import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, MonitorSmartphone, Search, Zap } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useApplicationStore } from '@/stores/applicationStore'
import { useProcessStore } from '@/stores/processStore'
import { techRisk, DEPLOYMENT_OPTIONS, type Application } from '@/types/application'
import { AppFormModal } from './AppFormModal'

const deployLabel = (v: string) => DEPLOYMENT_OPTIONS.find((o) => o.value === v)?.label ?? ''

// Inventario central de aplicaciones (para el área de TI): lista TODAS las apps de
// la empresa, permite crear/editar/eliminar su ficha desde un solo lugar. Los
// cambios se reflejan para todos los usuarios (misma tabla applications).
export function ApplicationsCatalog() {
  const companyId = useWorkspaceStore((s) => s.activeCompanyId)
  const apps = useApplicationStore((s) => s.applications)
  const usages = useApplicationStore((s) => s.usages)
  const deleteApplication = useApplicationStore((s) => s.deleteApplication)
  const processes = useProcessStore((s) => s.processes)

  const list = useMemo(() => apps.filter((a) => a.company_id === companyId).sort((a, b) => a.name.localeCompare(b.name)), [apps, companyId])
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase()
    return query ? list.filter((a) => a.name.toLowerCase().includes(query) || (a.category || '').toLowerCase().includes(query) || (a.vendor || '').toLowerCase().includes(query)) : list
  }, [list, q])

  const [form, setForm] = useState<{ app: Application | null } | null>(null)

  const procNamesOf = (appId: string) => [...new Set(usages.filter((u) => u.application_id === appId && u.process_id).map((u) => processes.find((p) => p.id === u.process_id)?.name).filter((n): n is string => !!n))]
  const del = (app: Application) => {
    const names = procNamesOf(app.id)
    const msg = names.length ? `Se usa en ${names.length} proceso(s): ${names.join(', ')}.\nSe quitarán sus nodos de esos diagramas.` : 'No se usa en ningún proceso.'
    if (!confirm(`¿Eliminar «${app.name}» del inventario de aplicaciones?\n\n${msg}`)) return
    deleteApplication(app.id)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar aplicación, categoría o proveedor…"
            className="w-full pl-8 pr-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50" />
        </div>
        <button onClick={() => setForm({ app: null })} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-sky-600 to-cyan-600 text-white hover:from-sky-500 hover:to-cyan-500"><Plus size={14} /> Nueva aplicación</button>
      </div>

      <div className="rounded-xl border border-white/5 divide-y divide-white/5">
        {shown.length === 0 && <div className="px-4 py-10 text-center text-xs text-white/30">No hay aplicaciones. Crea la primera o identifícalas con IA desde un proceso.</div>}
        {shown.map((app) => {
          const risk = techRisk(app)
          const nProc = procNamesOf(app.id).length
          return (
            <div key={app.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.02]">
              <MonitorSmartphone size={15} className="text-sky-300 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-white font-medium truncate">{app.name}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  {app.category && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">{app.category}</span>}
                  {app.vendor && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/45">{app.vendor}</span>}
                  {app.deployment && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/45">{deployLabel(app.deployment)}</span>}
                  {app.has_api && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 inline-flex items-center gap-0.5"><Zap size={9} /> API</span>}
                  <span className="text-[9px] px-1.5 py-0.5 rounded text-white" style={{ background: risk.hex }}>Riesgo {risk.label}</span>
                  <span className="text-[9px] text-white/35">{nProc} proceso{nProc === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setForm({ app })} title="Editar ficha" className="p-2 rounded text-white/30 hover:text-cyan-400 hover:bg-cyan-500/10"><Pencil size={13} /></button>
                <button onClick={() => del(app)} title="Eliminar del inventario" className="p-2 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-white/30">Este inventario es la fuente central: el área de TI completa aquí la información y todos los usuarios la ven actualizada.</p>

      {form && <AppFormModal processId="" application={form.app} linkUsage={false} onClose={() => setForm(null)} />}
    </div>
  )
}
