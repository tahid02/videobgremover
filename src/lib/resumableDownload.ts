import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'hf-resume-v1'
const CHUNKS = 'chunks'
const META = 'meta'
const CHUNK_SIZE = 20 * 1024 * 1024 // 20 MB per chunk

interface DownloadMeta {
  total: number
  contentType: string
  chunksStored: number
}

async function openDB_(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(CHUNKS)
      db.createObjectStore(META)
    },
  })
}

function chunkKey(url: string, i: number) {
  return `${url}#${i}`
}

function mergeToUint8(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) { out.set(p, offset); offset += p.byteLength }
  return out
}

async function reassemble(
  db: IDBPDatabase,
  url: string,
  meta: DownloadMeta,
): Promise<ArrayBuffer> {
  const parts: Uint8Array[] = []
  for (let i = 0; i < meta.chunksStored; i++) {
    const chunk: Uint8Array = await db.get(CHUNKS, chunkKey(url, i))
    if (!chunk) throw new Error(`Resume chunk ${i} missing — download may be corrupt`)
    parts.push(chunk)
  }
  return mergeToUint8(parts).buffer as ArrayBuffer
}

export async function resumableDownload(
  url: string,
  token: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Response> {
  const db = await openDB_()
  const meta: DownloadMeta | undefined = await db.get(META, url)

  // Return immediately if we already have a complete download stored
  if (meta && meta.total > 0) {
    const fullChunks = Math.ceil(meta.total / CHUNK_SIZE)
    if (meta.chunksStored >= fullChunks) {
      onProgress?.(meta.total, meta.total)
      const buffer = await reassemble(db, url, meta)
      return new Response(buffer, { headers: { 'Content-Type': meta.contentType } })
    }
  }

  // Resume from last saved chunk boundary
  const resumeFrom = meta ? meta.chunksStored * CHUNK_SIZE : 0

  const reqHeaders: HeadersInit = { Authorization: `Bearer ${token}` }
  if (resumeFrom > 0) reqHeaders['Range'] = `bytes=${resumeFrom}-`

  const response = await fetch(url, { headers: reqHeaders })
  if (!response.ok && response.status !== 206) {
    throw new Error(`HTTP ${response.status} while downloading model`)
  }

  // Determine total size from Content-Range (resume) or Content-Length (fresh)
  const contentType = response.headers.get('Content-Type') ?? 'application/octet-stream'
  let total = meta?.total ?? 0
  const contentRange = response.headers.get('Content-Range')
  if (contentRange) {
    total = parseInt(contentRange.split('/')[1])
  } else {
    const cl = response.headers.get('Content-Length')
    if (cl) total = resumeFrom + parseInt(cl)
  }

  const cur: DownloadMeta = {
    total,
    contentType,
    chunksStored: meta?.chunksStored ?? 0,
  }

  const reader = response.body!.getReader()
  let pending: Uint8Array[] = []
  let pendingSize = 0
  let received = resumeFrom

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    pending.push(value)
    pendingSize += value.byteLength
    received += value.byteLength
    onProgress?.(received, total)

    if (pendingSize >= CHUNK_SIZE) {
      const merged = mergeToUint8(pending)
      // Save exactly one CHUNK_SIZE slice; carry overflow to next chunk
      await db.put(CHUNKS, merged.slice(0, CHUNK_SIZE), chunkKey(url, cur.chunksStored))
      cur.chunksStored++
      await db.put(META, { ...cur }, url)

      const overflow = merged.slice(CHUNK_SIZE)
      pending = overflow.byteLength > 0 ? [overflow] : []
      pendingSize = overflow.byteLength
    }
  }

  // Save final (possibly partial) chunk
  if (pendingSize > 0) {
    await db.put(CHUNKS, mergeToUint8(pending), chunkKey(url, cur.chunksStored))
    cur.chunksStored++
    await db.put(META, { ...cur }, url)
  }

  const finalBuffer = await reassemble(db, url, cur)
  return new Response(finalBuffer, { headers: { 'Content-Type': contentType } })
}

export async function clearResumeCache(): Promise<void> {
  const db = await openDB_()
  await db.clear(CHUNKS)
  await db.clear(META)
}
