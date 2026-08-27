import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, MonitorSmartphone, Wand2, Sparkles, Loader2, ShieldAlert } from 'lucide-react'
import { useApplicationStore } from '@/stores/applicationStore'
import { useProcessStore } from '@/stores/processStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { orgProcPrefix } from '../../assets/assetCodes'
import { enrichApplication, describeApplication } from '@/lib/applicationAi'
import { parseBpmnXml } from '@/utils/bpmnParser'
import { toast } from '@/stores/toastStore'
import {
  OWNERSHIP_OPTIONS, DEPLOYMENT_OPTIONS, APP_STATUS_OPTIONS, INTEGRATION_OPTIONS,
  AUTH_OPTIONS, LICENSE_OPTIONS, techRisk, type Application,
} from '@/types/application'

interface Props {
  processId: string
  application?: Application | null
  bpmnElementId?: string | null
  activityName?: string
  // Si false, guardar NO crea un uso en el proceso (gestión desde el catálogo).
  linkUsage?: boolean
  onClose: () => void
}

export function AppFormModal({ processId, application, bpmnElementId, activityName, linkUsage = true, onClose }: Props) {
  const addApplication = useApplicationStore((s) => s.addApplication)
  const updateApplication = useApplicationStore((s) => s.updateApplication)
  const addUsage = useApplicationStore((s) => s.addUsage)
  const allApps = useApplicationStore((s) => s.applications)
  const getCatalogByType = useCatalogStore((s) => s.getCatalogByType)
  const addCatalogItem = useCatalogStore((s) => s.addCatalogItem)
  const opts = (type: string) => getCatalogByType(type).map((c) => ({ value: c.value, label: c.value }))
  const process = useProcessStore((s) => s.processes.find((p) => p.id === processId))
  const company = useCompanyStore((s) => s.company)
  const companyId = useWorkspaceStore((s) => s.activeCompanyId)
  const prefix = orgProcPrefix(process?.management, process?.coordination, process?.name)

  const [f, setF] = useState({
    name: application?.name ?? '', code: application?.code ?? '', description: application?.description ?? '',
    category: application?.category ?? '', vendor: application?.vendor ?? '',
    ownership: application?.ownership ?? '', deployment: application?.deployment ?? '', url: application?.url ?? '',
    criticality: application?.criticality ?? (null as number | null),
    business_owner: application?.business_owner ?? '', technical_custodian: application?.technical_custodian ?? '',
    status: application?.status ?? 'activo',
    has_api: application?.has_api ?? false, integration_type: application?.integration_type ?? '',
    automatable: application?.automatable ?? false, handles_personal_data: application?.handles_personal_data ?? false,
    auth_method: application?.auth_method ?? '', license_model: application?.license_model ?? '',
    cost_estimate: application?.cost_estimate ?? (null as number | null), cost_period: application?.cost_period ?? '',
    version: application?.version ?? '',
  })
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }))
  const [enriching, setEnriching] = useState(false)
  const [describing, setDescribing] = useState(false)

  const describe = async () => {
    if (!f.name.trim() || describing) return
    setDescribing(true)
    try {
      const activities = process?.bpmn_xml ? parseBpmnXml(process.bpmn_xml).activities.map((a) => a.name).filter(Boolean) : []
      const d = await describeApplication({
        name: f.name, companyName: company?.name, industry: company?.industry || undefined,
        processName: process?.name, processDescription: process?.description || undefined, activities,
      })
      if (d) { set('description', d); toast.success('Descripción generada con IA.') }
      else toast.info('La IA no pudo generar la descripción.')
    } catch { toast.error('No se pudo generar la descripción.') } finally { setDescribing(false) }
  }

  const autoCode = () => {
    const seq = allApps.filter((a) => a.company_id === companyId).length + 1
    set('code', `${prefix}-APP-${String(seq).padStart(3, '0')}`)
  }

  const enrich = async () => {
    if (!f.name.trim() || enriching) return
    setEnriching(true)
    try {
      const r = await enrichApplication({ name: f.name, description: f.description, companyName: company?.name, industry: company?.industry || undefined })
      if (r) {
        setF((p) => ({
          ...p,
          category: p.category || r.category, vendor: p.vendor || r.vendor,
          ownership: p.ownership || r.ownership, deployment: p.deployment || r.deployment,
          auth_method: p.auth_method || r.auth_method, has_api: r.has_api, automatable: r.automatable,
          criticality: p.criticality ?? r.criticality,
        }))
        toast.success('Ficha completada con IA. Revísala.')
      } else toast.info('La IA no pudo completar la ficha.')
    } catch { toast.error('No se pudo completar con IA.') } finally { setEnriching(false) }
  }

  const save = () => {
    if (!f.name.trim()) return
    const payload: Partial<Application> = { ...f, name: f.name.trim() }
    let appId = application?.id
    if (application) updateApplication(application.id, payload)
    else { const created = addApplication(payload); appId = created?.id }
    // Registra el uso de la app en este proceso (y en la actividad si viene el nodo).
    if (appId && !application && linkUsage && processId) addUsage(appId, processId, bpmnElementId ?? null, activityName ?? '')
    onClose()
  }

  const inp = 'w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-[13px] text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-cyan-500/50'
  const lbl = 'block text-[10px] font-medium text-white/50 mb-1 uppercase tracking-wide'

  // Riesgo tecnológico calculado EN VIVO con los valores actuales del formulario.
  const risk = techRisk({ criticality: f.criticality, deployment: f.deployment, has_api: f.has_api, auth_method: f.auth_method, status: f.status, handles_personal_data: f.handles_personal_data } as unknown as Application)

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed z-[71] inset-0 m-auto h-[90vh] w-[95vw] max-w-2xl bg-[#0a0f1a] rounded-2xl border border-white/10 flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center"><MonitorSmartphone size={15} className="text-sky-400" /></div>
            <h3 className="text-sm font-semibold text-white">{application ? 'Editar aplicación' : 'Nueva aplicación'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 flex items-end gap-2">
              <div className="flex-1"><label className={lbl}>Nombre *</label><input className={inp} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. SAP, Salesforce, Sistema interno…" /></div>
              <button onClick={enrich} disabled={enriching || !f.name.trim()} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600/80 to-cyan-600/80 text-white text-[11px] font-medium hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50" title="Completar la ficha con IA">
                {enriching ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Completar IA
              </button>
            </div>
            <div><label className={lbl}>Código</label>
              <div className="flex gap-1.5">
                <input className={inp} value={f.code} onChange={(e) => set('code', e.target.value)} placeholder={`${prefix}-APP-001`} />
                <button type="button" onClick={autoCode} className="shrink-0 inline-flex items-center gap-1 px-2 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10.5px] font-medium hover:bg-sky-500/25"><Wand2 size={12} /></button>
              </div>
            </div>
            <div><label className={lbl}>Categoría</label><CreatableSelect options={opts('application_category')} value={f.category} onChange={(v) => set('category', v)} onCreateOption={(v) => addCatalogItem('application_category', v)} placeholder="ERP, CRM, BI…" /></div>
            <div><label className={lbl}>Fabricante / Proveedor</label><CreatableSelect options={opts('application_vendor')} value={f.vendor} onChange={(v) => set('vendor', v)} onCreateOption={(v) => addCatalogItem('application_vendor', v)} placeholder="SAP, Microsoft, interno…" /></div>
            <div><label className={lbl}>Propiedad</label><select className={inp} value={f.ownership} onChange={(e) => set('ownership', e.target.value)}><option value="">—</option>{OWNERSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className={lbl}>Despliegue</label><select className={inp} value={f.deployment} onChange={(e) => set('deployment', e.target.value)}><option value="">—</option>{DEPLOYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className={`${lbl} mb-0`}>Descripción</label>
                <button type="button" onClick={describe} disabled={describing || !f.name.trim()}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-purple-600/80 to-cyan-600/80 text-white text-[10px] font-medium hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50"
                  title="Genera qué es y para qué se usa, leyendo el nombre y el contexto del subproceso">
                  {describing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} Describir IA
                  <TokenCostBadge operationKey="application_describe" />
                </button>
              </div>
              <textarea rows={2} className={`${inp} resize-none`} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Qué hace y para qué se usa en el proceso" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lbl}>Responsable de negocio</label><input className={inp} value={f.business_owner} onChange={(e) => set('business_owner', e.target.value)} /></div>
            <div><label className={lbl}>Custodio técnico (TI)</label><input className={inp} value={f.technical_custodian} onChange={(e) => set('technical_custodian', e.target.value)} /></div>
            <div><label className={lbl}>Criticidad</label><select className={inp} value={f.criticality ?? ''} onChange={(e) => set('criticality', e.target.value ? Number(e.target.value) : null)}><option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
            <div><label className={lbl}>Estado</label><select className={inp} value={f.status} onChange={(e) => set('status', e.target.value)}>{APP_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-3">
            <p className="text-[11px] font-semibold text-cyan-200/80">Automatización e integración</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-[12px] text-white/70"><input type="checkbox" checked={f.has_api} onChange={(e) => set('has_api', e.target.checked)} className="accent-cyan-500" /> Tiene API / integración</label>
              <label className="flex items-center gap-2 text-[12px] text-white/70"><input type="checkbox" checked={f.automatable} onChange={(e) => set('automatable', e.target.checked)} className="accent-cyan-500" /> Candidata a automatización</label>
              <div><label className={lbl}>Tipo de integración</label><select className={inp} value={f.integration_type} onChange={(e) => set('integration_type', e.target.value)}><option value="">—</option>{INTEGRATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className={lbl}>Autenticación</label><select className={inp} value={f.auth_method} onChange={(e) => set('auth_method', e.target.value)}><option value="">—</option>{AUTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            </div>
          </div>

          {/* Riesgo tecnológico: se calcula solo; aquí se explica de dónde sale. */}
          <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: `${risk.hex}55`, background: `${risk.hex}12` }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-white/85 flex items-center gap-1.5"><ShieldAlert size={13} style={{ color: risk.hex }} /> Riesgo tecnológico</p>
              <span className="text-[10.5px] px-2 py-0.5 rounded font-medium text-white" style={{ background: risk.hex }}>{risk.label} · {risk.score}/100</span>
            </div>
            <p className="text-[10.5px] text-white/50 leading-relaxed">Se calcula <b className="text-white/70">automáticamente</b> con lo que llenas arriba: <b className="text-white/70">criticidad</b>, <b className="text-white/70">despliegue</b> (on-premise pesa más), <b className="text-white/70">API</b> (sin API pesa más), <b className="text-white/70">autenticación</b> (débil pesa más), <b className="text-white/70">estado</b> (deprecado / a reemplazar) y si <b className="text-white/70">maneja datos personales</b>.</p>
            {risk.factors.length > 0
              ? <div className="flex flex-wrap gap-1">{risk.factors.map((fac) => <span key={fac} className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/70">{fac}</span>)}</div>
              : <p className="text-[9.5px] text-white/35">Completa los campos de arriba para ver qué eleva el riesgo.</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-[12px] text-white/70 sm:col-span-2"><input type="checkbox" checked={f.handles_personal_data} onChange={(e) => set('handles_personal_data', e.target.checked)} className="accent-cyan-500" /> Maneja datos personales</label>
            <div><label className={lbl}>Modelo de licencia</label><select className={inp} value={f.license_model} onChange={(e) => set('license_model', e.target.value)}><option value="">—</option>{LICENSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={lbl}>Costo estimado</label><input type="number" className={inp} value={f.cost_estimate ?? ''} onChange={(e) => set('cost_estimate', e.target.value ? Number(e.target.value) : null)} /></div>
              <div><label className={lbl}>Periodicidad</label><select className={inp} value={f.cost_period} onChange={(e) => set('cost_period', e.target.value)}><option value="">—</option><option value="mensual">Mensual</option><option value="anual">Anual</option><option value="unico">Único</option></select></div>
            </div>
            <div><label className={lbl}>URL / acceso</label><input className={inp} value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></div>
            <div><label className={lbl}>Versión</label><input className={inp} value={f.version} onChange={(e) => set('version', e.target.value)} /></div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/5 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/5 border border-white/10">Cancelar</button>
          <button onClick={save} disabled={!f.name.trim()} className="px-4 py-2 rounded-lg text-[12px] font-medium bg-gradient-to-r from-sky-600 to-cyan-600 text-white hover:from-sky-500 hover:to-cyan-500 disabled:opacity-40">{application ? 'Guardar cambios' : 'Crear aplicación'}</button>
        </div>
      </div>
    </>,
    document.body
  )
}
