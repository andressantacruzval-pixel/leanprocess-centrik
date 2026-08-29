import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function HubEntry() {
  const navigate = useNavigate()

  useEffect(() => {
    const goLogin = () => navigate('/login', { replace: true })
    const goApp = () => navigate('/app', { replace: true })

    // Flujo nuevo: ticket de un solo uso en el fragment (#token_hash=...)
    // El fragment nunca viaja a servidores ni queda en logs/Referer.
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    const token_hash = hashParams.get('token_hash')

    if (token_hash) {
      history.replaceState(null, '', window.location.pathname)
      supabase.auth.verifyOtp({ type: 'magiclink', token_hash })
        .then(({ error }) => (error ? goLogin() : goApp()))
        .catch(goLogin)
      return
    }

    // Flujo legacy (query params) — mantener hasta que Lite despliegue el
    // handoff nuevo; eliminar después.
    const params = new URLSearchParams(window.location.search)
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')

    if (!access_token || !refresh_token) {
      goLogin()
      return
    }

    supabase.auth.setSession({ access_token, refresh_token })
      .then(({ error }) => (error ? goLogin() : goApp()))
      .catch(goLogin)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#f8f9fa', color: '#111827',
      fontFamily: 'Geist, system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid #d1fae5',
          borderTopColor: '#10b981',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          Estableciendo sesión…
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
