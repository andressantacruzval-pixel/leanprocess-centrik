import { useEffect } from 'react'
import { X, User, Building2, Calendar, Zap, GitBranch, FileText, AlertTriangle, BarChart2, ClipboardList, Activity } from 'lucide-react'
import type { OnboardingUserSummary } from '@/stores/analyticsStore'
import { fmtNumber } from '../adminConstants'

interface Props {
  user: OnboardingUserSummary
  onClose: () => void
}

const PLAN_BADGE: Record<string, string> = {
  free:      'bg-white/10 text-white/50',
  community: 'bg-cyan-500/10 text-cyan-400',
  pro:       'bg-blue-500/10 text-blue-400',
  max:       'bg-purple-500/10 text-purple-400',
}

function StatBox({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Icon size={12} style={{ color }} />
        <span className="text-[10px] text-white/40 uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-lg font-bold text-white">{typeof value === 'number' ? fmtNumber(value) : value}</span>
    </div>
  )
}

export function UserDetailPanel({ user, onClose }: Props) {
  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'

  const totalProcesses = (user.topLevelProcessCount ?? 0) + (user.subprocessCount ?? 0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-xl bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-6 space-y-5 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <User size={17} className="text-cyan-400" />
            </div>
            <div>
              <p className="text-white font-semibold">{user.email}</p>
              {user.name !== user.email && user.name !== 'Sin nombre' && (
                <p className="text-white/40 text-xs mt-0.5">{user.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${PLAN_BADGE[user.plan] ?? PLAN_BADGE.free}`}>
              {user.plan}
            </span>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors p-1.5 rounded-lg hover:bg-white/[0.06]">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Info empresa */}
        <div className="flex flex-wrap gap-3 text-xs text-white/50 pb-4 border-b border-white/[0.06]">
          <span className="flex items-center gap-1.5">
            <Building2 size={12} className="text-white/30" />
            {user.companyName}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar size={12} className="text-white/30" />
            Registro: {joinedDate}
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400/80">
            ✓ Onboarding completado
          </span>
        </div>

        {/* Estructura de la empresa */}
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2.5">Estructura de la empresa</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatBox label="Niveles config."  value={user.processLevelCount ?? 0}    icon={GitBranch}    color="#06b6d4" />
            <StatBox label="Macroprocesos"    value={user.macroprocessCount ?? 0}    icon={GitBranch}    color="#8b5cf6" />
            <StatBox label="Procesos"         value={user.topLevelProcessCount ?? 0} icon={Activity}     color="#3b82f6" />
            <StatBox label="Subprocesos"      value={user.subprocessCount ?? 0}      icon={Activity}     color="#6366f1" />
          </div>
          <div className="mt-1.5 px-3 py-2 bg-white/[0.02] rounded-lg text-xs text-white/40 flex justify-between">
            <span>Total procesos en el sistema</span>
            <span className="font-semibold text-white/70">{fmtNumber(totalProcesses)}</span>
          </div>
        </div>

        {/* Documentación generada */}
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2.5">Documentación generada</p>
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Diag. BPMN"    value={user.bpmnCount ?? 0}          icon={GitBranch}    color="#10b981" />
            <StatBox label="Procedimientos" value={user.procedureCount ?? 0}    icon={FileText}     color="#f59e0b" />
            <StatBox label="Riesgos"        value={user.riskCount ?? 0}         icon={AlertTriangle} color="#ef4444" />
            <StatBox label="Indicadores"    value={user.indicatorCount ?? 0}    icon={BarChart2}    color="#06b6d4" />
            <StatBox label="Auditorías"     value={user.auditCount ?? 0}        icon={ClipboardList} color="#8b5cf6" />
            <StatBox label="Anál. Valor"    value={user.valueActivityCount ?? 0} icon={Activity}    color="#f97316" />
          </div>
        </div>

        {/* Uso de IA */}
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2.5">Uso de inteligencia artificial</p>
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Tokens usados"  value={user.totalTokens ?? 0}        icon={Zap} color="#f59e0b" />
            <StatBox label="Gasto USD"      value={`$${(user.totalAiCostUsd ?? 0).toFixed(3)}`} icon={Zap} color="#10b981" />
          </div>
          {(user.totalTokens ?? 0) > 0 && (
            <div className="mt-2 w-full bg-white/[0.06] rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: '100%' }} />
            </div>
          )}
          {(user.totalTokens ?? 0) === 0 && (
            <p className="text-xs text-white/25 mt-2">Sin uso de IA en el periodo seleccionado.</p>
          )}
        </div>

      </div>
    </div>
  )
}
