import { FILAS_POR_TANDA } from './reportPaging'

// Primitivas compartidas de los reportes: tarjetas de KPI, gráficos ligeros
// (dona SVG + barras CSS), insights de decisión y la tabla paginada con su
// "ver más". Centralizadas para que cada reporte quede bajo las 300 líneas y
// para que todos se vean igual.

// ─── Layout ──────────────────────────────────────────────────────────────

export function Dashboard({ children }: { children: React.ReactNode }) {
  return <div className="p-3 sm:p-4 space-y-4">{children}</div>
}

export function Grid({ cols = 4, children }: { cols?: number; children: React.ReactNode }) {
  const map: Record<number, string> = {
    2: 'grid-cols-2', 3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4', 5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  }
  return <div className={`grid ${map[cols] ?? map[4]} gap-3`}>{children}</div>
}

export function Card({ title, sub, right, children }: { title?: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      {(title || right) && (
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            {title && <h4 className="text-sm font-semibold text-white">{title}</h4>}
            {sub && <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────

const TONE: Record<string, string> = {
  cyan: 'border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-300',
  emerald: 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300',
  amber: 'border-amber-500/30 bg-amber-500/[0.06] text-amber-300',
  red: 'border-red-500/30 bg-red-500/[0.06] text-red-300',
  violet: 'border-violet-500/30 bg-violet-500/[0.06] text-violet-300',
  plain: 'border-white/10 bg-white/5 text-white',
}

export function Stat({ label, value, sub, tone = 'plain' }: { label: string; value: number | string; sub?: string; tone?: keyof typeof TONE }) {
  return (
    <div className={`rounded-2xl border p-4 ${TONE[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="text-2xl font-black mt-1 leading-none tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-white/40 mt-1">{sub}</div>}
    </div>
  )
}

// ─── Horizontal bars ─────────────────────────────────────────────────────

export interface Datum { label: string; value: number; color?: string }

export function HBars({ data, onBar, active }: { data: Datum[]; onBar?: (label: string) => void; active?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (!data.length) return <p className="text-[11px] text-white/30 py-4 text-center">Sin datos</p>
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <button key={d.label} onClick={onBar ? () => onBar(d.label) : undefined} disabled={!onBar}
          className={`w-full flex items-center gap-3 group text-left ${onBar ? 'cursor-pointer' : 'cursor-default'}`}>
          <span className={`w-36 shrink-0 text-[12px] truncate text-right ${active === d.label ? 'text-white' : 'text-white/60 group-hover:text-white/90'}`}>{d.label}</span>
          <span className="flex-1 h-5 rounded-md bg-white/5 overflow-hidden">
            <span className="h-full rounded-md flex items-center justify-end px-2 min-w-[1.5rem]" style={{ width: `${Math.max(6, d.value / max * 100)}%`, background: d.color ?? '#06b6d4' }}>
              <span className="text-[10px] font-bold text-white/95">{d.value}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── Donut (SVG) ─────────────────────────────────────────────────────────

export function Donut({ data, center, unit, onSlice, active }: { data: Datum[]; center?: string; unit?: string; onSlice?: (label: string) => void; active?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const R = 52, C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg viewBox="0 0 130 130" className="w-32 h-32 shrink-0 -rotate-90">
        <circle cx="65" cy="65" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
        {total > 0 && data.map((d, i) => {
          const frac = d.value / total
          const dash = frac * C
          const el = <circle key={i} cx="65" cy="65" r={R} fill="none" stroke={d.color ?? '#06b6d4'} strokeWidth="16" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset} />
          offset += dash
          return el
        })}
      </svg>
      <div className="min-w-0 flex-1">
        {center != null && <div className="mb-2"><span className="text-2xl font-black text-white tabular-nums">{center}</span>{unit && <span className="text-[11px] text-white/40 ml-1">{unit}</span>}</div>}
        <div className="space-y-1">
          {data.map((d) => {
            const inner = (
              <>
                <i className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color ?? '#06b6d4' }} />
                <span className={`truncate ${active === d.label ? 'text-white' : 'text-white/70'}`}>{d.label}</span>
                <span className="ml-auto text-white/50 tabular-nums">{d.value}{total > 0 ? ` · ${Math.round(d.value / total * 100)}%` : ''}</span>
              </>
            )
            return onSlice
              ? <button key={d.label} onClick={() => onSlice(d.label)} className={`w-full flex items-center gap-2 text-[11px] rounded px-1 -mx-1 transition-colors ${active === d.label ? 'bg-white/10' : 'hover:bg-white/5'}`}>{inner}</button>
              : <div key={d.label} className="flex items-center gap-2 text-[11px]">{inner}</div>
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Insight callout ─────────────────────────────────────────────────────

const INSIGHT_TONE: Record<string, { border: string; icon: string }> = {
  crit: { border: 'border-red-500/30 bg-red-500/[0.06]', icon: '🔴' },
  warn: { border: 'border-amber-500/30 bg-amber-500/[0.06]', icon: '🟠' },
  ok: { border: 'border-emerald-500/30 bg-emerald-500/[0.06]', icon: '🟢' },
  info: { border: 'border-cyan-500/30 bg-cyan-500/[0.06]', icon: '💡' },
}

export function Insight({ tone = 'info', children }: { tone?: keyof typeof INSIGHT_TONE; children: React.ReactNode }) {
  const t = INSIGHT_TONE[tone]
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${t.border}`}>
      <span className="text-[13px] leading-none mt-0.5">{t.icon}</span>
      <p className="text-[12.5px] text-white/75 leading-snug">{children}</p>
    </div>
  )
}

// ─── Table primitives ────────────────────────────────────────────────────

export function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2.5 text-[9px] font-semibold text-white/35 uppercase tracking-wider whitespace-nowrap sticky top-0 bg-[#0d1117] z-10">{children}</th>
}

export function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-[11px] text-white/65 whitespace-nowrap ${className}`}>{children}</td>
}

export function EmptyRow({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} className="px-3 py-8 text-center text-[11px] text-white/20">No hay datos para mostrar</td></tr>
}

export function Badge({ label, hex }: { label: string; hex: string }) {
  return <span className="text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap" style={{ backgroundColor: `${hex}22`, color: hex }}>{label}</span>
}

export function VerMasRow({ cols, ocultas, onVerMas }: { cols: number; ocultas: number; onVerMas: () => void }) {
  if (ocultas === 0) return null
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-3 text-center">
        <button onClick={onVerMas} className="px-4 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:text-white/80 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-colors">
          Ver {Math.min(ocultas, FILAS_POR_TANDA)} más · quedan {ocultas}
        </button>
        <p className="mt-1.5 text-[10px] text-white/20">La descarga incluye las {ocultas} restantes</p>
      </td>
    </tr>
  )
}

export function TableWrap({ minWidth, children }: { minWidth: number; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent rounded-2xl border border-white/5 bg-white/[0.02]">
      <table className="w-full text-left" style={{ minWidth }}>{children}</table>
    </div>
  )
}
