import { useMemo, useRef, useState } from 'react'
import { Search, UserCog, Sparkles, Loader2, FileText, FileDown, RefreshCw, Pencil, Check } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useProcessStore } from '@/stores/processStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { toast } from '@/stores/toastStore'
import { useCargoData, type CargoAgg } from '@/features/cargos/cargoData'
import { buildCargoContext, useCargoProfileStore, type CargoProfile } from '@/features/cargos/cargoProfile'
import { generateCargoProfile } from '@/lib/cargoProfileAi'
import { CargoProfileView, type CargoMetrics } from '@/features/cargos/components/CargoProfileView'

// Reporte "Manuales de Cargo": elige un cargo, genera con IA su perfil de 2
// páginas (objetivo, responsabilidades y perfil requerido inferido de sus
// actividades reales), edítalo en vivo y expórtalo a PDF o Word.

export function CargoManualsReport() {
  const companyId = useWorkspaceStore((s) => s.activeCompanyId) ?? ''
  const company = useCompanyStore((s) => s.company)
  const processes = useProcessStore((s) => s.processes)
  const indicators = useIndicatorStore((s) => s.indicators)
  const { getProfile, setProfile, patchProfile } = useCargoProfileStore()
  const profilesMap = useCargoProfileStore((s) => s.profiles)
  const { cargos } = useCargoData(companyId)

  const [q, setQ] = useState('')
  const [selKey, setSelKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState(false)
  const pagesRef = useRef<HTMLDivElement>(null)

  const conActividad = useMemo(() => cargos.filter((c) => c.activities.length > 0), [cargos])
  const shown = useMemo(() => conActividad.filter((c) => !q || c.cargo.toLowerCase().includes(q.toLowerCase())), [conActividad, q])
  const sel = useMemo(() => conActividad.find((c) => c.key === selKey) ?? null, [conActividad, selKey])
  const profile = sel ? getProfile(companyId, sel.cargo) : undefined
  void profilesMap // fuerza re-render al cambiar perfiles

  const areasOf = (agg: CargoAgg) => {
    const byId = new Map(processes.map((p) => [p.id, p]))
    return [...new Set([...agg.processes].map((id) => byId.get(id)?.management).filter(Boolean))].join(', ')
  }

  const generate = async (agg: CargoAgg) => {
    if (busy) return
    setBusy(true)
    try {
      const ctx = buildCargoContext({ agg, processes, indicators, companyName: company?.name ?? 'Empresa', industry: company?.industry })
      const p = await generateCargoProfile(agg.cargo, ctx)
      setProfile(companyId, agg.cargo, p)
      setEdit(false)
      toast.success('Perfil de cargo generado.')
    } catch (e) {
      const m = e instanceof Error ? e.message : ''
      toast.error(m === 'INSUFFICIENT_CREDITS' ? 'Sin tokens de IA suficientes.' : 'No se pudo generar el perfil. Reintenta.')
    } finally { setBusy(false) }
  }

  const onPatch = (patch: Partial<CargoProfile>) => { if (sel) patchProfile(companyId, sel.cargo, patch) }

  const exportPdf = async () => {
    if (!pagesRef.current) return
    const { exportCargoProfilePdf } = await import('@/features/cargos/cargoProfileExport')
    await exportCargoProfilePdf(pagesRef.current, `Manual_de_Cargo_${(sel?.cargo || 'cargo').replace(/\s+/g, '_')}.pdf`)
  }
  const exportDocx = async () => {
    if (!profile || !sel) return
    const { exportCargoProfileDocx } = await import('@/features/cargos/cargoProfileExport')
    await exportCargoProfileDocx(profile, company?.name ?? 'Empresa', areasOf(sel), `Manual_de_Cargo_${sel.cargo.replace(/\s+/g, '_')}.docx`)
  }

  if (!conActividad.length) {
    return (
      <div className="p-10 text-center">
        <UserCog size={28} className="mx-auto text-white/20 mb-3" />
        <h3 className="text-base font-semibold text-white">Aún no hay cargos con actividades</h3>
        <p className="text-sm text-white/50 mt-1 max-w-md mx-auto">Dibuja flujogramas con roles (lanes). Cuando un cargo tenga actividades, aquí podrás generar su manual de cargo con IA.</p>
      </div>
    )
  }

  const metrics: CargoMetrics | null = sel ? { procesos: sel.processes.size, actividades: sel.activities.length, vaMin: sel.vaMin, nvaMin: sel.nvaMin, nvabnMin: sel.nvabnMin } : null

  return (
    <div className="p-3 sm:p-4 flex flex-col lg:flex-row gap-4">
      {/* Lista de cargos */}
      <aside className="lg:w-64 shrink-0 space-y-2">
        <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg border border-white/10 px-3 py-1.5">
          <Search size={13} className="text-white/25 shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cargo…" className="bg-transparent text-xs text-white placeholder-white/25 outline-none flex-1 min-w-0" />
        </div>
        <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
          {shown.map((c) => {
            const has = !!getProfile(companyId, c.cargo)
            return (
              <button key={c.key} onClick={() => { setSelKey(c.key); setEdit(false) }}
                className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors ${selKey === c.key ? 'bg-cyan-500/15 border border-cyan-500/30' : 'border border-transparent hover:bg-white/5'}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] text-white/85 truncate flex-1">{c.cargo}</span>
                  {has && <Check size={12} className="text-emerald-400 shrink-0" />}
                </div>
                <div className="text-[10px] text-white/35">{c.processes.size} proc. · {c.activities.length} act.</div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* Panel del perfil */}
      <div className="flex-1 min-w-0">
        {!sel ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
            <UserCog size={24} className="mx-auto text-white/20 mb-2" />
            <p className="text-sm text-white/50">Elige un cargo a la izquierda para ver o generar su manual.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Barra de acciones */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white flex-1 min-w-0 truncate">{sel.cargo}</h3>
              {profile ? (
                <>
                  <button onClick={() => setEdit((v) => !v)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border ${edit ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-white/15 text-white/70 hover:bg-white/5'}`}>{edit ? <Check size={13} /> : <Pencil size={13} />} {edit ? 'Listo' : 'Editar'}</button>
                  <button onClick={() => generate(sel)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border border-white/15 text-white/70 hover:bg-white/5 disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Regenerar</button>
                  <button onClick={exportPdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/15"><FileDown size={13} /> PDF</button>
                  <button onClick={exportDocx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/15"><FileText size={13} /> Word</button>
                </>
              ) : (
                <button onClick={() => generate(sel)} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-[13px] font-semibold shadow-lg shadow-cyan-500/30 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Generar con IA</button>
              )}
            </div>

            {profile && metrics ? (
              <div className="overflow-x-auto rounded-2xl bg-slate-200/5 p-4">
                <div ref={pagesRef}>
                  <CargoProfileView companyName={company?.name ?? 'Empresa'} areas={areasOf(sel)} profile={profile} metrics={metrics} editable={edit} onPatch={onPatch} />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
                <Sparkles size={22} className="mx-auto text-cyan-400/60 mb-2" />
                <p className="text-sm text-white/60">Genera el manual de «{sel.cargo}» con IA a partir de sus {sel.activities.length} actividades en {sel.processes.size} proceso(s).</p>
                <p className="text-[11px] text-white/35 mt-1">Objetivo, responsabilidades y perfil requerido (educación, conocimientos, tecnología, competencias).</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
