import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  plan_type: string | null
  /** Escalón de plan comprado (0..3). Ver `@/lib/plans`. */
  plan_level?: number | null
  is_admin: boolean
  ai_tokens_used: number
  circle_member: boolean
  /** Tokens del plan. Se reinician el día 1. */
  credits?: number
  /** Tokens comprados aparte. No caducan. */
  credits_comprados?: number
  /**
   * `credits + credits_comprados`, columna generada por Postgres.
   * Es lo que hay que enseñar: leer solo `credits` subestima a quien haya
   * comprado tokens. Ver `docs/Lite/creditos.md`.
   */
  credits_total?: number
}

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  fetchProfile: () => Promise<void>
  refreshCredits: () => Promise<void>
  signOut: () => Promise<void>
  /** Initialize Supabase auth session + listener. Returns cleanup fn. */
  initializeAuth: () => () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      loading: true,
      setUser: (user) => {
        const prev = get().user
        const prevId = prev?.id ?? null
        const nextId = user?.id ?? null
        // Cambio de usuario real (A→B, o null→B después de que A estaba persistido):
        // borrar localStorage de todos los stores de dominio y forzar reload para
        // que la memoria quede limpia también. Sin esto, datos del usuario anterior
        // contaminan la sesión nueva y pueden provocar loops de redirect.
        const userChanged = prevId !== nextId && nextId != null
        if (userChanged && typeof window !== 'undefined') {
          const toRemove: string[] = []
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i)
            if (key && key.startsWith('lean-process-') && key !== 'lean-process-auth') {
              toRemove.push(key)
            }
          }
          toRemove.forEach((k) => window.localStorage.removeItem(k))
        }
        set({ user })
        if (userChanged && prevId != null && typeof window !== 'undefined') {
          // Solo reload si había otro usuario antes (prev != null). Evita reload
          // en el flujo normal de login desde la pantalla pública.
          window.location.href = '/app'
        }
      },
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),

      fetchProfile: async () => {
        const { user } = get()
        if (!user) return
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        if (error) {
          console.warn('[authStore] fetchProfile failed:', error.message)
          return
        }
        set({ profile: data as unknown as Profile })
      },
      refreshCredits: async () => { await get().fetchProfile() },
      signOut: async () => {
        await supabase.auth.signOut()
        // Limpiar localStorage de todos los stores de dominio antes del redirect.
        // Previene que un siguiente login reutilice estado del usuario que sale.
        if (typeof window !== 'undefined') {
          const toRemove: string[] = []
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i)
            if (key && key.startsWith('lean-process-')) {
              toRemove.push(key)
            }
          }
          toRemove.forEach((k) => window.localStorage.removeItem(k))
        }
        set({ user: null, profile: null })
        // Reload para re-inicializar todos los stores en memoria desde cero.
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      },

      initializeAuth: () => {
        const { setUser, setLoading } = get()
        // getSession sólo actualiza el user y controla el estado de carga.
        // fetchProfile se delega a onAuthStateChange para evitar llamadas duplicadas
        // (onAuthStateChange dispara un evento inicial con la sesión activa).
        supabase.auth.getSession().then(({ data: { session } }) => {
          setUser(session?.user ?? null)
          setLoading(false)
        }).catch(() => {
          setLoading(false)
        })
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null)
          if (session?.user) get().fetchProfile()
        })
        return () => subscription.unsubscribe()
      },
    }),
    {
      name: 'lean-process-auth',
      version: 3,
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        loading: false,
      }),
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version < 3) delete state['demoMode']
        return state
      },
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
