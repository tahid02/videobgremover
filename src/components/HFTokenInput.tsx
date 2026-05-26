import { useState } from 'react'

const STORAGE_KEY = 'hf_token'

interface Props {
  onConfirm: (token: string) => void
}

export function loadStoredToken(): string {
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

export default function HFTokenInput({ onConfirm }: Props) {
  const [token, setToken] = useState(loadStoredToken)
  const [show, setShow] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = token.trim()
    if (!t) return
    localStorage.setItem(STORAGE_KEY, t)
    onConfirm(t)
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className="border border-amber-300 bg-amber-50 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-amber-900 mb-1">
            HuggingFace access token required
          </h2>
          <p className="text-sm text-amber-800">
            The AI model (RMBG-1.4) requires a free HuggingFace account and a read token.
            Your token is stored locally in this browser only — never sent anywhere except HuggingFace.
            After the first download (~90 MB) the model is cached, so you won't be prompted again.
          </p>
        </div>

        <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
          <li>
            Create a free account at{' '}
            <a href="https://huggingface.co/join" target="_blank" rel="noreferrer" className="underline">
              huggingface.co/join
            </a>
          </li>
          <li>
            Accept the model license at{' '}
            <a href="https://huggingface.co/briaai/RMBG-1.4" target="_blank" rel="noreferrer" className="underline">
              huggingface.co/briaai/RMBG-1.4
            </a>
          </li>
          <li>
            Create a read token at{' '}
            <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="underline">
              huggingface.co/settings/tokens
            </a>
          </li>
        </ol>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="hf_..."
              className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 pr-20"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-amber-700 hover:text-amber-900"
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          <button
            type="submit"
            disabled={!token.trim()}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            Start processing
          </button>
        </form>
      </div>
    </div>
  )
}
