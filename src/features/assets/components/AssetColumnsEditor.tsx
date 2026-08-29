import { useState, type Dispatch, type SetStateAction } from 'react'
import { Plus, Trash2, Columns3, Sparkles, Loader2, Check, Wand2, X } from 'lucide-react'
import type { AssetColumn } from '@/types/asset'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import { toast } from '@/stores/toastStore'
import { suggestAssetColumns, type AiColumnSuggestion } from '@/lib/assetAi'
import { ASSET_OPERATIONS } from '@/types/asset'
import { STATE_COLORS } from '../journey/journeyGraph'
import { buildColumnCode } from '../assetCodes'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const inpBase = 'bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500'
const inp = `w-full ${inpBase}`
const inpCode = `w-24 shrink-0 ${inpBase}` // sin w-full para no tapar nombre/descripción

interface Props {
  columns: AssetColumn[]
  setColumns: Dispatch<SetStateAction<AssetColumn[]>>
  assetName: string
  assetType?: string
  description?: string
  getCodeBase: () => string
}

// Editor de columnas/campos del activo: alta manual, sugerencia con IA (con
// confirmación por columna), auto-codificación e indicador nuevo (ámbar) /
// en catálogo (verde), como los cargos del diagramador.
export function AssetColumnsEditor({ columns, setColumns, assetName, assetType, description, getCodeBase }: Props) {
  const getCatalogByType = useCatalogStore((s) => s.getCatalogByType)
  const company = useCompanyStore((s) => s.company)
  const fieldItems = getCatalogByType('asset_field')
  const opts = fieldItems.map((c) => ({ value: c.value, label: c.value }))
  const fieldSet = new Set(fieldItems.map((c) => norm(c.value)))

  const addColumn = () => setColumns((c) => [...c, { name: '', code: '', description: '' }])
  const updateColumn = (i: number, key: keyof AssetColumn, v: string) => setColumns((c) => c.map((col, idx) => (idx === i ? { ...col, [key]: v } : col)))
  const removeColumn = (i: number) => setColumns((c) => c.filter((_, idx) => idx !== i))
  const autoColumnCodes = () => setColumns((cols) => cols.map((c, i) => (c.code?.trim() ? c : { ...c, code: buildColumnCode(getCodeBase(), i) })))

  const budget = useTokenBudget({ operationKey: 'asset_columns' })
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<AiColumnSuggestion[]>([])
  const handleSuggest = async () => {
    if (suggesting) return
    setSuggesting(true)
    try {
      const res = await budget.run(() => suggestAssetColumns({
        assetName, assetType, description, companyName: company?.name, industry: company?.industry || undefined,
        existingFields: fieldItems.map((c) => c.value), currentColumns: columns.map((c) => c.name).filter(Boolean),
      }))
      if (res) setSuggestions(res)
    } catch { toast.error('No se pudieron sugerir columnas.') } finally { setSuggesting(false) }
  }
  const acceptSuggestion = (s: AiColumnSuggestion) => {
    setColumns((cols) => [...cols, { name: s.name, code: buildColumnCode(getCodeBase(), cols.length), description: s.description, operation: s.operation }])
    setSuggestions((prev) => prev.filter((x) => x.name !== s.name))
  }
  const acceptAll = () => { suggestions.forEach(acceptSuggestion); setSuggestions([]) }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
        <p className="text-[11px] font-semibold text-gray-700 flex items-center gap-1.5"><Columns3 size={13} className="text-primary-600" />Columnas / campos del activo <span className="text-[10px] font-medium text-primary-700 bg-primary-50 rounded-md px-1.5 py-0.5">{columns.length}</span></p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={handleSuggest} disabled={suggesting || budget.isConsuming} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-white text-[10.5px] font-medium disabled:opacity-50 bg-primary-500 hover:bg-primary-600">{(suggesting || budget.isConsuming) ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} Sugerir IA <TokenCostBadge operationKey="asset_columns" /></button>
          {columns.length > 0 && <button type="button" onClick={autoColumnCodes} title="Auto-codificar columnas" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 text-[10.5px] font-medium hover:bg-gray-100"><Wand2 size={11} /> Códigos</button>}
          <button type="button" onClick={addColumn} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-50 text-primary-700 border border-primary-300 text-[10.5px] font-medium hover:bg-primary-100"><Plus size={11} /> Columna</button>
        </div>
      </div>

      {columns.length === 0 && suggestions.length === 0 ? (
        <p className="text-[11px] text-gray-400 py-2">Sin columnas. Añádelas manualmente o pulsa «Sugerir IA» para proponer los campos lógicos de este activo.</p>
      ) : (
        <div className="space-y-1.5">
          {columns.map((col, i) => {
            const inCat = !!col.name.trim() && fieldSet.has(norm(col.name))
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${!col.name.trim() ? 'bg-gray-200' : inCat ? 'bg-emerald-500' : 'bg-amber-500'}`} title={!col.name.trim() ? '' : inCat ? 'En catálogo' : 'Campo nuevo (se agrega al catálogo al guardar)'} />
                <input className={inpCode} value={col.code ?? ''} onChange={(e) => updateColumn(i, 'code', e.target.value)} placeholder="Código" title="Código de la columna" />
                <div className="flex-1 min-w-[130px]"><CreatableSelect options={opts} value={col.name} onChange={(v) => updateColumn(i, 'name', v)} onCreateOption={() => { /* se persiste al guardar */ }} placeholder="Buscar campo por nombre…" /></div>
                <div className="relative shrink-0">
                  <select value={col.operation ?? ''} onChange={(e) => updateColumn(i, 'operation', e.target.value)} className={`${inpBase} w-32 pl-5`} title="Tratamiento del dato (mapeo de flujo de valor)" style={{ appearance: 'none' }}>
                    <option value="">Tratamiento…</option>
                    {ASSET_OPERATIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none" style={{ background: col.operation ? (STATE_COLORS[col.operation] ?? '#64748b') : 'transparent', border: col.operation ? 'none' : '1px solid rgba(255,255,255,.2)' }} />
                </div>
                <div className="flex-[1.4] min-w-[150px]"><input className={inp} value={col.description} onChange={(e) => updateColumn(i, 'description', e.target.value)} placeholder="Descripción de la columna" /></div>
                <button type="button" onClick={() => removeColumn(i)} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0" title="Quitar"><Trash2 size={13} /></button>
              </div>
            )
          })}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-2 rounded-lg border border-primary-200 bg-primary-50 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] text-primary-700">{suggestions.length} columna(s) sugeridas por IA — confírmalas para agregarlas.</p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={acceptAll} className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-medium hover:bg-emerald-100">Aceptar todas</button>
              <button type="button" onClick={() => setSuggestions([])} className="px-2 py-0.5 rounded-md text-gray-500 hover:text-gray-700 text-[10px]">Descartar</button>
            </div>
          </div>
          <div className="space-y-1">
            {suggestions.map((s) => {
              const inCat = fieldSet.has(norm(s.name))
              return (
                <div key={s.name} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-gray-50 border border-gray-100">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${inCat ? 'bg-emerald-500' : 'bg-amber-500'}`} title={inCat ? 'Ya en catálogo' : 'Campo nuevo'} />
                  <span className="min-w-0 flex-1"><span className="text-[12px] text-gray-800">{s.name}</span>{s.description && <span className="block text-[10px] text-gray-400 truncate">{s.description}</span>}</span>
                  {s.operation && <span className="text-[8.5px] px-1.5 py-0.5 rounded-md shrink-0" style={{ background: `${STATE_COLORS[s.operation] ?? '#64748b'}22`, color: STATE_COLORS[s.operation] ?? '#94a3b8' }}>{s.operation}</span>}
                  <button type="button" onClick={() => acceptSuggestion(s)} title="Agregar" className="p-1 rounded-md text-emerald-700 hover:bg-emerald-50 shrink-0"><Check size={13} /></button>
                  <button type="button" onClick={() => setSuggestions((prev) => prev.filter((x) => x.name !== s.name))} title="Descartar" className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"><X size={13} /></button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <InsufficientTokensModal open={budget.showInsufficientModal} onClose={budget.closeInsufficientModal} operationKey="asset_columns" />
    </div>
  )
}
