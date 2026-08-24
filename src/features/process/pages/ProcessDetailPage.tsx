import { useState, useMemo, useCallback } from 'react'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Save,
  GitBranch,
  Settings2,
  Info,
  BadgeCheck,
  Pencil,
} from 'lucide-react'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useCatalogStore } from '@/stores/catalogStore'
import { toast } from '@/stores/toastStore'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import { generateProcessObjective } from '@/lib/claude'
import { usePublishProcess } from '@/hooks/usePublishProcess'
import type { Process } from '@/types'
import { FieldHelpIcon } from '@/features/process/components/FieldHelpIcon'
import { CHARACTERIZATION_FIELD_HELP } from '@/features/process/constants/characterizationFieldHelp'
import SipocSection from '@/features/process/components/SipocSection'
import { ProcessModulesLauncher } from '@/features/process/components/ProcessModulesLauncher'
import { isDocumentable } from '@/lib/processLevels'
import { usePlanLimits } from '@/hooks/useActiveCompany'
import { planName } from '@/lib/plans'
import { avisarSiSinCupo } from '@/lib/planGateMessage'
import { PageHeader } from '@/components/ui/PageHeader'
import { processMapUrl } from '@/lib/processMapUrl'

/** Clase literal, no interpolada: Tailwind no compila clases hechas con plantilla. */
const CLASE_ACCION_BLOQUEADA =
  'bg-white/[0.02] rounded-xl border border-white/5 p-4 text-left cursor-not-allowed opacity-40'

// ─── Toggle fields ──────────────────────────────────────────────────────
const TOGGLE_FIELDS: { key: keyof Process; label: string }[] = [
  { key: 'provided_by_third_party', label: 'Provisto por tercero' },
  { key: 'is_critical', label: 'Proceso critico' },
  { key: 'involves_cash_movement', label: 'Mov. Efectivo' },
  { key: 'has_contingency_plan', label: 'Plan contingencia' },
  { key: 'has_tax_operations', label: 'Op. Tributarias' },
  { key: 'affects_accounting', label: 'Afecta contabilidad' },
  { key: 'handles_personal_data', label: 'Datos personales' },
]

export default function ProcessDetailPage() {
  const { id: processId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const processes = useProcessStore((s) => s.processes)
  const macroprocesses = useProcessStore((s) => s.macroprocesses)
  const updateProcess = useProcessStore((s) => s.updateProcess)

  const company = useCompanyStore((s) => s.company)
  const orgUnits = useCompanyStore((s) => s.orgUnits)
  const orgLevelDefinitions = useCompanyStore((s) => s.orgLevelDefinitions)

  const getCatalogByType = useCatalogStore((s) => s.getCatalogByType)
  const addCatalogItem = useCatalogStore((s) => s.addCatalogItem)

  const [saving, setSaving] = useState(false)
  const [generatingObjective, setGeneratingObjective] = useState(false)
  const objectiveBudget = useTokenBudget({ operationKey: 'process_objective' })

  const process = processes.find((p) => p.id === processId)

  const hierarchy = useMemo(() => {
    if (!process) return { macro: null, parent: null }
    const macro = macroprocesses.find((m) => m.id === process.macroprocess_id)
    let parent: typeof processes[number] | null = null
    if (process.parent_process_id) {
      parent = processes.find((p) => p.id === process.parent_process_id) || null
    }
    return { macro, parent }
  }, [process, macroprocesses, processes])

  // Proceso agrupador = NO está en el nivel más bajo declarado. Ojo: no es lo
  // mismo que "no tiene hijos" — una rama vacía sigue siendo agrupadora.
  // Ver @/lib/processLevels.
  const isGrouping = !!process && !isDocumentable(process, company?.process_level_count ?? 3)

  // Publicado = solo lectura. El gemelo de esta pantalla es ProcessCharacterizationPage.
  const { published, publish, unlock } = usePublishProcess(processId)

  // El cupo del plan. `isGrouping` es el NIVEL (estructura); esto es el CUPO. Un
  // proceso puede estar en el nivel correcto y aun asi no caber.
  const plan = usePlanLimits()
  const sinCupo = !!processId && !plan.puedeDocumentar(processId)
  const motivoSinCupo = `Has llegado al límite de procesos documentados de tu ${planName(plan.level)}: ${plan.cap}. Este proceso no admite documentación nueva; los que ya cuentan sí puedes terminarlos.`

  const [formData, setFormData] = useState<Partial<Process>>(() => ({
    description: process?.description || '',
    update_date: process?.update_date || new Date().toISOString().split('T')[0],
    entity: process?.entity || company?.name || '',
    // `version` NO va en formData. Ver el gemelo en ProcessCharacterizationPage.
    process_type: process?.process_type || hierarchy.macro?.category || '',
    execution_frequency: process?.execution_frequency || '',
    execution_level: process?.execution_level || '',
    management: process?.management || '',
    coordination: process?.coordination || '',
    operative: process?.operative || '',
    business_line: process?.business_line || '',
    supervision_level: process?.supervision_level || '',
    responsible: process?.responsible || '',
    delivery_method: process?.delivery_method || '',
    execution_type: process?.execution_type || '',
    is_critical: process?.is_critical || false,
    has_contingency_plan: process?.has_contingency_plan || false,
    involves_cash_movement: process?.involves_cash_movement || false,
    has_tax_operations: process?.has_tax_operations || false,
    affects_accounting: process?.affects_accounting || false,
    handles_personal_data: process?.handles_personal_data || false,
    provided_by_third_party: process?.provided_by_third_party || false,
  }))

  const updateField = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  // Catalog options
  const frequencyOptions = getCatalogByType('execution_frequency').map((c) => ({ value: c.value, label: c.value }))
  const executionTypeOptions = getCatalogByType('execution_type').map((c) => ({ value: c.value, label: c.value }))
  const deliveryMethodOptions = getCatalogByType('delivery_method').map((c) => ({ value: c.value, label: c.value }))
  const executionLevelOptions = getCatalogByType('execution_level').map((c) => ({ value: c.value, label: c.value }))
  const businessLineOptions = getCatalogByType('business_line').map((c) => ({ value: c.value, label: c.value }))
  const supervisionOptions = getCatalogByType('supervision_level').map((c) => ({ value: c.value, label: c.value }))
  const responsibleOptions = getCatalogByType('responsible').map((c) => ({ value: c.value, label: c.value }))

  const sortedLevels = useMemo(
    () => [...orgLevelDefinitions].sort((a, b) => a.level_number - b.level_number),
    [orgLevelDefinitions]
  )
  const level0Label = sortedLevels[0]?.level_name ?? 'Gerencia'
  const level1Label = sortedLevels[1]?.level_name ?? 'Jefatura'
  const level2Label = sortedLevels[2]?.level_name ?? 'Area'

  const managementOptions = useMemo(
    () => orgUnits.filter((u) => !u.parent_id).map((u) => ({ value: u.name, label: u.name })),
    [orgUnits]
  )

  const selectedManagementId = useMemo(() => {
    const name = (formData.management as string) || ''
    return orgUnits.find((u) => u.name === name)?.id ?? null
  }, [orgUnits, formData.management])

  const areaOptions = useMemo(() => {
    if (!selectedManagementId) return []
    return orgUnits
      .filter((u) => u.parent_id === selectedManagementId)
      .map((u) => ({ value: u.name, label: u.name }))
  }, [orgUnits, selectedManagementId])

  const selectedCoordinationId = useMemo(() => {
    const name = (formData.coordination as string) || ''
    return orgUnits.find((u) => u.name === name)?.id ?? null
  }, [orgUnits, formData.coordination])

  const operativeOptions = useMemo(() => {
    if (!selectedCoordinationId) return []
    return orgUnits
      .filter((u) => u.parent_id === selectedCoordinationId)
      .map((u) => ({ value: u.name, label: u.name }))
  }, [orgUnits, selectedCoordinationId])

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleGenerateObjective = async () => {
    if (!process || !hierarchy.macro) return
    setGeneratingObjective(true)
    try {
      await objectiveBudget.run(async () => {
        const result = await generateProcessObjective({
          companyName: company?.name || '',
          industry: company?.industry,
          companySize: company?.company_size,
          macroprocessName: hierarchy.macro!.name,
          processName: hierarchy.parent?.name,
          subprocessName: process.name,
        })
        updateField('description', result.text)
      })
    } catch {
      toast.error('Error al generar el objetivo. Intenta de nuevo.')
    } finally {
      setGeneratingObjective(false)
    }
  }

  const handleSave = useCallback(() => {
    if (!processId) return
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    // Guardar NO versiona. Ver el gemelo en ProcessCharacterizationPage.handleSave.
    updateProcess(processId, {
      ...formData,
      entity: company?.name || (formData.entity as string),
      process_type: hierarchy.macro?.category || (formData.process_type as string),
      update_date: today,
    })
    setFormData((prev) => ({ ...prev, update_date: today }))
    toast.success('Caracterización guardada.')
    setTimeout(() => setSaving(false), 600)
  }, [processId, formData, updateProcess, company?.name, hierarchy.macro?.category])

  if (!process) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/30">
        <p className="text-lg">Proceso no encontrado</p>
        <button onClick={() => navigate(processMapUrl(process))} className="mt-4 text-cyan-400 hover:underline">Volver al mapa</button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ═══ HEADER ═══ */}
      <PageHeader
        leading={
          <button
            onClick={() => navigate(processMapUrl(process))}
            aria-label="Volver al mapa de procesos"
            className="p-2.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
        }
        title={process.name}
        subtitle={
          (hierarchy.macro || hierarchy.parent) && (
            <span className="flex flex-wrap items-center gap-1.5">
              {hierarchy.macro && (<><span>{hierarchy.macro.name}</span><ChevronRight size={10} className="shrink-0" /></>)}
              {hierarchy.parent && <span>{hierarchy.parent.name}</span>}
            </span>
          )
        }
        /* Un agrupador no tiene nada que guardar: su ficha es solo el aviso. */
        actions={!isGrouping && (
          <div className="flex items-center gap-2">
            {published ? (
              <>
                <span className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <BadgeCheck size={14} />
                  Publicado v{process.version ?? '1.0'}
                </span>
                <button
                  onClick={unlock}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10 font-medium text-sm transition-all"
                  title="Vuelve a borrador para poder editarlo. Al publicar de nuevo sube la version."
                >
                  <Pencil size={16} />
                  Editar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium text-sm hover:from-cyan-500 hover:to-blue-500 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Guardar
                </button>
                <button
                  onClick={publish}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium text-sm hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50"
                  title="Cierra esta version del documento y la deja en solo lectura."
                >
                  <BadgeCheck size={16} />
                  <span className="hidden sm:inline">Aprobar y publicar</span>
                </button>
              </>
            )}
          </div>
        )}
      />

      {/* ═══ AVISO: proceso agrupador ═══ */}
      {isGrouping && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] px-5 py-4 flex items-start gap-3">
          <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-white/80">Proceso agrupador</p>
            <p className="text-xs text-white/40 mt-0.5">
              Este proceso contiene subprocesos. La caracterización, BPMN, procedimientos,
              KPIs, riesgos y auditoría se gestionan en cada subproceso.
            </p>
          </div>
        </div>
      )}

      {/* ═══ IR AL DIAGRAMADOR ═══ */}
      {/* El diagramador es una PANTALLA COMPLETA (editor BPMN), por eso navega. Lleva
          `useDocumentableGuard`, asi que sin cupo rebotaria; se deshabilita aqui con el
          motivo en el `title`. Los demas modulos (procedimiento, KPI, riesgos, etc.) ya
          NO navegan: se abren como ventanas emergentes en ProcessModulesLauncher, con la
          misma data. Esta pagina no puede llevar el guardian (redirige aqui mismo). */}
      {!isGrouping && (
        <button
          onClick={() => {
            if (avisarSiSinCupo(sinCupo, plan.level, plan.cap)) return
            navigate(`/app/process/${processId}/characterization`)
          }}
          title={sinCupo ? motivoSinCupo : 'BPMN, IA, Paleta, Exportar'}
          className={sinCupo ? `block w-full ${CLASE_ACCION_BLOQUEADA}` : 'group block w-full bg-white/[0.03] rounded-xl border border-white/5 p-4 text-left hover:border-cyan-500/30 hover:bg-cyan-500/[0.03] transition-all'}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
              <GitBranch size={20} className="text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white group-hover:text-cyan-400 transition-colors">Ir al Diagramador</h3>
              <p className="text-[11px] text-white/30">BPMN, IA, Paleta, Exportar</p>
            </div>
          </div>
        </button>
      )}

      {/* ═══ MODULOS (ventanas emergentes): misma info del rail derecho del diagramador ═══ */}
      {!isGrouping && <ProcessModulesLauncher processId={processId!} />}

      {/* ═══ CHARACTERIZATION CARD ═══ */}
      {/* Publicado = solo lectura. Mismo idioma que CharacterizationPanel (:141, :243):
          sin esto los campos quedarian editables pero sin boton con el que guardarlos. */}
      {!isGrouping && <div className={`bg-white/[0.03] rounded-2xl border border-white/5 p-6 ${published ? 'pointer-events-none opacity-70' : ''}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <Settings2 size={18} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Caracterizacion del Proceso</h2>
            <p className="text-[11px] text-white/30">Ficha tecnica, atributos y metadatos</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Objective */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1">
                <label className="block text-xs font-medium text-white/60">Objetivo / Descripcion</label>
                <FieldHelpIcon text={CHARACTERIZATION_FIELD_HELP.description} />
              </span>
              <button
                type="button"
                onClick={handleGenerateObjective}
                disabled={generatingObjective || objectiveBudget.isConsuming}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-cyan-400 bg-cyan-500/10 rounded hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
              >
                {(generatingObjective || objectiveBudget.isConsuming) ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                IA <TokenCostBadge operationKey="process_objective" />
              </button>
            </div>
            <textarea
              value={(formData.description as string) || ''}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none"
              placeholder="Objetivo del proceso..."
            />
          </div>

          {/* Fields grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FieldBox label="Fecha actualizacion" hint="Se actualiza al guardar" helpText={CHARACTERIZATION_FIELD_HELP.update_date}>
              <input
                type="date"
                value={(formData.update_date as string) || ''}
                readOnly
                disabled
                className="w-full px-2 py-1.5 border border-white/10 rounded text-xs bg-white/[0.02] text-white/50 cursor-not-allowed"
              />
            </FieldBox>
            <FieldBox label="Version" hint="Sube al aprobar y publicar" helpText={CHARACTERIZATION_FIELD_HELP.version}>
              <input
                type="text"
                value={process.version ?? '1.0'}
                readOnly
                disabled
                className="w-full px-2 py-1.5 border border-white/10 rounded text-xs bg-white/[0.02] text-white/50 cursor-not-allowed"
              />
            </FieldBox>
            <FieldBox label="Entidad" helpText={CHARACTERIZATION_FIELD_HELP.entity}>
              <input type="text" value={(formData.entity as string) || ''} readOnly disabled className="w-full px-2 py-1.5 border border-white/10 rounded text-xs bg-white/[0.02] text-white/50 cursor-not-allowed" />
            </FieldBox>
            <FieldBox label="Tipo de proceso" helpText={CHARACTERIZATION_FIELD_HELP.process_type}>
              <input type="text" value={(formData.process_type as string) || ''} readOnly disabled className="w-full px-2 py-1.5 border border-white/10 rounded text-xs bg-white/[0.02] text-white/50 cursor-not-allowed" />
            </FieldBox>
            <FieldBox label="Frecuencia" helpText={CHARACTERIZATION_FIELD_HELP.execution_frequency}>
              <CreatableSelect options={frequencyOptions} value={(formData.execution_frequency as string) || ''} onChange={(v) => updateField('execution_frequency', v)} onCreateOption={(v) => addCatalogItem('execution_frequency', v)} placeholder="Frecuencia..." />
            </FieldBox>
            <FieldBox label="Nivel ejecucion" helpText={CHARACTERIZATION_FIELD_HELP.execution_level}>
              <CreatableSelect options={executionLevelOptions} value={(formData.execution_level as string) || ''} onChange={(v) => updateField('execution_level', v)} onCreateOption={(v) => addCatalogItem('execution_level', v)} placeholder="Nivel..." />
            </FieldBox>
            <FieldBox label={level0Label} helpText={CHARACTERIZATION_FIELD_HELP.management}>
              <CreatableSelect
                options={managementOptions}
                value={(formData.management as string) || ''}
                onChange={(v) => {
                  updateField('management', v)
                  const newMgmt = orgUnits.find((u) => u.name === v)
                  const currentCoord = (formData.coordination as string) || ''
                  const isCoordValid = orgUnits.some(
                    (u) => u.name === currentCoord && u.parent_id === newMgmt?.id
                  )
                  if (!isCoordValid) {
                    updateField('coordination', '')
                    updateField('operative', '')
                  }
                }}
                placeholder="Gerencia..."
              />
            </FieldBox>
            <FieldBox label={level1Label} hint={!selectedManagementId ? `Elige primero ${level0Label.toLowerCase()}` : undefined} helpText={CHARACTERIZATION_FIELD_HELP.coordination}>
              <CreatableSelect
                options={areaOptions}
                value={(formData.coordination as string) || ''}
                onChange={(v) => {
                  updateField('coordination', v)
                  const newCoord = orgUnits.find((u) => u.name === v)
                  const currentOp = (formData.operative as string) || ''
                  const isOpValid = orgUnits.some(
                    (u) => u.name === currentOp && u.parent_id === newCoord?.id
                  )
                  if (!isOpValid) updateField('operative', '')
                }}
                placeholder={selectedManagementId ? `${level1Label}...` : `(elige ${level0Label.toLowerCase()})`}
              />
            </FieldBox>
            {sortedLevels.length >= 3 && (
              <FieldBox label={level2Label} hint={!selectedCoordinationId ? `Elige primero ${level1Label.toLowerCase()}` : undefined} helpText={CHARACTERIZATION_FIELD_HELP.coordination}>
                <CreatableSelect
                  options={operativeOptions}
                  value={(formData.operative as string) || ''}
                  onChange={(v) => updateField('operative', v)}
                  placeholder={selectedCoordinationId ? `${level2Label}...` : `(elige ${level1Label.toLowerCase()})`}
                />
              </FieldBox>
            )}
            <FieldBox label="Linea negocio" helpText={CHARACTERIZATION_FIELD_HELP.business_line}>
              <CreatableSelect options={businessLineOptions} value={(formData.business_line as string) || ''} onChange={(v) => updateField('business_line', v)} onCreateOption={(v) => addCatalogItem('business_line', v)} placeholder="Linea..." />
            </FieldBox>
            <FieldBox label="Supervision" helpText={CHARACTERIZATION_FIELD_HELP.supervision_level}>
              <CreatableSelect options={supervisionOptions} value={(formData.supervision_level as string) || ''} onChange={(v) => updateField('supervision_level', v)} onCreateOption={(v) => addCatalogItem('supervision_level', v)} placeholder="Nivel..." />
            </FieldBox>
            <FieldBox label="Responsable" helpText={CHARACTERIZATION_FIELD_HELP.responsible}>
              <CreatableSelect options={responsibleOptions} value={(formData.responsible as string) || ''} onChange={(v) => updateField('responsible', v)} onCreateOption={(v) => addCatalogItem('responsible', v)} placeholder="Responsable..." />
            </FieldBox>
            <FieldBox label="Medio entrega" helpText={CHARACTERIZATION_FIELD_HELP.delivery_method}>
              <CreatableSelect options={deliveryMethodOptions} value={(formData.delivery_method as string) || ''} onChange={(v) => updateField('delivery_method', v)} onCreateOption={(v) => addCatalogItem('delivery_method', v)} placeholder="Medio..." />
            </FieldBox>
            <FieldBox label="Tipo ejecucion" helpText={CHARACTERIZATION_FIELD_HELP.execution_type}>
              <CreatableSelect options={executionTypeOptions} value={(formData.execution_type as string) || ''} onChange={(v) => updateField('execution_type', v)} onCreateOption={(v) => addCatalogItem('execution_type', v)} placeholder="Tipo..." />
            </FieldBox>
          </div>

          {/* Toggles */}
          <div>
            <h3 className="text-xs font-medium text-white/60 mb-2">Atributos</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {TOGGLE_FIELDS.map(({ key, label }) => {
                const helpText = CHARACTERIZATION_FIELD_HELP[key as string]
                return (
                  <label key={key} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/5 cursor-pointer transition-colors has-[:checked]:border-cyan-500/40 has-[:checked]:bg-cyan-500/[0.06]">
                    <div className="relative shrink-0">
                      <input type="checkbox" checked={!!formData[key]} onChange={(e) => updateField(key, e.target.checked)} className="sr-only peer" />
                      <div className="w-9 h-5 rounded-full bg-white/10 ring-1 ring-inset ring-white/20 peer-checked:ring-0 peer-checked:bg-gradient-to-r peer-checked:from-cyan-500 peer-checked:to-blue-500 peer-checked:shadow-[0_0_10px_rgba(6,182,212,0.55)] transition-all" />
                      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md peer-checked:translate-x-4 transition-transform" />
                    </div>
                    <span className="flex items-center gap-1 text-[11px] text-white/70">
                      {label}
                      {helpText && <FieldHelpIcon text={helpText} />}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      </div>}

      {/* SIPOC es documentación del proceso: solo en el nivel más bajo. */}
      {!isGrouping && <SipocSection processId={processId!} />}

      <InsufficientTokensModal
        open={objectiveBudget.showInsufficientModal}
        onClose={objectiveBudget.closeInsufficientModal}
        operationKey="process_objective"
      />
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────

function FieldBox({ label, hint, helpText, children }: { label: string; hint?: string; helpText?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="flex items-center gap-1 mb-0.5">
        <label className="block text-[10px] font-medium text-white/50">{label}</label>
        {helpText && <FieldHelpIcon text={helpText} />}
      </span>
      {children}
      {hint && <p className="text-[9px] text-white/30 mt-0.5">{hint}</p>}
    </div>
  )
}

