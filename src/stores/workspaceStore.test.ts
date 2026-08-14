import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { Company } from '@/types/organization'
import { useAuthStore } from './authStore'
import { useWorkspaceStore } from './workspaceStore'

/**
 * Tests para los aspectos de persistencia cross-device de workspaceStore.
 * Cubre el bug histórico: al hacer logout/login, el store conservaba un
 * activeCompanyId huérfano que causaba bucles de onboarding o pantallas
 * vacías.
 */

function makeCompany(id: string, userId: string, overrides: Partial<Company> = {}): Company {
  const now = new Date().toISOString()
  return {
    id,
    user_id: userId,
    name: `Empresa ${id}`,
    onboarding_completed: true,
    process_level_count: 3,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe('workspaceStore.loadCompaniesFromDB', () => {
  const USER_ID = 'user-1'

  beforeEach(() => {
    // Reset stores
    useWorkspaceStore.setState({
      companies: [],
      activeCompanyId: null,
      subscription: null,
      addOns: [],
      invoices: [],
    })
    // Mock profile como no-admin para activar el filtrado B2C
    useAuthStore.setState({
      // @ts-expect-error — mock user mínimo
      user: { id: USER_ID, email: 'u@e' },
      profile: {
        id: USER_ID,
        email: 'u@e',
        full_name: 'Test',
        avatar_url: null,
        plan_id: 'community',
        is_admin: false,
        ai_tokens_used: 0,
        circle_member: false,
      },
      loading: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resets companies and activeCompanyId when DB returns zero empresas', async () => {
    // Arrange: el store tiene una empresa persistida en memoria (simulando
    // localStorage rehidratado) pero la DB no tiene ninguna.
    useWorkspaceStore.setState({
      companies: [makeCompany('ghost', USER_ID)],
      activeCompanyId: 'ghost',
    })

    vi.doMock('@/services/companies.service', () => ({
      getCompanies: vi.fn().mockResolvedValue({ data: [], error: null }),
    }))

    // Act
    await useWorkspaceStore.getState().loadCompaniesFromDB(USER_ID)

    // Assert: la empresa fantasma debe desaparecer y activeCompanyId ser null
    const state = useWorkspaceStore.getState()
    expect(state.companies).toEqual([])
    expect(state.activeCompanyId).toBeNull()

    vi.doUnmock('@/services/companies.service')
  })

  it('resets activeCompanyId when it points to a company not in DB', async () => {
    // Arrange: store cree que la empresa "orphan" está activa, pero DB devuelve "real".
    useWorkspaceStore.setState({
      companies: [makeCompany('orphan', USER_ID)],
      activeCompanyId: 'orphan',
    })

    const real = makeCompany('real', USER_ID)
    vi.doMock('@/services/companies.service', () => ({
      getCompanies: vi.fn().mockResolvedValue({ data: [real], error: null }),
    }))

    // Act
    await useWorkspaceStore.getState().loadCompaniesFromDB(USER_ID)

    // Assert: activeCompanyId debe reasignarse a la primera empresa válida.
    const state = useWorkspaceStore.getState()
    expect(state.companies.map((c) => c.id)).toEqual(['real'])
    expect(state.activeCompanyId).toBe('real')

    vi.doUnmock('@/services/companies.service')
  })

  it('preserves activeCompanyId when still valid in DB', async () => {
    const c1 = makeCompany('c1', USER_ID)
    const c2 = makeCompany('c2', USER_ID)
    useWorkspaceStore.setState({
      companies: [c1, c2],
      activeCompanyId: 'c2', // valid pre-existing
    })

    vi.doMock('@/services/companies.service', () => ({
      getCompanies: vi.fn().mockResolvedValue({ data: [c1, c2], error: null }),
    }))

    await useWorkspaceStore.getState().loadCompaniesFromDB(USER_ID)

    expect(useWorkspaceStore.getState().activeCompanyId).toBe('c2')

    vi.doUnmock('@/services/companies.service')
  })

  it('filters out other users companies (isolation B2C) when user is not admin', async () => {
    const mine = makeCompany('mine', USER_ID)
    const theirs = makeCompany('theirs', 'other-user')
    useWorkspaceStore.setState({ companies: [], activeCompanyId: null })

    vi.doMock('@/services/companies.service', () => ({
      getCompanies: vi.fn().mockResolvedValue({ data: [mine, theirs], error: null }),
    }))

    await useWorkspaceStore.getState().loadCompaniesFromDB(USER_ID)

    const state = useWorkspaceStore.getState()
    expect(state.companies.map((c) => c.id)).toEqual(['mine'])
    expect(state.activeCompanyId).toBe('mine')

    vi.doUnmock('@/services/companies.service')
  })

  it('admin sees all companies regardless of user_id', async () => {
    // Promote to admin
    useAuthStore.setState({
      profile: {
        id: USER_ID,
        email: 'admin@e',
        full_name: 'Admin',
        avatar_url: null,
        plan_id: 'pro',
        is_admin: true,
        ai_tokens_used: 0,
        circle_member: false,
      },
    })

    const a = makeCompany('a', USER_ID)
    const b = makeCompany('b', 'other')

    vi.doMock('@/services/companies.service', () => ({
      getCompanies: vi.fn().mockResolvedValue({ data: [a, b], error: null }),
    }))

    await useWorkspaceStore.getState().loadCompaniesFromDB(USER_ID)

    expect(useWorkspaceStore.getState().companies.map((c) => c.id).sort()).toEqual(['a', 'b'])

    vi.doUnmock('@/services/companies.service')
  })
})
