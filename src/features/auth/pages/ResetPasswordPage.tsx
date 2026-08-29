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
    <div className="min-h-screen bg-surface-ground flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-50 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-primary-50 rounded-full blur-3xl" />
      </div>

      <div className="relative bg-gray-50 rounded-lg border border-gray-100 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center shadow-lg bg-primary-500">
            <Zap size={22} className="text-gray-900" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-primary-600">
            Nueva contraseña
          </h1>
          <p className="text-gray-500">Elige una contraseña segura para tu cuenta</p>
        </div>

        {success ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
            <p className="text-emerald-600 text-sm leading-relaxed">
              ¡Contraseña actualizada! Ahora puedes iniciar sesión con tu nueva contraseña.
            </p>
            <p className="text-gray-400 text-xs mt-2">Redirigiendo...</p>
          </div>
        ) : !sessionReady ? (
          linkInvalid ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <p className="text-red-600 text-sm leading-relaxed mb-4">
                Enlace inválido o expirado. Solicita un nuevo enlace de recuperación.
              </p>
              <Link
                to="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-700 transition-colors"
              >
                Solicitar nuevo enlace
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary-300 border-t-primary-500 rounded-full animate-spin" />
            </div>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-300"
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-300"
                placeholder="Repite tu contraseña"
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-2.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg bg-primary-500 hover:bg-primary-600"
            >
              {loading ? 'Guardando...' : 'Establecer nueva contraseña'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-400 mt-6">
          <Link to="/login" className="text-primary-600 hover:text-primary-600 transition-colors">
            ← Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
