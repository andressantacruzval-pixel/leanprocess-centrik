import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export default function AdminBillingPage() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)

  if (!profile?.is_admin) {
    navigate('/app')
    return null
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/app/admin')}
        className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-8 transition-colors"
      >
        <ArrowLeft size={14} /> Volver al admin
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <Zap size={20} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-white font-semibold">Créditos y Billing</h1>
          <p className="text-white/40 text-sm">Gestionado desde LeanProcess Lite (HUB)</p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <p className="text-white/60 text-sm">
          El sistema de créditos está centralizado en{' '}
          <span className="text-white font-medium">LeanProcess Lite</span>.
        </p>
        <p className="text-white/40 text-xs mt-2">
          Administra wallets, planes y transacciones desde el HUB.
        </p>
      </div>
    </div>
  )
}
