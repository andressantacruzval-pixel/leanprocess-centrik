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
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-sm text-white/40">
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
          <h2 className="text-lg font-semibold text-white truncate">Miembros de {activeCompany.name}</h2>
          <p className="text-xs text-white/40 mt-0.5">
            {members.length} miembro{members.length === 1 ? '' : 's'} · Incluidos en el plan:{' '}
            {BASE_PLAN.included_members_per_company} ·{' '}
            {formatMoney(ADDON_PRICES.extra_member)}/mes por cada miembro adicional
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-medium transition-all"
        >
          <UserPlus size={14} />
          Invitar miembro
        </button>
      </div>

      {members.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
          <Users size={32} className="mx-auto text-white/20 mb-2" />
          <div className="text-sm text-white/50">Todavia no hay miembros registrados.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-cyan-500/30 flex items-center justify-center shrink-0">
                {m.role === 'owner' ? (
                  <Shield size={14} className="text-cyan-400" />
                ) : (
                  <Users size={14} className="text-cyan-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">
                    {m.full_name || m.email}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/60">
                    {ROLE_LABELS[m.role]}
                  </span>
                  {m.billed_as_addon && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                      +{formatMoney(ADDON_PRICES.extra_member)}/mes
                    </span>
                  )}
                  {m.status === 'invited' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300">
                      Invitado
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-white/40 mt-0.5 truncate">{m.email}</div>
              </div>
              {m.role !== 'owner' && (
                <button
                  onClick={() => setDeleteTarget(m.id)}
                  className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-red-400 transition-colors"
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
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.03] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Invitar nuevo miembro</span>
            <button
              onClick={resetForm}
              className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70"
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
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-500/40"
                >
                  <option value="admin" className="bg-[#0b1020] text-white">Administrador</option>
                  <option value="editor" className="bg-[#0b1020] text-white">Editor</option>
                  <option value="viewer" className="bg-[#0b1020] text-white">Lector</option>
                </select>
              </div>

              {gate.requires_payment && (
                <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  Agregar este miembro sumara{' '}
                  <span className="font-semibold">
                    {formatMoney(gate.addon_amount)}/mes
                  </span>{' '}
                  a tu suscripcion.
                </div>
              )}
              {error && (
                <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={resetForm}
                  className="px-3 py-1.5 text-xs text-white/60 hover:text-white/90"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleInvite}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-medium"
                >
                  {gate.requires_payment ? 'Continuar al pago' : 'Enviar invitacion'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                <div className="text-sm font-semibold text-white">
                  {ADDON_LABELS.extra_member}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  Invitar a <span className="text-white/80">{email}</span> como{' '}
                  {ROLE_LABELS[role]}
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 flex items-baseline justify-between">
                  <span className="text-xs text-white/40">Cobro mensual adicional</span>
                  <span className="text-lg font-bold text-white">
                    {formatMoney(gate.addon_amount, gate.currency)}
                    <span className="text-[10px] text-white/40 font-normal ml-1">/mes</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowPayment(false)}
                  className="px-3 py-1.5 text-xs text-white/60 hover:text-white/90"
                >
                  Volver
                </button>
                <button
                  onClick={handlePayAndInvite}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-medium"
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
