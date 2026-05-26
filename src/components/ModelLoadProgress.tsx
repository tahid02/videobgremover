interface Props {
  percent: number
  mb: string
}

export default function ModelLoadProgress({ percent, mb }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-gray-600">
        <span>Downloading AI model...</span>
        <span>{mb}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">
        Model is cached after the first download (~50 MB)
      </p>
    </div>
  )
}
