/**
 * CompaniesPanel
 * ---------------
 * Lista de empresas del usuario en Settings. Permite:
 *  - activar otra empresa
 *  - abrir el modal de creacion
 *  - eliminar una empresa (con confirmacion)
 *
 * Muestra un badge con el estado de billing (incluida / add-on) por
 * cada empresa usando los add-ons del workspaceStore.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Building2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useAuthStore } from '@/stores/authStore'
import { formatMoney, BASE_PLAN, ADDON_PRICES } from '@/lib/pricing'
import { IS_PHASE_1 } from '@/lib/phaseFlags'
import { CreateCompanyModal } from './CreateCompanyModal'
import { EditCompanyModal } from './EditCompanyModal'
import { ResetCompanyModal } from './ResetCompanyModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

export function CompaniesPanel() {
  const companies = useWorkspaceStore((s) => s.companies)
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)
  const addOns = useWorkspaceStore((s) => s.addOns)
  const setActiveCompany = useWorkspaceStore((s) => s.setActiveCompany)
  const deleteCompany = useWorkspaceStore((s) => s.deleteCompany)
  const syncCompany = useCompanyStore((s) => s.syncWithActiveCompany)
  const userId = useAuthStore((s) => s.user?.id)
  const navigate = useNavigate()

  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const editCompanyObj = companies.find((c) => c.id === editTarget)

  const hasExtraCompanyAddon = (companyId: string) =>
    addOns.some(
      (a) =>
        a.type === 'extra_company' &&
        a.company_id === companyId &&
        a.status === 'active'
    )

  const handleActivate = (id: string) => {
    setActiveCompany(id)
    syncCompany(companies.find((c) => c.id === id) ?? null)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    deleteCompany(deleteTarget)
    setDeleteTarget(null)
  }

  const targetCompany = companies.find((c) => c.id === deleteTarget)
  const resetCompanyObj = companies.find((c) => c.id === resetTarget)

  const handleResetSuccess = () => {
    setResetTarget(null)
    navigate('/onboarding')
  }

  const isOwner = (companyId: string) =>
    (companies.find((c) => c.id === companyId) as unknown as { user_id?: string })?.user_id === userId

  const ownedCompanies = companies.filter(
    (c) => (c as unknown as { user_id?: string }).user_id === userId
  )
  const canDelete = (companyId: string) =>
    isOwner(companyId) && ownedCompanies.length > 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">Mis empresas</h2>
          {!IS_PHASE_1 && (
            <p className="text-xs text-white/40 mt-0.5">
              {companies.length} de {BASE_PLAN.included_companies} incluidas en tu plan —{' '}
              {formatMoney(ADDON_PRICES.extra_company)}/mes por cada empresa adicional.
            </p>
          )}
        </div>
        {!IS_PHASE_1 && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-medium transition-all"
          >
            <Plus size={14} />
            Nueva empresa
          </button>
        )}
      </div>

      {companies.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
          <Building2 size={32} className="mx-auto text-white/20 mb-2" />
          <div className="text-sm text-white/50">
            Aun no has creado ninguna empresa.
          </div>
          {!IS_PHASE_1 && (
            <button
              onClick={() => setModalOpen(true)}
              className="mt-3 text-sm text-cyan-400 hover:text-cyan-300"
            >
              Crear tu primera empresa
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {companies.map((c) => {
            const isActive = c.id === activeCompanyId
            const isExtra = !IS_PHASE_1 && hasExtraCompanyAddon(c.id)
            return (
              <div
                key={c.id}
                className={`rounded-xl border p-4 transition-all ${
                  isActive
                    ? 'bg-cyan-500/5 border-cyan-500/30'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-gradient-to-br from-cyan-500/30 to-blue-500/30 ring-1 ring-cyan-500/40'
                        : 'bg-white/5'
                    }`}
                  >
                    <Building2
                      size={16}
                      className={isActive ? 'text-cyan-400' : 'text-white/50'}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {c.name}
                      </span>
                      {isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-medium">
                          Activa
                        </span>
                      )}
                      {isExtra ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
                          Add-on {formatMoney(ADDON_PRICES.extra_company)}/mes
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-medium">
                          Incluida en el plan
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-white/40 mt-0.5 truncate">
                      {c.industry ?? 'Sin industria'}
                      {c.country && ` · ${c.country}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!isActive && (
                      <button
                        onClick={() => handleActivate(c.id)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
                      >
                        Activar
                      </button>
                    )}
                    {isOwner(c.id) && (
                      <button
                        onClick={() => setEditTarget(c.id)}
                        className="p-2 rounded-lg transition-colors hover:bg-white/5 text-white/30 hover:text-cyan-400"
                        title="Editar empresa"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {isOwner(c.id) && (
                      <button
                        onClick={() => setResetTarget(c.id)}
                        className="p-2 rounded-lg transition-colors hover:bg-white/5 text-white/30 hover:text-amber-400"
                        title="Reiniciar empresa de fábrica"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                    {canDelete(c.id) && (
                      <button
                        onClick={() => setDeleteTarget(c.id)}
                        className="p-2 rounded-lg transition-colors hover:bg-white/5 text-white/30 hover:text-red-400"
                        title="Eliminar empresa"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CreateCompanyModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {editCompanyObj && (
        <EditCompanyModal
          open={!!editTarget}
          company={editCompanyObj}
          onClose={() => setEditTarget(null)}
        />
      )}

      {resetCompanyObj && (
        <ResetCompanyModal
          open={!!resetTarget}
          company={resetCompanyObj}
          onClose={() => setResetTarget(null)}
          onSuccess={handleResetSuccess}
        />
      )}

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title={`¿Eliminar la empresa «${targetCompany?.name ?? ''}»?`}
        description="Se eliminarán todos los procesos, riesgos e indicadores asociados."
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
