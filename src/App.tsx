import Navbar from './components/Navbar'
import DropZone from './components/DropZone'
import StepIndicator from './components/StepIndicator'
import CapabilityBadge from './components/CapabilityBadge'
import TabVisibilityWarning from './components/TabVisibilityWarning'
import ModelLoadProgress from './components/ModelLoadProgress'
import ProcessingProgress from './components/ProcessingProgress'
import AssemblyProgress from './components/AssemblyProgress'
import CancelButton from './components/CancelButton'
import TransparentVideoPreview from './components/TransparentVideoPreview'
import DownloadButton from './components/DownloadButton'
import UsageGuide from './components/UsageGuide'
import { usePipeline } from './hooks/usePipeline'
import { detectCapability } from './lib/capability'
import { useState, useEffect } from 'react'
import type { Capability } from './types'

export default function App() {
  const { state, tabVisibility, start, cancel, reset } = usePipeline()
  const [capability, setCapability] = useState<Capability | null>(null)

  useEffect(() => {
    detectCapability().then(setCapability)
  }, [])

  const isProcessing =
    state.status !== 'idle' && state.status !== 'done' && state.status !== 'error'

  const pipelinePhase: 'extracting' | 'processing' | 'assembling' | null =
    state.status === 'extracting' || state.status === 'paused'
      ? 'extracting'
      : state.status === 'processing'
        ? 'processing'
        : state.status === 'assembling'
          ? 'assembling'
          : null

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 pb-16">
        {/* Hero */}
        <div className="py-10 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Remove your pet's video background.
          </h1>
          <p className="text-gray-500">
            Free. Private. In your browser. No upload. No account.{' '}
            {capability && <CapabilityBadge capability={capability} />}
          </p>
        </div>

        {/* Drop zone — shown only when idle */}
        {state.status === 'idle' && <DropZone onFile={start} />}

        {/* Pipeline panel — shown while processing */}
        {isProcessing && (
          <div className="space-y-6">
            <StepIndicator state={state} />

            {/* Tab visibility warning during active phases */}
            {pipelinePhase && (
              <TabVisibilityWarning
                phase={pipelinePhase}
                tabVisible={tabVisibility === 'visible'}
              />
            )}

            {/* Per-step progress UI */}
            {(state.status === 'capability-check') && (
              <p className="text-sm text-gray-500">Checking browser capabilities...</p>
            )}

            {state.status === 'model-loading' && (
              <ModelLoadProgress percent={state.percent} mb={state.mb} />
            )}

            {(state.status === 'extracting' || state.status === 'paused') && (
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  {state.status === 'paused'
                    ? `Paused at frame ${state.frame} of ${state.total}`
                    : `Extracting frame ${state.frame} of ${state.total}...`}
                </p>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all duration-200"
                    style={{ width: `${Math.round((state.frame / state.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {state.status === 'processing' && (
              <ProcessingProgress
                frame={state.frame}
                total={state.total}
                previewUrl={state.previewUrl}
                eta={state.eta}
              />
            )}

            {state.status === 'assembling' && (
              <AssemblyProgress percent={state.percent} tabWarning={state.tabWarning} />
            )}

            <CancelButton onCancel={cancel} />
          </div>
        )}

        {/* Result panel */}
        {state.status === 'done' && (
          <div className="space-y-8 text-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Done! 🎉</h2>
              <p className="text-sm text-gray-500">Your video is ready with a transparent background.</p>
            </div>

            <TransparentVideoPreview blob={state.blob} />

            <DownloadButton blob={state.blob} sizeMb={state.sizeMb} />

            <UsageGuide />

            <button
              onClick={reset}
              className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors block mx-auto"
            >
              Process another video
            </button>
          </div>
        )}

        {/* Error state */}
        {state.status === 'error' && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-6 py-5 text-center space-y-3">
            <p className="font-semibold text-red-800">Something went wrong</p>
            <p className="text-sm text-red-700">{state.message}</p>
            <button
              onClick={reset}
              className="text-sm text-red-600 underline hover:text-red-800"
            >
              Try again
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
