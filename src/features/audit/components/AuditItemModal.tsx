import { useState, useCallback } from 'react'
import { X, ClipboardCheck, Sparkles, Loader2 } from 'lucide-react'
import { ConfirmUnsavedModal } from '@/components/ui/ConfirmUnsavedModal'
import type { AuditItem } from '@/lib/procedureAi'
import type { TokenBudgetResult } from '@/hooks/useTokenBudget'
import { useAuditStore } from '@/stores/auditStore'
import { useAuditAiSuggest } from '../hooks/useAuditAiSuggest'

const FRECUENCIAS = ['Mensual', 'Trimestral', 'Semestral', 'Anual'] as const

const EMPTY_FORM: AuditItem = {
  actividad: '',
  queAuditar: '',
  criterio: '',
  evidencia: '',
  frecuencia: 'Trimestral',
  responsable: '',
}

interface AuditItemModalProps {
  open: boolean
  processId: string
  processName: string
  bpmnXml?: string
  companyName?: string
  existingItems: AuditItem[]
  item?: AuditItem
  itemIndex?: number
  auditBudget: TokenBudgetResult
  onClose: () => void
}

export function AuditItemModal({
  open,
  processId,
  processName,
  bpmnXml,
  companyName,
  existingItems,
  item,
  itemIndex,
  auditBudget,
  onClose,
}: AuditItemModalProps) {
  const addAuditItem = useAuditStore((s) => s.addAuditItem)
  const updateAuditItem = useAuditStore((s) => s.updateAuditItem)

  const [form, setForm] = useState<AuditItem>(() => item ? { ...item } : { ...EMPTY_FORM })
  const [initialForm] = useState<AuditItem>(() => item ? { ...item } : { ...EMPTY_FORM })
  const [touched, setTouched] = useState(false)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  const isEditMode = item !== undefined && itemIndex !== undefined
  const isValid = form.queAuditar.trim() !== '' && form.criterio.trim() !== ''
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const handleCloseAttempt = () => { if (isDirty) setShowConfirmClose(true); else onClose() }

  const handleSuggested = useCallback((suggested: AuditItem) => {
    setForm(suggested)
  }, [])

  const { handleAiSuggestOne, isAiSuggesting } = useAuditAiSuggest({
    bpmnXml,
    processName,
    companyName,
    existingItems,
    auditBudget,
    onSuggested: handleSuggested,
  })

  const handleSave = () => {
    setTouched(true)
    if (!isValid) return
    if (isEditMode) {
      updateAuditItem(processId, itemIndex, form)
    } else {
      addAuditItem(processId, form)
    }
    onClose()
  }

  const setField = <K extends keyof AuditItem>(key: K, value: AuditItem[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  if (!open) return null

  const fieldError = (val: string) => touched && val.trim() === ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 border border-gray-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={15} className="text-primary-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              {isEditMode ? 'Editar ítem de auditoría' : 'Nuevo ítem de auditoría'}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {bpmnXml && (
              <button
                onClick={handleAiSuggestOne}
                disabled={isAiSuggesting || auditBudget.isConsuming}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Sugerir ítem con IA"
              >
                {isAiSuggesting || auditBudget.isConsuming
                  ? <Loader2 size={11} className="animate-spin" />
                  : <Sparkles size={11} />}
                IA
              </button>
            )}
            <button
              onClick={handleCloseAttempt}
              className="p-1 rounded-md hover:bg-gray-50 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Actividad */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">
              Actividad del proceso
            </label>
            <input
              type="text"
              value={form.actividad}
              onChange={(e) => setField('actividad', e.target.value)}
              placeholder="Nombre de la actividad asociada..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-900 focus:ring-1 focus:ring-primary-500 placeholder-gray-400"
            />
          </div>

          {/* Qué auditar */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">
              ¿Qué auditar? <span className="text-red-600">*</span>
            </label>
            <textarea
              value={form.queAuditar}
              onChange={(e) => setField('queAuditar', e.target.value)}
              rows={3}
              placeholder="Aspecto específico a auditar..."
              className={`w-full px-3 py-2 border rounded-lg text-xs bg-gray-50 text-gray-900 focus:ring-1 focus:ring-primary-500 resize-none placeholder-gray-400 ${
                fieldError(form.queAuditar) ? 'border-red-300' : 'border-gray-200'
              }`}
            />
            {fieldError(form.queAuditar) && (
              <p className="text-[9px] text-red-600 mt-1">Campo requerido</p>
            )}
          </div>

          {/* Criterio */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">
              Criterio o norma <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={form.criterio}
              onChange={(e) => setField('criterio', e.target.value)}
              placeholder="ISO 9001, política interna, etc."
              className={`w-full px-3 py-2 border rounded-lg text-xs bg-gray-50 text-gray-900 focus:ring-1 focus:ring-primary-500 placeholder-gray-400 ${
                fieldError(form.criterio) ? 'border-red-300' : 'border-gray-200'
              }`}
            />
            {fieldError(form.criterio) && (
              <p className="text-[9px] text-red-600 mt-1">Campo requerido</p>
            )}
          </div>

          {/* Evidencia + Frecuencia */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">
                Tipo de evidencia
              </label>
              <input
                type="text"
                value={form.evidencia}
                onChange={(e) => setField('evidencia', e.target.value)}
                placeholder="Registros, reportes..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-900 focus:ring-1 focus:ring-primary-500 placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">
                Frecuencia
              </label>
              <select
                value={form.frecuencia}
                onChange={(e) => setField('frecuencia', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-900 focus:ring-1 focus:ring-primary-500"
              >
                {FRECUENCIAS.map((f) => (
                  <option key={f} value={f} className="bg-surface-ground text-gray-900">{f}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Responsable */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">
              Responsable
            </label>
            <input
              type="text"
              value={form.responsable}
              onChange={(e) => setField('responsable', e.target.value)}
              placeholder="Rol que ejecuta la auditoría..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-900 focus:ring-1 focus:ring-primary-500 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={touched && !isValid}
            className="px-5 py-2 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary-500 hover:bg-primary-600"
          >
            Guardar
          </button>
        </div>
      </div>
      {showConfirmClose && (
        <ConfirmUnsavedModal
          onDiscard={onClose}
          onSave={() => { setShowConfirmClose(false); handleSave() }}
        />
      )}
    </div>
  )
}
