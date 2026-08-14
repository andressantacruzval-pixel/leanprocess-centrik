import { useMemo, useEffect } from 'react'
import {
  Plus,
  GitBranch,
  BookOpen,
  ShieldAlert,
  TrendingUp,
  ClipboardCheck,
  Activity,
  Edit3,
  History,
  X,
  Loader2,
} from 'lucide-react'
import { useChangeLogStore, PAGINA_HISTORIAL, type ChangeAction } from '@/stores/changeLogStore'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

const ACTION_CONFIG: Record<ChangeAction, { icon: React.ElementType; color: string; bg: string }> = {
  created:              { icon: Plus,           color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  bpmn_updated:         { icon: GitBranch,      color: 'text-cyan-400',    bg: 'bg-cyan-500/20' },
  procedure_generated:  { icon: BookOpen,       color: 'text-blue-400',    bg: 'bg-blue-500/20' },
  risks_identified:     { icon: ShieldAlert,    color: 'text-amber-400',   bg: 'bg-amber-500/20' },
  kpis_defined:         { icon: TrendingUp,     color: 'text-purple-400',  bg: 'bg-purple-500/20' },
  audit_created:        { icon: ClipboardCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  value_analyzed:       { icon: Activity,       color: 'text-cyan-400',    bg: 'bg-cyan-500/20' },
  manual_edit:          { icon: Edit3,          color: 'text-white/50',    bg: 'bg-white/10' },
}

interface ChangeTimelineProps {
  processId: string
}

export function ChangeTimeline({ processId }: ChangeTimelineProps) {
  const allEntries = useChangeLogStore((s) => s.entries)
  const cargarHistorial = useChangeLogStore((s) => s.cargarHistorial)
  const pagina = useChangeLogStore((s) => s.paginas[processId])

  // El historial se pide cuando se abre, no al iniciar sesion. Si ya se trajo en
  // esta sesion, el store lo tiene y esto no vuelve a consultar.
  useEffect(() => {
    if (!pagina?.cargado) void cargarHistorial(processId)
  }, [processId, pagina?.cargado, cargarHistorial])

  const entries = useMemo(
    () => allEntries.filter((e) => e.process_id === processId),
    [allEntries, processId]
  )

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-white/30 text-xs gap-2">
        {pagina?.cargando ? (
          <>
            <Loader2 size={24} className="animate-spin" />
            <span>Cargando historial...</span>
          </>
        ) : (
          <>
            <History size={24} />
            <span>Sin cambios registrados</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-white/10" />

      <div className="flex flex-col gap-4">
        {entries.map((entry) => {
          const config = ACTION_CONFIG[entry.action]
          const Icon = config.icon
          return (
            <div key={entry.id} className="relative flex gap-3 items-start">
              {/* Dot */}
              <div
                className={`absolute -left-6 top-0.5 w-[22px] h-[22px] rounded-full flex items-center justify-center ${config.bg} ring-2 ring-[#070b14]`}
              >
                <Icon size={11} className={config.color} />
              </div>

              {/* Content */}
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[11px] text-white/70 leading-snug">
                  {entry.description}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30">
                    {formatRelativeTime(entry.timestamp)}
                  </span>
                  <span className="text-[10px] text-white/20">
                    {entry.author}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* «Ver mas» trae la siguiente pagina del SERVIDOR y la deja en memoria; no
          vuelve a consultar al reabrir la pestaña. Solo aparece si queda algo. */}
      {!pagina?.completo && (
        <button
          onClick={() => void cargarHistorial(processId)}
          disabled={pagina?.cargando}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-medium text-white/50 hover:text-white/80 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-colors disabled:opacity-50"
        >
          {pagina?.cargando ? (
            <><Loader2 size={12} className="animate-spin" /> Cargando...</>
          ) : (
            <>Ver {PAGINA_HISTORIAL} mas</>
          )}
        </button>
      )}

      {pagina?.completo && entries.length > PAGINA_HISTORIAL && (
        <p className="mt-4 text-center text-[10px] text-white/20">
          {entries.length} cambios — no hay mas
        </p>
      )}
    </div>
  )
}

interface ChangeTimelinePanelProps {
  processId: string
  open: boolean
  onToggle: () => void
}

export function ChangeTimelinePanel({ processId, open, onToggle }: ChangeTimelinePanelProps) {
  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={`absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
          open
            ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
            : 'bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 border border-white/5'
        }`}
        title="Historial de Cambios"
      >
        <History size={12} />
        <span className="hidden sm:inline">Historial</span>
      </button>

      {/* Slide-in panel */}
      <div
        className={`absolute top-0 right-0 bottom-0 z-10 w-[280px] bg-[#070b14]/95 backdrop-blur-md border-l border-white/5 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="text-xs font-semibold text-white/80">Historial de Cambios</h3>
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <ChangeTimeline processId={processId} />
        </div>
      </div>
    </>
  )
}
