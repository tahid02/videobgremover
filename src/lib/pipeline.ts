import { wrap, proxy } from 'comlink'
import type { Remote } from 'comlink'
import type { AIWorker } from '../workers/ai.worker'
import type { Capability, PipelineProgressEvent } from '../types'
import { extractFrames } from './frameExtractor'
import { formatBytes } from './formatters'
import { initEncoder, storeFrame, encodeVideo, resetEncoder } from './encoder'

export class CancelError extends Error {
  constructor() {
    super('Cancelled')
    this.name = 'CancelError'
  }
}

export function playAssembleAlert(): void {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    ctx.resume().then(() => {
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.6)
    })
  } catch {
    // Audio not critical
  }
}

const CHUNK_SIZE = 30
const FPS = 30
const MAX_LONG_SIDE = 1280

interface Workers {
  ai: Remote<AIWorker>
}

let workers: Workers | null = null

export function getWorkers(): Workers {
  if (!workers) {
    const aiWorkerInstance = new Worker(
      new URL('../workers/ai.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workers = { ai: wrap<AIWorker>(aiWorkerInstance) }
  }
  return workers
}

export function terminateWorkers(): void {
  workers = null
  resetEncoder()
}

export async function runPipeline(
  file: File,
  _capability: Capability,
  hfToken: string,
  onProgress: (event: PipelineProgressEvent) => void,
  onPaused: () => void,
  onResumed: () => void,
  signal: AbortSignal,
): Promise<Blob> {
  const { ai } = getWorkers()

  await ai.loadModel(
    hfToken,
    proxy((event: PipelineProgressEvent) => {
      if (event.stage === 'model-download') onProgress(event)
    }),
  )

  if (signal.aborted) throw new CancelError()

  // Get video dimensions first — initEncoder needs them
  const video = document.createElement('video')
  video.preload = 'auto'
  video.src = URL.createObjectURL(file)
  await new Promise<void>((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true })
    video.addEventListener('error', () => reject(new Error('Cannot read video')), { once: true })
  })
  const { videoWidth: width, videoHeight: height, duration } = video
  URL.revokeObjectURL(video.src)

  // Cap long side to 1280 so encoding canvas stays manageable
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(width, height))
  const encWidth = Math.max(2, Math.round(width * scale / 2) * 2)
  const encHeight = Math.max(2, Math.round(height * scale / 2) * 2)

  await initEncoder(FPS, encWidth, encHeight)

  if (signal.aborted) throw new CancelError()

  const totalFrames = Math.ceil(duration * FPS)

  // Preview canvas (320 px wide)
  const previewCanvas = document.createElement('canvas')
  previewCanvas.width = 320
  previewCanvas.height = Math.round((height / width) * 320)
  const previewCtx = previewCanvas.getContext('2d')!

  // Encoding canvas at capped resolution
  const encCanvas = document.createElement('canvas')
  encCanvas.width = encWidth
  encCanvas.height = encHeight
  const encCtx = encCanvas.getContext('2d')!

  let frameIndex = 0
  let chunk: { imageData: ImageData; index: number }[] = []

  async function flushChunk() {
    for (const { imageData, index } of chunk) {
      if (signal.aborted) throw new CancelError()

      const processed = await ai.processFrame({
        data: imageData.data,
        width: imageData.width,
        height: imageData.height,
      })

      // Full-res temp canvas for drawing the processed frame
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = imageData.width
      tempCanvas.height = imageData.height
      const tempCtx = tempCanvas.getContext('2d')!
      tempCtx.putImageData(
        new ImageData(new Uint8ClampedArray(processed.data), processed.width, processed.height),
        0, 0,
      )

      // Thumbnail for UI preview (JPEG, small)
      previewCtx.drawImage(tempCanvas, 0, 0, previewCanvas.width, previewCanvas.height)
      const previewDataUrl = previewCanvas.toDataURL('image/jpeg', 0.5)
      onProgress({ stage: 'process', frame: index + 1, total: totalFrames, previewDataUrl })

      // Downscale to encoding resolution and feed to VideoEncoder
      encCtx.drawImage(tempCanvas, 0, 0, encWidth, encHeight)
      const encPixels = encCtx.getImageData(0, 0, encWidth, encHeight)
      storeFrame(new Uint8Array(encPixels.data.buffer), index)
    }
    chunk = []
  }

  for await (const imageData of extractFrames(file, FPS, onPaused, onResumed)) {
    if (signal.aborted) throw new CancelError()

    onProgress({ stage: 'extract', frame: frameIndex + 1, total: totalFrames })
    chunk.push({ imageData, index: frameIndex })
    frameIndex++

    if (chunk.length >= CHUNK_SIZE) await flushChunk()
  }

  if (chunk.length > 0) await flushChunk()

  if (signal.aborted) throw new CancelError()

  playAssembleAlert()
  onProgress({ stage: 'assemble', percent: 0 })

  const blob = await encodeVideo(FPS, encWidth, encHeight, (percent: number) => {
    onProgress({ stage: 'assemble', percent })
  })

  onProgress({ stage: 'done', blob, durationSec: duration, sizeMb: blob.size / 1_000_000 })

  return blob
}

export { formatBytes }
