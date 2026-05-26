import { useState, useEffect, useRef } from 'react'
import type { PipelineState, PipelineProgressEvent } from '../types'
import { detectCapability } from '../lib/capability'
import { runPipeline, terminateWorkers, CancelError } from '../lib/pipeline'
import { useTabVisibility } from './useTabVisibility'

export function usePipeline() {
  const [state, setState] = useState<PipelineState>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)
  const tabVisibility = useTabVisibility()

  // Monitor tab visibility during assembly to set tabWarning
  useEffect(() => {
    if (state.status === 'assembling' && tabVisibility === 'hidden') {
      setState((s) =>
        s.status === 'assembling' ? { ...s, tabWarning: true } : s,
      )
    }
  }, [tabVisibility, state.status])

  async function start(file: File, hfToken: string) {
    abortRef.current = new AbortController()

    setState({ status: 'capability-check' })
    const capability = await detectCapability()

    setState({ status: 'model-loading', percent: 0, mb: '0 MB' })

    function onProgress(event: PipelineProgressEvent) {
      switch (event.stage) {
        case 'model-download':
          setState({
            status: 'model-loading',
            percent: event.percent,
            mb: `${event.mbLoaded.toFixed(1)} / ${event.mbTotal.toFixed(1)} MB`,
          })
          break

        case 'extract':
          setState({ status: 'extracting', frame: event.frame, total: event.total })
          break

        case 'process':
          setState({
            status: 'processing',
            frame: event.frame,
            total: event.total,
            previewUrl: event.previewDataUrl,
            eta: '',
          })
          break

        case 'assemble':
          setState((s) => ({
            status: 'assembling',
            percent: event.percent,
            tabWarning: s.status === 'assembling' ? s.tabWarning : false,
          }))
          break

        case 'done':
          setState({
            status: 'done',
            blob: event.blob,
            sizeMb: event.sizeMb,
          })
          break

        case 'error':
          setState({ status: 'error', message: event.message })
          break
      }
    }

    function onPaused() {
      setState((s) =>
        s.status === 'extracting' ? { status: 'paused', frame: s.frame, total: s.total } : s,
      )
    }

    function onResumed() {
      setState((s) =>
        s.status === 'paused' ? { status: 'extracting', frame: s.frame, total: s.total } : s,
      )
    }

    try {
      await runPipeline(
        file,
        capability,
        hfToken,
        onProgress,
        onPaused,
        onResumed,
        abortRef.current.signal,
      )
    } catch (e) {
      if (e instanceof CancelError) {
        setState({ status: 'idle' })
      } else {
        setState({
          status: 'error',
          message: (e as Error).message ?? 'An unexpected error occurred.',
        })
      }
    }
  }

  function cancel() {
    abortRef.current?.abort()
    setState({ status: 'idle' })
  }

  function reset() {
    abortRef.current?.abort()
    terminateWorkers()
    setState({ status: 'idle' })
  }

  return { state, tabVisibility, start, cancel, reset }
}
