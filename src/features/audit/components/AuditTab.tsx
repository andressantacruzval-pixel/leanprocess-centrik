import { useState, useMemo } from 'react'
import { ClipboardCheck, Sparkles, Loader2, Trash2, Plus } from 'lucide-react'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { useRiskStore } from '@/stores/riskStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useAuditStore } from '@/stores/auditStore'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { generateAuditFromBpmn } from '@/lib/claude'
import { parseBpmnXml, bpmnToTextSummary } from '@/utils/bpmnParser'
import type { AuditItem } from '@/lib/procedureAi'
import { AuditItemModal } from './AuditItemModal'

interface AuditTabProps {
  processId: string
  processName: string
  bpmnXml?: string
  isExpanded?: boolean
}

export function AuditTab({ processId, processName, bpmnXml, isExpanded }: AuditTabProps) {
  const company = useCompanyStore((s) => s.company)
  const allRisks = useRiskStore((s) => s.risks)
  const processRisks = useMemo(() => allRisks.filter((r) => r.process_id === processId), [allRisks, processId])

  const allAudits = useAuditStore((s) => s.audits)
  const auditItems = useMemo(() => allAudits[processId] || [], [allAudits, processId])
  const setAuditItems = useAuditStore((s) => s.setAuditItems)
  const removeAuditItem = useAuditStore((s) => s.removeAuditItem)

  const [isGenerating, setIsGenerating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<AuditItem | undefined>()
  const [selectedIndex, setSelectedIndex] = useState<number | undefined>()

  const auditBudget = useTokenBudget({ operationKey: 'audit_recommendations' })

  const handleGenerate = async () => {
    if (!bpmnXml || isGenerating) return
    setIsGenerating(true)
    await auditBudget.run(async () => {
      const parsed = parseBpmnXml(bpmnXml)
      const summary = bpmnToTextSummary(parsed)
      const risksContext = processRisks.map((r) => ({
        title: r.title,
        processStep: r.processStep,
        controls: r.controls.map((c) => ({ description: c.description })),
      }))
      const items = await generateAuditFromBpmn(summary, processName, company?.name, risksContext)
      setAuditItems(processId, items)
    })
    setIsGenerating(false)
  }

  const handleOpenAdd = () => {
    setSelectedItem(undefined)
    setSelectedIndex(undefined)
    setModalOpen(true)
  }

  const handleOpenEdit = (item: AuditItem, index: number) => {
    setSelectedItem(item)
    setSelectedIndex(index)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setTimeout(() => {
      setSelectedItem(undefined)
      setSelectedIndex(undefined)
    }, 300)
  }

  const removeItem = (index: number) => {
    removeAuditItem(processId, index)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={isExpanded ? 16 : 14} className="text-violet-400" />
          <span className={`font-semibold text-white ${isExpanded ? 'text-sm' : 'text-xs'}`}>Programa de Auditoria</span>
          {auditItems.length > 0 && (
            <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">{auditItems.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/10 border border-white/10 transition-colors"
            title="Agregar ítem de auditoría"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!bpmnXml || isGenerating || auditBudget.isConsuming}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 text-[11px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {(isGenerating || auditBudget.isConsuming) ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {(isGenerating || auditBudget.isConsuming) ? 'Generando...' : auditItems.length > 0 ? 'Regenerar' : 'Generar con IA'}
            <TokenCostBadge operationKey="audit_recommendations" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {!isGenerating && auditItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <ClipboardCheck size={24} className="text-white/10 mb-3" />
            <p className="text-xs text-white/30 mb-1">Sin programa de auditoria</p>
            <p className="text-[10px] text-white/20 mb-4">
              {bpmnXml
                ? 'Genera recomendaciones de auditoria basadas en el flujograma y riesgos, o agrega ítems manualmente.'
                : 'Necesitas un diagrama BPMN primero, o agrega ítems manualmente.'}
            </p>
          </div>
        )}

        {!isGenerating && auditItems.length > 0 && (
          <div className={isExpanded ? 'p-5 grid grid-cols-1 lg:grid-cols-2 gap-3' : 'p-3 space-y-2'}>
            {auditItems.map((item, i) => (
              <div
                key={i}
                onClick={() => handleOpenEdit(item, i)}
                className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-2 group cursor-pointer hover:border-white/10 hover:bg-white/[0.04] transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className={`font-medium text-white ${isExpanded ? 'text-xs' : 'text-[11px]'}`}>{item.queAuditar}</p>
                    <p className={`text-violet-400/60 mt-0.5 ${isExpanded ? 'text-[10px]' : 'text-[9px]'}`}>{item.actividad}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(i) }}
                    className="p-0.5 text-white/20 opacity-30 group-hover:opacity-100 group-hover:text-red-500 transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>

                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-x-3 gap-y-1">
                  <div>
                    <span className="text-[10px] text-white/30 uppercase">Criterio</span>
                    <p className="text-xs text-white/70">{item.criterio}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 uppercase">Evidencia</span>
                    <p className="text-xs text-white/70">{item.evidencia}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 uppercase">Frecuencia</span>
                    <p className="text-xs text-white/70">{item.frecuencia}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 uppercase">Responsable</span>
                    <p className="text-xs text-white/70">{item.responsable}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title="¿Eliminar este item de auditoria?"
        onConfirm={() => {
          if (deleteTarget !== null) { removeItem(deleteTarget); setDeleteTarget(null) }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      <InsufficientTokensModal
        open={auditBudget.showInsufficientModal}
        onClose={auditBudget.closeInsufficientModal}
        operationKey="audit_recommendations"
      />
      <AuditItemModal
        key={`${modalOpen}-${selectedIndex ?? 'new'}`}
        open={modalOpen}
        processId={processId}
        processName={processName}
        bpmnXml={bpmnXml}
        companyName={company?.name}
        existingItems={auditItems}
        item={selectedItem}
        itemIndex={selectedIndex}
        auditBudget={auditBudget}
        onClose={handleCloseModal}
      />
    </div>
  )
}
