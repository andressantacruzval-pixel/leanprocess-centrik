import { useMemo, useState } from 'react'
import { Layers, GitBranch, ChevronDown, AlertTriangle, ExternalLink, Trash2, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { useProcessHealth, type ProcessHealthChecks } from '@/hooks/useProcessHealth'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { isDocumentable } from '@/lib/processLevels'
import { usePlanLimits } from '@/hooks/useActiveCompany'
import { planName } from '@/lib/plans'
import { avisarSiSinCupo } from '@/lib/planGateMessage'
import { DepurarProcesosModal } from '../components/DepurarProcesosModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { PROCESS_CATEGORIES } from '@/lib/constants'
import type { Process, Macroprocess } from '@/types/process'
import type { ProcessHealthMap } from '@/hooks/useProcessHealth'

// ── Constantes ─────────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, string> = {
  estrategico: 'bg-red-500/10 text-red-400',
  productivo:  'bg-white/10 text-white/50',
  apoyo:       'bg-violet-500/10 text-violet-400',
}

const CHECKS: { key: keyof ProcessHealthChecks; short: string; label: string }[] = [
  { key: 'bpmn',          short: 'B', label: 'BPMN' },
  { key: 'procedure',     short: 'P', label: 'Procedimiento' },
  { key: 'kpis',          short: 'K', label: 'KPIs' },
  { key: 'risks',         short: 'R', label: 'Riesgos' },
  { key: 'audit',         short: 'A', label: 'Auditoría' },
  { key: 'valueAnalysis', short: 'V', label: 'Valor' },
]

// ── Helpers de UI ──────────────────────────────────────────────────────────

/**
 * El boton de entrar se ve apagado pero SIGUE pulsandose: al hacerlo explica por que
 * no se puede. Un boton muerto no dice nada y se lee como un fallo de la aplicacion.
 *
 * Clase literal, no interpolada: Tailwind no compila clases hechas con plantilla.
 */
const CLASE_ENTRADA_BLOQUEADA =
  'p-1 rounded text-white/10 cursor-not-allowed shrink-0'

function CandadoDeCupo({ motivo }: { motivo: string }) {
  return (
    <span
      title={motivo}
      className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-400/80 border border-amber-500/20"
    >
      <Lock size={8} />
      Sin cupo
    </span>
  )
}

/**
 * El ancho de esta barra es la columna derecha del arbol entero: el hueco reservado
 * cuando no hay salud (`HUECO_SALUD`) tiene que valer exactamente lo mismo, o las
 * filas con y sin datos dejan de alinearse. Estaban descuadradas: `w-28` frente a
 * `w-36` en la rama "Sin datos".
 */
const ANCHO_SALUD = 'w-20 sm:w-28'
const HUECO_SALUD = <span className={`${ANCHO_SALUD} shrink-0`} />

function HealthBar({ score }: { score: number }) {
  const color = score >= 67 ? 'bg-emerald-400' : score >= 34 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className={`flex items-center gap-2 shrink-0 ${ANCHO_SALUD}`}>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] text-white/40 w-8 text-right">{score}%</span>
    </div>
  )
}

function CheckDots({ checks }: { checks: ProcessHealthChecks }) {
  // `shrink-0`: sin el, estos ~108px eran lo primero que se deformaba al estrechar.
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {CHECKS.map((c) => (
        <span
          key={c.key}
          title={c.label}
          className={`text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded ${
            checks[c.key] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/20'
          }`}
        >
          {c.short}
        </span>
      ))}
    </div>
  )
}

// ── Filas del árbol ────────────────────────────────────────────────────────

interface MacroRowProps {
  macro: Macroprocess
  isOpen: boolean
  avgScore: number | null
  childCount: number
  levelName: string
  onToggle: () => void
}

function MacroRow({ macro, isOpen, avgScore, childCount, levelName, onToggle }: MacroRowProps) {
  const catStyle = CATEGORY_STYLE[macro.category] ?? 'bg-white/10 text-white/40'
  const catLabel = PROCESS_CATEGORIES[macro.category as keyof typeof PROCESS_CATEGORIES]?.label ?? macro.category
  return (
    <div
      onClick={onToggle}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 cursor-pointer hover:bg-white/[0.07] transition-all"
    >
      <ChevronDown size={14} className={`text-white/30 transition-transform shrink-0 ${isOpen ? '' : '-rotate-90'}`} />
      <GitBranch size={15} className="text-blue-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{macro.name}</p>
        <p className="text-[10px] text-white/30">{childCount} {levelName.toLowerCase()}(s)</p>
      </div>
      <span className={`hidden sm:inline text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${catStyle}`}>{catLabel}</span>
      {avgScore !== null ? <HealthBar score={avgScore} /> : HUECO_SALUD}
    </div>
  )
}

interface ProcessRowProps {
  process: Process
  health: { score: number; checks: ProcessHealthChecks } | undefined
  /** Si este proceso admite documentación (está en el nivel más bajo declarado).
   *  Antes se usaba `childCount === 0`, que trataba una rama vacía como hoja y le
   *  pedía los 6 documentos. Ver @/lib/processLevels. */
  documentable: boolean
  /** Motivo por el que no cabe en el cupo del plan, o undefined si sí cabe.
   *  Son dos cosas distintas: `documentable` es el NIVEL (estructura) y esto es el
   *  CUPO (plan). Un proceso puede ser documentable y no caber. */
  bloqueo?: string
  isOpen: boolean
  onToggle: () => void
  onNavigate: () => void
}

function ProcessRow({ process, health, documentable, bloqueo, isOpen, onToggle, onNavigate }: ProcessRowProps) {
  return (
    <>
      <div
        onClick={onToggle}
        className="flex items-center gap-2 pl-5 sm:pl-8 pr-3 py-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 cursor-pointer transition-all"
      >
        <ChevronDown size={12} className={`text-white/20 transition-transform shrink-0 ${isOpen ? '' : '-rotate-90'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-white truncate">{process.name}</p>
            {process.is_critical && <AlertTriangle size={10} className="text-amber-400 shrink-0" />}
            {bloqueo && <CandadoDeCupo motivo={bloqueo} />}
          </div>
        </div>
        {health ? <HealthBar score={health.score} /> : HUECO_SALUD}
        {documentable && (
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate() }}
            className={bloqueo ? CLASE_ENTRADA_BLOQUEADA : 'p-1 rounded text-white/20 hover:text-white/70 hover:bg-white/10 transition-colors shrink-0'}
            title={bloqueo ?? 'Ir al detalle'}
          >
            <ExternalLink size={12} />
          </button>
        )}
      </div>
      {isOpen && documentable && health && (
        <div className="pl-8 sm:pl-12 pr-4 py-2 ml-5 sm:ml-8 border-l border-white/5">
          <CheckDots checks={health.checks} />
        </div>
      )}
    </>
  )
}

function SubprocessRow({
  process,
  health,
  bloqueo,
  onNavigate,
}: {
  process: Process
  health: { score: number; checks: ProcessHealthChecks } | undefined
  bloqueo?: string
  onNavigate: () => void
}) {
  return (
    <div className="flex items-center gap-2 pl-10 sm:pl-16 pr-3 py-2 rounded-lg hover:bg-white/[0.03] transition-all">
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <p className="text-xs text-white/80 truncate">{process.name}</p>
        {bloqueo && <CandadoDeCupo motivo={bloqueo} />}
      </div>
      {health ? (
        <>
          {/* En movil los checks ceden el sitio al nombre, que es lo que se lee */}
          <span className="hidden sm:flex">
            <CheckDots checks={health.checks} />
          </span>
          <HealthBar score={health.score} />
        </>
      ) : (
        <span className={`text-[10px] text-white/20 text-right shrink-0 ${ANCHO_SALUD}`}>Sin datos</span>
      )}
      <button
        onClick={onNavigate}
        className={bloqueo ? CLASE_ENTRADA_BLOQUEADA : 'p-1 rounded text-white/20 hover:text-white/70 hover:bg-white/10 transition-colors shrink-0'}
        title={bloqueo ?? 'Ir al detalle'}
      >
        <ExternalLink size={11} />
      </button>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────

export default function ProcessLevelsPage() {
  const { macroprocesses, processes } = useCompanyScopedData()
  const healthMap: ProcessHealthMap = useProcessHealth()
  const navigate = useNavigate()
  const levelDefinitions = useProcessStore((s) => s.levelDefinitions)
  const processLevelCount = useCompanyStore((s) => s.company?.process_level_count ?? 3)

  const [openMacros, setOpenMacros] = useState<Set<string>>(new Set())
  const [openProcesses, setOpenProcesses] = useState<Set<string>>(new Set())
  const [depurando, setDepurando] = useState(false)
  const plan = usePlanLimits()

  /**
   * Por qué este proceso no cabe en el cupo, o undefined si cabe.
   *
   * Existe porque esta pantalla solo miraba `plan.processes.reached` —el tope de
   * CREAR— y navegaba a cualquier proceso sin mirar el de DOCUMENTAR. Desde niveles
   * se entraba a un proceso topado como si nada, se trabajaba, y la base lo rechazaba
   * al guardar. Su pantalla hermana (`ProcessDrilldown`) ya consultaba lo correcto.
   *
   * El predicado es el mismo que aplica el trigger `enforce_documentable_level`; aquí
   * solo se adelanta para no dejar empezar un trabajo condenado.
   */
  const motivoSinCupo = (processId: string): string | undefined =>
    plan.puedeDocumentar(processId)
      ? undefined
      : `Has llegado al límite de procesos documentados de tu ${planName(plan.level)}: ${plan.cap}. Este proceso no admite documentación nueva; los que ya cuentan sí puedes terminarlos.`

  const level2 = useMemo(() => processes.filter((p) => !p.parent_process_id), [processes])
  const level3 = useMemo(() => processes.filter((p) => !!p.parent_process_id), [processes])

  const level3ByParent = useMemo(() => {
    const map: Record<string, Process[]> = {}
    for (const p of level3) {
      if (!p.parent_process_id) continue
      ;(map[p.parent_process_id] ??= []).push(p)
    }
    return map
  }, [level3])

  const getLevelName = (n: number) =>
    levelDefinitions.find((d) => d.level_number === n)?.level_name ||
    ['', 'Macroproceso', 'Proceso', 'Subproceso'][n] || `Nivel ${n}`

  const macroAvgScore = (macroId: string) => {
    const children = level2.filter((p) => p.macroprocess_id === macroId)
    if (children.length === 0) return null
    return Math.round(children.reduce((s, p) => s + (healthMap[p.id]?.score ?? 0), 0) / children.length)
  }

  const handleToggleMacro = (id: string) =>
    setOpenMacros((prev) => {
      const s = new Set(prev)
      if (s.has(id)) { s.delete(id) } else { s.add(id) }
      return s
    })

  const handleToggleProcess = (id: string) =>
    setOpenProcesses((prev) => {
      const s = new Set(prev)
      if (s.has(id)) { s.delete(id) } else { s.add(id) }
      return s
    })

  return (
    <div className="space-y-6">
      <DepurarProcesosModal open={depurando} onClose={() => setDepurando(false)} />

      <PageHeader
        icon={Layers}
        iconClass="bg-blue-500/10 border border-blue-500/20"
        iconColor="text-blue-400"
        title="Procesos por Niveles"
        subtitle={
          `${macroprocesses.length} ${getLevelName(1).toLowerCase()}(s) · ${level2.length} ${getLevelName(2).toLowerCase()}(s)` +
          (level3.length > 0 ? ` · ${level3.length} ${getLevelName(3).toLowerCase()}(s)` : '')
        }
        actions={
          /* Puerta al borrado multiple. Vive aqui porque es la pantalla donde ya se
             ve, proceso a proceso, cuanto trabajo tiene cada uno dentro: es la
             informacion que hace falta para decidir cual sobra. */
          <button
            onClick={() => setDepurando(true)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
              plan.processes.reached
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/20'
                : 'bg-white/[0.03] text-white/50 border-white/10 hover:bg-white/[0.07] hover:text-white/80'
            }`}
            title="Eliminar varios procesos a la vez"
          >
            <Trash2 size={13} />
            Depurar procesos
          </button>
        }
      />

      <div className="space-y-2">
        {macroprocesses.length === 0 && (
          <div className="py-16 text-center text-sm text-white/25 bg-white/[0.02] rounded-2xl border border-white/5">
            No hay macroprocesos creados.
          </div>
        )}
        {macroprocesses.map((macro) => {
          const macroChildren = level2.filter((p) => p.macroprocess_id === macro.id)
          const isOpen = openMacros.has(macro.id)
          return (
            <div key={macro.id}>
              <MacroRow
                macro={macro}
                isOpen={isOpen}
                avgScore={macroAvgScore(macro.id)}
                childCount={macroChildren.length}
                levelName={getLevelName(2)}
                onToggle={() => handleToggleMacro(macro.id)}
              />
              {isOpen && (
                <div className="mt-1 space-y-1">
                  {macroChildren.length === 0 && (
                    <p className="pl-10 py-3 text-[11px] text-white/25">
                      Sin {getLevelName(2).toLowerCase()}s en este {getLevelName(1).toLowerCase()}.
                    </p>
                  )}
                  {macroChildren.map((p2) => {
                    const p2Children = level3ByParent[p2.id] ?? []
                    const p2Open = openProcesses.has(p2.id)
                    return (
                      <div key={p2.id}>
                        <ProcessRow
                          process={p2}
                          health={healthMap[p2.id]}
                          documentable={isDocumentable(p2, processLevelCount)}
                          bloqueo={motivoSinCupo(p2.id)}
                          isOpen={p2Open}
                          onToggle={() => handleToggleProcess(p2.id)}
                          onNavigate={() => {
                            if (avisarSiSinCupo(!!motivoSinCupo(p2.id), plan.level, plan.cap)) return
                            navigate(`/app/process/${p2.id}`)
                          }}
                        />
                        {p2Open && p2Children.length > 0 && (
                          <div className="mt-0.5 space-y-0.5">
                            {p2Children.map((p3) => (
                              <SubprocessRow
                                key={p3.id}
                                process={p3}
                                health={healthMap[p3.id]}
                                bloqueo={motivoSinCupo(p3.id)}
                                onNavigate={() => {
                                  if (avisarSiSinCupo(!!motivoSinCupo(p3.id), plan.level, plan.cap)) return
                                  navigate(`/app/process/${p3.id}`)
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
