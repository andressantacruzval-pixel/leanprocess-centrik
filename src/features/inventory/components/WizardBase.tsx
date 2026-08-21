import { useRef } from 'react'
import { Map, Building2, Upload, ArrowRight, Info } from 'lucide-react'
import { useInventoryStore } from '@/stores/inventoryStore'
import type { InvDoc } from '../types'
import { TIPO_COLOR } from '../types'
import { leafAreas } from '../inventoryUtils'

// Paso 1 — Base: el mapa Nivel 0 y las áreas se LEEN de la app (mapa de procesos
// y estructura organizacional). No se crean áreas aquí.

interface Props {
  companyId: string
  doc: InvDoc
  onImport: (text: string) => void
  onNext: () => void
}

export function WizardBase({ companyId, doc, onImport, onNext }: Props) {
  const setProyecto = useInventoryStore((s) => s.setProyecto)
  const fileRef = useRef<HTMLInputElement>(null)
  const hojas = leafAreas(doc.areas, doc.macros)
  const P = doc.proyecto

  const franjas = ['Productivo', 'Apoyo', 'Estratégico'] as const

  return (
    <div className="space-y-5">
      <header>
        <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 mb-1">Paso 1 · Punto de partida</div>
        <h2 className="text-2xl font-bold text-white">El mapa y las áreas de tu empresa</h2>
        <p className="text-sm text-white/50 mt-1">El inventario se construye sobre lo que ya tienes en la app: el mapa de procesos Nivel 0 y la estructura organizacional. Se leen automáticamente.</p>
      </header>

      {/* Mapa Nivel 0 (leído del mapa de procesos) */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Map size={16} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Mapa de procesos Nivel 0</h3>
          <span className="text-[11px] text-white/40">· {doc.macros.length} macroproceso(s) leídos del mapa</span>
        </div>
        {doc.macros.length ? (
          <div className="flex flex-wrap gap-1.5">
            {doc.macros.map((m, i) => (
              <span key={m.nombre + i} className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                <i className="w-2 h-2 rounded-full" style={{ background: TIPO_COLOR[m.tipo] }} />{m.nombre}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-amber-300/80 flex items-center gap-2"><Info size={14} /> No hay macroprocesos en el mapa. Créalos primero en el Mapa de Procesos.</p>
        )}
        <div className="flex gap-3 mt-3 text-[11px] text-white/40">
          {franjas.map((t) => (<span key={t} className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ background: TIPO_COLOR[t] }} />{t}</span>))}
        </div>
      </div>

      {/* Áreas (leídas de estructura organizacional) */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Building2 size={16} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Estructura organizacional</h3>
          <span className="text-[11px] text-white/40">· {hojas.length} área(s) hoja (las que reciben subprocesos)</span>
        </div>
        {hojas.length ? (
          <div className="flex flex-wrap gap-1.5">
            {hojas.map((a, i) => (
              <span key={a + i} className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">{a}</span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-amber-300/80 flex items-center gap-2"><Info size={14} /> No hay áreas en Estructura Organizacional. Puedes cargarlas allí, o dejarlo así: el prompt se las pedirá a la IA.</p>
        )}
      </div>

      {/* Ficha del proyecto */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Ficha del proyecto</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Consultor" value={P.consultor} onChange={(v) => setProyecto(companyId, { consultor: v })} placeholder="Nombre y apellido" />
          <Field label="Organización cliente" value={P.cliente} onChange={(v) => setProyecto(companyId, { cliente: v })} placeholder="Ej. Centrik" />
          <Field label="Sector / giro" value={P.sector} onChange={(v) => setProyecto(companyId, { sector: v })} placeholder="Ej. Software B2B" />
          <Field label="Alcance" value={P.alcance} onChange={(v) => setProyecto(companyId, { alcance: v })} placeholder="Ej. Toda la empresa" />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onNext} disabled={!doc.macros.length} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-cyan-500/30 disabled:opacity-40 disabled:shadow-none">
          Elegir método <ArrowRight size={15} />
        </button>
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/15 text-white/70 text-sm hover:bg-white/5">
          <Upload size={14} /> Importar inventario (.json)
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return
          const r = new FileReader(); r.onload = () => onImport(String(r.result)); r.readAsText(f); e.target.value = ''
        }} />
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-white/50 mb-1.5">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent" />
    </label>
  )
}
