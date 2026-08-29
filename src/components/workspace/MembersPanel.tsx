/**
 * MembersPanel
 * ------------
 * Lista de miembros de la empresa activa y formulario para invitar
 * nuevos. Muestra el gate de pago cuando corresponde ($9.99 / mes por
 * miembro adicional).
 */

import { useState } from 'react'
import { Users, UserPlus, X, Trash2, Shield } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useMembershipStore } from '@/stores/membershipStore'
import { useActiveCompany, useActiveCompanyMembers } from '@/hooks/useActiveCompany'
import {
  ADDON_PRICES,
  BASE_PLAN,
  formatMoney,
  ADDON_LABELS,
} from '@/lib/pricing'
import type { WorkspaceRole } from '@/types/workspace'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Lector',
}

export function MembersPanel() {
  const user = useAuthStore((s) => s.user)
  const { activeCompanyId, activeCompany } = useActiveCompany()
  const members = useActiveCompanyMembers()
  const canInviteGate = useMembershipStore((s) => s.canInviteGate)
  const inviteMember = useMembershipStore((s) => s.inviteMember)
  const confirmInviteMember = useMembershipStore((s) => s.confirmInviteMember)
  const removeMember = useMembershipStore((s) => s.removeMember)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('editor')
  const [showPayment, setShowPayment] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  if (!activeCompany || !activeCompanyId) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-8 text-center text-sm text-gray-500">
        Selecciona o crea una empresa para gestionar miembros.
      </div>
    )
  }

  const gate = canInviteGate(activeCompanyId)

  const resetForm = () => {
    setInviteOpen(false)
    setEmail('')
    setRole('editor')
    setShowPayment(false)
    setError(null)
  }

  const handleInvite = () => {
    if (!email.trim() || !user) {
      setError('Email requerido.')
      return
    }
    setError(null)

    if (gate.requires_payment) {
      setShowPayment(true)
      return
    }

    inviteMember(activeCompanyId, { email: email.trim(), role }, user.id)
    resetForm()
  }

  const handlePayAndInvite = () => {
    if (!user) return
    confirmInviteMember(
      activeCompanyId,
      { email: email.trim(), role },
      user.id,
      `manual_${Date.now()}`
    )
    resetForm()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 truncate">Miembros de {activeCompany.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {members.length} miembro{members.length === 1 ? '' : 's'} · Incluidos en el plan:{' '}
            {BASE_PLAN.included_members_per_company} ·{' '}
            {formatMoney(ADDON_PRICES.extra_member)}/mes por cada miembro adicional
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-medium transition-all bg-primary-500 hover:bg-primary-600"
        >
          <UserPlus size={14} />
          Invitar miembro
        </button>
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-8 text-center">
          <Users size={32} className="mx-auto text-gray-300 mb-2" />
          <div className="text-sm text-gray-500">Todavia no hay miembros registrados.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-gray-100 bg-gray-50 p-3 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-full ring-1 ring-primary-500 flex items-center justify-center shrink-0 bg-primary-500">
                {m.role === 'owner' ? (
                  <Shield size={14} className="text-primary-600" />
                ) : (
                  <Users size={14} className="text-primary-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {m.full_name || m.email}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-600">
                    {ROLE_LABELS[m.role]}
                  </span>
                  {m.billed_as_addon && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">
                      +{formatMoney(ADDON_PRICES.extra_member)}/mes
                    </span>
                  )}
                  {m.status === 'invited' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">
                      Invitado
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5 truncate">{m.email}</div>
              </div>
              {m.role !== 'owner' && (
                <button
                  onClick={() => setDeleteTarget(m.id)}
                  className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-red-600 transition-colors"
                  title="Remover miembro"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title="¿Remover a este miembro?"
        description="El miembro perderá acceso a la empresa inmediatamente."
        onConfirm={() => { if (deleteTarget) { removeMember(deleteTarget); setDeleteTarget(null) } }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Inline invite form */}
      {inviteOpen && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Invitar nuevo miembro</span>
            <button
              onClick={resetForm}
              className="p-1 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-700"
            >
              <X size={14} />
            </button>
          </div>

          {!showPayment ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary-300"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                  className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-primary-300"
                >
                  <option value="admin" className="bg-surface-ground text-gray-900">Administrador</option>
                  <option value="editor" className="bg-surface-ground text-gray-900">Editor</option>
                  <option value="viewer" className="bg-surface-ground text-gray-900">Lector</option>
                </select>
              </div>

              {gate.requires_payment && (
                <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Agregar este miembro sumara{' '}
                  <span className="font-semibold">
                    {formatMoney(gate.addon_amount)}/mes
                  </span>{' '}
                  a tu suscripcion.
                </div>
              )}
              {error && (
                <div className="text-[11px] text-red-700 bg-red-50 border border-red-300 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={resetForm}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleInvite}
                  className="px-3 py-1.5 rounded-lg text-white text-xs font-medium bg-primary-500 hover:bg-primary-600"
                >
                  {gate.requires_payment ? 'Continuar al pago' : 'Enviar invitacion'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
                <div className="text-sm font-semibold text-gray-900">
                  {ADDON_LABELS.extra_member}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Invitar a <span className="text-gray-800">{email}</span> como{' '}
                  {ROLE_LABELS[role]}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-baseline justify-between">
                  <span className="text-xs text-gray-500">Cobro mensual adicional</span>
                  <span className="text-lg font-bold text-gray-900">
                    {formatMoney(gate.addon_amount, gate.currency)}
                    <span className="text-[10px] text-gray-500 font-normal ml-1">/mes</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowPayment(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
                >
                  Volver
                </button>
                <button
                  onClick={handlePayAndInvite}
                  className="px-3 py-1.5 rounded-lg text-white text-xs font-medium bg-primary-500 hover:bg-primary-600"
                >
                  Pagar {formatMoney(gate.addon_amount)} y enviar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
