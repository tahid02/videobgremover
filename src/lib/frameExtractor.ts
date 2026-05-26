const MAX_FPS = 30

async function waitForVisible(): Promise<void> {
  if (document.visibilityState === 'visible') return
  await new Promise<void>((resolve) => {
    document.addEventListener('visibilitychange', function handler() {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', handler)
        resolve()
      }
    })
  })
}

export async function* extractFrames(
  file: File,
  fps: number,
  onPaused: () => void,
  onResumed: () => void,
): AsyncGenerator<ImageData> {
  const cappedFps = Math.min(fps, MAX_FPS)
  const frameInterval = 1 / cappedFps

  const video = document.createElement('video')
  video.preload = 'auto'
  video.src = URL.createObjectURL(file)

  await new Promise<void>((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true })
    video.addEventListener('error', () => reject(new Error('Failed to load video metadata')), { once: true })
  })

  const { videoWidth: w, videoHeight: h, duration } = video

  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!

  let paused = false

  for (let t = 0; t < duration; t += frameInterval) {
    const wasVisible = document.visibilityState === 'visible'
    await waitForVisible()

    if (!wasVisible && document.visibilityState === 'visible') {
      if (paused) {
        paused = false
        onResumed()
      }
    } else if (document.visibilityState === 'hidden' && !paused) {
      paused = true
      onPaused()
      await waitForVisible()
      paused = false
      onResumed()
    }

    // Register listener before assigning currentTime to avoid seek race
    const seeked = new Promise<void>((r) =>
      video.addEventListener('seeked', () => r(), { once: true }),
    )
    video.currentTime = t
    await seeked

    ctx.drawImage(video, 0, 0)
    yield ctx.getImageData(0, 0, w, h)
  }

  URL.revokeObjectURL(video.src)
}

export function estimateFrameCount(duration: number, fps: number): number {
  return Math.ceil(duration * Math.min(fps, MAX_FPS))
}
