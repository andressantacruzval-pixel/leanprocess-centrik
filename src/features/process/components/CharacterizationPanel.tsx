import { useMemo } from 'react'
import { Eye, Loader2, Save, Sparkles } from 'lucide-react'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import type { Process } from '@/types'
import { TOGGLE_FIELDS } from '@/pages/processCharacterizationConstants'
import { FieldHelpIcon } from './FieldHelpIcon'
import { CHARACTERIZATION_FIELD_HELP } from '@/features/process/constants/characterizationFieldHelp'

// ─── PanelField ────────────────────────────────────────────────────────────

function PanelField({ label, hint, helpText, children }: { label: string; hint?: string; helpText?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="flex items-center gap-1 mb-0.5">
        <label className="block text-[10px] font-medium text-gray-500">{label}</label>
        {helpText && <FieldHelpIcon text={helpText} />}
      </span>
      {children}
      {hint && <p className="text-[9px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

// ─── CharacterizationPanel ─────────────────────────────────────────────────

export interface CharacterizationPanelProps {
  formData: Partial<Process>
  /** La version viva del proceso. Fuera de `formData` a proposito: ahi se
   *  quedaria congelada al montar y `handleSave` la reescribiria vieja. */
  version: string
  updateField: (key: string, value: unknown) => void
  onSave: () => void
  saving: boolean
  readOnly: boolean
  generatingObjective: boolean
  onGenerateObjective: () => void
  frequencyOptions: { value: string; label: string }[]
  executionTypeOptions: { value: string; label: string }[]
  deliveryMethodOptions: { value: string; label: string }[]
  executionLevelOptions: { value: string; label: string }[]
  businessLineOptions: { value: string; label: string }[]
  supervisionOptions: { value: string; label: string }[]
  responsibleOptions: { value: string; label: string }[]
  orgUnits: { id: string; name: string; parent_id: string | null }[]
  orgLevelDefinitions: { id: string; level_number: number; level_name: string }[]
  addCatalogItem: (type: string, value: string) => void
}

export function CharacterizationPanel({
  formData,
  version,
  updateField,
  onSave,
  saving,
  readOnly,
  generatingObjective,
  onGenerateObjective,
  frequencyOptions,
  executionTypeOptions,
  deliveryMethodOptions,
  executionLevelOptions,
  businessLineOptions,
  supervisionOptions,
  responsibleOptions,
  orgUnits,
  orgLevelDefinitions,
  addCatalogItem,
}: CharacterizationPanelProps) {
  // Etiquetas dinámicas de nivel según organigrama configurado
  const sortedLevels = useMemo(
    () => [...orgLevelDefinitions].sort((a, b) => a.level_number - b.level_number),
    [orgLevelDefinitions]
  )
  const level0Label = sortedLevels[0]?.level_name ?? 'Gerencia'
  const level1Label = sortedLevels[1]?.level_name ?? 'Jefatura'
  const level2Label = sortedLevels[2]?.level_name ?? 'Area'

  // Cascada nivel 0 (raíz) → nivel 1 → nivel 2
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

  return (
    <div className="space-y-5">
      {readOnly && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 text-xs">
          <Eye size={14} />
          Modo lectura — los campos no son editables
        </div>
      )}

      {/* Objective */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1">
            <label className="block text-xs font-medium text-gray-600">Objetivo / Descripcion</label>
            <FieldHelpIcon text={CHARACTERIZATION_FIELD_HELP.description} />
          </span>
          <button
            type="button"
            onClick={onGenerateObjective}
            disabled={generatingObjective}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-primary-600 bg-primary-50 rounded-md hover:bg-primary-100 transition-colors disabled:opacity-50"
          >
            {generatingObjective ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
            IA
          </button>
        </div>
        <textarea
          value={(formData.description as string) || ''}
          onChange={(e) => updateField('description', e.target.value)}
          rows={3}
          readOnly={readOnly}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
          placeholder="Objetivo del proceso..."
        />
      </div>

      {/* Fields grid */}
      <div className={`grid grid-cols-1 min-[380px]:grid-cols-2 gap-3${readOnly ? ' pointer-events-none opacity-70' : ''}`}>
        <PanelField label="Fecha actualizacion" hint="Se actualiza automaticamente al guardar" helpText={CHARACTERIZATION_FIELD_HELP.update_date}>
          <input
            type="date"
            value={(formData.update_date as string) || ''}
            readOnly
            disabled
            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </PanelField>
        <PanelField label="Version" hint="Sube al aprobar y publicar" helpText={CHARACTERIZATION_FIELD_HELP.version}>
          <input
            type="text"
            value={version}
            readOnly
            disabled
            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </PanelField>
        <PanelField label="Entidad" helpText={CHARACTERIZATION_FIELD_HELP.entity}>
          <input type="text" value={(formData.entity as string) || ''} readOnly disabled className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs bg-gray-50 text-gray-500 cursor-not-allowed" />
        </PanelField>
        <PanelField label="Tipo de proceso" helpText={CHARACTERIZATION_FIELD_HELP.process_type}>
          <input type="text" value={(formData.process_type as string) || ''} readOnly disabled className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs bg-gray-50 text-gray-500 cursor-not-allowed" />
        </PanelField>
        <PanelField label="Frecuencia" helpText={CHARACTERIZATION_FIELD_HELP.execution_frequency}>
          <CreatableSelect options={frequencyOptions} value={(formData.execution_frequency as string) || ''} onChange={(v) => updateField('execution_frequency', v)} onCreateOption={(v) => addCatalogItem('execution_frequency', v)} placeholder="Frecuencia..." />
        </PanelField>
        <PanelField label="Nivel ejecucion" helpText={CHARACTERIZATION_FIELD_HELP.execution_level}>
          <CreatableSelect options={executionLevelOptions} value={(formData.execution_level as string) || ''} onChange={(v) => updateField('execution_level', v)} onCreateOption={(v) => addCatalogItem('execution_level', v)} placeholder="Nivel..." />
        </PanelField>
        <PanelField label={level0Label} helpText={CHARACTERIZATION_FIELD_HELP.management}>
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
        </PanelField>
        <PanelField
          label={level1Label}
          hint={!selectedManagementId ? `Elige primero ${level0Label.toLowerCase()}` : undefined}
          helpText={CHARACTERIZATION_FIELD_HELP.coordination}
        >
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
        </PanelField>
        {sortedLevels.length >= 3 && (
          <PanelField
            label={level2Label}
            hint={!selectedCoordinationId ? `Elige primero ${level1Label.toLowerCase()}` : undefined}
            helpText={CHARACTERIZATION_FIELD_HELP.coordination}
          >
            <CreatableSelect
              options={operativeOptions}
              value={(formData.operative as string) || ''}
              onChange={(v) => updateField('operative', v)}
              placeholder={selectedCoordinationId ? `${level2Label}...` : `(elige ${level1Label.toLowerCase()})`}
            />
          </PanelField>
        )}
        <PanelField label="Linea negocio" helpText={CHARACTERIZATION_FIELD_HELP.business_line}>
          <CreatableSelect options={businessLineOptions} value={(formData.business_line as string) || ''} onChange={(v) => updateField('business_line', v)} onCreateOption={(v) => addCatalogItem('business_line', v)} placeholder="Linea..." />
        </PanelField>
        <PanelField label="Supervision" helpText={CHARACTERIZATION_FIELD_HELP.supervision_level}>
          <CreatableSelect options={supervisionOptions} value={(formData.supervision_level as string) || ''} onChange={(v) => updateField('supervision_level', v)} onCreateOption={(v) => addCatalogItem('supervision_level', v)} placeholder="Nivel..." />
        </PanelField>
        <PanelField label="Responsable" helpText={CHARACTERIZATION_FIELD_HELP.responsible}>
          <CreatableSelect options={responsibleOptions} value={(formData.responsible as string) || ''} onChange={(v) => updateField('responsible', v)} onCreateOption={(v) => addCatalogItem('responsible', v)} placeholder="Responsable..." />
        </PanelField>
        <PanelField label="Medio entrega" helpText={CHARACTERIZATION_FIELD_HELP.delivery_method}>
          <CreatableSelect options={deliveryMethodOptions} value={(formData.delivery_method as string) || ''} onChange={(v) => updateField('delivery_method', v)} onCreateOption={(v) => addCatalogItem('delivery_method', v)} placeholder="Medio..." />
        </PanelField>
        <PanelField label="Tipo ejecucion" helpText={CHARACTERIZATION_FIELD_HELP.execution_type}>
          <CreatableSelect options={executionTypeOptions} value={(formData.execution_type as string) || ''} onChange={(v) => updateField('execution_type', v)} onCreateOption={(v) => addCatalogItem('execution_type', v)} placeholder="Tipo..." />
        </PanelField>
      </div>

      {/* Toggles */}
      <div className={readOnly ? 'pointer-events-none opacity-70' : ''}>
        <h3 className="text-xs font-medium text-gray-600 mb-2">Atributos</h3>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
          {TOGGLE_FIELDS.map(({ key, label }) => {
            const helpText = CHARACTERIZATION_FIELD_HELP[key as string]
            return (
              <label key={key} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 cursor-pointer transition-colors has-[:checked]:border-primary-300 has-[:checked]:bg-primary-50">
                <div className="relative shrink-0">
                  <input type="checkbox" checked={!!formData[key]} onChange={(e) => updateField(key, e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 rounded-full bg-gray-100 ring-1 ring-inset ring-gray-300 peer-checked:ring-0 transition-all bg-primary-500" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md peer-checked:translate-x-4 transition-transform" />
                </div>
                <span className="flex items-center gap-1 text-[11px] text-gray-700 peer-checked:text-primary-700">
                  {label}
                  {helpText && <FieldHelpIcon text={helpText} />}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={onSave}
        disabled={saving || readOnly}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 bg-primary-500 hover:bg-primary-600"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {readOnly ? 'Modo lectura' : 'Guardar Caracterizacion'}
      </button>
    </div>
  )
}
