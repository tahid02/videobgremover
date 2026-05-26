import type { PipelineState } from '../types'

const STEPS = ['Upload', 'Model', 'Extract', 'Process', 'Assemble', 'Done'] as const

function activeStep(status: PipelineState['status']): number {
  switch (status) {
    case 'idle': return 0
    case 'capability-check':
    case 'model-loading': return 1
    case 'extracting':
    case 'paused': return 2
    case 'processing': return 3
    case 'assembling': return 4
    case 'done': return 5
    case 'error': return -1
  }
}

interface Props {
  state: PipelineState
}

export default function StepIndicator({ state }: Props) {
  const current = activeStep(state.status)

  return (
    <div className="flex items-center justify-between">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${
                  done
                    ? 'bg-green-500 border-green-500 text-white'
                    : active
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className={`text-xs mt-1 ${
                  active ? 'text-blue-600 font-medium' : done ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-5 ${done ? 'bg-green-400' : 'bg-gray-200'}`}
                style={{ minWidth: '20px' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
