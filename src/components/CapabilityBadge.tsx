import type { Capability } from '../types'

const LABELS: Record<Capability, { text: string; className: string }> = {
  'webgpu-fp16': {
    text: 'GPU accelerated ⚡ (fastest)',
    className: 'bg-green-100 text-green-800 border-green-300',
  },
  webgpu: {
    text: 'GPU accelerated ⚡',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  wasm: {
    text: 'CPU mode — processing will be slower',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  },
}

interface Props {
  capability: Capability
}

export default function CapabilityBadge({ capability }: Props) {
  const { text, className } = LABELS[capability]
  return (
    <span className={`inline-block text-sm font-medium px-3 py-1 rounded-full border ${className}`}>
      {text}
    </span>
  )
}
