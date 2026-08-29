/**
 * CreateCompanyModal
 * ------------------
 * Flujo en dos pasos:
 *  1. Datos de la empresa (nombre, industria, pais).
 *  2. Si el plan base NO cubre la empresa, muestra confirmacion de
 *     cobro ($29.99) antes de materializarla.
 *
 * La pasarela real (Stripe Checkout / Paddle) se engancha en el boton
 * "Pagar y crear". Hoy el modal llama directamente a
 * `confirmCreateCompany`, que registra el add-on extra_company como
 * provider 'manual' — suficiente para poder navegar en desarrollo.
 */

import { useState } from 'react'
import { Building2, X, CreditCard, Check } from 'lucide-react'
import { ComboboxSelect } from '@/components/ui/ComboboxSelect'
import { INDUSTRY_OPTIONS, COUNTRY_OPTIONS } from '@/utils/selectOptions'
import { useAuthStore } from '@/stores/authStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useMembershipStore } from '@/stores/membershipStore'
import { ADDON_DESCRIPTIONS, ADDON_LABELS, formatMoney } from '@/lib/pricing'

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (companyId: string) => void
}

type Step = 'form' | 'payment' | 'success'

export function CreateCompanyModal({ open, onClose, onCreated }: Props) {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const createCompany = useWorkspaceStore((s) => s.createCompany)
  const confirmCreate = useWorkspaceStore((s) => s.confirmCreateCompany)
  const canCreateGate = useWorkspaceStore((s) => s.canCreateCompanyGate)
  const setActiveCompany = useWorkspaceStore((s) => s.setActiveCompany)
  const syncCompany = useCompanyStore((s) => s.syncWithActiveCompany)
  const ensureOwner = useMembershipStore((s) => s.ensureOwner)

  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [country, setCountry] = useState('')
  const [description, setDescription] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [_createdId, setCreatedId] = useState<string | null>(null)

  const gate = canCreateGate()

  const reset = () => {
    setStep('form')
    setName('')
    setIndustry('')
    setCountry('')
    setDescription('')
    setError(null)
    setCreatedId(null)
    setProcessing(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleNext = () => {
    if (!name.trim()) {
      setError('Ingresa un nombre para la empresa.')
      return
    }
    setError(null)

    if (!user) {
      setError('Necesitas estar autenticado.')
      return
    }

    if (!gate.allowed) {
      setError(gate.reason ?? 'No es posible crear empresas en este momento.')
      return
    }

    if (gate.requires_payment) {
      setStep('payment')
      return
    }

    // Primer empresa — incluida en el plan.
    const { company } = createCompany(
      { name: name.trim(), industry, country, description },
      user.id
    )
    if (company) {
      ensureOwner(company.id, user.id, profile?.email ?? user.email ?? '', profile?.full_name)
      setActiveCompany(company.id)
      syncCompany(company)
      setCreatedId(company.id)
      setStep('success')
      onCreated?.(company.id)
    }
  }

  const handlePay = async () => {
    if (!user) return
    setProcessing(true)
    setError(null)
    try {
      // TODO: integrar Stripe Checkout. Por ahora registramos localmente.
      const company = confirmCreate(
        {
          draft: { name: name.trim(), industry, country, description },
          paymentRef: `manual_${Date.now()}`,
          provider: 'manual',
        },
        user.id
      )
      ensureOwner(company.id, user.id, profile?.email ?? user.email ?? '', profile?.full_name)
      setActiveCompany(company.id)
      syncCompany(company)
      setCreatedId(company.id)
      setStep('success')
      onCreated?.(company.id)
    } catch {
      setError('No se pudo procesar el cobro. Intenta de nuevo.')
    } finally {
      setProcessing(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/45 flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg ring-1 ring-primary-500 flex items-center justify-center bg-primary-100">
              <Building2 size={16} className="text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Nueva empresa</h2>
              <p className="text-xs text-gray-500">
                {step === 'form' && 'Datos principales de la empresa'}
                {step === 'payment' && 'Confirmar cobro de empresa adicional'}
                {step === 'success' && 'Empresa creada'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step === 'form' && (
            <>
              <Field label="Nombre de la empresa *">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Acme Corp"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary-300"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Industria">
                  <ComboboxSelect
                    value={industry}
                    onChange={setIndustry}
                    options={INDUSTRY_OPTIONS}
                    placeholder="Buscar industria..."
                  />
                </Field>
                <Field label="País">
                  <ComboboxSelect
                    value={country}
                    onChange={setCountry}
                    options={COUNTRY_OPTIONS}
                    placeholder="Buscar país..."
                  />
                </Field>
              </div>
              <Field label="Descripcion breve">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Ej: Consultoria de procesos para clientes de retail"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary-300 resize-none"
                />
              </Field>

              {/* Info del gate */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs">
                {gate.requires_payment ? (
                  <>
                    <div className="text-gray-500">
                      Esta sera tu empresa numero{' '}
                      <span className="text-gray-800 font-semibold">
                        {useWorkspaceStore.getState().companies.length + 1}
                      </span>
                      .
                    </div>
                    <div className="mt-1 text-primary-600">
                      Se agregara un cobro adicional de{' '}
                      <span className="font-semibold">
                        {formatMoney(gate.addon_amount, gate.currency)}/mes
                      </span>{' '}
                      a tu suscripcion.
                    </div>
                  </>
                ) : (
                  <div className="text-emerald-600">
                    Tu plan incluye esta empresa sin costo adicional.
                  </div>
                )}
              </div>
            </>
          )}

          {step === 'payment' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
                <div className="flex items-start gap-3">
                  <CreditCard size={18} className="text-primary-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">
                      {ADDON_LABELS.extra_company}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {ADDON_DESCRIPTIONS.extra_company}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-baseline justify-between">
                  <span className="text-xs text-gray-500">Se agrega a tu ciclo mensual</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {formatMoney(gate.addon_amount, gate.currency)}
                    <span className="text-xs text-gray-500 font-normal ml-1">/mes</span>
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Al confirmar, agregaras la empresa <span className="text-gray-700">{name}</span>{' '}
                y tu siguiente factura reflejara el cambio.
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="py-6 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 ring-1 ring-emerald-500 flex items-center justify-center">
                <Check size={24} className="text-emerald-600" />
              </div>
              <div>
                <div className="text-base font-semibold text-gray-900">Empresa creada</div>
                <p className="text-xs text-gray-500 mt-1">
                  <span className="text-gray-800">{name}</span> esta lista. Iniciaras el
                  onboarding de esta empresa al cerrar.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-300 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex flex-wrap items-center justify-end gap-2">
          {step === 'form' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleNext}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all bg-primary-500 hover:bg-primary-600"
              >
                {gate.requires_payment ? 'Continuar al pago' : 'Crear empresa'}
              </button>
            </>
          )}

          {step === 'payment' && (
            <>
              <button
                onClick={() => setStep('form')}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handlePay}
                disabled={processing}
                className="px-4 py-2 rounded-lg disabled:opacity-50 text-white text-sm font-medium transition-all bg-primary-500 hover:bg-primary-600"
              >
                {processing ? 'Procesando...' : `Pagar ${formatMoney(gate.addon_amount)} y crear`}
              </button>
            </>
          )}

          {step === 'success' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all bg-primary-500 hover:bg-primary-600"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">{label}</div>
      {children}
    </label>
  )
}
