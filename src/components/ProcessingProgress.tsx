import { useEffect, useRef } from 'react'

interface Props {
  frame: number
  total: number
  previewUrl: string
  eta: string
}

export default function ProcessingProgress({ frame, total, previewUrl, eta }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const percent = total > 0 ? Math.round((frame / total) * 100) : 0

  useEffect(() => {
    if (!previewUrl || !canvasRef.current) return
    const img = new Image()
    img.onload = () => {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
    img.src = previewUrl
  }, [previewUrl])

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Removing background from frame {frame} of {total}...</span>
          {eta && <span className="text-gray-400">{eta}</span>}
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-right">{percent}%</p>
      </div>

      {previewUrl && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Live preview</p>
          <div className="checkered rounded-lg overflow-hidden max-w-sm">
            <canvas
              ref={canvasRef}
              width={320}
              height={180}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  )
}
