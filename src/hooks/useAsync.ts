import { useState, useCallback } from 'react'

interface UseAsyncReturn {
  loading: boolean
  error: string | null
  run: <T>(fn: () => Promise<T>) => Promise<T | null>
  reset: () => void
}

export function useAsync(): UseAsyncReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)
    try {
      return await fn()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
  }, [])

  return { loading, error, run, reset }
}
