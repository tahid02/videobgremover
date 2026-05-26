export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const mb = bytes / 1_000_000
  return mb < 1 ? `${(bytes / 1000).toFixed(0)} KB` : `${mb.toFixed(1)} MB`
}

export function formatEta(framesLeft: number, framesPerSec: number): string {
  if (framesPerSec <= 0 || framesLeft <= 0) return ''
  const totalSec = Math.ceil(framesLeft / framesPerSec)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `~${sec}s remaining`
  if (sec === 0) return `~${min}m remaining`
  return `~${min}m ${sec}s remaining`
}
