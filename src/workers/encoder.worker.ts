import { expose } from 'comlink'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const ffmpeg = new FFmpeg()
let initialized = false

const worker = {
  async init(): Promise<void> {
    if (initialized) return
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    initialized = true
  },

  async writeFrames(
    frames: { data: Uint8Array; index: number }[],
  ): Promise<void> {
    for (const frame of frames) {
      const name = `frame${String(frame.index).padStart(5, '0')}.rgba`
      await ffmpeg.writeFile(name, frame.data)
    }
  },

  async encode(
    fps: number,
    width: number,
    height: number,
    onProgress: (percent: number) => void,
  ): Promise<Blob> {
    const logs: string[] = []
    const logHandler = ({ message }: { message: string }) => {
      logs.push(message)
    }
    const progressHandler = ({ progress }: { progress: number }) => {
      onProgress(Math.round(progress * 100))
    }
    ffmpeg.on('log', logHandler)
    ffmpeg.on('progress', progressHandler)

    try {
      const ret = await ffmpeg.exec([
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
        const tail = logs.slice(-15).join('\n')
        throw new Error(`FFmpeg VP9 encode failed (exit ${ret})\n${tail}`)
      }

      const data = await ffmpeg.readFile('output.webm')
      const bytes: Uint8Array =
        typeof data === 'string'
          ? new TextEncoder().encode(data)
          : (data as unknown as Uint8Array)
      return new Blob([bytes.buffer as ArrayBuffer], { type: 'video/webm' })
    } finally {
      ffmpeg.off('log', logHandler)
      ffmpeg.off('progress', progressHandler)
    }
  },
}

expose(worker)

export type EncoderWorker = typeof worker
