import { expose } from 'comlink'
import { removeBackground } from '@imgly/background-removal'

type ProgressCallback = (event: {
  stage: 'model-download'
  percent: number
  mbLoaded: number
  mbTotal: number
}) => void

// isnet_fp16 = half-precision ISNet — good balance of speed and quality
const BASE_CONFIG = {
  model: 'isnet_fp16' as const,
  output: {
    format: 'image/png' as const,
    quality: 1.0,
  },
}

const worker = {
  async loadModel(onProgress: ProgressCallback): Promise<void> {
    // Process a tiny image to trigger model download + cache it in memory
    const canvas = new OffscreenCanvas(64, 64)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#888'
    ctx.fillRect(0, 0, 64, 64)
    const blob = await canvas.convertToBlob({ type: 'image/png' })

    await removeBackground(blob, {
      ...BASE_CONFIG,
      progress: (_key: string, current: number, total: number) => {
        if (total > 0) {
          onProgress({
            stage: 'model-download',
            percent: Math.round((current / total) * 100),
            mbLoaded: current / 1_000_000,
            mbTotal: total / 1_000_000,
          })
        }
      },
    })
  },

  async processFrame(input: {
    data: Uint8ClampedArray
    width: number
    height: number
  }): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
    // Copy data to ensure a plain ArrayBuffer (avoids SharedArrayBuffer TS mismatch)
    const safeData = new Uint8ClampedArray(input.data)

    // ImageData → OffscreenCanvas → PNG Blob
    const inputCanvas = new OffscreenCanvas(input.width, input.height)
    const inputCtx = inputCanvas.getContext('2d')!
    inputCtx.putImageData(new ImageData(safeData, input.width, input.height), 0, 0)
    const inputBlob = await inputCanvas.convertToBlob({ type: 'image/png' })

    // Remove background (model already in memory after loadModel warm-up)
    const resultBlob = await removeBackground(inputBlob, BASE_CONFIG)

    // Result PNG Blob → ImageData
    const bitmap = await createImageBitmap(resultBlob)
    const resultCanvas = new OffscreenCanvas(input.width, input.height)
    const resultCtx = resultCanvas.getContext('2d')!
    resultCtx.drawImage(bitmap, 0, 0, input.width, input.height)
    bitmap.close()
    const { data } = resultCtx.getImageData(0, 0, input.width, input.height)

    return { data, width: input.width, height: input.height }
  },
}

expose(worker)

export type AIWorker = typeof worker
