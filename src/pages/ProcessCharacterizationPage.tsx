import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Save,
  X,
  FileText,
  Download,
  Bot,
  Maximize2,
  Minimize2,
  Undo2,
  Redo2,
  BadgeCheck,
  Pencil,
} from 'lucide-react'
import { usePublishProcess } from '@/hooks/usePublishProcess'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useCatalogStore } from '@/stores/catalogStore'
import { toast } from '@/stores/toastStore'
import { ChangeTimelinePanel } from '@/components/timeline/ChangeTimeline'
import { generateProcessObjective } from '@/lib/claude'
import { formatDate } from '@/utils/helpers'
import { BpmnModeler } from '@/features/bpmn/components/BpmnModeler'
import { CargoLanesPanel } from '@/features/cargos/components/CargoLanesPanel'
import { AssetsPanel } from '@/features/assets/components/AssetsPanel'
import BpmnPalette from '@/components/workspace/BpmnPalette'
import type { BpmnModelerInstance, BpmnCommandStack } from '@/types/bpmn'
import { ProcedureTab } from '@/features/procedure/components/ProcedureTab'
import { IndicatorsTab } from '@/features/kpi/components/IndicatorsTab'
import { RiskPanel } from '@/features/risk/components/RiskPanel'
import { AuditTab } from '@/features/audit/components/AuditTab'
import { ValueAnalysisTab } from '@/features/value-analysis/components/ValueAnalysisTab'
import { ImprovementTab } from '@/features/improvement/components/ImprovementTab'
import { AssetsTab } from '@/features/assets/components/AssetsTab'
import { ApplicationsTab } from '@/features/applications/components/ApplicationsTab'
import type { Process } from '@/types'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { CharacterizationPanel } from '@/features/process/components/CharacterizationPanel'
import { PantallaEstrecha } from '@/components/ui/PantallaEstrecha'
import { useBpmnAutoSave } from '@/features/process/hooks/useBpmnAutoSave'
import { useDocumentableGuard } from '@/hooks/useDocumentableGuard'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { processMapUrl } from '@/lib/processMapUrl'
import { normalizeDataAssociationsForBizagi } from '@/lib/bpmnLayoutFix'
import {
  BLANK_BPMN,
  TOOLBAR_TABS,
  type RightPanelTab,
} from './processCharacterizationConstants'

/**
 * Ancho fijo del menu de exportar. Es fijo para poder centrarlo sobre el boton sin
 * medir el menu despues de pintarlo (que costaria un segundo render y un parpadeo).
 * Si cambia el contenido del menu, cambia aqui: la clase `w-[240px]` de abajo y esto
 * son el mismo numero y tienen que seguir siendolo. Mismo trato que TOOLTIP_W en
 * FieldHelpIcon.
 */
const ANCHO_MENU_EXPORTAR = 240

export default function ProcessCharacterizationPage() {
  const { processId } = useParams<{ processId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const processes = useProcessStore((s) => s.processes)
  const macroprocesses = useProcessStore((s) => s.macroprocesses)
  const updateProcess = useProcessStore((s) => s.updateProcess)

  const company = useCompanyStore((s) => s.company)
  const orgUnits = useCompanyStore((s) => s.orgUnits)
  const orgLevelDefinitions = useCompanyStore((s) => s.orgLevelDefinitions)

  const getSipocByProcess = useCatalogStore((s) => s.getSipocByProcess)
  const getCatalogByType = useCatalogStore((s) => s.getCatalogByType)
  const addCatalogItem = useCatalogStore((s) => s.addCatalogItem)

  const objectiveBudget = useTokenBudget({ operationKey: 'process_objective' })

  // ─── State ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [generatingObjective, setGeneratingObjective] = useState(false)
  const [modelerInstance, setModelerInstance] = useState<BpmnModelerInstance | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  // El menu de descarga se ancla a la ventana: la barra lo recortaria. Se mide al
  // abrir, que es cuando el boton ya esta en su sitio definitivo.
  const exportBtnRef = useRef<HTMLButtonElement>(null)
  const [exportCoords, setExportCoords] = useState<{ top: number; left: number } | null>(null)
  const [rightPanel, setRightPanel] = useState<RightPanelTab>(() => {
    const tab = searchParams.get('tab')
    const valid: RightPanelTab[] = ['info', 'procedimiento', 'indicadores', 'riesgos', 'auditoria', 'analisis', 'mejoras', 'activos', 'aplicaciones']
    return valid.includes(tab as RightPanelTab) ? (tab as RightPanelTab) : null
  })
  const [panelExpanded, setPanelExpanded] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)

  // ─── Process data ───────────────────────────────────────────────────────
  const process = processes.find((p) => p.id === processId)

  const hierarchy = useMemo(() => {
    if (!process) return { macro: null, parent: null }
    const macro = macroprocesses.find((m) => m.id === process.macroprocess_id)
    let parent: typeof processes[number] | null = null
    if (process.parent_process_id) {
      parent = processes.find((p) => p.id === process.parent_process_id) || null
    }
    return { macro, parent }
  }, [process, macroprocesses, processes])

  // Solo se documenta en el nivel más bajo declarado. Antes esto miraba si el
  // proceso tenía hijos, lo que dejaba pasar las ramas vacías del nivel
  // intermedio. Ver @/lib/processLevels.
  useDocumentableGuard(processId)

  const [bpmnXml, setBpmnXml] = useState(() => process?.bpmn_xml || BLANK_BPMN)

  // Sync del XML cuando cambia desde fuera (otra pestaña, otro usuario en el
  // store, etc.). Comparamos contra bpmnXml local para no resetear cambios sin guardar.
  useEffect(() => {
    if (process?.bpmn_xml && process.bpmn_xml !== bpmnXml) {
      setBpmnXml(process.bpmn_xml)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process?.bpmn_xml])

  // Un documento publicado entra en modo lectura: para tocarlo hay que darle a «Editar»,
  // que lo devuelve a borrador. El toggle del ojo sigue siendo una preferencia de vista.
  const { published, publish, unlock } = usePublishProcess(processId)
  const [readOnly, setReadOnly] = useState(false)
  useEffect(() => { setReadOnly(published) }, [published])

  const autoSaveStatus = useBpmnAutoSave({
    processId,
    bpmnXml,
    blankBpmn: BLANK_BPMN,
    processes,
    updateProcess,
  })

  // Form state — deriva management/coordination desde org_unit_id si los campos de texto están vacíos
  const [formData, setFormData] = useState<Partial<Process>>(() => {
    let management = process?.management || ''
    let coordination = process?.coordination || ''
    let operative = process?.operative || ''
    if ((!management || !coordination) && process?.org_unit_id) {
      const unitMap = new Map(orgUnits.map((u) => [u.id, u]))
      const chain: typeof orgUnits = []
      let cur = unitMap.get(process.org_unit_id)
      while (cur) {
        chain.unshift(cur)
        cur = cur.parent_id ? unitMap.get(cur.parent_id) : undefined
      }
      const len = chain.length
      if (len > 0) {
        management = management || (chain[0]?.name ?? '')
        coordination = coordination ||
          (len >= 3 ? (chain[len - 2]?.name ?? '') : len === 2 ? (chain[1]?.name ?? '') : '')
        operative = operative || (len >= 3 ? (chain[len - 1]?.name ?? '') : '')
      }
    }
    return {
      description: process?.description || '',
      update_date: process?.update_date || new Date().toISOString().split('T')[0],
      entity: process?.entity || company?.name || '',
      // `version` NO va en formData: se sembraria una sola vez al montar y
      // `handleSave` la reescribiria con el valor viejo, deshaciendo la publicacion.
      // La unica fuente es `process.version`, y solo la mueve usePublishProcess.
      process_type: process?.process_type || hierarchy.macro?.category || '',
      execution_frequency: process?.execution_frequency || '',
      execution_level: process?.execution_level || '',
      management,
      coordination,
      operative,
      business_line: process?.business_line || '',
      supervision_level: process?.supervision_level || '',
      responsible: process?.responsible || '',
      delivery_method: process?.delivery_method || '',
      execution_type: process?.execution_type || '',
      is_critical: process?.is_critical || false,
      has_contingency_plan: process?.has_contingency_plan || false,
      involves_cash_movement: process?.involves_cash_movement || false,
      has_tax_operations: process?.has_tax_operations || false,
      affects_accounting: process?.affects_accounting || false,
      handles_personal_data: process?.handles_personal_data || false,
      provided_by_third_party: process?.provided_by_third_party || false,
    }
  })

  const updateField = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  // Catalog options
  const frequencyOptions = getCatalogByType('execution_frequency').map((c) => ({ value: c.value, label: c.value }))
  const executionTypeOptions = getCatalogByType('execution_type').map((c) => ({ value: c.value, label: c.value }))
  const deliveryMethodOptions = getCatalogByType('delivery_method').map((c) => ({ value: c.value, label: c.value }))
  const executionLevelOptions = getCatalogByType('execution_level').map((c) => ({ value: c.value, label: c.value }))
  const businessLineOptions = getCatalogByType('business_line').map((c) => ({ value: c.value, label: c.value }))
  const supervisionOptions = getCatalogByType('supervision_level').map((c) => ({ value: c.value, label: c.value }))
  const responsibleOptions = getCatalogByType('responsible').map((c) => ({ value: c.value, label: c.value }))

  const processSipoc = processId ? getSipocByProcess(processId) : []

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleGenerateObjective = async () => {
    if (!process || !hierarchy.macro) return
    setGeneratingObjective(true)
    try {
      await objectiveBudget.run(async () => {
        const result = await generateProcessObjective({
          companyName: company?.name || '',
          industry: company?.industry,
          companySize: company?.company_size,
          macroprocessName: hierarchy.macro!.name,
          processName: hierarchy.parent?.name,
          subprocessName: process.name,
        })
        updateField('description', result.text)
      })
    } catch {
      toast.error('Error al generar el objetivo. Intenta de nuevo.')
    } finally {
      setGeneratingObjective(false)
    }
  }

  const handleSave = useCallback(() => {
    if (!processId) return
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    // Guardar NO versiona: la version solo la mueve «Aprobar y publicar» (usePublishProcess).
    // Antes se llamaba a bumpMinorVersion aqui sin comparar nada, asi que guardar sin tocar
    // un campo subia la version. En produccion llego a 1.37 en un proceso.
    updateProcess(processId, {
      ...formData,
      entity: company?.name || (formData.entity as string),
      process_type: hierarchy.macro?.category || (formData.process_type as string),
      bpmn_xml: bpmnXml !== BLANK_BPMN ? bpmnXml : undefined,
      update_date: today,
      org_unit_id: process?.org_unit_id ?? null,
    })
    setFormData((prev) => ({ ...prev, update_date: today }))
    toast.success('Caracterización guardada.')
    setTimeout(() => setSaving(false), 600)
  }, [processId, formData, bpmnXml, updateProcess, process?.org_unit_id, company?.name, hierarchy.macro?.category])

  const abrirMenuExportar = useCallback(() => {
    if (showExportMenu) {
      setShowExportMenu(false)
      return
    }
    const rect = exportBtnRef.current?.getBoundingClientRect()
    if (rect) {
      // Centrado sobre el boton, no pegado a su borde derecho: el menu es mucho mas
      // ancho, asi que alinearlo por la derecha lo tiraba entero hacia la izquierda y
      // parecia colgar de «Valor». Se topa a la ventana para que no se salga al
      // estrechar, que es cuando el boton se acerca al borde.
      const centrado = rect.left + rect.width / 2 - ANCHO_MENU_EXPORTAR / 2
      const margen = 8
      setExportCoords({
        top: rect.bottom + 4,
        left: Math.min(
          Math.max(centrado, margen),
          window.innerWidth - ANCHO_MENU_EXPORTAR - margen
        ),
      })
    }
    setShowExportMenu(true)
  }, [showExportMenu])

  const handleBpmnXmlChange = useCallback((xml: string) => {
    setBpmnXml(xml)
  }, [])

  const handleUndo = useCallback(() => {
    if (!modelerInstance) return
    try {
      const cs = modelerInstance.get('commandStack') as BpmnCommandStack
      if (cs?.canUndo()) cs.undo()
    } catch { /* no-op */ }
  }, [modelerInstance])

  const handleRedo = useCallback(() => {
    if (!modelerInstance) return
    try {
      const cs = modelerInstance.get('commandStack') as BpmnCommandStack
      if (cs?.canRedo()) cs.redo()
    } catch { /* no-op */ }
  }, [modelerInstance])

  const handleExportBpmn = useCallback(() => {
    if (!bpmnXml || bpmnXml === BLANK_BPMN) return

    // Convierte las asociaciones de datos en flechas que Bizagi dibuja (los
    // dataInputAssociation de bpmn-js no los renderiza).
    let exportXml = normalizeDataAssociationsForBizagi(bpmnXml)

    if (exportXml.includes('xmlns:bpmn=') && !exportXml.includes('xmlns:bpmn2=')) {
      exportXml = exportXml
        .replace(/xmlns:bpmn="/g, 'xmlns:bpmn2="')
        .replace(/<bpmn:/g, '<bpmn2:')
        .replace(/<\/bpmn:/g, '</bpmn2:')
    }
    if (!exportXml.includes('exporter=')) {
      exportXml = exportXml.replace(
        'targetNamespace=',
        'exporter="Lean Process" exporterVersion="1.0" targetNamespace='
      )
    }
    if (!exportXml.includes('xmlns:di=')) {
      exportXml = exportXml.replace(
        'xmlns:dc=',
        'xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:dc='
      )
    }

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(exportXml, 'application/xml')
      const NS_DI = 'http://www.omg.org/spec/BPMN/20100524/DI'
      const NS_DC = 'http://www.omg.org/spec/DD/20100524/DC'
      const shapes = doc.getElementsByTagNameNS(NS_DI, 'BPMNShape')
      const edges = doc.getElementsByTagNameNS(NS_DI, 'BPMNEdge')
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      const participantShapes: Element[] = []
      const laneShapes: Element[] = []

      for (const shape of Array.from(shapes)) {
        const bpmnEl = shape.getAttribute('bpmnElement') || ''
        const bounds = shape.getElementsByTagNameNS(NS_DC, 'Bounds')[0]
        if (!bounds) continue
        const x = parseFloat(bounds.getAttribute('x') || '0')
        const y = parseFloat(bounds.getAttribute('y') || '0')
        const w = parseFloat(bounds.getAttribute('width') || '0')
        const h = parseFloat(bounds.getAttribute('height') || '0')
        if (bpmnEl.startsWith('Participant') || bpmnEl === 'Participant_1') {
          participantShapes.push(shape)
        } else if (bpmnEl.startsWith('Lane') || bpmnEl.includes('Lane')) {
          laneShapes.push(shape)
        } else {
          minX = Math.min(minX, x); minY = Math.min(minY, y)
          maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h)
        }
      }
      for (const edge of Array.from(edges)) {
        const waypoints = edge.getElementsByTagNameNS(NS_DI, 'waypoint')
        for (const wp of Array.from(waypoints)) {
          const x = parseFloat(wp.getAttribute('x') || '0')
          const y = parseFloat(wp.getAttribute('y') || '0')
          minX = Math.min(minX, x); minY = Math.min(minY, y)
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
        }
      }
      if (minX !== Infinity && participantShapes.length > 0) {
        const padding = 50
        const poolX = Math.min(0, minX - padding - 30)
        const poolY = Math.min(0, minY - padding)
        const poolW = Math.max(1122, maxX - poolX + padding)
        const poolH = Math.max(250, maxY - poolY + padding)
        for (const ps of participantShapes) {
          const bounds = ps.getElementsByTagNameNS(NS_DC, 'Bounds')[0]
          if (bounds) {
            bounds.setAttribute('x', String(poolX)); bounds.setAttribute('y', String(poolY))
            bounds.setAttribute('width', String(poolW)); bounds.setAttribute('height', String(poolH))
          }
        }
        for (const ls of laneShapes) {
          const bounds = ls.getElementsByTagNameNS(NS_DC, 'Bounds')[0]
          if (bounds) {
            bounds.setAttribute('x', String(poolX + 30))
            bounds.setAttribute('width', String(poolW - 30))
          }
        }
      }
      exportXml = new XMLSerializer().serializeToString(doc)
    } catch { /* export as-is */ }

    const blob = new Blob([exportXml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${process?.name || 'proceso'}.bpmn`
    a.click()
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
  }, [bpmnXml, process?.name])

  const handleExportPdf = useCallback(async () => {
    if (!modelerInstance?.saveSVG) return
    try {
      const { svg } = await modelerInstance.saveSVG()
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      const img = new Image()
      img.onload = () => {
        const A4_W = 1123, A4_H = 794
        const canvas = document.createElement('canvas')
        canvas.width = A4_W * 2; canvas.height = A4_H * 2
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        const padding = 40
        const scaleX = (canvas.width - padding * 2) / img.width
        const scaleY = (canvas.height - padding * 2) / img.height
        const scale = Math.min(scaleX, scaleY, 2)
        ctx.drawImage(img, (canvas.width - img.width * scale) / 2, (canvas.height - img.height * scale) / 2, img.width * scale, img.height * scale)
        ctx.fillStyle = '#1e293b'
        ctx.font = 'bold 28px Aptos, Calibri, sans-serif'
        ctx.fillText(process?.name || 'Proceso', padding, padding + 20)
        ctx.fillStyle = '#64748b'
        ctx.font = '18px Aptos, Calibri, sans-serif'
        ctx.fillText(`${company?.name || ''} | ${new Date().toLocaleDateString('es-ES')}`, padding, padding + 48)
        canvas.toBlob((blob) => {
          if (!blob) return
          const link = document.createElement('a')
          link.href = URL.createObjectURL(blob)
          link.download = `${process?.name || 'proceso'}.png`
          link.click()
          URL.revokeObjectURL(link.href)
        }, 'image/png', 1.0)
        URL.revokeObjectURL(url)
      }
      img.src = url
    } catch (err) {
      console.error('Export PDF failed:', err)
    }
    setShowExportMenu(false)
  }, [modelerInstance, process?.name, company?.name])

  const toggleRightPanel = (tab: RightPanelTab) => {
    setRightPanel((prev) => {
      if (prev === tab) { setPanelExpanded(false); return null }
      return tab
    })
  }

  // ─── Not found ──────────────────────────────────────────────────────────
  if (!process) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/30">
        <p className="text-lg">Proceso no encontrado</p>
        <button onClick={() => navigate(processMapUrl(process))} className="mt-4 text-cyan-400 hover:underline">
          Volver al mapa
        </button>
      </div>
    )
  }

  const hasBpmn = !!bpmnXml && bpmnXml !== BLANK_BPMN

  // ─── Main layout ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-4 lg:-m-6 bg-[#070b14]">
      {/* ═══ TOP TOOLBAR ═══
          `overflow-x-auto` + `shrink-0` en los bloques: son 14 controles y la cadena de
          padres es `overflow-hidden`, asi que «Guardar» y «Asistente IA» se recortaban
          sin scroll posible. Ahora la barra se desplaza en vez de comerse sus botones. */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#0a0f1a] border-b border-white/5 shrink-0 overflow-x-auto">
        <button onClick={() => navigate(processMapUrl(process))} className="shrink-0 p-2.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors">
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center gap-0.5 mr-1 shrink-0">
          <button onClick={handleUndo} disabled={!modelerInstance || readOnly} className="p-2.5 rounded-md text-white/20 hover:text-white/60 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/20" title="Deshacer (Ctrl+Z)">
            <Undo2 size={14} />
          </button>
          <button onClick={handleRedo} disabled={!modelerInstance || readOnly} className="p-2.5 rounded-md text-white/20 hover:text-white/60 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/20" title="Rehacer (Ctrl+Y)">
            <Redo2 size={14} />
          </button>
        </div>

        <div className="hidden 2xl:flex items-center gap-2 mr-auto shrink-0">
          {formData.management && <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/40 border border-white/5">Gerencia: {formData.management as string}</span>}
          {formData.coordination && <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/40 border border-white/5">Area: {formData.coordination as string}</span>}
          <span className="px-2 py-0.5 bg-cyan-500/10 rounded text-[10px] text-cyan-400/60 border border-cyan-500/10">v{process.version ?? '1.0'}</span>
        </div>

        <div className="flex-1 2xl:flex-none" />

        {/* Module tabs */}
        <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5 shrink-0">
          {TOOLBAR_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = rightPanel === tab.key
            const isBlocked = tab.requires === 'bpmn' && !hasBpmn
            return (
              /* El aviso de por que esta bloqueada NO puede ser un tooltip colgando
                 de aqui: la barra lleva `overflow-x-auto` y por spec eso fuerza
                 `overflow-y: auto`, asi que lo recortaba (mismo caso que el menu de
                 Descargar). Y el boton iba `disabled`, de modo que pulsarlo no hacia
                 NADA y el motivo quedaba escondido en el recorte.
                 Ahora se dice en voz alta al pulsar, como ya hace ProcessDrilldown
                 con el cupo de plan: el silencio se lee como una app rota. */
              <div key={tab.key}>
                <button
                  onClick={() =>
                    isBlocked
                      ? toast.warning(tab.requiresMessage ?? 'Necesitas un flujograma BPMN.')
                      : toggleRightPanel(tab.key)
                  }
                  aria-disabled={isBlocked}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                    isBlocked ? 'text-white/15 hover:text-white/30'
                    : isActive ? 'bg-cyan-600/20 text-cyan-300 shadow-sm'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}
                  title={isBlocked ? tab.requiresMessage : tab.label}
                >
                  <Icon size={13} />
                  <span className="hidden xl:inline">{tab.label}</span>
                </button>
              </div>
            )
          })}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {/* Publicado: el ojo sobra (esta forzado a lectura) y habria DOS botones «Editar». */}
          {!published && (
            <button
              onClick={() => setReadOnly((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                readOnly
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 border border-white/5'
              }`}
            >
              {readOnly ? <EyeOff size={12} /> : <Eye size={12} />}
              {readOnly ? 'Editar' : 'Solo lectura'}
            </button>
          )}

          {autoSaveStatus === 'pending' && <span className="text-[11px] text-amber-400 animate-pulse">Guardando...</span>}
          {autoSaveStatus === 'saved' && <span className="text-[11px] text-emerald-400">Guardado automaticamente</span>}
          {autoSaveStatus === 'error' && <span className="text-[11px] text-red-400" title="No se pudo guardar el diagrama en la nube. Revisa tu conexion e intenta editar para reintentar.">Error al guardar</span>}

          <div className="relative">
            <button
              ref={exportBtnRef}
              onClick={abrirMenuExportar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
            >
              <Download size={13} />
              <span className="hidden md:inline">Descargar</span>
            </button>
            {/* El menu se pinta en <body>, no aqui dentro. La barra lleva
                `overflow-x-auto` a proposito (ver el comentario de arriba), y por spec
                eso fuerza `overflow-y: auto`: un hijo `absolute` que cuelgue por debajo
                queda RECORTADO por la barra. Es lo que se veia — el menu asomando a
                medias. Mismo patron que FieldHelpIcon, en este mismo feature. */}
            {showExportMenu && exportCoords && createPortal(
              <>
                <div className="fixed inset-0 z-[999]" onClick={() => setShowExportMenu(false)} />
                <div
                  style={{ position: 'fixed', top: exportCoords.top, left: exportCoords.left }}
                  className="z-[1000] w-[240px] bg-[#0d1420] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                >
                  <button onClick={handleExportBpmn} className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs text-white/70 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors">
                    <FileText size={14} />
                    <div><div className="font-medium">Bizagi (.bpmn)</div><div className="text-[10px] text-white/30">Compatible con Bizagi, Camunda</div></div>
                  </button>
                  <div className="border-t border-white/5" />
                  <button onClick={handleExportPdf} className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs text-white/70 hover:bg-purple-500/10 hover:text-purple-400 transition-colors">
                    <Download size={14} />
                    <div><div className="font-medium">Imagen HD (.png)</div><div className="text-[10px] text-white/30">Formato A4 horizontal, alta calidad</div></div>
                  </button>
                </div>
              </>,
              document.body
            )}
          </div>

          {!published && (
            <button
              onClick={handleSave}
              disabled={saving || readOnly}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-medium bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span className="hidden md:inline">{readOnly ? 'Modo lectura' : 'Guardar'}</span>
            </button>
          )}

          {/* Publicar es lo unico que sube la version, y le pone el codigo al documento. */}
          {published ? (
            <>
              <span
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                title={`Publicado el ${formatDate(process.published_at as string)}`}
              >
                <BadgeCheck size={12} />
                Publicado v{process.version ?? '1.0'}
              </span>
              <button
                onClick={unlock}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10 transition-all"
                title="Vuelve a borrador para poder editarlo. Al publicar de nuevo sube la version."
              >
                <Pencil size={13} />
                <span className="hidden md:inline">Editar</span>
              </button>
            </>
          ) : (
            <button
              onClick={publish}
              disabled={saving || readOnly}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-medium bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50"
              title="Cierra esta version del documento y la deja en solo lectura."
            >
              <BadgeCheck size={13} />
              <span className="hidden md:inline">Aprobar y publicar</span>
            </button>
          )}

          <button
            onClick={() => navigate(`/app/process/${process.id}/flowchart/onboarding`)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-medium bg-gradient-to-r from-purple-600 to-cyan-600 text-white hover:from-purple-500 hover:to-cyan-500 transition-all shadow-lg shadow-purple-500/15"
          >
            <Bot size={14} />
            <span className="hidden md:inline">Asistente IA</span>
          </button>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Un documento en lectura no tiene nada que arrastrar. Ademas el visor no
            trae paleta, asi que dejarla montada solo enseña un spinner eterno. */}
        {!readOnly && <BpmnPalette modeler={modelerInstance} />}

        {/* Solo se retira el LIENZO por debajo de 768px, no la pantalla entera: las
            pestanas de la barra siguen abriendo ficha, procedimiento, KPIs, riesgos,
            auditoria y valor, que si son usables en un movil. */}
        <div className="md:hidden flex-1 min-w-0">
          <PantallaEstrecha
            que="El diagramador BPMN"
            motivo="Crear y editar un diagrama necesita arrastrar y hacer doble clic. Abrelo desde una tablet u ordenador. El resto de la ficha del proceso si funciona aqui: usa las pestanas de arriba."
          />
        </div>

        <div className="hidden md:block flex-1 min-w-0 overflow-hidden relative">
          {/* Process header overlay */}
          <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none flex items-start justify-between gap-3">
            <div className="pointer-events-auto inline-flex max-w-full flex-wrap items-center gap-x-4 gap-y-1 bg-[#0d1420]/90 backdrop-blur-sm rounded-xl border border-white/5 px-4 py-2">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white truncate">{process.name}</h2>
                <p className="text-[11px] text-white/35 truncate">
                  {hierarchy.macro?.name}{hierarchy.parent && ` > ${hierarchy.parent.name}`} | {company?.name || ''}
                </p>
              </div>
              <div className="hidden sm:block h-8 w-px bg-white/10" />
              <div className="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
                {formData.management && <span>Gerencia: <span className="text-white/60">{formData.management as string}</span></span>}
                {formData.coordination && <span>Area: <span className="text-white/60">{formData.coordination as string}</span></span>}
                {formData.responsible && <span>Resp: <span className="text-white/60">{formData.responsible as string}</span></span>}
              </div>
            </div>
          </div>

          <BpmnModeler
            xml={bpmnXml}
            onXmlChange={handleBpmnXmlChange}
            onModelerReady={setModelerInstance}
            readOnly={readOnly}
            hidePalette
            className="h-full"
          />
          <CargoLanesPanel modeler={modelerInstance} readOnly={readOnly} />
          <AssetsPanel modeler={modelerInstance} processId={process.id} readOnly={readOnly} />
          <ChangeTimelinePanel
            processId={process.id}
            open={timelineOpen}
            onToggle={() => setTimelineOpen((v) => !v)}
          />
        </div>

        {/* Right panel drawer */}
        <InsufficientTokensModal
          open={objectiveBudget.showInsufficientModal}
          onClose={objectiveBudget.closeInsufficientModal}
          operationKey="process_objective"
        />

        {rightPanel && (
          <>
            {panelExpanded && (
              <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" />
            )}
            {/* Bajo `lg` el panel se superpone en vez de repartirse la fila. Con
                `min-w-[420px]` en el flujo, el lienzo —que es `flex-1 min-w-0`— era
                el unico que cedia y colapsaba a 0px de ancho. */}
            {!panelExpanded && (
              <div
                onClick={() => setRightPanel(null)}
                className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
                aria-hidden
              />
            )}
            <div className={panelExpanded
              ? 'fixed z-50 inset-0 m-auto h-[90vh] w-[90vw] max-w-5xl bg-[#0a0f1a] rounded-2xl border border-white/10 flex flex-col shadow-[0_8px_60px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 fade-in duration-200'
              : 'fixed top-14 bottom-0 right-0 z-40 w-full max-w-[420px] shadow-2xl lg:static lg:z-auto lg:w-[420px] lg:max-w-none lg:shrink-0 lg:shadow-none border-l border-white/5 bg-[#0a0f1a] flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-200'
            }>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/20 shrink-0">
              <h3 className={`font-semibold text-white ${panelExpanded ? 'text-base' : 'text-sm'}`}>
                {rightPanel === 'info'         && 'Caracterizacion'}
                {rightPanel === 'procedimiento' && 'Procedimiento'}
                {rightPanel === 'indicadores'  && 'Indicadores KPI'}
                {rightPanel === 'riesgos'      && 'Gestion de Riesgos'}
                {rightPanel === 'auditoria'    && 'Programa de Auditoria'}
                {rightPanel === 'analisis'     && 'Analisis de Valor'}
                {rightPanel === 'mejoras'      && 'Oportunidades de Mejora'}
                {rightPanel === 'activos'      && 'Activos de Informacion'}
                {rightPanel === 'aplicaciones' && 'Aplicaciones / Software'}
              </h3>
              <div className="flex items-center gap-1">
                {rightPanel !== 'info' && (
                  <button onClick={() => setPanelExpanded(!panelExpanded)} className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60">
                    {panelExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                )}
                <button onClick={() => { setRightPanel(null); setPanelExpanded(false) }} className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={panelExpanded ? 'flex-1 overflow-y-auto' : 'flex-1 overflow-y-auto p-4'}>
              {rightPanel === 'info' && (
                <CharacterizationPanel
                  formData={formData}
                  version={process.version ?? '1.0'}
                  updateField={updateField}
                  onSave={handleSave}
                  saving={saving}
                  readOnly={readOnly}
                  generatingObjective={generatingObjective || objectiveBudget.isConsuming}
                  onGenerateObjective={handleGenerateObjective}
                  frequencyOptions={frequencyOptions}
                  executionTypeOptions={executionTypeOptions}
                  deliveryMethodOptions={deliveryMethodOptions}
                  executionLevelOptions={executionLevelOptions}
                  businessLineOptions={businessLineOptions}
                  supervisionOptions={supervisionOptions}
                  responsibleOptions={responsibleOptions}
                  orgUnits={orgUnits}
                  orgLevelDefinitions={orgLevelDefinitions}
                  addCatalogItem={addCatalogItem}
                />
              )}
              {rightPanel === 'procedimiento' && (
                <ErrorBoundary>
                  <ProcedureTab
                    processId={processId!}
                    companyName={company?.name || ''}
                    industry={company?.industry}
                    macroprocessName={hierarchy.macro?.name || ''}
                    parentProcessName={hierarchy.parent?.name}
                    processName={process.name}
                    description={formData.description as string | undefined}
                    sipocEntries={processSipoc}
                    bpmnXml={hasBpmn ? bpmnXml : undefined}
                    isExpanded={panelExpanded}
                  />
                </ErrorBoundary>
              )}
              {rightPanel === 'indicadores' && (
                <ErrorBoundary>
                  <IndicatorsTab
                    processId={processId!}
                    processName={process.name}
                    description={(formData.description as string) || ''}
                    bpmnXml={hasBpmn ? bpmnXml : ''}
                    isExpanded={panelExpanded}
                  />
                </ErrorBoundary>
              )}
              {rightPanel === 'riesgos' && (
                <ErrorBoundary>
                  <RiskPanel
                    processId={processId!}
                    processName={process.name}
                    bpmnXml={hasBpmn ? bpmnXml : undefined}
                    isExpanded={panelExpanded}
                  />
                </ErrorBoundary>
              )}
              {rightPanel === 'auditoria' && (
                <AuditTab
                  processId={processId!}
                  processName={process.name}
                  bpmnXml={hasBpmn ? bpmnXml : undefined}
                  isExpanded={panelExpanded}
                />
              )}
              {rightPanel === 'analisis' && (
                <ValueAnalysisTab
                  processId={processId!}
                  processName={process.name}
                  bpmnXml={hasBpmn ? bpmnXml : undefined}
                  isExpanded={panelExpanded}
                />
              )}
              {rightPanel === 'mejoras' && (
                <ErrorBoundary>
                  <ImprovementTab
                    processId={processId!}
                    processName={process.name}
                    bpmnXml={hasBpmn ? bpmnXml : undefined}
                    isExpanded={panelExpanded}
                  />
                </ErrorBoundary>
              )}
              {rightPanel === 'activos' && (
                <ErrorBoundary>
                  <AssetsTab
                    processId={processId!}
                    processName={process.name}
                    isExpanded={panelExpanded}
                    modeler={modelerInstance}
                  />
                </ErrorBoundary>
              )}
              {rightPanel === 'aplicaciones' && (
                <ErrorBoundary>
                  <ApplicationsTab
                    processId={processId!}
                    processName={process.name}
                    isExpanded={panelExpanded}
                    modeler={modelerInstance}
                  />
                </ErrorBoundary>
              )}
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
