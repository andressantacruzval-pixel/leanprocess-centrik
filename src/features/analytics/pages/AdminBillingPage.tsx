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
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-8 transition-colors"
      >
        <ArrowLeft size={14} /> Volver al admin
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
          <Zap size={20} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-gray-900 font-semibold">Créditos y Billing</h1>
          <p className="text-gray-500 text-sm">Gestionado desde LeanProcess Lite (HUB)</p>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-600 text-sm">
          El sistema de créditos está centralizado en{' '}
          <span className="text-gray-900 font-medium">LeanProcess Lite</span>.
        </p>
        <p className="text-gray-500 text-xs mt-2">
          Administra wallets, planes y transacciones desde el HUB.
        </p>
      </div>
    </div>
  )
}
