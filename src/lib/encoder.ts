import { Muxer, ArrayBufferTarget } from 'webm-muxer'

let muxer: Muxer<ArrayBufferTarget> | null = null
let videoEncoder: VideoEncoder | null = null
let encoderError: Error | null = null
let encFps = 30
let encWidth = 0
let encHeight = 0

export async function initEncoder(fps: number, width: number, height: number): Promise<void> {
  encFps = fps
  encWidth = width
  encHeight = encHeight = height
  encoderError = null

  // Probe VP8 + alpha support. VP8 alpha in WebM is the most battle-tested
  // transparent video path in Chrome; fall back to VP9 without alpha if unavailable.
  let useAlpha = false
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const check = await VideoEncoder.isConfigSupported({ codec: 'vp8', width, height, bitrate: 1_000_000, alpha: 'keep' } as any)
    useAlpha = check.supported === true
  } catch { /* browser doesn't support alpha probe */ }

  const target = new ArrayBufferTarget()
  muxer = new Muxer({
    target,
    video: {
      codec: useAlpha ? 'V_VP8' : 'V_VP9',
      width,
      height,
      frameRate: fps,
      alpha: useAlpha,
    },
    firstTimestampBehavior: 'offset',
  })

  videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer!.addVideoChunk(chunk, meta),
    error: (e) => { encoderError = e as Error },
  })

  if (useAlpha) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    videoEncoder.configure({ codec: 'vp8', width, height, bitrate: 2_000_000, alpha: 'keep' } as any)
  } else {
    videoEncoder.configure({ codec: 'vp09.00.10.08', width, height, bitrate: 2_000_000 })
  }

  // Allow one microtask for the async error callback to fire if configure rejected
  await Promise.resolve()
  if (encoderError) throw new Error(`VideoEncoder configure failed: ${(encoderError as Error).message}`)
}

export function storeFrame(data: Uint8Array, index: number): void {
  if (encoderError) throw encoderError
  if (!videoEncoder) throw new Error('Encoder not initialized')
  const timestamp = Math.round((index / encFps) * 1_000_000)
  const frame = new VideoFrame(data, {
    format: 'RGBA',
    codedWidth: encWidth,
    codedHeight: encHeight,
    timestamp,
  })
  videoEncoder.encode(frame, { keyFrame: index % 30 === 0 })
  frame.close()
}

export async function encodeVideo(
  _fps: number,
  _width: number,
  _height: number,
  onProgress: (percent: number) => void,
): Promise<Blob> {
  if (!videoEncoder || !muxer) throw new Error('Encoder not initialized')
  if (encoderError) throw encoderError
  onProgress(10)
  await videoEncoder.flush()
  if (encoderError) throw encoderError
  onProgress(90)
  muxer.finalize()
  onProgress(100)
  const { buffer } = muxer.target as ArrayBufferTarget
  return new Blob([buffer], { type: 'video/webm' })
}

export function resetEncoder(): void {
  try { videoEncoder?.close() } catch { /* already closed */ }
  videoEncoder = null
  muxer = null
  encoderError = null
}
