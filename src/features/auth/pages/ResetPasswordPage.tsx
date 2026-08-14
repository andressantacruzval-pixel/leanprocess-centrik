import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Zap } from 'lucide-react'
import { useAsync } from '@/hooks/useAsync'

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const { loading, error, run } = useAsync()
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [linkInvalid, setLinkInvalid] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    // Enlace nuevo (plantilla con token_hash): se canjea aquí. No usa PKCE, así que funciona
    // aunque el correo se abra en otro dispositivo o en el visor interno de la app de Gmail.
    const tokenHash = searchParams.get('token_hash')
    if (tokenHash) {
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        .then(({ error }) => {
          if (error) {
            setLinkInvalid(true)
            return
          }
          // Fuera el token de la URL para que no quede en el historial
          window.history.replaceState({}, '', '/reset-password')
          setSessionReady(true)
        })
      return
    }

    // Enlace antiguo (tokens en el fragment): lo procesa detectSessionInUrl del cliente.
    // Se puede quitar cuando caduquen los enlaces ya enviados.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    // After 2 seconds, if sessionReady is still false, show invalid link error
    const timer = setTimeout(() => {
      setLinkInvalid(true)
    }, 2000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await run(async () => {
      if (newPassword !== confirmPassword) throw new Error('Las contraseñas no coinciden')
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw new Error(error.message)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative bg-white/[0.03] rounded-2xl border border-white/5 p-8 w-full max-w-md backdrop-blur-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Nueva contraseña
          </h1>
          <p className="text-white/40">Elige una contraseña segura para tu cuenta</p>
        </div>

        {success ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
            <p className="text-green-400 text-sm leading-relaxed">
              ¡Contraseña actualizada! Ahora puedes iniciar sesión con tu nueva contraseña.
            </p>
            <p className="text-white/30 text-xs mt-2">Redirigiendo...</p>
          </div>
        ) : !sessionReady ? (
          linkInvalid ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
              <p className="text-red-400 text-sm leading-relaxed mb-4">
                Enlace inválido o expirado. Solicita un nuevo enlace de recuperación.
              </p>
              <Link
                to="/forgot-password"
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Solicitar nuevo enlace
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm border border-red-500/20">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white/40 mb-1">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30"
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/40 mb-1">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30"
                placeholder="Repite tu contraseña"
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-2.5 rounded-xl hover:from-cyan-500 hover:to-blue-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20"
            >
              {loading ? 'Guardando...' : 'Establecer nueva contraseña'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-white/30 mt-6">
          <Link to="/login" className="text-cyan-400/70 hover:text-cyan-400 transition-colors">
            ← Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
