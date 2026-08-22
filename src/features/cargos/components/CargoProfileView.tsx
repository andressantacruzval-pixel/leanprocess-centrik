import { Briefcase, Target, ListChecks, Network, GaugeCircle, GraduationCap, Cpu, Sparkles, Plus, X } from 'lucide-react'
import type { CargoProfile } from '../cargoProfile'

// Perfil de cargo en 2 páginas A4 (estilo documento premium, tema claro para que
// exporte impecable a PDF/Word). Editable in-situ: los textos son contentEditable
// y las listas permiten agregar/eliminar. Las métricas factuales vienen de la
// analítica por cargo (no de la IA).

export interface CargoMetrics { procesos: number; actividades: number; vaMin: number; nvaMin: number; nvabnMin: number }

interface Props {
  companyName: string
  profile: CargoProfile
  metrics: CargoMetrics
  editable?: boolean
  onPatch?: (patch: Partial<CargoProfile>) => void
}

const ACCENT = '#0e7490'

export function CargoProfileView({ companyName, profile: p, metrics: m, editable, onPatch }: Props) {
  const patchReq = (k: keyof CargoProfile['requisitos'], v: string | string[]) => onPatch?.({ requisitos: { ...p.requisitos, [k]: v } })

  return (
    <div id="cargo-profile-pages" className="flex flex-col items-center gap-6">
      {/* ── Página 1 ── */}
      <Page>
        <header className="flex items-start justify-between gap-4 pb-4 border-b-2" style={{ borderColor: ACCENT }}>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>Manual de Cargo</div>
            <Ed editable={editable} tag="h1" className="text-[26px] font-black text-slate-800 leading-tight mt-0.5" value={p.cargo} onCommit={(v) => onPatch?.({ cargo: v })} />
          </div>
          <div className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-white" style={{ background: ACCENT }}>
            <Briefcase size={26} />
          </div>
        </header>

        {/* Métricas factuales */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Metric label="Procesos" value={m.procesos} />
          <Metric label="Actividades" value={m.actividades} />
        </div>

        <Section icon={Target} title="Objetivo de la posición">
          <Ed editable={editable} tag="p" className="text-[13px] text-slate-700 leading-relaxed" value={p.objetivo} onCommit={(v) => onPatch?.({ objetivo: v })} />
          {(p.reportaA || editable) && (
            <p className="text-[12px] text-slate-500 mt-2">Reporta a: <Ed inline editable={editable} tag="span" className="font-medium text-slate-700" value={p.reportaA} onCommit={(v) => onPatch?.({ reportaA: v })} /></p>
          )}
        </Section>

        <Section icon={ListChecks} title="Responsabilidades principales">
          <EdList editable={editable} items={p.responsabilidades} onChange={(v) => onPatch?.({ responsabilidades: v })} ordered />
        </Section>

        <Footer companyName={companyName} n={1} generatedAt={p.generatedAt} />
      </Page>

      {/* ── Página 2 ── */}
      <Page>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] pb-3 border-b border-slate-200" style={{ color: ACCENT }}>
          Perfil requerido — {p.cargo}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <Section icon={GraduationCap} title="Educación">
            <Ed editable={editable} tag="p" className="text-[13px] text-slate-700 leading-relaxed" value={p.requisitos.educacion} onCommit={(v) => patchReq('educacion', v)} />
          </Section>
          <Section icon={Sparkles} title="Experiencia">
            <Ed editable={editable} tag="p" className="text-[13px] text-slate-700 leading-relaxed" value={p.requisitos.experiencia} onCommit={(v) => patchReq('experiencia', v)} />
          </Section>
        </div>

        <Section icon={GraduationCap} title="Conocimientos técnicos">
          <Chips editable={editable} items={p.requisitos.conocimientos} tone="#0e7490" onChange={(v) => patchReq('conocimientos', v)} />
        </Section>
        <Section icon={Cpu} title="Tecnología y herramientas">
          <Chips editable={editable} items={p.requisitos.tecnologia} tone="#7c3aed" onChange={(v) => patchReq('tecnologia', v)} />
        </Section>
        <Section icon={Sparkles} title="Competencias clave">
          <Chips editable={editable} items={p.requisitos.competencias} tone="#059669" onChange={(v) => patchReq('competencias', v)} />
        </Section>

        <div className="grid grid-cols-2 gap-4">
          <Section icon={Network} title="Relaciones internas">
            <EdList editable={editable} items={p.relacionesInternas} onChange={(v) => onPatch?.({ relacionesInternas: v })} />
          </Section>
          <Section icon={Network} title="Relaciones externas">
            <EdList editable={editable} items={p.relacionesExternas} onChange={(v) => onPatch?.({ relacionesExternas: v })} />
          </Section>
        </div>

        <Section icon={GaugeCircle} title="Indicadores de desempeño">
          <EdList editable={editable} items={p.indicadores} onChange={(v) => onPatch?.({ indicadores: v })} />
        </Section>

        <Footer companyName={companyName} n={2} generatedAt={p.generatedAt} />
      </Page>
    </div>
  )
}

// ─── Building blocks ───────────────────────────────────────────────────────

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="cargo-page bg-white text-slate-800 shadow-lg rounded-sm" style={{ width: 794, minHeight: 1123, padding: 48, display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={15} style={{ color: ACCENT }} />
        <h2 className="text-[12px] font-bold uppercase tracking-wide text-slate-700">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Metric({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-[20px] font-black text-slate-800 leading-none tabular-nums">{value}</div>
      {sub && <div className="text-[9px] text-slate-400">{sub}</div>}
    </div>
  )
}

function Footer({ companyName, n, generatedAt }: { companyName: string; n: number; generatedAt: string }) {
  const d = generatedAt ? generatedAt.slice(0, 10) : ''
  return (
    <div className="mt-auto pt-4 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-200">
      <span>{companyName}{d ? ` · ${d}` : ''}</span>
      <span>Página {n}/2 · LeanProcess</span>
    </div>
  )
}

// contentEditable simple: escribe en onBlur.
function Ed({ value, onCommit, className, tag = 'p', editable, inline }: { value: string; onCommit: (v: string) => void; className?: string; tag?: 'h1' | 'p' | 'span'; editable?: boolean; inline?: boolean }) {
  const Tag = tag as React.ElementType
  return (
    <Tag
      className={`${className ?? ''} ${editable ? 'outline-none focus:bg-cyan-50/60 rounded px-0.5 -mx-0.5' : ''}`}
      contentEditable={editable}
      suppressContentEditableWarning
      onBlur={editable ? (e: React.FocusEvent<HTMLElement>) => onCommit(e.currentTarget.textContent?.trim() ?? '') : undefined}
      style={inline ? { display: 'inline' } : undefined}
    >
      {value || (editable ? '' : '—')}
    </Tag>
  )
}

function EdList({ items, onChange, editable, ordered }: { items: string[]; onChange: (v: string[]) => void; editable?: boolean; ordered?: boolean }) {
  const set = (i: number, v: string) => { const n = [...items]; n[i] = v; onChange(n.filter((_, idx) => idx !== i || !!v.trim())) }
  return (
    <ul className="space-y-1">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-[13px] text-slate-700 leading-relaxed group">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }}>{ordered ? '' : ''}</span>
          <span className={`flex-1 ${editable ? 'outline-none focus:bg-cyan-50/60 rounded px-0.5' : ''}`} contentEditable={editable} suppressContentEditableWarning
            onBlur={editable ? (e) => set(i, e.currentTarget.textContent?.trim() ?? '') : undefined}>{it}</span>
          {editable && <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500"><X size={12} /></button>}
        </li>
      ))}
      {editable && (
        <li><button onClick={() => onChange([...items, 'Nuevo elemento'])} className="inline-flex items-center gap-1 text-[11px] text-cyan-700 hover:text-cyan-900"><Plus size={11} /> Agregar</button></li>
      )}
      {!items.length && !editable && <li className="text-[12px] text-slate-300">—</li>}
    </ul>
  )
}

function Chips({ items, onChange, editable, tone }: { items: string[]; onChange: (v: string[]) => void; editable?: boolean; tone: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium group" style={{ background: `${tone}14`, color: tone }}>
          <span className={editable ? 'outline-none' : ''} contentEditable={editable} suppressContentEditableWarning
            onBlur={editable ? (e) => { const n = [...items]; const v = e.currentTarget.textContent?.trim() ?? ''; n[i] = v; onChange(n.filter(Boolean)) } : undefined}>{it}</span>
          {editable && <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="opacity-40 hover:opacity-100"><X size={10} /></button>}
        </span>
      ))}
      {editable && <button onClick={() => onChange([...items, 'nuevo'])} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] border border-dashed" style={{ borderColor: `${tone}55`, color: tone }}><Plus size={10} /></button>}
      {!items.length && !editable && <span className="text-[12px] text-slate-300">—</span>}
    </div>
  )
}
