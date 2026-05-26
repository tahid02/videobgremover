import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null
let isLoaded = false

async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpeg) ffmpeg = new FFmpeg()
  if (!isLoaded) {
    const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    isLoaded = true
  }
  return ffmpeg
}

export async function initEncoder(): Promise<void> {
  await getFFmpeg()
}

export async function writeEncoderFrame(data: Uint8Array, index: number): Promise<void> {
  const f = await getFFmpeg()
  await f.writeFile(`frame${String(index).padStart(5, '0')}.rgba`, data)
}

export async function encodeVideo(
  fps: number,
  width: number,
  height: number,
  onProgress: (percent: number) => void,
): Promise<Blob> {
  const f = await getFFmpeg()
  const logs: string[] = []
  const logHandler = ({ message }: { message: string }) => { logs.push(message) }
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress(Math.round(progress * 100))
  }
  f.on('log', logHandler)
  f.on('progress', progressHandler)
  try {
    const ret = await f.exec([
      '-f', 'rawvideo',
      '-pixel_format', 'rgba',
      '-video_size', `${width}x${height}`,
      '-framerate', String(fps),
      '-i', 'frame%05d.rgba',
      '-c:v', 'libvpx-vp9',
      '-pix_fmt', 'yuva420p',
      '-b:v', '0',
      '-crf', '30',
      '-auto-alt-ref', '0',
      '-threads', '1',
      'output.webm',
    ])
    if (ret !== 0) {
      throw new Error(`FFmpeg VP9 encode failed (exit ${ret})\n${logs.slice(-15).join('\n')}`)
    }
    const data = await f.readFile('output.webm')
    const bytes = typeof data === 'string'
      ? new TextEncoder().encode(data)
      : (data as unknown as Uint8Array)
    return new Blob([bytes.buffer as ArrayBuffer], { type: 'video/webm' })
  } finally {
    f.off('log', logHandler)
    f.off('progress', progressHandler)
  }
}

export function resetEncoder(): void {
  ffmpeg = null
  isLoaded = false
}
