import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuthBootstrap } from './useAuthBootstrap'
import { useAuthStore } from '@/stores/authStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useBillingStore } from '@/stores/billingStore'

describe('useAuthBootstrap', () => {
  beforeEach(() => {
    // Reset stores
    useAuthStore.setState({ user: null, profile: null, loading: false })
    vi.restoreAllMocks()
  })

  it('returns ready=true immediately when no user', async () => {
    const { result } = renderHook(() => useAuthBootstrap())
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.error).toBeNull()
  })

  it('waits for loadCompanies/loadWallet before marking ready', async () => {
    let resolveCompanies: () => void = () => {}
    const companiesPromise = new Promise<void>((r) => { resolveCompanies = r })

    vi.spyOn(useWorkspaceStore.getState(), 'loadCompaniesFromDB').mockReturnValue(companiesPromise)
    vi.spyOn(useBillingStore.getState(), 'loadWallet').mockResolvedValue(undefined)
    vi.spyOn(useBillingStore.getState(), 'loadPackages').mockResolvedValue(undefined)
    vi.spyOn(useBillingStore.getState(), 'loadOperationCosts').mockResolvedValue(undefined)
    vi.spyOn(useBillingStore.getState(), 'loadAddonPrices').mockResolvedValue(undefined)

    useAuthStore.setState({
      // @ts-expect-error — mock user
      user: { id: 'user-1', email: 'u@e' },
      loading: false,
    })

    const { result } = renderHook(() => useAuthBootstrap())
    // Inmediatamente después del efecto, ready debe ser false
    await waitFor(() => expect(useWorkspaceStore.getState().loadCompaniesFromDB).toHaveBeenCalled())
    expect(result.current.ready).toBe(false)

    resolveCompanies()
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.error).toBeNull()
  })

  it('marks ready=true even when loadCompanies rejects and exposes error', async () => {
    vi.spyOn(useWorkspaceStore.getState(), 'loadCompaniesFromDB').mockRejectedValue(new Error('network down'))
    vi.spyOn(useBillingStore.getState(), 'loadWallet').mockResolvedValue(undefined)
    vi.spyOn(useBillingStore.getState(), 'loadPackages').mockResolvedValue(undefined)
    vi.spyOn(useBillingStore.getState(), 'loadOperationCosts').mockResolvedValue(undefined)
    vi.spyOn(useBillingStore.getState(), 'loadAddonPrices').mockResolvedValue(undefined)

    useAuthStore.setState({
      // @ts-expect-error: objeto user incompleto para test de error handling
      user: { id: 'user-err', email: 'u@e' },
      loading: false,
    })

    const { result } = renderHook(() => useAuthBootstrap())
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('network down')
  })
})
