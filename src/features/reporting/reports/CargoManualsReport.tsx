import { useMemo, useRef, useState } from 'react'
import { Search, UserCog, Sparkles, Loader2, FileText, FileDown, RefreshCw, Pencil, Check } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useProcessStore } from '@/stores/processStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { toast } from '@/stores/toastStore'
import { useCargoData, scaleDaily, type CargoAgg } from '@/features/cargos/cargoData'
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
    await exportCargoProfileDocx(profile, company?.name ?? 'Empresa', `Manual_de_Cargo_${sel.cargo.replace(/\s+/g, '_')}.docx`)
  }

  if (!conActividad.length) {
    return (
      <div className="p-10 text-center">
        <UserCog size={28} className="mx-auto text-gray-300 mb-3" />
        <h3 className="text-base font-semibold text-gray-900">Aún no hay cargos con actividades</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">Dibuja flujogramas con roles (lanes). Cuando un cargo tenga actividades, aquí podrás generar su manual de cargo con IA.</p>
      </div>
    )
  }

  const metrics: CargoMetrics | null = sel ? {
    procesos: sel.processes.size, actividades: sel.activities.length,
    vaMin: scaleDaily(sel.vaDaily, 'mes', 'min'), nvaMin: scaleDaily(sel.nvaDaily, 'mes', 'min'), nvabnMin: scaleDaily(sel.nvabnDaily, 'mes', 'min'),
  } : null

  const withManual = conActividad.filter((c) => !!getProfile(companyId, c.cargo)).length
  const pending = conActividad.length - withManual

  return (
    <div className="p-3 sm:p-4 space-y-4">
      {/* Resumen de cobertura de manuales */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Cargos" value={conActividad.length} tone="cyan" />
        <MiniStat label="Con manual" value={withManual} tone="emerald" />
        <MiniStat label="Pendientes" value={pending} tone={pending ? 'amber' : 'emerald'} />
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
      {/* Lista de cargos */}
      <aside className="lg:w-64 shrink-0 space-y-2">
        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg border border-gray-200 px-3 py-1.5">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cargo…" className="bg-transparent text-xs text-gray-900 placeholder-gray-400 outline-none flex-1 min-w-0" />
        </div>
        <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
          {shown.map((c) => {
            const has = !!getProfile(companyId, c.cargo)
            return (
              <button key={c.key} onClick={() => { setSelKey(c.key); setEdit(false) }}
                className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors ${selKey === c.key ? 'bg-primary-50 border border-primary-300' : 'border border-transparent hover:bg-gray-50'}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] text-gray-800 truncate flex-1">{c.cargo}</span>
                  {has && <Check size={12} className="text-emerald-600 shrink-0" />}
                </div>
                <div className="text-[10px] text-gray-400">{c.processes.size} proc. · {c.activities.length} act.</div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* Panel del perfil */}
      <div className="flex-1 min-w-0">
        {!sel ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
            <UserCog size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Elige un cargo a la izquierda para ver o generar su manual.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Barra de acciones */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-gray-900 flex-1 min-w-0 truncate">{sel.cargo}</h3>
              {profile ? (
                <>
                  <button onClick={() => setEdit((v) => !v)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border ${edit ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{edit ? <Check size={13} /> : <Pencil size={13} />} {edit ? 'Listo' : 'Editar'}</button>
                  <button onClick={() => generate(sel)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Regenerar</button>
                  <button onClick={exportPdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] bg-red-50 text-red-700 border border-red-200 hover:bg-red-50"><FileDown size={13} /> PDF</button>
                  <button onClick={exportDocx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-50"><FileText size={13} /> Word</button>
                </>
              ) : (
                <button onClick={() => generate(sel)} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] font-semibold shadow-lg disabled:opacity-50 bg-primary-500">{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Generar con IA</button>
              )}
            </div>

            {profile && metrics ? (
              <div className="overflow-x-auto rounded-lg bg-slate-200/5 p-4">
                <div ref={pagesRef}>
                  <CargoProfileView companyName={company?.name ?? 'Empresa'} profile={profile} metrics={metrics} editable={edit} onPatch={onPatch} />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
                <Sparkles size={22} className="mx-auto text-primary-600 mb-2" />
                <p className="text-sm text-gray-600">Genera el manual de «{sel.cargo}» con IA a partir de sus {sel.activities.length} actividades en {sel.processes.size} proceso(s).</p>
                <p className="text-[11px] text-gray-400 mt-1">Objetivo, responsabilidades y perfil requerido (educación, conocimientos, tecnología, competencias).</p>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'emerald' | 'amber' }) {
  const cls = tone === 'cyan' ? 'border-primary-300 bg-primary-50 text-primary-700'
    : tone === 'emerald' ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
    : 'border-amber-300 bg-amber-50 text-amber-700'
  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-black mt-1 leading-none tabular-nums">{value}</div>
    </div>
  )
}
