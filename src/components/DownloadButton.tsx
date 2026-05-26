import { useMemo, useEffect } from 'react'

interface Props {
  blob: Blob
  sizeMb: number
}

export default function DownloadButton({ blob, sizeMb }: Props) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob])

  useEffect(() => {
    return () => URL.revokeObjectURL(url)
  }, [url])

  return (
    <a
      href={url}
      download="transparent.webm"
      className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
    >
      Download transparent.webm
      <span className="ml-2 text-blue-200 text-sm font-normal">
        ({sizeMb.toFixed(1)} MB)
      </span>
    </a>
  )
}
