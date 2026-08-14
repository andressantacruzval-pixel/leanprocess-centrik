import { useState, useCallback } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import {
  Loader2,
  Plus,
  Trash2,
  RefreshCcw,
  Download,
} from 'lucide-react'
import { useProcedureStore } from '@/stores/procedureStore'
import { useRiskStore } from '@/stores/riskStore'
import { useProcessStore } from '@/stores/processStore'
import { useAuditStore } from '@/stores/auditStore'
import {
  generateProcedureFromContext,
  generateProcedureFromBpmn,
  improveText,
} from '@/lib/claude'
import { ACCIONES_AL_PASAR } from '@/lib/constants'
import { parseBpmnXml } from '@/utils/bpmnParser'
import { exportProcedureToDocx } from '@/utils/procedureDocxExporter'
import type {
  ProcedureData,
  ProcedureActivity,
  ProcedureGlossaryItem,
} from '@/lib/claude'
import { getRiskLevel, EFFECTIVENESS_COLORS, computeControlScore } from '@/types/risk'
import { useRotatingMessage } from '../hooks/useRotatingMessage'
import { EditableText } from './EditableText'
import { DocSection } from './DocSection'
import { ProcedureEmptyState } from './ProcedureEmptyState'
import { ActivitiesSection } from './ActivitiesSection'

// ─── Props ──────────────────────────────────────────────────────────────

interface ProcedureTabProps {
  processId: string
  companyName: string
  industry?: string
  macroprocessName: string
  parentProcessName?: string
  processName: string
  description?: string
  bpmnXml?: string
  sipocEntries?: Array<{
    supplier_name: string
    input_description: string
    output_description: string
    customer_name: string
  }>
  isExpanded?: boolean
}

// ─── Main Component ─────────────────────────────────────────────────────

export function ProcedureTab({
  processId,
  companyName,
  industry,
  macroprocessName,
  parentProcessName,
  processName,
  description,
  bpmnXml,
  sipocEntries,
  isExpanded,
}: ProcedureTabProps) {
  const { getProcedureByProcess, saveProcedure, updateProcedureData, deleteProcedure } =
    useProcedureStore()

  const stored = getProcedureByProcess(processId)
  const data = stored?.data

  // Hay UNA sola version y es la del proceso: la sube «Aprobar y publicar».
  const processVersion =
    useProcessStore((s) => s.processes.find((p) => p.id === processId)?.version) ?? '1.0'

  const { loading: generating, run: runAsync } = useAsync()
  const contextBudget = useTokenBudget({ operationKey: 'procedure_from_context' })
  const bpmnBudget = useTokenBudget({ operationKey: 'procedure_from_bpmn' })
  const allRisks = useRiskStore((s) => s.risks)
  const processRisks = allRisks.filter((r) => r.process_id === processId)
  const allAudits = useAuditStore((s) => s.audits)
  const auditItems = allAudits[processId] || []
  const [improvingField, setImprovingField] = useState<string | null>(null)
  const [bpmnSummary, setBpmnSummary] = useState<string | null>(null)

  const loadingMessage = useRotatingMessage(generating)

  const update = useCallback(
    (updates: Partial<ProcedureData>) => updateProcedureData(processId, updates),
    [processId, updateProcedureData]
  )

  // ─── Generate from Context ─────────────────────────────────────────

  const handleGenerateFromContext = async () => {
    await contextBudget.run(async () => {
      await runAsync(async () => {
        const result = await generateProcedureFromContext({
          companyName,
          industry,
          macroprocessName,
          processName: parentProcessName,
          subprocessName: processName,
          description,
          sipocEntries,
        })
        saveProcedure(processId, result)
      })
    })
  }

  // ─── Generate from BPMN ─────────────────────────────────────────────

  const handleGenerateFromBpmn = async () => {
    if (!bpmnXml) return
    setBpmnSummary(null)
    await bpmnBudget.run(async () => {
      await runAsync(async () => {
        const parsedBpmn = parseBpmnXml(bpmnXml)
        const activitiesCount = parsedBpmn.activities?.length ?? 0
        const decisionsCount = parsedBpmn.decisions?.length ?? 0
        const rolesCount = parsedBpmn.lanes?.length ?? 0
        setBpmnSummary(`Parseado: ${activitiesCount} actividades, ${decisionsCount} decisiones, ${rolesCount} roles`)

        const context = {
          companyName,
          industry,
          macroprocessName,
          processName: parentProcessName,
          subprocessName: processName,
          description,
          sipocEntries,
        }
        const result = await generateProcedureFromBpmn(parsedBpmn, context)
        saveProcedure(processId, result)
      })
    })
  }

  // ─── Export to Word ────────────────────────────────────────────────

  const handleExportWord = () => {
    if (!data) return
    // La version que va impresa es la del proceso, no la del jsonb del procedimiento.
    exportProcedureToDocx({ ...data, version: processVersion }, { companyName, processName }, { processRisks, auditItems })
  }

  // ─── Improve Text ─────────────────────────────────────────────────

  const handleImproveText = async (field: keyof ProcedureData, sectionLabel: string) => {
    if (!data) return
    const current = data[field] as string
    if (!current?.trim()) return
    setImprovingField(field)
    try {
      const improved = await improveText(sectionLabel, current)
      update({ [field]: improved })
    } catch (err) {
      console.error('Error improving text:', err)
    } finally {
      setImprovingField(null)
    }
  }

  // ─── Regenerate ───────────────────────────────────────────────────

  const handleRegenerate = async () => {
    deleteProcedure(processId)
    if (bpmnXml) {
      await handleGenerateFromBpmn()
    } else {
      await handleGenerateFromContext()
    }
  }

  // ─── Activity Editing ─────────────────────────────────────────────

  const updateActivity = (index: number, updates: Partial<ProcedureActivity>) => {
    if (!data) return
    const newActivities = [...data.actividades]
    newActivities[index] = { ...newActivities[index], ...updates }
    update({ actividades: newActivities })
  }

  const addActivity = () => {
    if (!data) return
    update({
      actividades: [
        ...data.actividades,
        { nombre: 'Nueva actividad', ejecutor: '', descripcion: '', decisiones: '', esDecision: false },
      ],
    })
  }

  const removeActivity = (index: number) => {
    if (!data) return
    update({ actividades: data.actividades.filter((_, i) => i !== index) })
  }

  // ─── Glossary ─────────────────────────────────────────────────────

  const addGlossaryItem = () => {
    if (!data) return
    update({ glosario: [...data.glosario, { termino: '', definicion: '' }] })
  }

  const updateGlossaryItem = (index: number, updates: Partial<ProcedureGlossaryItem>) => {
    if (!data) return
    const items = [...data.glosario]
    items[index] = { ...items[index], ...updates }
    update({ glosario: items })
  }

  const removeGlossaryItem = (index: number) => {
    if (!data) return
    update({ glosario: data.glosario.filter((_, i) => i !== index) })
  }

  // ─── Objectives ───────────────────────────────────────────────────

  const addObjective = () => {
    if (!data) return
    update({ objetivosEspecificos: [...data.objetivosEspecificos, ''] })
  }

  const updateObjective = (index: number, value: string) => {
    if (!data) return
    const items = [...data.objetivosEspecificos]
    items[index] = value
    update({ objetivosEspecificos: items })
  }

  const removeObjective = (index: number) => {
    if (!data) return
    update({ objetivosEspecificos: data.objetivosEspecificos.filter((_, i) => i !== index) })
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER: Empty state (no procedure yet)
  // ═══════════════════════════════════════════════════════════════════

  if (!data) {
    return (
      <>
        <ProcedureEmptyState
          generating={generating || bpmnBudget.isConsuming || contextBudget.isConsuming}
          bpmnXml={bpmnXml}
          bpmnSummary={bpmnSummary}
          loadingMessage={loadingMessage}
          onGenerateFromBpmn={handleGenerateFromBpmn}
        />
        <InsufficientTokensModal
          open={bpmnBudget.showInsufficientModal || contextBudget.showInsufficientModal}
          onClose={() => { bpmnBudget.closeInsufficientModal(); contextBudget.closeInsufficientModal() }}
          operationKey={bpmnBudget.showInsufficientModal ? 'procedure_from_bpmn' : 'procedure_from_context'}
        />
      </>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER: Document-style Procedure Editor
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className={`flex flex-col gap-3 ${isExpanded ? 'max-w-3xl mx-auto px-6 py-4' : ''}`}>
      {/* ─── Document Toolbar ─── */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-[#0a0f1a] py-2 -mx-4 px-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={generating || bpmnBudget.isConsuming || contextBudget.isConsuming}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 text-[11px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {(generating || bpmnBudget.isConsuming || contextBudget.isConsuming) ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
            {(generating || bpmnBudget.isConsuming || contextBudget.isConsuming) ? 'Generando...' : 'Regenerar'}
            <TokenCostBadge operationKey={bpmnXml ? 'procedure_from_bpmn' : 'procedure_from_context'} />
          </button>
          <button
            onClick={handleExportWord}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10 text-[11px] font-medium transition-colors"
          >
            <Download className="w-3 h-3" />
            Word
          </button>
        </div>
        {generating && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span className="text-[11px] text-cyan-400 animate-pulse">{loadingMessage}</span>
          </div>
        )}
      </div>

      {/* ═══ THE DOCUMENT ═══ */}
      <div
        className="bg-white rounded-sm shadow-xl mx-auto overflow-hidden"
        style={{
          width: '100%',
          maxWidth: '816px',
          fontFamily: "'Aptos', 'Calibri', 'Segoe UI', sans-serif",
        }}
      >
        {/* ─── Document Header Bar (blue stripe) ─── */}
        <div className="bg-[#2563EB] px-4 sm:px-10 py-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-200 text-[10px] uppercase tracking-[0.2em] font-semibold mb-1">
                Procedimiento Operativo Estandar
              </p>
              <EditableText
                value={data.titulo}
                onChange={v => update({ titulo: v })}
                className="text-white text-xl font-bold leading-tight"
                placeholder="Titulo del procedimiento"
              />
            </div>
            <div className="text-right shrink-0 ml-6">
              <p className="text-blue-200 text-[10px] uppercase tracking-wider mb-1">{companyName}</p>
              <EditableText
                value={data.codigo}
                onChange={v => update({ codigo: v })}
                className="text-white text-sm font-mono font-semibold"
                placeholder="PROC-000"
              />
            </div>
          </div>

          {/* Meta strip */}
          <div className="flex items-center gap-6 mt-4 pt-3 border-t border-blue-400/30">
            <div>
              <p className="text-blue-300 text-[9px] uppercase tracking-wider">Version</p>
              {/* La version del documento es la del PROCESO y solo la mueve «Aprobar y
                  publicar». Antes habia aqui un campo suelto que nadie tocaba: acabo con
                  73 de 74 procedimientos congelados en 1.0 mientras el Word decia lo mismo. */}
              <p
                className="text-white text-xs font-semibold"
                title="Sube al aprobar y publicar el proceso"
              >
                {processVersion}
              </p>
            </div>
            <div>
              <p className="text-blue-300 text-[9px] uppercase tracking-wider">Fecha</p>
              <EditableText
                value={data.fecha}
                onChange={v => update({ fecha: v })}
                className="text-white text-xs font-semibold"
                placeholder="2026-01-01"
              />
            </div>
            <div>
              <p className="text-blue-300 text-[9px] uppercase tracking-wider">Macroproceso</p>
              <p className="text-white text-xs font-semibold">{macroprocessName}</p>
            </div>
            <div>
              <p className="text-blue-300 text-[9px] uppercase tracking-wider">Proceso</p>
              <p className="text-white text-xs font-semibold">{processName}</p>
            </div>
          </div>
        </div>

        {/* ─── Document Body ─── */}
        <div className="px-4 sm:px-10 py-8 text-gray-800 text-[13px] leading-relaxed space-y-8">

          {/* ══ 1. INTRODUCCION ══ */}
          <DocSection number="1" title="Introduccion" field="introduccion" improvingField={improvingField} onImprove={() => handleImproveText('introduccion', 'Introduccion')}>
            <EditableText
              value={data.introduccion}
              onChange={v => update({ introduccion: v })}
              className="text-gray-700 text-[13px] leading-relaxed"
              multiline
              placeholder="Descripcion introductoria del procedimiento..."
            />
          </DocSection>

          {/* ══ 2. OBJETIVO ══ */}
          <DocSection number="2" title="Objetivo" field="objetivoGeneral" improvingField={improvingField} onImprove={() => handleImproveText('objetivoGeneral', 'Objetivo General')}>
            <div className="mb-4">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold mb-1">Objetivo General</p>
              <EditableText
                value={data.objetivoGeneral}
                onChange={v => update({ objetivoGeneral: v })}
                className="text-gray-700 text-[13px] leading-relaxed"
                multiline
                placeholder="Objetivo general del procedimiento..."
              />
            </div>

            {data.objetivosEspecificos.length > 0 && (
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold mb-2">Objetivos Especificos</p>
                <ol className="list-none space-y-1.5">
                  {data.objetivosEspecificos.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 group">
                      <span className="text-blue-600 font-semibold text-xs mt-0.5 shrink-0">{i + 1}.</span>
                      <EditableText
                        value={obj}
                        onChange={v => updateObjective(i, v)}
                        className="text-gray-700 text-[13px] flex-1"
                        placeholder="Objetivo especifico..."
                      />
                      <button onClick={() => removeObjective(i)} title="Eliminar objetivo" className={`text-red-400 hover:text-red-600 shrink-0 p-2 -m-1 ${ACCIONES_AL_PASAR}`}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <button onClick={addObjective} className="mt-2 flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 font-medium">
              <Plus className="w-3 h-3" /> Agregar objetivo especifico
            </button>
          </DocSection>

          {/* ══ 3. ALCANCE ══ */}
          <DocSection number="3" title="Alcance" field="alcance" improvingField={improvingField} onImprove={() => handleImproveText('alcance', 'Alcance')}>
            <EditableText
              value={data.alcance}
              onChange={v => update({ alcance: v })}
              className="text-gray-700 text-[13px] leading-relaxed"
              multiline
              placeholder="Alcance del procedimiento..."
            />
          </DocSection>

          {/* ══ 4. SIPOC ══ */}
          <DocSection number="4" title="SIPOC del Procedimiento">
            {sipocEntries && sipocEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr>
                    <th className="bg-[#DC2626] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Proveedor</th>
                    <th className="bg-[#6B7280] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Entrada</th>
                    <th className="bg-[#0D9488] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Salida</th>
                    <th className="bg-[#2563EB] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Cliente</th>
                  </tr>
                </thead>
                <tbody>
                  {sipocEntries.map((entry, i) => (
                    <tr key={i}>
                      <td className="border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700 bg-red-50/30">{entry.supplier_name || '-'}</td>
                      <td className="border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700">{entry.input_description || '-'}</td>
                      <td className="border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700 bg-teal-50/30">{entry.output_description || '-'}</td>
                      <td className="border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700 bg-blue-50/30">{entry.customer_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 text-[12px] italic">No hay datos SIPOC. Configura el SIPOC en la ficha de caracterizacion del proceso.</p>
            )}
          </DocSection>

          {/* ══ 5. GLOSARIO ══ */}
          <DocSection number="5" title="Glosario de Terminos">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse mb-2">
              <thead>
                <tr>
                  <th className="bg-[#2563EB] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300 w-1/3">Termino</th>
                  <th className="bg-[#2563EB] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Definicion</th>
                  <th className="bg-[#2563EB] border border-gray-300 w-7"></th>
                </tr>
              </thead>
              <tbody>
                {data.glosario.map((item, i) => (
                  <tr key={i} className="group">
                    <td className="border border-gray-200 px-3 py-1.5">
                      <EditableText value={item.termino} onChange={v => updateGlossaryItem(i, { termino: v })} className="text-gray-700 text-[12px] font-semibold" placeholder="Termino..." />
                    </td>
                    <td className="border border-gray-200 px-3 py-1.5">
                      <EditableText value={item.definicion} onChange={v => updateGlossaryItem(i, { definicion: v })} className="text-gray-700 text-[12px]" placeholder="Definicion..." />
                    </td>
                    <td className="border border-gray-200 px-1 text-center">
                      <button onClick={() => removeGlossaryItem(i)} title="Eliminar termino" className={`text-red-400 hover:text-red-600 shrink-0 p-2 -m-1 ${ACCIONES_AL_PASAR}`}><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
                {data.glosario.length === 0 && (
                  <tr><td colSpan={3} className="border border-gray-200 px-3 py-3 text-center text-gray-400 text-xs italic">Sin terminos en el glosario</td></tr>
                )}
              </tbody>
              </table>
            </div>
            <button onClick={addGlossaryItem} className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 font-medium">
              <Plus className="w-3 h-3" /> Agregar termino
            </button>
          </DocSection>

          {/* ══ 6. DESCRIPCION DE ACTIVIDADES ══ */}
          <DocSection number="6" title="Descripcion de Actividades">
            <ActivitiesSection
              actividades={data.actividades}
              updateActivity={updateActivity}
              addActivity={addActivity}
              removeActivity={removeActivity}
            />
          </DocSection>

          {/* ══ 7. RIESGOS Y CONTROLES ══ */}
          <DocSection number="7" title="Riesgos y Controles">
            {processRisks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr>
                    <th className="bg-[#DC2626] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Actividad</th>
                    <th className="bg-[#DC2626] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Riesgo</th>
                    <th className="bg-[#DC2626] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Nivel</th>
                    <th className="bg-[#0D9488] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Controles</th>
                  </tr>
                </thead>
                <tbody>
                  {processRisks.map((risk, i) => {
                    const level = getRiskLevel(risk.inherentProbability, risk.inherentImpact)
                    return (
                      <tr key={risk.id} className={i % 2 === 0 ? 'bg-red-50/30' : ''}>
                        <td className="border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700">{risk.processStep || '-'}</td>
                        <td className="border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700">
                          <span className="font-medium">{risk.title}</span>
                          {risk.description && <p className="text-[10px] text-gray-400 mt-0.5">{risk.description}</p>}
                        </td>
                        <td className="border border-gray-200 px-3 py-1.5 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${level.color}`}>{level.label}</span>
                        </td>
                        <td className="border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700 bg-teal-50/20">
                          {risk.controls.length > 0 ? (
                            <ul className="space-y-1">
                              {risk.controls.map((c) => {
                                const { effectiveness } = computeControlScore(c)
                                return (
                                  <li key={c.id} className="flex items-center gap-1.5">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${EFFECTIVENESS_COLORS[effectiveness]}`}>{effectiveness}</span>
                                    <span className="text-[11px]">{c.description || 'Sin descripcion'}</span>
                                  </li>
                                )
                              })}
                            </ul>
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">Sin controles</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 text-[12px] italic">No hay riesgos identificados. Usa el panel de Riesgos en el diagramador para identificarlos.</p>
            )}
          </DocSection>

          {/* ══ 8. PROGRAMA DE AUDITORIA ══ */}
          <DocSection number="8" title="Programa de Auditoria">
            {auditItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr>
                    <th className="bg-[#7C3AED] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Actividad</th>
                    <th className="bg-[#7C3AED] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Que Auditar</th>
                    <th className="bg-[#7C3AED] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Criterio</th>
                    <th className="bg-[#7C3AED] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Evidencia</th>
                    <th className="bg-[#7C3AED] text-white text-[11px] font-semibold px-3 py-2 text-left border border-gray-300">Frecuencia</th>
                  </tr>
                </thead>
                <tbody>
                  {auditItems.map((item, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-violet-50/30' : ''}>
                      <td className="border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700">{item.actividad}</td>
                      <td className="border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700 font-medium">{item.queAuditar}</td>
                      <td className="border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700">{item.criterio}</td>
                      <td className="border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700">{item.evidencia}</td>
                      <td className="border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700 text-center">{item.frecuencia}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 text-[12px] italic">No hay programa de auditoria. Usa el panel de Auditoria en el diagramador para generarlo.</p>
            )}
          </DocSection>

        </div>

        {/* ─── Document Footer ─── */}
        <div className="border-t border-gray-200 px-4 sm:px-10 py-3 flex items-center justify-between text-[9px] text-gray-400">
          <span>{companyName} | {macroprocessName} | {processName}</span>
          <span>{data.codigo} | Version {processVersion}</span>
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="h-6" />
      <InsufficientTokensModal
        open={bpmnBudget.showInsufficientModal || contextBudget.showInsufficientModal}
        onClose={() => { bpmnBudget.closeInsufficientModal(); contextBudget.closeInsufficientModal() }}
        operationKey={bpmnBudget.showInsufficientModal ? 'procedure_from_bpmn' : 'procedure_from_context'}
      />
    </div>
  )
}
