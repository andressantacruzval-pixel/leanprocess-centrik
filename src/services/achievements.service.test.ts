import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateId } from '@/utils/id'

const USER_ID = generateId()
const ACHIEVEMENT_ID = 'first-process'

// Fakes del chain de Supabase — se comparten entre funciones del mock
const mockSingle = vi.fn()
const mockOrder  = vi.fn()
const mockEq     = vi.fn()
const mockEq2    = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    }),
  },
}))

import {
  getAchievements,
  getAllAchievements,
  getUserAchievements,
  unlockAchievement,
  markAchievementShared,
  createAchievement,
  updateAchievement,
  toggleAchievementActive,
} from './achievements.service'

// ── Helpers para configurar las cadenas de llamadas ───────────────────────

function setupSelectList(result: unknown) {
  mockOrder.mockResolvedValue(result)
  mockEq.mockReturnValue({ order: mockOrder })
  mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder })
}

function setupInsertSingle(result: unknown) {
  mockSingle.mockResolvedValue(result)
  mockSelect.mockReturnValue({ single: mockSingle })
  mockInsert.mockReturnValue({ select: mockSelect })
}

function setupUpdate(result: unknown) {
  mockEq2.mockResolvedValue(result)
  mockEq.mockReturnValue({ eq: mockEq2 })
  mockUpdate.mockReturnValue({ eq: mockEq })
}

beforeEach(() => { vi.clearAllMocks() })

// ── getAchievements ───────────────────────────────────────────────────────

describe('getAchievements', () => {
  it('retorna el catálogo parseado cuando DB responde OK', async () => {
    const dbRow = {
      id: ACHIEVEMENT_ID, title: 'Primer Paso', description: 'Crea tu primer subproceso',
      icon: 'Footprints', category: 'procesos', points: 10, tier: 'bronze',
      criteria: '', is_active: true, sort_order: 1,
    }
    setupSelectList({ data: [dbRow], error: null })

    const { data, error } = await getAchievements()

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(ACHIEVEMENT_ID)
    expect(data![0].points).toBe(10)
  })

  it('retorna array vacío cuando no hay logros', async () => {
    setupSelectList({ data: [], error: null })

    const { data, error } = await getAchievements()

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('retorna error cuando Supabase falla', async () => {
    setupSelectList({ data: null, error: { message: 'connection refused' } })

    const { data, error } = await getAchievements()

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
    expect(error!.message).toBe('connection refused')
  })
})

// ── getUserAchievements ───────────────────────────────────────────────────

describe('getUserAchievements', () => {
  it('retorna los logros del usuario', async () => {
    const row = {
      id: generateId(), user_id: USER_ID, achievement_id: ACHIEVEMENT_ID,
      unlocked_at: new Date().toISOString(), shared_to_community: false,
      created_at: new Date().toISOString(),
    }
    setupSelectList({ data: [row], error: null })

    const { data, error } = await getUserAchievements(USER_ID)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].achievement_id).toBe(ACHIEVEMENT_ID)
    expect(data![0].user_id).toBe(USER_ID)
  })

  it('retorna array vacío si el usuario no tiene logros', async () => {
    setupSelectList({ data: [], error: null })

    const { data, error } = await getUserAchievements(USER_ID)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('retorna error si Supabase falla', async () => {
    setupSelectList({ data: null, error: { message: 'rls error' } })

    const { data, error } = await getUserAchievements(USER_ID)

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
  })
})

// ── unlockAchievement ─────────────────────────────────────────────────────

describe('unlockAchievement', () => {
  it('retorna la fila insertada en inserción exitosa', async () => {
    const row = {
      id: generateId(), user_id: USER_ID, achievement_id: ACHIEVEMENT_ID,
      unlocked_at: new Date().toISOString(), shared_to_community: false,
      created_at: new Date().toISOString(),
    }
    setupInsertSingle({ data: row, error: null })

    const { data, error } = await unlockAchievement(USER_ID, ACHIEVEMENT_ID)

    expect(error).toBeNull()
    expect(data!.achievement_id).toBe(ACHIEVEMENT_ID)
    expect(data!.user_id).toBe(USER_ID)
  })

  it('trata error 23505 (UNIQUE violation) como no-error — logro ya desbloqueado', async () => {
    setupInsertSingle({ data: null, error: { code: '23505', message: 'duplicate key' } })

    const { data, error } = await unlockAchievement(USER_ID, ACHIEVEMENT_ID)

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('retorna error en otros fallos de DB', async () => {
    setupInsertSingle({ data: null, error: { code: '42501', message: 'permission denied' } })

    const { data, error } = await unlockAchievement(USER_ID, ACHIEVEMENT_ID)

    expect(error).toBeInstanceOf(Error)
    expect(error!.message).toBe('permission denied')
    expect(data).toBeNull()
  })

  it('lanza error Zod con user_id que no es UUID', async () => {
    await expect(unlockAchievement('not-a-uuid', ACHIEVEMENT_ID)).rejects.toThrow()
  })

  it('lanza error Zod con achievement_id vacío', async () => {
    await expect(unlockAchievement(USER_ID, '')).rejects.toThrow()
  })
})

// ── markAchievementShared ─────────────────────────────────────────────────

describe('markAchievementShared', () => {
  it('retorna null error en actualización exitosa', async () => {
    setupUpdate({ error: null })

    const { error } = await markAchievementShared(USER_ID, ACHIEVEMENT_ID)

    expect(error).toBeNull()
  })

  it('retorna error si Supabase falla', async () => {
    setupUpdate({ error: { message: 'rls violation' } })

    const { error } = await markAchievementShared(USER_ID, ACHIEVEMENT_ID)

    expect(error).toBeInstanceOf(Error)
    expect(error!.message).toBe('rls violation')
  })
})

// ── getAllAchievements ────────────────────────────────────────────────────

describe('getAllAchievements', () => {
  it('retorna todos los achievements incluyendo inactivos', async () => {
    const dbRow = {
      id: ACHIEVEMENT_ID, title: 'Primer Paso', description: 'Crea tu primer subproceso',
      icon: 'Footprints', category: 'procesos', points: 10, tier: 'bronze',
      criteria: '', is_active: false, sort_order: 1,
    }
    setupSelectList({ data: [dbRow], error: null })

    const { data, error } = await getAllAchievements()

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].is_active).toBe(false)
  })

  it('retorna error cuando Supabase falla', async () => {
    setupSelectList({ data: null, error: { message: 'connection refused' } })

    const { data, error } = await getAllAchievements()

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
  })
})

// ── createAchievement ─────────────────────────────────────────────────────

const NEW_ACHIEVEMENT = {
  id: 'new-test', title: 'Test', description: 'desc',
  icon: 'Star', category: 'procesos' as const, points: 20, tier: 'silver' as const,
  criteria: '', is_active: true, sort_order: 99,
}

describe('createAchievement', () => {
  it('retorna el achievement creado en inserción exitosa', async () => {
    setupInsertSingle({ data: NEW_ACHIEVEMENT, error: null })

    const { data, error } = await createAchievement(NEW_ACHIEVEMENT)

    expect(error).toBeNull()
    expect(data!.id).toBe('new-test')
    expect(data!.points).toBe(20)
  })

  it('retorna error si Supabase falla', async () => {
    setupInsertSingle({ data: null, error: { code: '23505', message: 'duplicate key' } })

    const { data, error } = await createAchievement(NEW_ACHIEVEMENT)

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
    expect(error!.message).toBe('duplicate key')
  })

  it('lanza error Zod con category inválida', async () => {
    await expect(
      createAchievement({ ...NEW_ACHIEVEMENT, category: 'invalid' as never })
    ).rejects.toThrow()
  })

  it('lanza error Zod con points negativo', async () => {
    await expect(
      createAchievement({ ...NEW_ACHIEVEMENT, points: -5 })
    ).rejects.toThrow()
  })
})

// ── updateAchievement ─────────────────────────────────────────────────────

describe('updateAchievement', () => {
  it('retorna el achievement actualizado', async () => {
    const updated = { ...NEW_ACHIEVEMENT, points: 50 }
    setupInsertSingle({ data: updated, error: null })
    // updateAchievement usa .update().eq().select().single() — reutilizamos setupInsertSingle
    // (mockSelect → mockSingle), pero update usa mockUpdate, no mockInsert
    // Configurar cadena correcta:
    mockSingle.mockResolvedValue({ data: updated, error: null })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockEq.mockReturnValue({ select: mockSelect })
    mockUpdate.mockReturnValue({ eq: mockEq })

    const { data, error } = await updateAchievement('new-test', { points: 50 })

    expect(error).toBeNull()
    expect(data!.points).toBe(50)
  })

  it('retorna error si Supabase falla', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'rls denied' } })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockEq.mockReturnValue({ select: mockSelect })
    mockUpdate.mockReturnValue({ eq: mockEq })

    const { data, error } = await updateAchievement('new-test', { points: 50 })

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
    expect(error!.message).toBe('rls denied')
  })
})

// ── toggleAchievementActive ───────────────────────────────────────────────
// Usa una sola .eq() — helper distinto a setupUpdate (que asume dos .eq())

function setupToggle(result: unknown) {
  mockEq.mockResolvedValue(result)
  mockUpdate.mockReturnValue({ eq: mockEq })
}

describe('toggleAchievementActive', () => {
  it('retorna null error al desactivar exitosamente', async () => {
    setupToggle({ error: null })

    const { error } = await toggleAchievementActive(ACHIEVEMENT_ID, false)

    expect(error).toBeNull()
  })

  it('retorna null error al activar exitosamente', async () => {
    setupToggle({ error: null })

    const { error } = await toggleAchievementActive(ACHIEVEMENT_ID, true)

    expect(error).toBeNull()
  })

  it('retorna error si Supabase falla', async () => {
    setupToggle({ error: { message: 'rls denied' } })

    const { error } = await toggleAchievementActive(ACHIEVEMENT_ID, false)

    expect(error).toBeInstanceOf(Error)
    expect(error!.message).toBe('rls denied')
  })
})
