import { useState } from 'react'

const STEPS = [
  'Download transparent.webm from PetCut.',
  'Open the Pet Gatekeeper options page.',
  'Under "Custom Pet Video", click "Upload video".',
  'Select your downloaded transparent.webm.',
  'The extension stores the video in chrome.storage.local.',
  'Your pet now appears on blocked sites instead of the default cat.',
]

export default function UsageGuide() {
  const [open, setOpen] = useState(false)

  return (
    <div id="how-to-use" className="border border-gray-200 rounded-xl overflow-hidden max-w-xl mx-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>How to use in Pet Gatekeeper</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ol className="px-5 pb-5 space-y-2 text-sm text-gray-600">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
