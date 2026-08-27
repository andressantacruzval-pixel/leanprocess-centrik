import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, MonitorSmartphone, Sparkles, Loader2, Link2, Cpu, Zap } from 'lucide-react'
import { useApplicationStore } from '@/stores/applicationStore'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { identifyApplicationsFromProcess } from '@/lib/applicationAi'
import { parseBpmnXml } from '@/utils/bpmnParser'
import { toast } from '@/stores/toastStore'
import { techRisk, DEPLOYMENT_OPTIONS, type Application, type ApplicationUsage } from '@/types/application'
import type { BpmnModelerInstance, BpmnEventBus, BpmnElement, BpmnElementRegistry } from '@/types/bpmn'
import { placeApplicationNode, isApplicationBO, stripAppPrefix } from '../placeApplicationNode'
import { removeNode } from '../../assets/placeAssetNode'
import { AppFormModal } from './AppFormModal'

const DATA_NODE_TYPES = new Set(['bpmn:DataStoreReference', 'bpmn:DataObjectReference'])
const deployLabel = (v: string) => DEPLOYMENT_OPTIONS.find((o) => o.value === v)?.label ?? v
// Normaliza el nombre para comparar (sin acentos, minúsculas) y evitar duplicados.
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

interface Props { processId: string; processName: string; isExpanded?: boolean; modeler?: BpmnModelerInstance | null }

export function ApplicationsTab({ processId, processName, isExpanded, modeler }: Props) {
  const applications = useApplicationStore((s) => s.applications)
  const usages = useApplicationStore((s) => s.usages)
  const addApplication = useApplicationStore((s) => s.addApplication)
  const addUsage = useApplicationStore((s) => s.addUsage)
  const deleteUsage = useApplicationStore((s) => s.deleteUsage)
  const process = useProcessStore((s) => s.processes.find((p) => p.id === processId))
  const company = useCompanyStore((s) => s.company)
  const budget = useTokenBudget({ operationKey: 'application_identification' })
  const [identifying, setIdentifying] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Application | null>(null)
  const [pickExisting, setPickExisting] = useState(false)

  const list = usages.filter((u) => u.process_id === processId)
  const appById = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications])
  const usedAppIds = new Set(list.map((u) => u.application_id))
  const availableApps = applications.filter((a) => !usedAppIds.has(a.id))
  // Una fila por APLICACIÓN en este proceso (agrupa sus nodos/usos).
  const byApp = useMemo(() => {
    const m = new Map<string, { app: Application; us: ApplicationUsage[] }>()
    for (const u of list) { const app = appById.get(u.application_id); if (!app) continue; const e = m.get(app.id) ?? { app, us: [] }; e.us.push(u); m.set(app.id, e) }
    return [...m.values()]
  }, [list, appById])

  // Nodos «Aplicación» del diagrama (DataObject con prefijo) sin registrar como uso.
  const [diagVer, setDiagVer] = useState(0)
  useEffect(() => {
    if (!modeler) return
    const bus = modeler.get('eventBus') as BpmnEventBus
    const bump = () => setDiagVer((v) => v + 1)
    ;['shape.added', 'shape.removed', 'element.changed', 'import.done'].forEach((e) => bus.on(e, bump))
    return () => { ['shape.added', 'shape.removed', 'element.changed', 'import.done'].forEach((e) => bus.off(e, bump)) }
  }, [modeler])

  // (El borrado nodo → panel lo maneja ApplicationsPanel, que está siempre montado.)

  const unregistered = useMemo(() => {
    if (!modeler) return [] as { id: string; name: string }[]
    const covered = new Set(list.map((u) => u.bpmn_element_id).filter(Boolean) as string[])
    try {
      const registry = modeler.get('elementRegistry') as BpmnElementRegistry
      return (registry.filter(() => true) as BpmnElement[])
        .filter((el) => DATA_NODE_TYPES.has(el.type) && isApplicationBO(el.businessObject) && !covered.has(el.id))
        .map((el) => ({ id: el.id, name: stripAppPrefix(el.businessObject?.name) || 'Aplicación' }))
    } catch { return [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeler, list, diagVer])

  const registerNode = (node: { id: string; name: string }) => {
    const app = addApplication({ name: node.name, status: 'en_evaluacion' })
    if (app) addUsage(app.id, processId, node.id, '')
  }
  const registerAll = () => { unregistered.forEach(registerNode); if (unregistered.length) toast.success(`${unregistered.length} aplicación(es) registradas desde el diagrama.`) }

  // Quita la app de ESTE proceso: elimina sus usos y TODOS sus nodos en el
  // diagrama actual. NO borra la app del catálogo (eso solo se hace desde el
  // catálogo/inventario).
  const removeFromProcess = (app: Application, us: ApplicationUsage[]) => {
    const nodes = us.map((u) => u.bpmn_element_id).filter(Boolean).length
    if (!confirm(`¿Quitar «${app.name}» de este proceso? Se eliminan sus ${nodes} nodo(s) del diagrama. La aplicación se conserva en el catálogo.`)) return
    us.forEach((u) => { deleteUsage(u.id); if (modeler && u.bpmn_element_id) removeNode(modeler, u.bpmn_element_id) })
  }

  const handleIdentify = async () => {
    if (identifying) return
    setIdentifying(true)
    try {
      const suggestions = await budget.run(() => identifyApplicationsFromProcess({
        companyName: company?.name || '', industry: company?.industry || undefined,
        processName, description: process?.description || undefined, bpmnXml: process?.bpmn_xml || undefined,
        activities: process?.bpmn_xml ? parseBpmnXml(process.bpmn_xml).activities.map((a) => a.name).filter(Boolean) : [],
        existingAppNames: applications.map((a) => a.name),
      }))
      if (!suggestions) return
      let added = 0, linked = 0
      const seen = new Set<string>()
      for (const s of suggestions) {
        const key = norm(s.name)
        if (!key || seen.has(key)) continue // no repetir la misma app en una corrida
        seen.add(key)
        // ¿La aplicación ya existe en el inventario? → reutilizar, no duplicar.
        const existing = applications.find((a) => norm(a.name) === key)
        if (existing) {
          // Si ya se usa en ESTE proceso, no la vinculamos de nuevo.
          if (usages.some((u) => u.application_id === existing.id && u.process_id === processId)) continue
          const nodeId = modeler ? placeApplicationNode(modeler, s.relatedActivity, existing.name) : null
          addUsage(existing.id, processId, nodeId, s.relatedActivity)
          linked++
          continue
        }
        const nodeId = modeler ? placeApplicationNode(modeler, s.relatedActivity, s.name) : null
        const app = addApplication({
          name: s.name, category: s.category, vendor: s.vendor, ownership: s.ownership,
          deployment: s.deployment, has_api: s.has_api, automatable: s.automatable,
          criticality: s.criticality, status: 'en_evaluacion',
        })
        if (app) { added++; addUsage(app.id, processId, nodeId, s.relatedActivity) }
      }
      if (added || linked) toast.success(`${added} nueva(s) y ${linked} vinculada(s). Revísalas y ajústalas.`)
      else toast.info('La IA no encontró aplicaciones nuevas para este proceso.')
    } catch (err) {
      console.warn('[ApplicationsTab] identify error', err)
      toast.error('No se pudieron identificar las aplicaciones. Intenta de nuevo.')
    } finally { setIdentifying(false) }
  }

  return (
    <div className={`flex flex-col h-full ${isExpanded ? 'max-w-3xl mx-auto w-full' : ''}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <MonitorSmartphone size={isExpanded ? 16 : 14} className="text-sky-400" />
          <span className={`font-semibold text-white ${isExpanded ? 'text-sm' : 'text-xs'}`}>Aplicaciones / Software</span>
          {list.length > 0 && <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">{list.length}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleIdentify} disabled={identifying || budget.isConsuming}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600/80 to-cyan-600/80 text-white hover:from-purple-500 hover:to-cyan-500 text-[11px] font-medium transition-colors disabled:opacity-50"
            title="La IA identifica las aplicaciones usadas en el proceso desde el diagrama">
            {(identifying || budget.isConsuming) ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {(identifying || budget.isConsuming) ? 'Identificando…' : 'Identificar con IA'}
            <TokenCostBadge operationKey="application_identification" />
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 border border-sky-500/20 text-[11px] font-medium"><Plus size={12} /> App</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {availableApps.length > 0 && (
          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2">
            {!pickExisting ? (
              <button onClick={() => setPickExisting(true)} className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] text-white/55 hover:text-cyan-300 py-1"><Link2 size={12} /> Usar una aplicación existente del inventario</button>
            ) : (
              <div className="flex items-center gap-2">
                <select onChange={(e) => { if (e.target.value) { addUsage(e.target.value, processId, null, ''); setPickExisting(false); toast.success('Aplicación vinculada al proceso.') } }} defaultValue=""
                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50">
                  <option value="">Elegir aplicación existente…</option>
                  {availableApps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <button onClick={() => setPickExisting(false)} className="text-[11px] text-white/40 hover:text-white/70">Cancelar</button>
              </div>
            )}
          </div>
        )}

        {unregistered.length > 0 && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-amber-200/90">{unregistered.length} nodo(s) de aplicación en el diagrama sin registrar.</p>
              <button onClick={registerAll} className="shrink-0 px-2 py-1 rounded-lg bg-amber-500/20 text-amber-100 border border-amber-500/30 text-[10.5px] font-medium hover:bg-amber-500/30">Registrar todos</button>
            </div>
            {unregistered.map((n) => (
              <div key={n.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.03] border border-white/8">
                <Cpu size={12} className="text-white/40 shrink-0" />
                <span className="text-[11px] text-white/70 truncate flex-1">{n.name}</span>
                <button onClick={() => registerNode(n)} className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-cyan-300 hover:bg-cyan-500/15"><Plus size={11} /> Registrar</button>
              </div>
            ))}
          </div>
        )}

        {list.length === 0 && unregistered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MonitorSmartphone size={24} className="text-white/10 mb-3" />
            <p className="text-xs text-white/30 mb-1">Aún no hay aplicaciones registradas</p>
            <p className="text-[10px] text-white/20">Identifícalas con IA desde el diagrama o agrégalas manualmente.</p>
          </div>
        ) : byApp.map(({ app, us }) => {
          const risk = techRisk(app)
          const nodes = us.filter((u) => u.bpmn_element_id).length
          const acts = [...new Set(us.map((u) => u.activity_name).filter(Boolean))]
          return (
            <div key={app.id} className="group rounded-lg border border-white/8 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white flex items-center gap-1.5"><MonitorSmartphone size={12} className="text-sky-300 shrink-0" />{app.name}{nodes > 1 && <span className="text-[9px] text-white/40">· {nodes} nodos</span>}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {app.category && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">{app.category}</span>}
                    {app.ownership && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">{app.ownership === 'propia' ? 'Propia' : app.ownership === 'terceros' ? 'Terceros' : 'Mixta'}</span>}
                    {app.deployment && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/45">{deployLabel(app.deployment)}</span>}
                    {app.has_api && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 inline-flex items-center gap-0.5"><Zap size={9} /> API</span>}
                    <span className="text-[9px] px-1.5 py-0.5 rounded text-white" style={{ background: risk.hex }} title={`Riesgo tecnológico: ${risk.factors.join(', ') || 'bajo'}`}>Riesgo {risk.label}</span>
                    {acts.length > 0 && <span className="text-[9px] text-white/40 truncate">en «{acts.join('», «')}»</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => { setEditing(app); setShowForm(true) }} title="Editar" className="p-1.5 rounded text-white/30 hover:text-cyan-400 hover:bg-white/5"><Pencil size={13} /></button>
                  <button onClick={() => removeFromProcess(app, us)} title="Quitar de este proceso (elimina sus nodos; conserva la app en el catálogo)" className="p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showForm && (
        <AppFormModal processId={processId} application={editing} onClose={() => { setShowForm(false); setEditing(null) }} />
      )}
      <InsufficientTokensModal open={budget.showInsufficientModal} onClose={budget.closeInsufficientModal} operationKey="application_identification" />
    </div>
  )
}
