import { useState, useEffect } from 'react'

export function useTabVisibility(): 'visible' | 'hidden' {
  const [visibility, setVisibility] = useState<'visible' | 'hidden'>(
    document.visibilityState === 'visible' ? 'visible' : 'hidden',
  )

  useEffect(() => {
    const handler = () =>
      setVisibility(document.visibilityState === 'visible' ? 'visible' : 'hidden')
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  return visibility
}
