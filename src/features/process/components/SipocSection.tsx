import { useState, useCallback } from 'react'
import { Plus, Trash2, Pencil, Sparkles } from 'lucide-react'
import { useCatalogStore, type SipocEntry } from '@/features/catalog/catalogStore'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { usePlanLimits } from '@/hooks/useActiveCompany'
import { planName } from '@/lib/plans'
import { avisarSiSinCupo } from '@/lib/planGateMessage'
import { ACCIONES_AL_PASAR } from '@/lib/constants'
import { parseBpmnXml } from '@/utils/bpmnParser'
import type { SipocAiContext, SipocTurn } from '@/lib/sipocAi'
import { SipocAiAssistant } from '@/features/process/components/SipocAiAssistant'
import {
  SipocLeftModal,
  SipocRightModal,
  SipocEditInputModal,
  SipocEditOutputModal,
} from '@/features/process/components/SipocModals'

export default function SipocSection({ processId }: { processId: string }) {
  /**
   * SIPOC cuenta como documentacion, y esta seccion se monta en `ProcessDetailPage`,
   * que NO puede llevar `useDocumentableGuard`: el guardian redirige justo a esa
   * pagina, asi que se quedaria dando vueltas sobre si misma. Por eso el freno vive
   * aqui, en los dos botones que crean.
   *
   * Solo se frena AÑADIR. Editar o borrar una fila que ya existe no documenta nada
   * nuevo — el proceso ya contaba —, y es la misma linea que traza el trigger
   * `enforce_documentable_level`, que solo mira INSERT.
   */
  const plan = usePlanLimits()
  const sinCupo = !plan.puedeDocumentar(processId)
  const motivo = `Has llegado al límite de procesos documentados de tu ${planName(plan.level)}: ${plan.cap}. Puedes seguir editando los procesos que ya contaban.`
  // Clase literal, no interpolada: Tailwind no compila clases construidas con plantilla.
  const CLASE_BLOQUEADA =
    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium bg-white/[0.02] text-white/25 border border-white/5 cursor-not-allowed'

  const suppliers = useCatalogStore((s) => s.suppliers)
  const customers = useCatalogStore((s) => s.customers)
  const sipocEntries = useCatalogStore((s) => s.sipocEntries)
  const addSupplier = useCatalogStore((s) => s.addSupplier)
  const addCustomer = useCatalogStore((s) => s.addCustomer)
  const addSipocEntry = useCatalogStore((s) => s.addSipocEntry)
  const updateSipocEntry = useCatalogStore((s) => s.updateSipocEntry)
  const deleteSipocEntry = useCatalogStore((s) => s.deleteSipocEntry)

  const processSipoc = sipocEntries
    .filter((e) => e.process_id === processId)
    .sort((a, b) => a.sort_order - b.sort_order)

  const [sipocLeftModal, setSipocLeftModal] = useState(false)
  const [sipocRightModal, setSipocRightModal] = useState(false)
  const [editingInputEntry, setEditingInputEntry] = useState<SipocEntry | null>(null)
  const [editingOutputEntry, setEditingOutputEntry] = useState<SipocEntry | null>(null)

  // ─── Asistente IA ─────────────────────────────────────────────────────────
  const [aiOpen, setAiOpen] = useState(false)
  // Filas recién añadidas por la IA, para resaltarlas un instante al aparecer.
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set())

  const process = useProcessStore((s) => s.processes.find((p) => p.id === processId))
  const macroprocesses = useProcessStore((s) => s.macroprocesses)
  const allProcesses = useProcessStore((s) => s.processes)
  const company = useCompanyStore((s) => s.company)

  // La IA entiende el proceso Y su entorno: hermanos de la empresa (posibles
  // proveedores/clientes internos) y actividades del diagrama. Se lee FRESCO en
  // cada turno para no repetir lo ya registrado.
  const getContext = useCallback((): SipocAiContext => {
    const macro = macroprocesses.find((m) => m.id === process?.macroprocess_id)
    const parent = process?.parent_process_id ? allProcesses.find((p) => p.id === process.parent_process_id) : undefined
    const siblings = allProcesses
      .filter((p) => p.company_id === process?.company_id && p.id !== processId)
      .map((p) => p.name)
    let activities: string[] = []
    try {
      if (process?.bpmn_xml) activities = parseBpmnXml(process.bpmn_xml).activities.map((a) => a.name).filter(Boolean)
    } catch { /* diagrama ilegible: seguimos sin actividades */ }
    const current = useCatalogStore.getState().sipocEntries.filter((e) => e.process_id === processId)
    return {
      companyName: company?.name || '',
      industry: company?.industry || undefined,
      macroName: macro?.name,
      parentName: parent?.name,
      processName: process?.name || '',
      description: process?.description || undefined,
      siblings,
      activities,
      existing: {
        inputs: current.filter((e) => e.supplier_name || e.input_description).map((e) => ({ supplier: e.supplier_name, input: e.input_description })),
        outputs: current.filter((e) => e.output_description || e.customer_name).map((e) => ({ output: e.output_description, customer: e.customer_name })),
      },
    }
  }, [process, macroprocesses, allProcesses, company, processId])

  // Añade a la tabla los pares NUEVOS que propone la IA (deduplica) y los resalta.
  const norm = (s: string) => s.trim().toLowerCase()
  const handleAiAdd = useCallback((add: SipocTurn['add']): number => {
    if (!add) return 0
    const existing = useCatalogStore.getState().sipocEntries.filter((e) => e.process_id === processId)
    const seenIn = new Set(existing.map((e) => `${norm(e.supplier_name)}|${norm(e.input_description)}`))
    const seenOut = new Set(existing.map((e) => `${norm(e.output_description)}|${norm(e.customer_name)}`))
    const created: string[] = []
    for (const p of add.inputs ?? []) {
      const key = `${norm(p.supplier)}|${norm(p.input)}`
      if (!p.input.trim() || seenIn.has(key)) continue
      seenIn.add(key)
      const e = addSipocEntry(processId, '', p.supplier, p.input, '', '', '')
      if (e) created.push(e.id)
    }
    for (const p of add.outputs ?? []) {
      const key = `${norm(p.output)}|${norm(p.customer)}`
      if (!p.output.trim() || seenOut.has(key)) continue
      seenOut.add(key)
      const e = addSipocEntry(processId, '', '', '', p.output, '', p.customer)
      if (e) created.push(e.id)
    }
    if (created.length) {
      setRecentIds((prev) => new Set([...prev, ...created]))
      setTimeout(() => setRecentIds((prev) => {
        const n = new Set(prev)
        created.forEach((id) => n.delete(id))
        return n
      }), 2600)
    }
    return created.length
  }, [processId, addSipocEntry])

  const handleDeleteInput = (e: SipocEntry) => {
    if (e.output_description || e.customer_id) {
      updateSipocEntry(e.id, { supplier_id: '', supplier_name: '', input_description: '' })
    } else {
      deleteSipocEntry(e.id)
    }
  }

  const handleDeleteOutput = (e: SipocEntry) => {
    if (e.input_description || e.supplier_id) {
      updateSipocEntry(e.id, { output_description: '', customer_id: '', customer_name: '' })
    } else {
      deleteSipocEntry(e.id)
    }
  }

  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-teal-400">
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white truncate">Analisis SIPOC</h2>
            <p className="text-xs text-white/35">Proveedores, Entradas, Salidas y Clientes del proceso</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (avisarSiSinCupo(sinCupo, plan.level, plan.cap)) return
              setAiOpen((v) => !v)
            }}
            title={sinCupo ? motivo : 'Construir el SIPOC con ayuda de la IA'}
            className={sinCupo ? CLASE_BLOQUEADA : `flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium border transition-colors ${aiOpen ? 'bg-purple-500/25 text-purple-100 border-purple-500/40' : 'bg-purple-500/10 text-purple-300 border-purple-500/25 hover:bg-purple-500/20'}`}
          >
            <Sparkles size={12} /> Construir con IA
          </button>
          <button
            onClick={() => {
              if (avisarSiSinCupo(sinCupo, plan.level, plan.cap)) return
              setSipocLeftModal(true)
            }}
            title={sinCupo ? motivo : 'Agregar proveedor y entrada'}
            className={sinCupo ? CLASE_BLOQUEADA : 'flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-[11px] font-medium hover:bg-red-500/20 transition-colors'}
          >
            <Plus size={12} /> Proveedor / Entrada
          </button>
          <button
            onClick={() => {
              if (avisarSiSinCupo(sinCupo, plan.level, plan.cap)) return
              setSipocRightModal(true)
            }}
            title={sinCupo ? motivo : 'Agregar salida y cliente'}
            className={sinCupo ? CLASE_BLOQUEADA : 'flex items-center gap-1.5 px-3 py-2 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-lg text-[11px] font-medium hover:bg-teal-500/20 transition-colors'}
          >
            <Plus size={12} /> Salida / Cliente
          </button>
        </div>
      </div>

      {/* Asistente IA inline: la tabla queda visible debajo y se puebla en vivo. */}
      {aiOpen && (
        <SipocAiAssistant getContext={getContext} onAdd={handleAiAdd} onClose={() => setAiOpen(false)} />
      )}

      {/* `overflow-x-auto` + `min-w`: son 4 columnas de texto libre y estaban dentro de
          un `overflow-hidden`, asi que se aplastaban sin escape posible. */}
      <div className="rounded-lg border border-white/10 overflow-x-auto text-xs">
        <div className="min-w-[640px]">
        <div className="grid grid-cols-4">
          <div className="bg-red-600/80 text-white text-center font-semibold py-2">Proveedores</div>
          <div className="bg-gray-800 text-white text-center font-semibold py-2">Entradas</div>
          <div className="bg-teal-600/80 text-white text-center font-semibold py-2">Salidas</div>
          <div className="bg-blue-600/80 text-white text-center font-semibold py-2">Clientes</div>
        </div>

        {processSipoc.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-xs">No hay entradas SIPOC. Agrega proveedores/entradas y salidas/clientes.</div>
        ) : (
          processSipoc.map((entry) => (
            <div key={entry.id} className={`grid grid-cols-4 border-t border-white/5 group hover:bg-white/[0.02] transition-colors duration-500 ${recentIds.has(entry.id) ? 'bg-purple-500/[0.10] ring-1 ring-inset ring-purple-400/40' : ''}`}>
              <div className="px-3 py-2 text-white/70 bg-red-500/5">{entry.supplier_name}</div>

              {/* `pr-16` reserva el sitio de los botones: sin el, el texto pasaba por
                  debajo de ellos. Y los botones estan SIEMPRE en el DOM — ver
                  ACCIONES_AL_PASAR: eran la unica forma de editar o borrar una fila
                  SIPOC y no existian sin raton. */}
              <div className="pl-3 pr-16 py-2 text-white/70 relative">
                <span>{entry.input_description}</span>
                <div className={`absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 ${ACCIONES_AL_PASAR}`}>
                  <button onClick={() => setEditingInputEntry(entry)} title="Editar entrada" className="p-2 rounded hover:bg-white/10 text-white/30 hover:text-cyan-400 transition-all"><Pencil size={12} /></button>
                  <button onClick={() => handleDeleteInput(entry)} title="Eliminar entrada" className="p-2 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"><Trash2 size={12} /></button>
                </div>
              </div>

              <div className="pl-3 pr-16 py-2 text-white/70 bg-teal-500/5 relative">
                <span>{entry.output_description}</span>
                <div className={`absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 ${ACCIONES_AL_PASAR}`}>
                  <button onClick={() => setEditingOutputEntry(entry)} title="Editar salida" className="p-2 rounded hover:bg-white/10 text-white/30 hover:text-cyan-400 transition-all"><Pencil size={12} /></button>
                  <button onClick={() => handleDeleteOutput(entry)} title="Eliminar salida" className="p-2 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"><Trash2 size={12} /></button>
                </div>
              </div>

              <div className="px-3 py-2 text-white/70 bg-blue-500/5">{entry.customer_name}</div>
            </div>
          ))
        )}
        </div>
      </div>

      {/* Modales de agregar */}
      {sipocLeftModal && (
        <SipocLeftModal
          suppliers={suppliers}
          addSupplier={addSupplier}
          onSave={(supplierId, supplierName, inputDesc) => { addSipocEntry(processId, supplierId, supplierName, inputDesc, '', '', ''); setSipocLeftModal(false) }}
          onClose={() => setSipocLeftModal(false)}
        />
      )}
      {sipocRightModal && (
        <SipocRightModal
          customers={customers}
          addCustomer={addCustomer}
          entries={processSipoc}
          onSave={(entryId, outputDesc, customerId, customerName) => {
            if (entryId) { updateSipocEntry(entryId, { output_description: outputDesc, customer_id: customerId, customer_name: customerName }) }
            else { addSipocEntry(processId, '', '', '', outputDesc, customerId, customerName) }
            setSipocRightModal(false)
          }}
          onClose={() => setSipocRightModal(false)}
        />
      )}

      {/* Modales de edición (popup pre-relleno) */}
      {editingInputEntry && (
        <SipocEditInputModal
          entry={editingInputEntry}
          suppliers={suppliers}
          addSupplier={addSupplier}
          onSave={(supplierId, supplierName, inputDesc) => {
            updateSipocEntry(editingInputEntry.id, { supplier_id: supplierId, supplier_name: supplierName, input_description: inputDesc })
            setEditingInputEntry(null)
          }}
          onClose={() => setEditingInputEntry(null)}
        />
      )}
      {editingOutputEntry && (
        <SipocEditOutputModal
          entry={editingOutputEntry}
          customers={customers}
          addCustomer={addCustomer}
          onSave={(outputDesc, customerId, customerName) => {
            updateSipocEntry(editingOutputEntry.id, { output_description: outputDesc, customer_id: customerId, customer_name: customerName })
            setEditingOutputEntry(null)
          }}
          onClose={() => setEditingOutputEntry(null)}
        />
      )}
    </div>
  )
}
