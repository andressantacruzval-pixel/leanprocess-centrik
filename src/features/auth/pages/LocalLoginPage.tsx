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
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center px-4">
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
            {mode === 'signup' ? 'Crear cuenta (local)' : 'Iniciar sesión (local)'}
          </h1>
          <p className="text-white/40 text-sm">
            Entorno de desarrollo — Supabase local, sin producción
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm border border-red-500/20">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-cyan-500/10 text-cyan-300 p-3 rounded-xl text-sm border border-cyan-500/20">
              {info}
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-white/40 mb-1">Nombre completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30"
                placeholder="Tu nombre"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/40 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/40 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-2.5 rounded-xl hover:from-cyan-500 hover:to-blue-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20"
          >
            {loading
              ? 'Procesando...'
              : mode === 'signup'
                ? 'Crear cuenta'
                : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-white/30 mt-6">
          {mode === 'signup' ? (
            <>
              ¿Ya tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => { setMode('signin'); setInfo(null) }}
                className="text-cyan-400/70 hover:text-cyan-400 transition-colors"
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
                className="text-cyan-400/70 hover:text-cyan-400 transition-colors"
              >
                Crear una
              </button>
            </>
          )}
        </p>

        <p className="text-center text-sm text-white/30 mt-3">
          <Link to="/" className="text-white/30 hover:text-white/60 transition-colors">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  )
}
