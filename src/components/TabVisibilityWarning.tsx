interface Props {
  phase: 'extracting' | 'processing' | 'assembling'
  tabVisible: boolean
}

type BannerConfig = {
  text: string
  className: string
}

function getBanner(phase: Props['phase'], tabVisible: boolean): BannerConfig {
  if (phase === 'extracting' && tabVisible) {
    return {
      text: 'You can switch tabs during processing — a sound will play when assembly starts. Return immediately when you hear it.',
      className: 'bg-blue-50 border-blue-300 text-blue-800',
    }
  }
  if (phase === 'extracting' && !tabVisible) {
    return {
      text: 'Paused — return to this tab to continue processing.',
      className: 'bg-yellow-50 border-yellow-400 text-yellow-800',
    }
  }
  if (phase === 'processing') {
    return {
      text: 'Processing in background — come back when you hear the sound.',
      className: 'bg-blue-50 border-blue-300 text-blue-800',
    }
  }
  if (phase === 'assembling' && tabVisible) {
    return {
      text: 'Assembling your video — stay on this tab!',
      className: 'bg-yellow-50 border-yellow-400 text-yellow-800',
    }
  }
  // assembling + tab hidden
  return {
    text: '⚠ Please return immediately — leaving may corrupt your video.',
    className: 'bg-red-50 border-red-500 text-red-800 animate-pulse',
  }
}

export default function TabVisibilityWarning({ phase, tabVisible }: Props) {
  const { text, className } = getBanner(phase, tabVisible)
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${className}`}>
      {text}
    </div>
  )
}
