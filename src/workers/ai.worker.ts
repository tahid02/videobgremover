import { expose } from 'comlink'
import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers'
import { resumableDownload } from '../lib/resumableDownload'

env.allowLocalModels = false
env.useBrowserCache = true

const MODEL_ID = 'briaai/RMBG-2.0'

type ProgressCallback = (event: {
  stage: 'model-download'
  percent: number
  mbLoaded: number
  mbTotal: number
}) => void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null

const worker = {
  async loadModel(token: string, onProgress: ProgressCallback): Promise<void> {
    // Override env.fetch:
    // - ONNX files (.onnx) → resumable download via IndexedDB (saves every 20 MB)
    // - All other HF files → standard fetch with auth header
    env.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (!url.includes('huggingface.co')) return fetch(input, init)

      if (url.endsWith('.onnx')) {
        return resumableDownload(url, token, (loaded, total) => {
          if (total > 0) {
            onProgress({
              stage: 'model-download',
              percent: Math.round((loaded / total) * 100),
              mbLoaded: loaded / 1_000_000,
              mbTotal: total / 1_000_000,
            })
          }
        })
      }

      // Config files, tokenizers, etc. — just add auth header
      const headers = new Headers(init.headers)
      headers.set('Authorization', `Bearer ${token}`)
      return fetch(input, { ...init, headers })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const progressCallback = (info: any) => {
      if (info.status === 'progress' && info.total) {
        onProgress({
          stage: 'model-download',
          percent: info.progress ?? 0,
          mbLoaded: (info.loaded ?? 0) / 1_000_000,
          mbTotal: (info.total ?? 0) / 1_000_000,
        })
      }
    }

    // RMBG-2.0 uses model_type: null in config — must use AutoModel with model_type: 'custom'
    // to bypass the unsupported-type check in the pipeline API
    model = await AutoModel.from_pretrained(MODEL_ID, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { model_type: 'custom' } as any,
      device: 'webgpu',
      dtype: 'fp32',
      progress_callback: progressCallback,
    })

    processor = await AutoProcessor.from_pretrained(MODEL_ID, {
      config: {
        do_normalize: true,
        do_pad: false,
        do_rescale: true,
        do_resize: true,
        image_mean: [0.5, 0.5, 0.5],
        image_std: [0.5, 0.5, 0.5],
        resample: 2,
        rescale_factor: 0.00392156862745098,
        size: { width: 1024, height: 1024 },
      },
      progress_callback: progressCallback,
    })
  },

  async processFrame(input: {
    data: Uint8ClampedArray
    width: number
    height: number
  }): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
    if (!model || !processor) throw new Error('Model not loaded')

    const raw = new RawImage(new Uint8ClampedArray(input.data), input.width, input.height, 4)

    const { pixel_values } = await processor(raw)
    const result = await model({ input: pixel_values })

    // BiRefNet output is the first tensor — shape [1, 1, H, W]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outputTensor = (Object.values(result)[0] as any)
    // Squeeze batch + channel dims → [H, W], scale 0–1 → 0–255
    const maskTensor = outputTensor.squeeze(0).squeeze(0).mul(255).clamp(0, 255).to('uint8')
    const maskH: number = maskTensor.dims[0]
    const maskW: number = maskTensor.dims[1]

    // Build RawImage from mask and resize back to original frame size
    const maskRaw = new RawImage(maskTensor.data as Uint8Array, maskW, maskH, 1)
    const resized = await maskRaw.resize(input.width, input.height)

    const output = new Uint8ClampedArray(input.data)
    for (let i = 0; i < resized.data.length; i++) {
      output[i * 4 + 3] = resized.data[i] as number
    }
    return { data: output, width: input.width, height: input.height }
  },
}

expose(worker)

export type AIWorker = typeof worker
