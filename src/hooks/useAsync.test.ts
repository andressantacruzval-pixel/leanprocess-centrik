import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAsync } from './useAsync'

describe('useAsync', () => {
  it('starts with loading=false and no error', () => {
    const { result } = renderHook(() => useAsync())
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets loading=true while running and false after', async () => {
    const { result } = renderHook(() => useAsync())

    const promise = act(async () => {
      await result.current.run(() => Promise.resolve('done'))
    })

    // After completion
    await promise
    expect(result.current.loading).toBe(false)
  })

  it('returns the resolved value', async () => {
    const { result } = renderHook(() => useAsync())

    let returnValue: string | null = null
    await act(async () => {
      returnValue = await result.current.run(() => Promise.resolve('hello'))
    })

    expect(returnValue).toBe('hello')
    expect(result.current.error).toBeNull()
  })

  it('captures error message on rejection', async () => {
    const { result } = renderHook(() => useAsync())

    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('algo salió mal')))
    })

    expect(result.current.error).toBe('algo salió mal')
    expect(result.current.loading).toBe(false)
  })

  it('returns null when the function throws', async () => {
    const { result } = renderHook(() => useAsync())

    let returnValue: unknown = 'not-null'
    await act(async () => {
      returnValue = await result.current.run(() => Promise.reject(new Error('fail')))
    })

    expect(returnValue).toBeNull()
  })

  it('uses fallback message for non-Error throws', async () => {
    const { result } = renderHook(() => useAsync())

    await act(async () => {
      await result.current.run(async () => { throw 'string error' })
    })

    expect(result.current.error).toBe('Error inesperado')
  })

  it('resets state with reset()', async () => {
    const { result } = renderHook(() => useAsync())

    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('err')))
    })
    expect(result.current.error).toBe('err')

    act(() => {
      result.current.reset()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('clears previous error before new run', async () => {
    const { result } = renderHook(() => useAsync())

    // First call fails
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('first error')))
    })
    expect(result.current.error).toBe('first error')

    // Second call succeeds — error should clear
    await act(async () => {
      await result.current.run(() => Promise.resolve('ok'))
    })
    expect(result.current.error).toBeNull()
  })

  it('run is stable across renders (same reference)', () => {
    const { result, rerender } = renderHook(() => useAsync())
    const firstRun = result.current.run
    rerender()
    expect(result.current.run).toBe(firstRun)
  })
})
