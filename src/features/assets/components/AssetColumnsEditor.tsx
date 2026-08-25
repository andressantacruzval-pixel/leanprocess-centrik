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
const inpBase = 'bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-[13px] text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-cyan-500/50'
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
        <p className="text-[11px] font-semibold text-white/70 flex items-center gap-1.5"><Columns3 size={13} className="text-indigo-400" />Columnas / campos del activo <span className="text-[10px] font-medium text-indigo-300 bg-indigo-500/15 rounded px-1.5 py-0.5">{columns.length}</span></p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={handleSuggest} disabled={suggesting || budget.isConsuming} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-purple-600/80 to-cyan-600/80 text-white text-[10.5px] font-medium hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50">{(suggesting || budget.isConsuming) ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} Sugerir IA <TokenCostBadge operationKey="asset_columns" /></button>
          {columns.length > 0 && <button type="button" onClick={autoColumnCodes} title="Auto-codificar columnas" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 text-white/60 border border-white/10 text-[10.5px] font-medium hover:bg-white/10"><Wand2 size={11} /> Códigos</button>}
          <button type="button" onClick={addColumn} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10.5px] font-medium hover:bg-indigo-500/25"><Plus size={11} /> Columna</button>
        </div>
      </div>

      {columns.length === 0 && suggestions.length === 0 ? (
        <p className="text-[11px] text-white/30 py-2">Sin columnas. Añádelas manualmente o pulsa «Sugerir IA» para proponer los campos lógicos de este activo.</p>
      ) : (
        <div className="space-y-1.5">
          {columns.map((col, i) => {
            const inCat = !!col.name.trim() && fieldSet.has(norm(col.name))
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${!col.name.trim() ? 'bg-white/20' : inCat ? 'bg-emerald-400' : 'bg-amber-400'}`} title={!col.name.trim() ? '' : inCat ? 'En catálogo' : 'Campo nuevo (se agrega al catálogo al guardar)'} />
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
                <button type="button" onClick={() => removeColumn(i)} className="p-1.5 rounded text-white/25 hover:text-red-400 hover:bg-red-500/10 shrink-0" title="Quitar"><Trash2 size={13} /></button>
              </div>
            )
          })}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-2 rounded-lg border border-purple-500/25 bg-purple-500/[0.05] p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] text-purple-200/90">{suggestions.length} columna(s) sugeridas por IA — confírmalas para agregarlas.</p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={acceptAll} className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 text-[10px] font-medium hover:bg-emerald-500/30">Aceptar todas</button>
              <button type="button" onClick={() => setSuggestions([])} className="px-2 py-0.5 rounded text-white/40 hover:text-white/70 text-[10px]">Descartar</button>
            </div>
          </div>
          <div className="space-y-1">
            {suggestions.map((s) => {
              const inCat = fieldSet.has(norm(s.name))
              return (
                <div key={s.name} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.03] border border-white/8">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${inCat ? 'bg-emerald-400' : 'bg-amber-400'}`} title={inCat ? 'Ya en catálogo' : 'Campo nuevo'} />
                  <span className="min-w-0 flex-1"><span className="text-[12px] text-white/80">{s.name}</span>{s.description && <span className="block text-[10px] text-white/35 truncate">{s.description}</span>}</span>
                  {s.operation && <span className="text-[8.5px] px-1.5 py-0.5 rounded shrink-0" style={{ background: `${STATE_COLORS[s.operation] ?? '#64748b'}22`, color: STATE_COLORS[s.operation] ?? '#94a3b8' }}>{s.operation}</span>}
                  <button type="button" onClick={() => acceptSuggestion(s)} title="Agregar" className="p-1 rounded text-emerald-300 hover:bg-emerald-500/15 shrink-0"><Check size={13} /></button>
                  <button type="button" onClick={() => setSuggestions((prev) => prev.filter((x) => x.name !== s.name))} title="Descartar" className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 shrink-0"><X size={13} /></button>
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
