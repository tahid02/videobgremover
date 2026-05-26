import { expose } from 'comlink'
import { pipeline, env, RawImage } from '@huggingface/transformers'

env.allowLocalModels = false
env.useBrowserCache = true

type ProgressCallback = (event: {
  stage: 'model-download'
  percent: number
  mbLoaded: number
  mbTotal: number
}) => void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let segmenter: any = null

const worker = {
  async loadModel(onProgress: ProgressCallback): Promise<void> {
    segmenter = await pipeline('image-segmentation', 'briaai/RMBG-2.0', {
      device: 'webgpu',
      dtype: 'fp16',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (info: any) => {
        if (info.status === 'progress' && info.total) {
          onProgress({
            stage: 'model-download',
            percent: info.progress ?? 0,
            mbLoaded: (info.loaded ?? 0) / 1_000_000,
            mbTotal: (info.total ?? 0) / 1_000_000,
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
    if (!segmenter) throw new Error('Model not loaded')

    const raw = new RawImage(input.data, input.width, input.height, 4)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = await segmenter(raw)
    const mask = result[0].mask as RawImage

    const output = new Uint8ClampedArray(input.data)
    for (let i = 0; i < mask.data.length; i++) {
      // RMBG-2.0 mask values are already 0–255 (uint8 RawImage), not 0.0–1.0
      output[i * 4 + 3] = mask.data[i] as number
    }
    return { data: output, width: input.width, height: input.height }
  },
}

expose(worker)

export type AIWorker = typeof worker
