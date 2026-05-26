import { useRef, useState, DragEvent, ChangeEvent } from 'react'

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo']
const MAX_SIZE_MB = 200

interface Props {
  onFile: (file: File) => void
}

export default function DropZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  function handleFile(file: File) {
    setWarning(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setWarning('Unsupported format. Please upload an MP4, MOV, WEBM, or AVI file.')
      return
    }
    const sizeMb = file.size / 1_000_000
    if (sizeMb > MAX_SIZE_MB) {
      setWarning(`File is ${sizeMb.toFixed(0)} MB. Large files may be slow to process — continuing anyway.`)
    }
    onFile(file)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        }`}
      >
        <div className="text-5xl mb-4">🎬</div>
        <p className="text-xl font-semibold text-gray-700 mb-2">
          Drop your pet video here
        </p>
        <p className="text-gray-500 mb-1">or click to browse</p>
        <p className="text-sm text-gray-400 mt-4">
          Accepted: MP4, MOV, WEBM, AVI · Max 200 MB
        </p>
        <p className="text-xs text-gray-400 mt-1">
          First run downloads a ~50 MB AI model. Cached after that.
        </p>
      </div>
      {warning && (
        <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 max-w-2xl">
          {warning}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  )
}
