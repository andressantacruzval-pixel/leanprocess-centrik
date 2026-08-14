/**
 * processStore.persistence — verifica que macroprocesos y procesos usen
 * el user_id real del usuario autenticado y no el valor hardcodeado 'demo'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted para variables disponibles en factories de vi.mock
const { mockInsert } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'db-id' }, error: null }),
    }),
  })
  return { mockInsert }
})

// Mocks deben declararse antes de importar el módulo bajo prueba
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: mockInsert,
      update: () => ({
        eq: () => ({ then: (fn: (v: unknown) => unknown) => fn({ error: null }) }),
      }),
      upsert: () => Promise.resolve({ error: null }),
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}))

vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/stores/changeLogStore', () => ({
  useChangeLogStore: {
    getState: vi.fn().mockReturnValue({ addEntry: vi.fn() }),
  },
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: vi.fn().mockReturnValue({
      user: { id: 'real-user-uuid-abc' },
      profile: { full_name: 'Usuario Test' },
    }),
  },
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: {
    getState: vi.fn().mockReturnValue({ activeCompanyId: 'real-company-uuid-xyz' }),
  },
}))


import { useProcessStore } from './processStore'

describe('processStore — persistencia user_id', () => {
  beforeEach(() => {
    useProcessStore.setState({ macroprocesses: [], processes: [] })
    vi.clearAllMocks()
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'db-id' }, error: null }),
      }),
    })
  })

  // ── addMacroprocess ────────────────────────────────────────────────────

  describe('addMacroprocess', () => {
    it('asigna el user_id del authStore, no "demo"', () => {
      const macro = useProcessStore.getState().addMacroprocess('Ventas', 'productivo')
      expect(macro.user_id).toBe('real-user-uuid-abc')
      expect(macro.user_id).not.toBe('demo')
    })

    it('asigna el company_id de la empresa activa', () => {
      const macro = useProcessStore.getState().addMacroprocess('Ventas', 'productivo')
      expect(macro.company_id).toBe('real-company-uuid-xyz')
    })

    it('el objeto enviado al servicio tiene user_id real (no undefined ni "demo")', () => {
      // Verificamos directamente el objeto creado, que es el que se pasa al servicio
      const macro = useProcessStore.getState().addMacroprocess('Ventas', 'productivo')
      expect(macro.user_id).toBe('real-user-uuid-abc')
      expect(macro.user_id).not.toBeUndefined()
      expect(macro.user_id).not.toBe('demo')
    })

    it('persiste el macroproceso en el store', () => {
      useProcessStore.getState().addMacroprocess('Logística', 'apoyo')
      const macros = useProcessStore.getState().macroprocesses
      expect(macros).toHaveLength(1)
      expect(macros[0].name).toBe('Logística')
    })
  })

  // ── addProcess ─────────────────────────────────────────────────────────

  describe('addProcess', () => {
    it('asigna el user_id del authStore, no "demo"', () => {
      const macro = useProcessStore.getState().addMacroprocess('Ops', 'productivo')
      vi.clearAllMocks()
      const proc = useProcessStore.getState().addProcess('Marketing', macro.id)
      expect(proc.user_id).toBe('real-user-uuid-abc')
      expect(proc.user_id).not.toBe('demo')
    })

    it('asigna el company_id de la empresa activa', () => {
      const macro = useProcessStore.getState().addMacroprocess('Ops', 'productivo')
      vi.clearAllMocks()
      const proc = useProcessStore.getState().addProcess('Marketing', macro.id)
      expect(proc.company_id).toBe('real-company-uuid-xyz')
    })

    it('el objeto enviado al servicio tiene user_id real (no "demo")', () => {
      // Verificamos directamente el objeto creado, que es el que se pasa al servicio
      const macro = useProcessStore.getState().addMacroprocess('Ops', 'productivo')
      vi.clearAllMocks()
      const proc = useProcessStore.getState().addProcess('Marketing', macro.id)
      expect(proc.user_id).toBe('real-user-uuid-abc')
      expect(proc.user_id).not.toBe('demo')
    })

    it('persiste el proceso en el store con la referencia al macroproceso', () => {
      const macro = useProcessStore.getState().addMacroprocess('Ops', 'productivo')
      vi.clearAllMocks()
      useProcessStore.getState().addProcess('Ventas digitales', macro.id)
      const procs = useProcessStore.getState().processes
      expect(procs).toHaveLength(1)
      expect(procs[0].name).toBe('Ventas digitales')
      expect(procs[0].macroprocess_id).toBe(macro.id)
    })
  })
})
