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
            Recuperar contraseña
          </h1>
          <p className="text-gray-500">Te enviaremos un enlace a tu correo</p>
        </div>

        {success ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
            <p className="text-emerald-600 text-sm leading-relaxed">
              ¡Correo enviado! Revisa tu bandeja de entrada y sigue el enlace para restablecer tu contraseña.
            </p>
            <Link
              to="/login"
              className="inline-block mt-4 text-sm text-primary-600 hover:text-primary-700 transition-colors"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-300"
                placeholder="tu@email.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-2.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg bg-primary-500 hover:bg-primary-600"
            >
              {loading ? 'Enviando...' : 'Enviar enlace'}
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
