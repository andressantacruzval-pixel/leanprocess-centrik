import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const loading = useAuthStore((s) => s.loading)
  const signOut = useAuthStore((s) => s.signOut)

  return {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    isAdmin: profile?.is_admin ?? false,
    signOut,
  }
}
