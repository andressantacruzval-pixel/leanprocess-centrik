import { useState } from 'react'
import { TriangleAlert, AlertCircle, RotateCcw } from 'lucide-react'
import { useProcessStore } from '@/stores/processStore'
import { useRiskStore } from '@/stores/riskStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useProcedureStore } from '@/stores/procedureStore'
import { useAuditStore } from '@/stores/auditStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useChangeLogStore } from '@/stores/changeLogStore'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useOnboardingStore } from '@/features/onboarding/onboardingStore'
import { resetCompany } from '@/services/companies.service'
import { toast } from '@/stores/toastStore'

type Step = 1 | 2 | 3

interface ResetableCompany {
  id: string
  name: string
}

const DELETED_ITEMS = [
  'Macroprocesos, procesos y subprocesos',
  'Diagramas BPMN',
  'Procedimientos y pasos documentados',
  'Indicadores KPI y lecturas registradas',
  'Riesgos y controles de mitigación',
  'Programas de auditoría',
  'Análisis de valor (VA / NVA / NVABN)',
  'Catálogos SIPOC (proveedores, clientes, entradas/salidas)',
  'Catálogos de dropdowns personalizados',
  'Niveles de proceso y organigrama',
  'Historial de cambios y notificaciones',
]

const KEPT_ITEMS = [
  'Nombre de la empresa y datos generales',
  'Miembros del equipo y roles',
  'Suscripción y plan activo',
]

interface Props {
  open: boolean
  company: ResetableCompany
  onClose: () => void
  onSuccess: () => void
}

export function ResetCompanyModal({ open, company, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)

  const expectedText = `Confirmo eliminar ${company.name}`
  const isMatch = confirmText === expectedText

  const handleClose = () => {
    setStep(1)
    setConfirmText('')
    setLoading(false)
    onClose()
  }

  const handleReset = async () => {
    setLoading(true)

    // Capturar processIds ANTES de limpiar el store
    const processIds = useProcessStore.getState().processes
      .filter((p) => p.company_id === company.id)
      .map((p) => p.id)

    const { error } = await resetCompany(company.id)
    if (error) {
      console.warn('[ResetCompanyModal]', error.message)
      toast.error('Error al reiniciar la empresa. Intenta de nuevo.')
      setLoading(false)
      return
    }

    // Limpiar stores locales
    useProcessStore.getState().clearCompanyData(company.id)
    useRiskStore.getState().clearCompanyData(company.id)
    useIndicatorStore.getState().clearCompanyData(company.id)
    useProcedureStore.getState().clearProcesses(processIds)
    useAuditStore.getState().clearProcesses(processIds)
    useValueAnalysisStore.getState().clearProcesses(processIds)
    useChangeLogStore.getState().clearProcesses(processIds)
    useCatalogStore.getState().clearCompanyData(company.id)
    useCompanyStore.getState().resetAll()
    useOnboardingStore.getState().resetOnboarding()

    // Marcar empresa como onboarding pendiente en workspaceStore
    useWorkspaceStore.setState((s) => ({
      companies: s.companies.map((c) =>
        c.id === company.id ? { ...c, onboarding_completed: false } : c
      ),
    }))

    toast.success('Empresa reiniciada. Comenzando onboarding...')
    onSuccess()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/45" onClick={handleClose} />

      <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center gap-2 mb-1">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  n <= step ? 'bg-amber-500' : 'bg-gray-100'
                }`}
              />
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Paso {step} de 3</p>
        </div>

        {/* Step 1 — Advertencia */}
        {step === 1 && (
          <div className="p-6">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
                <TriangleAlert size={28} className="text-amber-600" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">
              ¿Reiniciar empresa de fábrica?
            </h2>
            <p className="text-sm text-gray-500 text-center mb-5">
              Esta acción eliminará <span className="text-gray-900 font-medium">toda la información operativa</span> de{' '}
              <span className="text-amber-700 font-medium">{company.name}</span>.
            </p>

            <div className="space-y-3 mb-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide mb-2">Se eliminará</p>
                <ul className="space-y-1">
                  {DELETED_ITEMS.map((item) => (
                    <li key={item} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <span className="text-red-600 mt-0.5">✕</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide mb-2">Se conservará</p>
                <ul className="space-y-1">
                  {KEPT_ITEMS.map((item) => (
                    <li key={item} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <span className="text-emerald-600 mt-0.5">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-lg bg-amber-100 hover:bg-amber-100 border border-amber-300 text-sm text-amber-700 font-medium transition-colors"
              >
                Entiendo, continuar →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Consecuencias irreversibles */}
        {step === 2 && (
          <div className="p-6">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle size={28} className="text-red-600" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">
              Esta acción no se puede deshacer
            </h2>
            <div className="space-y-3 my-5 text-sm text-gray-600 leading-relaxed">
              <p>
                Al reiniciar la empresa, <span className="text-gray-900">toda la información operativa será eliminada de forma permanente</span>.
                No existe forma de recuperarla.
              </p>
              <p>
                La empresa volverá al estado inicial y se lanzará el{' '}
                <span className="text-gray-900">onboarding desde cero</span>. Podrás elegir
                nuevamente los niveles de proceso, el organigrama y toda la configuración.
              </p>
              <p className="text-amber-700">
                Los miembros del equipo se mantendrán, pero no tendrán acceso a ningún proceso
                hasta que los crees de nuevo.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-colors"
              >
                ← Volver
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-lg bg-red-100 hover:bg-red-100 border border-red-300 text-sm text-red-700 font-medium transition-colors"
              >
                Sí, quiero reiniciar →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Confirmación por texto */}
        {step === 3 && (
          <div className="p-6">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <RotateCcw size={28} className="text-red-600" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">
              Confirma el reinicio
            </h2>
            <p className="text-sm text-gray-500 text-center mb-5">
              Para confirmar, escribe exactamente:
            </p>

            <div className="mb-4">
              <p className="text-sm font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center mb-3 select-all">
                {expectedText}
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={expectedText}
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-red-300 focus:ring-1 focus:ring-red-500 transition-colors"
              />
              {confirmText.length > 0 && !isMatch && (
                <p className="text-[11px] text-red-600 mt-1">
                  El texto no coincide exactamente.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-colors disabled:opacity-40"
              >
                ← Volver
              </button>
              <button
                onClick={handleReset}
                disabled={!isMatch || loading}
                className="flex-1 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-sm text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RotateCcw size={14} className="animate-spin" />
                    Reiniciando...
                  </>
                ) : (
                  'Reiniciar empresa'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
