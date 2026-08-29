import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { useAsync } from '@/hooks/useAsync'
import { signIn, signUp } from '@/services/auth.service'

/**
 * Login LOCAL — solo para desarrollo en localhost.
 *
 * En producción la puerta de entrada es el Hub Lite (ver `@/features/auth/lite`):
 * la App nunca muestra un formulario de login. Pero en local no existe ese Hub,
 * así que sin esto no habría forma de entrar a `/app`.
 *
 * Este formulario usa el `auth.service` que ya existe (`signInWithPassword` /
 * `signUp` de Supabase) contra el Supabase que tengas configurado en `.env`
 * (idealmente uno LOCAL vía `supabase start`, nunca producción).
 *
 * Las rutas que montan esta página (`/login`, `/register`) solo la renderizan
 * cuando `EN_LOCAL` es cierto; en producción caen a `RedirectToLite`.
 */
export default function LocalLoginPage({ signup = false }: { signup?: boolean }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>(signup ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const { loading, error, run } = useAsync()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInfo(null)
    await run(async () => {
      if (mode === 'signup') {
        const { error } = await signUp(email, password, fullName)
        if (error) throw error
        // Con Supabase local (confirmaciones deshabilitadas) ya hay sesión.
        // Si el proyecto exige confirmar el correo, avisamos.
        setInfo('Cuenta creada. Si tu Supabase exige confirmar correo, revisa Mailpit (http://127.0.0.1:54324). Si no, ya puedes entrar.')
      } else {
        const { error } = await signIn(email, password)
        if (error) throw error
      }
      // La sesión la propaga onAuthStateChange en authStore; vamos a /app.
      navigate('/app', { replace: true })
    })
  }

  return (
    <div className="min-h-screen bg-surface-ground flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-50 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-primary-50 rounded-full blur-3xl" />
      </div>

      <div className="relative bg-gray-50 rounded-lg border border-gray-100 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center shadow-lg bg-primary-500">
            <Zap size={22} className="text-gray-900" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-primary-500">
            {mode === 'signup' ? 'Crear cuenta (local)' : 'Iniciar sesión (local)'}
          </h1>
          <p className="text-gray-500 text-sm">
            Entorno de desarrollo — Supabase local, sin producción
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-primary-50 text-primary-700 p-3 rounded-lg text-sm border border-primary-200">
              {info}
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Nombre completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-300"
                placeholder="Tu nombre"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-300"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-300"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-2.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg bg-primary-500 hover:bg-primary-600"
          >
            {loading
              ? 'Procesando...'
              : mode === 'signup'
                ? 'Crear cuenta'
                : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          {mode === 'signup' ? (
            <>
              ¿Ya tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => { setMode('signin'); setInfo(null) }}
                className="text-primary-600 hover:text-primary-600 transition-colors"
              >
                Inicia sesión
              </button>
            </>
          ) : (
            <>
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setInfo(null) }}
                className="text-primary-600 hover:text-primary-600 transition-colors"
              >
                Crear una
              </button>
            </>
          )}
        </p>

        <p className="text-center text-sm text-gray-400 mt-3">
          <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  )
}
