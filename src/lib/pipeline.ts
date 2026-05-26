import { wrap, proxy } from 'comlink'
import type { Remote } from 'comlink'
import type { AIWorker } from '../workers/ai.worker'
import type { Capability, PipelineProgressEvent } from '../types'
import { extractFrames } from './frameExtractor'
import { formatBytes } from './formatters'
import { initEncoder, writeEncoderFrame, encodeVideo, resetEncoder } from './encoder'

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
    // Audio not critical — silently ignore if blocked
  }
}

const CHUNK_SIZE = 30
const FPS = 30

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
    workers = {
      ai: wrap<AIWorker>(aiWorkerInstance),
    }
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

  // Load AI model
  await ai.loadModel(
    hfToken,
    proxy((event: PipelineProgressEvent) => {
      if (event.stage === 'model-download') {
        onProgress(event)
      }
    }),
  )

  if (signal.aborted) throw new CancelError()

  // Initialise ffmpeg encoder on main thread (avoids nested-Worker FS issue)
  await initEncoder()

  if (signal.aborted) throw new CancelError()

  // Determine video dimensions
  const video = document.createElement('video')
  video.preload = 'auto'
  video.src = URL.createObjectURL(file)
  await new Promise<void>((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true })
    video.addEventListener('error', () => reject(new Error('Cannot read video')), { once: true })
  })
  const { videoWidth: width, videoHeight: height, duration } = video
  URL.revokeObjectURL(video.src)

  const totalFrames = Math.ceil(duration * FPS)

  // Scratch canvas for JPEG preview generation
  const scratch = document.createElement('canvas')
  scratch.width = 320
  scratch.height = Math.round((height / width) * 320)
  const scratchCtx = scratch.getContext('2d')!

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

      // Draw processed frame to temp canvas, then scale to preview size
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = imageData.width
      tempCanvas.height = imageData.height
      const tempCtx = tempCanvas.getContext('2d')!
      tempCtx.putImageData(
        new ImageData(new Uint8ClampedArray(processed.data), processed.width, processed.height),
        0,
        0,
      )
      scratchCtx.drawImage(tempCanvas, 0, 0, scratch.width, scratch.height)
      const previewDataUrl = scratch.toDataURL('image/jpeg', 0.5)

      onProgress({
        stage: 'process',
        frame: index + 1,
        total: totalFrames,
        previewDataUrl,
      })

      // Write raw RGBA directly to ffmpeg FS (main thread → ffmpeg internal worker)
      await writeEncoderFrame(new Uint8Array(processed.data.buffer), index)
    }
    chunk = []
  }

  for await (const imageData of extractFrames(file, FPS, onPaused, onResumed)) {
    if (signal.aborted) throw new CancelError()

    onProgress({ stage: 'extract', frame: frameIndex + 1, total: totalFrames })
    chunk.push({ imageData, index: frameIndex })
    frameIndex++

    if (chunk.length >= CHUNK_SIZE) {
      await flushChunk()
    }
  }

  if (chunk.length > 0) {
    await flushChunk()
  }

  if (signal.aborted) throw new CancelError()

  playAssembleAlert()
  onProgress({ stage: 'assemble', percent: 0 })

  const blob = await encodeVideo(FPS, width, height, (percent: number) => {
    onProgress({ stage: 'assemble', percent })
  })

  const durationSec = duration
  const sizeMb = blob.size / 1_000_000
  onProgress({ stage: 'done', blob, durationSec, sizeMb })

  return blob
}

// Keep formatBytes accessible if needed elsewhere
export { formatBytes }
