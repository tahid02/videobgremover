import { useEffect, useMemo } from 'react'

interface Props {
  blob: Blob
}

export default function TransparentVideoPreview({ blob }: Props) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob])

  useEffect(() => {
    return () => URL.revokeObjectURL(url)
  }, [url])

  return (
    <div className="checkered rounded-xl overflow-hidden max-w-xl mx-auto">
      <video
        src={url}
        autoPlay
        loop
        muted
        playsInline
        className="w-full"
      />
    </div>
  )
}
