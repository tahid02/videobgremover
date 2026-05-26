import { Muxer, ArrayBufferTarget } from 'webm-muxer'

let muxer: Muxer<ArrayBufferTarget> | null = null
let videoEncoder: VideoEncoder | null = null
let encFps = 30
let encWidth = 0
let encHeight = 0

export async function initEncoder(fps: number, width: number, height: number): Promise<void> {
  encFps = fps
  encWidth = width
  encHeight = height

  const target = new ArrayBufferTarget()
  muxer = new Muxer({
    target,
    video: { codec: 'V_VP9', width, height, frameRate: fps },
    firstTimestampBehavior: 'offset',
  })

  videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer!.addVideoChunk(chunk, meta),
    error: (e) => { throw e },
  })

  videoEncoder.configure({
    codec: 'vp09.00.10.08',
    width,
    height,
    bitrate: 2_000_000,
    alpha: 'keep',
    latencyMode: 'quality',
  } as VideoEncoderConfig)
}

export function storeFrame(data: Uint8Array, index: number): void {
  if (!videoEncoder) throw new Error('Encoder not initialized')
  const timestamp = Math.round((index / encFps) * 1_000_000) // microseconds
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
  onProgress(10)
  await videoEncoder.flush()
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
}
