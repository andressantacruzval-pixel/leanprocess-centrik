import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted: variables disponibles en las factories de vi.mock (que se elevan al tope)
const { USER_ID, mockUnlockDB, mockGetUserAch, mockMarkSharedDB, mockGetCatalog, mockUpdateTotalPoints } = vi.hoisted(() => {
  const USER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5'
  const mockUnlockDB          = vi.fn()
  const mockGetUserAch        = vi.fn()
  const mockMarkSharedDB      = vi.fn()
  const mockGetCatalog        = vi.fn()
  const mockUpdateTotalPoints = vi.fn().mockResolvedValue({ data: null, error: null })
  return { USER_ID, mockUnlockDB, mockGetUserAch, mockMarkSharedDB, mockGetCatalog, mockUpdateTotalPoints }
})

vi.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: vi.fn().mockReturnValue({ user: { id: USER_ID } }),
  },
}))

vi.mock('@/services/achievements.service', () => ({
  getAchievements:       (...args: unknown[]) => mockGetCatalog(...args),
  unlockAchievement:     (...args: unknown[]) => mockUnlockDB(...args),
  getUserAchievements:   (...args: unknown[]) => mockGetUserAch(...args),
  markAchievementShared: (...args: unknown[]) => mockMarkSharedDB(...args),
  updateTotalPoints:     (...args: unknown[]) => mockUpdateTotalPoints(...args),
}))

import { useAchievementStore } from './achievementStore'

const ACHIEVEMENT_ID = 'first-process'

// Catálogo mínimo para los tests (no depende de la DB real)
const MOCK_CATALOG = [
  { id: 'first-process', title: 'Primer Paso',      description: 'Crea tu primer subproceso', icon: 'Footprints', category: 'procesos',      points: 10, tier: 'bronze', criteria: '', is_active: true, sort_order: 1 },
  { id: 'first-risk',    title: 'Vigilante',         description: 'Identifica tu primer riesgo', icon: 'ShieldAlert', category: 'riesgos',   points: 10, tier: 'bronze', criteria: '', is_active: true, sort_order: 2 },
  { id: 'first-bpmn',    title: 'Diagramador',       description: 'Crea tu primer diagrama BPMN', icon: 'GitBranch', category: 'procesos',  points: 15, tier: 'bronze', criteria: '', is_active: true, sort_order: 3 },
  { id: 'ten-risks',     title: 'Guardian',          description: 'Identifica 10 riesgos', icon: 'Shield', category: 'riesgos',              points: 40, tier: 'silver', criteria: '', is_active: true, sort_order: 4 },
  { id: 'five-processes',title: 'Arquitecto Junior', description: 'Crea 5 subprocesos', icon: 'Layers', category: 'procesos',                points: 25, tier: 'silver', criteria: '', is_active: true, sort_order: 5 },
]

const MOCK_UNLOCK_ROW = {
  id: 'row-uuid-0001',
  user_id: USER_ID,
  achievement_id: ACHIEVEMENT_ID,
  unlocked_at: new Date().toISOString(),
  shared_to_community: false,
  created_at: new Date().toISOString(),
}

const RESET_STATE = {
  unlockedAchievements: [],
  totalPoints: 0,
  communityQueue: [],
  communityPosts: [],
  pendingNotifications: [],
  webhookUrl: null,
  catalog: MOCK_CATALOG,
  catalogLoaded: true,
}

beforeEach(() => {
  useAchievementStore.setState(RESET_STATE)
  vi.clearAllMocks()
  mockUnlockDB.mockResolvedValue({ data: MOCK_UNLOCK_ROW, error: null })
  mockGetUserAch.mockResolvedValue({ data: [], error: null })
  mockMarkSharedDB.mockResolvedValue({ data: null, error: null })
  mockGetCatalog.mockResolvedValue({ data: MOCK_CATALOG, error: null })
})

// ── loadCatalog ───────────────────────────────────────────────────────────

describe('loadCatalog', () => {
  it('carga el catálogo desde DB y lo pone en el store', async () => {
    useAchievementStore.setState({ catalog: [], catalogLoaded: false })

    await useAchievementStore.getState().loadCatalog()

    const { catalog, catalogLoaded } = useAchievementStore.getState()
    expect(catalog).toHaveLength(MOCK_CATALOG.length)
    expect(catalog[0].id).toBe('first-process')
    expect(catalogLoaded).toBe(true)
  })

  it('no modifica el estado si DB retorna error', async () => {
    useAchievementStore.setState({ catalog: [], catalogLoaded: false })
    mockGetCatalog.mockResolvedValueOnce({ data: null, error: new Error('network') })

    await useAchievementStore.getState().loadCatalog()

    expect(useAchievementStore.getState().catalog).toHaveLength(0)
    expect(useAchievementStore.getState().catalogLoaded).toBe(false)
  })

  it('no modifica el estado si DB retorna null sin error', async () => {
    useAchievementStore.setState({ catalog: [], catalogLoaded: false })
    mockGetCatalog.mockResolvedValueOnce({ data: null, error: null })

    await useAchievementStore.getState().loadCatalog()

    expect(useAchievementStore.getState().catalog).toHaveLength(0)
  })
})

// ── unlockAchievement ─────────────────────────────────────────────────────

describe('unlockAchievement', () => {
  it('agrega el logro al estado local inmediatamente (optimistic)', () => {
    useAchievementStore.getState().unlockAchievement(ACHIEVEMENT_ID)

    const { unlockedAchievements, totalPoints } = useAchievementStore.getState()
    expect(unlockedAchievements).toHaveLength(1)
    expect(unlockedAchievements[0].achievementId).toBe(ACHIEVEMENT_ID)
    expect(totalPoints).toBe(10)
  })

  it('llama al servicio de Supabase para persistir', async () => {
    useAchievementStore.getState().unlockAchievement(ACHIEVEMENT_ID)

    await new Promise((r) => setTimeout(r, 0))
    expect(mockUnlockDB).toHaveBeenCalledWith(USER_ID, ACHIEVEMENT_ID)
  })

  it('no desbloquea el mismo logro dos veces', () => {
    useAchievementStore.getState().unlockAchievement(ACHIEVEMENT_ID)
    useAchievementStore.getState().unlockAchievement(ACHIEVEMENT_ID)

    expect(useAchievementStore.getState().unlockedAchievements).toHaveLength(1)
    expect(useAchievementStore.getState().totalPoints).toBe(10)
  })

  it('retorna false al intentar desbloquear el mismo logro dos veces', () => {
    useAchievementStore.getState().unlockAchievement(ACHIEVEMENT_ID)
    const result = useAchievementStore.getState().unlockAchievement(ACHIEVEMENT_ID)
    expect(result).toBe(false)
  })

  it('agrega el id a pendingNotifications', () => {
    useAchievementStore.getState().unlockAchievement('first-risk')
    expect(useAchievementStore.getState().pendingNotifications).toContain('first-risk')
  })

  it('suma correctamente los puntos de múltiples logros', () => {
    useAchievementStore.getState().unlockAchievement(ACHIEVEMENT_ID) // 10 pts
    useAchievementStore.getState().unlockAchievement('first-risk')   // 10 pts
    useAchievementStore.getState().unlockAchievement('first-bpmn')   // 15 pts

    expect(useAchievementStore.getState().totalPoints).toBe(35)
    expect(useAchievementStore.getState().unlockedAchievements).toHaveLength(3)
  })

  it('no llama al servicio si no hay usuario autenticado', async () => {
    const { useAuthStore } = await import('@/stores/authStore')
    vi.mocked(useAuthStore.getState).mockReturnValueOnce({ user: null } as never)

    useAchievementStore.getState().unlockAchievement(ACHIEVEMENT_ID)
    await new Promise((r) => setTimeout(r, 0))

    expect(mockUnlockDB).not.toHaveBeenCalled()
  })

  it('retorna false para achievement_id desconocido (no está en catalog)', () => {
    const result = useAchievementStore.getState().unlockAchievement('nonexistent-id')
    expect(result).toBe(false)
    expect(useAchievementStore.getState().unlockedAchievements).toHaveLength(0)
  })

  it('retorna false si el catálogo está vacío', () => {
    useAchievementStore.setState({ catalog: [], catalogLoaded: false })
    const result = useAchievementStore.getState().unlockAchievement(ACHIEVEMENT_ID)
    expect(result).toBe(false)
  })

  it('agrega evento a communityQueue al desbloquear', () => {
    useAchievementStore.getState().unlockAchievement(ACHIEVEMENT_ID)

    const queue = useAchievementStore.getState().communityQueue
    expect(queue).toHaveLength(1)
    expect(queue[0].type).toBe('achievement_unlocked')
    expect(queue[0].payload.achievementId).toBe(ACHIEVEMENT_ID)
  })
})

// ── loadFromDB ────────────────────────────────────────────────────────────

describe('loadFromDB', () => {
  it('reemplaza el estado local con datos de DB', async () => {
    useAchievementStore.setState({ totalPoints: 999, unlockedAchievements: [] })

    mockGetUserAch.mockResolvedValueOnce({ data: [MOCK_UNLOCK_ROW], error: null })

    await useAchievementStore.getState().loadFromDB(USER_ID)

    const { unlockedAchievements, totalPoints } = useAchievementStore.getState()
    expect(unlockedAchievements).toHaveLength(1)
    expect(unlockedAchievements[0].achievementId).toBe(ACHIEVEMENT_ID)
    expect(totalPoints).toBe(10)  // Recalculado desde catálogo en store
  })

  it('recalcula totalPoints correctamente desde múltiples logros en DB', async () => {
    const rows = [
      { ...MOCK_UNLOCK_ROW, achievement_id: ACHIEVEMENT_ID },                          // 10 pts
      { ...MOCK_UNLOCK_ROW, id: 'row-uuid-0002', achievement_id: 'first-risk' },       // 10 pts
      { ...MOCK_UNLOCK_ROW, id: 'row-uuid-0003', achievement_id: 'first-bpmn' },       // 15 pts
    ]
    mockGetUserAch.mockResolvedValueOnce({ data: rows, error: null })

    await useAchievementStore.getState().loadFromDB(USER_ID)

    expect(useAchievementStore.getState().totalPoints).toBe(35)
    expect(useAchievementStore.getState().unlockedAchievements).toHaveLength(3)
  })

  it('no modifica el estado si DB retorna error', async () => {
    useAchievementStore.setState({ totalPoints: 50 })
    mockGetUserAch.mockResolvedValueOnce({ data: null, error: new Error('network') })

    await useAchievementStore.getState().loadFromDB(USER_ID)

    expect(useAchievementStore.getState().totalPoints).toBe(50)
  })

  it('no modifica el estado si DB retorna null sin error', async () => {
    useAchievementStore.setState({ totalPoints: 50 })
    mockGetUserAch.mockResolvedValueOnce({ data: null, error: null })

    await useAchievementStore.getState().loadFromDB(USER_ID)

    expect(useAchievementStore.getState().totalPoints).toBe(50)
  })

  it('mapea sharedToCommunity desde DB correctamente', async () => {
    mockGetUserAch.mockResolvedValueOnce({
      data: [{ ...MOCK_UNLOCK_ROW, shared_to_community: true }],
      error: null,
    })

    await useAchievementStore.getState().loadFromDB(USER_ID)

    const ua = useAchievementStore.getState().unlockedAchievements[0]
    expect(ua.sharedToCommunity).toBe(true)
  })

  it('usa puntos del catálogo en store (no hardcodeados)', async () => {
    // Si el catálogo cambia los puntos, loadFromDB debe usar los nuevos
    const customCatalog = [
      { ...MOCK_CATALOG[0], points: 999 },  // first-process ahora vale 999 pts
    ]
    useAchievementStore.setState({ catalog: customCatalog, catalogLoaded: true })
    mockGetUserAch.mockResolvedValueOnce({ data: [MOCK_UNLOCK_ROW], error: null })

    await useAchievementStore.getState().loadFromDB(USER_ID)

    expect(useAchievementStore.getState().totalPoints).toBe(999)
  })
})

// ── markShared ────────────────────────────────────────────────────────────

describe('markShared', () => {
  beforeEach(() => {
    useAchievementStore.setState({
      ...RESET_STATE,
      unlockedAchievements: [
        { achievementId: ACHIEVEMENT_ID, unlockedAt: Date.now(), sharedToCommunity: false },
      ],
    })
  })

  it('marca el logro como compartido en el estado local', () => {
    useAchievementStore.getState().markShared(ACHIEVEMENT_ID)

    const ua = useAchievementStore.getState().unlockedAchievements[0]
    expect(ua.sharedToCommunity).toBe(true)
  })

  it('llama al servicio para persistir en DB', async () => {
    useAchievementStore.getState().markShared(ACHIEVEMENT_ID)

    await new Promise((r) => setTimeout(r, 0))
    expect(mockMarkSharedDB).toHaveBeenCalledWith(USER_ID, ACHIEVEMENT_ID)
  })

  it('no afecta otros logros al marcar uno como compartido', () => {
    useAchievementStore.setState({
      ...RESET_STATE,
      unlockedAchievements: [
        { achievementId: ACHIEVEMENT_ID, unlockedAt: Date.now(), sharedToCommunity: false },
        { achievementId: 'first-risk', unlockedAt: Date.now(), sharedToCommunity: false },
      ],
    })

    useAchievementStore.getState().markShared(ACHIEVEMENT_ID)

    const { unlockedAchievements } = useAchievementStore.getState()
    expect(unlockedAchievements.find((u) => u.achievementId === ACHIEVEMENT_ID)?.sharedToCommunity).toBe(true)
    expect(unlockedAchievements.find((u) => u.achievementId === 'first-risk')?.sharedToCommunity).toBe(false)
  })
})

// ── dismissNotification ───────────────────────────────────────────────────

describe('dismissNotification', () => {
  it('elimina el id de pendingNotifications', () => {
    useAchievementStore.setState({
      ...RESET_STATE,
      pendingNotifications: [ACHIEVEMENT_ID, 'first-risk'],
    })

    useAchievementStore.getState().dismissNotification(ACHIEVEMENT_ID)

    expect(useAchievementStore.getState().pendingNotifications).toEqual(['first-risk'])
  })

  it('dismissAllNotifications limpia todas las notificaciones', () => {
    useAchievementStore.setState({
      ...RESET_STATE,
      pendingNotifications: [ACHIEVEMENT_ID, 'first-risk', 'first-bpmn'],
    })

    useAchievementStore.getState().dismissAllNotifications()

    expect(useAchievementStore.getState().pendingNotifications).toEqual([])
  })
})

// ── isUnlocked / getLockedList / getUnlockedList ───────────────────────────

describe('consultas de estado', () => {
  it('isUnlocked retorna true para logros desbloqueados', () => {
    useAchievementStore.getState().unlockAchievement(ACHIEVEMENT_ID)
    expect(useAchievementStore.getState().isUnlocked(ACHIEVEMENT_ID)).toBe(true)
    expect(useAchievementStore.getState().isUnlocked('first-risk')).toBe(false)
  })

  it('getLockedList excluye los logros desbloqueados', () => {
    useAchievementStore.getState().unlockAchievement(ACHIEVEMENT_ID)
    const locked = useAchievementStore.getState().getLockedList()
    expect(locked.some((a) => a.id === ACHIEVEMENT_ID)).toBe(false)
    expect(locked.length).toBe(MOCK_CATALOG.length - 1)
  })

  it('getUnlockedList retorna los logros desbloqueados con metadata del catálogo', () => {
    useAchievementStore.getState().unlockAchievement(ACHIEVEMENT_ID)
    const unlocked = useAchievementStore.getState().getUnlockedList()
    expect(unlocked).toHaveLength(1)
    expect(unlocked[0].id).toBe(ACHIEVEMENT_ID)
    expect(unlocked[0].points).toBe(10)
    expect(typeof unlocked[0].unlockedAt).toBe('number')
  })

  it('getLockedList retorna catálogo completo cuando no hay logros desbloqueados', () => {
    const locked = useAchievementStore.getState().getLockedList()
    expect(locked.length).toBe(MOCK_CATALOG.length)
  })

  it('getUnlockedList retorna vacío si el catálogo no tiene el achievement', () => {
    useAchievementStore.setState({
      ...RESET_STATE,
      unlockedAchievements: [
        { achievementId: 'deleted-achievement', unlockedAt: Date.now(), sharedToCommunity: false },
      ],
    })
    const unlocked = useAchievementStore.getState().getUnlockedList()
    expect(unlocked).toHaveLength(0)
  })
})
