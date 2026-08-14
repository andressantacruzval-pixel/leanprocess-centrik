import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Zap } from 'lucide-react'
import { useAsync } from '@/hooks/useAsync'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const { loading, error, run } = useAsync()
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await run(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      })
      if (error) throw new Error(error.message)
      setSuccess(true)
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
            Recuperar contraseña
          </h1>
          <p className="text-white/40">Te enviaremos un enlace a tu correo</p>
        </div>

        {success ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
            <p className="text-green-400 text-sm leading-relaxed">
              ¡Correo enviado! Revisa tu bandeja de entrada y sigue el enlace para restablecer tu contraseña.
            </p>
            <Link
              to="/login"
              className="inline-block mt-4 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm border border-red-500/20">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white/40 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30"
                placeholder="tu@email.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-2.5 rounded-xl hover:from-cyan-500 hover:to-blue-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20"
            >
              {loading ? 'Enviando...' : 'Enviar enlace'}
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
