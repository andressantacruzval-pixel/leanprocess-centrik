import { describe, it, expect, beforeEach, vi } from 'vitest'
import { dbWrite } from './dbWrite'
import { useToastStore } from '@/stores/toastStore'

describe('dbWrite', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('returns ok=true with data on success', async () => {
    const op = Promise.resolve({ data: { id: '1' }, error: null })
    const result = await dbWrite('test:success', op)
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ id: '1' })
    expect(result.error).toBeNull()
  })

  it('shows success toast when successMessage is provided', async () => {
    const op = Promise.resolve({ data: { id: '1' }, error: null })
    await dbWrite('test:success', op, { successMessage: 'Guardado' })
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe('success')
    expect(toasts[0].message).toBe('Guardado')
  })

  it('does not toast on success when successMessage is absent', async () => {
    const op = Promise.resolve({ data: { id: '1' }, error: null })
    await dbWrite('test:success', op)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('returns ok=false and runs rollback on supabase error', async () => {
    const rollback = vi.fn()
    const op = Promise.resolve({ data: null, error: { message: 'RLS violation' } })
    const result = await dbWrite('test:error', op, { rollback })
    expect(result.ok).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error?.message).toBe('RLS violation')
    expect(rollback).toHaveBeenCalledOnce()
  })

  it('shows error toast with custom message', async () => {
    const op = Promise.resolve({ data: null, error: { message: 'RLS violation' } })
    await dbWrite('test:error', op, { errorMessage: 'No se pudo guardar el riesgo' })
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe('error')
    expect(toasts[0].message).toBe('No se pudo guardar el riesgo')
  })

  it('stays silent when silent=true even on error', async () => {
    const rollback = vi.fn()
    const op = Promise.resolve({ data: null, error: { message: 'err' } })
    await dbWrite('test:silent', op, { silent: true, rollback })
    expect(useToastStore.getState().toasts).toHaveLength(0)
    expect(rollback).toHaveBeenCalledOnce()
  })

  it('handles thrown exceptions (network error)', async () => {
    const rollback = vi.fn()
    const op = Promise.reject(new Error('Network down'))
    const result = await dbWrite('test:throw', op, { rollback })
    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('Network down')
    expect(rollback).toHaveBeenCalledOnce()
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe('error')
  })
})
