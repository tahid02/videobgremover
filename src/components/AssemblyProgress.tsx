interface Props {
  percent: number
  tabWarning: boolean
}

export default function AssemblyProgress({ percent, tabWarning }: Props) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Assembling video...</span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>
      {tabWarning && (
        <div className="rounded-lg border border-red-500 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 animate-pulse">
          ⚠ Please return to this tab — leaving may corrupt your video.
        </div>
      )}
    </div>
  )
}
