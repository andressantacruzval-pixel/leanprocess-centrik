import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Eye, EyeOff, RotateCcw, Wand2 } from 'lucide-react'
import { BpmnModeler } from '@/features/bpmn/components/BpmnModeler'
import { ConversationalPanel } from '@/components/ai/ConversationalPanel'
import { ChangeTimelinePanel } from '@/components/timeline/ChangeTimeline'
import { useConversationalAgent } from '@/hooks/useConversationalAgent'
import { useProcesses } from '@/hooks/useProcesses'
import { QUALITY_MODEL } from '@/lib/conversationalAi'
import { buildFlowchartPrompt } from '@/lib/prompts/flowchartOnboarding'
import { analyzeEnumeration, buildEnumerationHint } from '@/lib/enumerationDetector'
import {
  addBranch, addLane, addNode, assignNodeToLane, connectNodes,
  createGraph, deleteLane, deleteNode, describeGraph, disconnectNodes,
  insertBetween, renameLane, renameNode, setCursor, toBpmnXml,
  type FlowchartGraph, type NodeType,
} from '@/lib/flowchartGraph'

type Process = ReturnType<typeof useProcesses>['processes'][number]

interface FlowchartChatModeProps {
  process: Process
  onSave: (xml: string, messages: Array<{ role: string; text: string }>) => void
  isSaving: boolean
}

export function FlowchartChatMode({ process, onSave, isSaving }: FlowchartChatModeProps) {
  const { updateProcess } = useProcesses()

  const [graph, setGraph] = useState<FlowchartGraph>(() => createGraph())
  const graphRef = useRef(graph)
  useEffect(() => { graphRef.current = graph }, [graph])

  const [layoutVersion, setLayoutVersion] = useState(0)
  const [readOnly, setReadOnly] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saved'>('idle')
  const [timelineOpen, setTimelineOpen] = useState(false)

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bpmnXml = useMemo(() => {
    const base = toBpmnXml(graph)
    if (layoutVersion === 0) return base
    return base.replace(
      /<\/bpmn2:definitions>\s*$/,
      `<!-- relayout-v${layoutVersion} -->\n</bpmn2:definitions>`
    )
  }, [graph, layoutVersion])

  // setState en effect es intencional: marca el indicador 'pending'
  // inmediatamente al detectar cambios y debounce el save real.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!process || !bpmnXml || bpmnXml === process.bpmn_xml) return
    setAutoSaveStatus('pending')
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    if (fadeTimer.current) clearTimeout(fadeTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      updateProcess(process.id, { bpmn_xml: bpmnXml })
      setAutoSaveStatus('saved')
      fadeTimer.current = setTimeout(() => setAutoSaveStatus('idle'), 2000)
    }, 2000)
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      if (fadeTimer.current) clearTimeout(fadeTimer.current)
    }
  }, [bpmnXml, process, updateProcess])
  /* eslint-enable react-hooks/set-state-in-effect */

  const nodeCount = graph.nodes.length - 1

  const systemPrompt = useMemo(() => {
    const processCtx = process
      ? `Contexto del proceso: "${process.name}"${process.description ? ` — ${process.description}` : ''}.`
      : undefined
    return buildFlowchartPrompt(describeGraph(graph), processCtx)
  }, [graph, process])

  const agent = useConversationalAgent({
    systemPrompt,
    model: QUALITY_MODEL,
    temperature: 0.3,
    feature: 'flowchart_interview_turn',
    greeting: `Hola, soy tu consultor de procesos. Vamos con "${process.name}". ¿Como prefieres arrancar: definiendo los roles que participan, contandome los pasos del proceso, o directamente dictandomelo como se te ocurra? Tu eliges, yo lo voy armando en vivo.`,
    augmentSystemPromptForTurn: (userText) => {
      const analysis = analyzeEnumeration(userText)
      return buildEnumerationHint(analysis)
    },
    postTurnVerify: ({ userText, assistantText, dispatchedCallsThisTurn }) => {
      const gatewaysThisTurn = dispatchedCallsThisTurn.filter((c) => c.name === 'ADD_GATEWAY')
      const branchesThisTurn = dispatchedCallsThisTurn.filter((c) => c.name === 'ADD_BRANCH')
      if (gatewaysThisTurn.length > 0) {
        const orphanGateways: string[] = []
        for (const gw of gatewaysThisTurn) {
          const gwName = gw.params.name
          if (!gwName) continue
          const related = branchesThisTurn.filter((b) => b.params.from === gwName)
          if (related.length < 2) orphanGateways.push(`"${gwName}" (tiene ${related.length} de 2 ramas)`)
        }
        if (orphanGateways.length > 0) {
          return `[CORRECCION INTERNA DEL SISTEMA — no visible al usuario]
Emitiste estos gateways en tu respuesta anterior SIN sus 2 ramas (cada decision necesita al menos 2 salidas con label distinto):
${orphanGateways.map((g) => '  - ' + g).join('\n')}

Mensaje original del usuario: "${userText}"

EMITE AHORA los ADD_BRANCH que faltan. Reglas:
- Cada gateway sin ramas necesita 2 ADD_BRANCH con labels distintos (tipicamente "Si" y "No").
- Si el usuario solo menciono una rama, INFIERE la otra del contexto (rechazar, iterar, descartar, escalar, pausar).
- Formato exacto: <<ADD_BRANCH from="NombreGateway" label="Si" target="NombreTarea">>
- Responde SOLO con los marcadores crudos. Sin texto, sin saludo.`
        }
      }

      const analysis = analyzeEnumeration(userText)
      const expected = analysis.count
      const createdThisTurn = dispatchedCallsThisTurn.filter((c) =>
        ['ADD_LANE', 'RENAME_LANE', 'ADD_TASK', 'ADD_GATEWAY', 'ADD_END', 'ADD_BRANCH'].includes(c.name)
      ).length

      if (expected >= 2 && createdThisTurn < expected) {
        const missing = expected - createdThisTurn
        return `[CORRECCION INTERNA DEL SISTEMA — no visible al usuario]
El usuario dijo: "${userText}"
Analisis automatico: ${expected} items esperados${analysis.noun ? ' (' + analysis.noun + ')' : ''}.
Marcadores que emitiste en la respuesta anterior: ${createdThisTurn}.
FALTAN ${missing} marcador(es).
Tu respuesta anterior decia: "${assistantText}"

EMITE AHORA los ${missing} marcadores faltantes. Responde EXCLUSIVAMENTE con los marcadores crudos <<...>>, sin texto explicativo, sin saludo, sin preguntas. Revisa la frase del usuario y agrega los items que omitiste. Si el usuario menciono "${analysis.hint ?? userText}", asegurate de cubrir cada uno.`
      }

      const claimMatch = assistantText
        .toLowerCase()
        .match(/\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d{1,2})\s+(roles|lanes|carriles|tareas|pasos|actividades|decisiones|compuertas)\b/)
      if (claimMatch) {
        const numMap: Record<string, number> = {
          dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
          siete: 7, ocho: 8, nueve: 9, diez: 10,
        }
        const claimed = numMap[claimMatch[1]] ?? parseInt(claimMatch[1], 10)
        if (Number.isFinite(claimed) && claimed >= 2 && claimed <= 20 && createdThisTurn < claimed) {
          const missing = claimed - createdThisTurn
          return `[CORRECCION INTERNA DEL SISTEMA — no visible al usuario]
Tu respuesta anterior afirmaba "${claimMatch[0]}" pero solo emitiste ${createdThisTurn} marcador(es) en realidad. Faltan ${missing}.
Mensaje original del usuario: "${userText}"
EMITE AHORA los ${missing} marcadores faltantes. Responde SOLO con los marcadores crudos <<...>>, sin texto.`
        }
      }

      return null
    },
    onToolCall: (call) => {
      const current = graphRef.current
      switch (call.name) {
        case 'ADD_TASK': {
          const { name, after, lane } = call.params
          if (!name) return
          setGraph(addNode(current, 'task', name, { afterName: after, laneName: lane }).graph)
          return
        }
        case 'ADD_GATEWAY': {
          const { name, after, lane } = call.params
          if (!name) return
          setGraph(addNode(current, 'gateway', name, { afterName: after, laneName: lane }).graph)
          return
        }
        case 'ADD_END': {
          const { name, after, lane } = call.params
          setGraph(addNode(current, 'endEvent', name || 'Fin', { afterName: after, laneName: lane }).graph)
          return
        }
        case 'ADD_BRANCH': {
          const { from, label, target, lane } = call.params
          if (!from || !target) return
          setGraph(addBranch(current, from, label || '', target, lane).graph)
          return
        }
        case 'RENAME': {
          const { old: oldName, new: newName } = call.params
          if (!oldName || !newName) return
          setGraph(renameNode(current, oldName, newName).graph)
          return
        }
        case 'DELETE': {
          const { name } = call.params
          if (!name) return
          setGraph(deleteNode(current, name).graph)
          return
        }
        case 'SET_CURSOR': {
          const { name } = call.params
          if (!name) return
          setGraph(setCursor(current, name).graph)
          return
        }
        case 'CONNECT': {
          const { from, to, label } = call.params
          if (!from || !to) return
          setGraph(connectNodes(current, from, to, label).graph)
          return
        }
        case 'DISCONNECT': {
          const { from, to } = call.params
          if (!from || !to) return
          setGraph(disconnectNodes(current, from, to).graph)
          return
        }
        case 'INSERT_BETWEEN': {
          const { after, before, type, name, lane } = call.params
          if (!after || !before || !name) return
          const nodeType: Exclude<NodeType, 'startEvent'> =
            type === 'gateway' ? 'gateway' : type === 'end' || type === 'endEvent' ? 'endEvent' : 'task'
          setGraph(insertBetween(current, after, before, nodeType, name, lane).graph)
          return
        }
        case 'ADD_LANE': {
          const { name } = call.params
          if (!name) return
          setGraph(addLane(current, name).graph)
          return
        }
        case 'RENAME_LANE': {
          const { old: oldName, new: newName } = call.params
          if (!oldName || !newName) return
          setGraph(renameLane(current, oldName, newName).graph)
          return
        }
        case 'DELETE_LANE': {
          const { name } = call.params
          if (!name) return
          setGraph(deleteLane(current, name).graph)
          return
        }
        case 'ASSIGN_LANE': {
          const { node, lane } = call.params
          if (!node || !lane) return
          setGraph(assignNodeToLane(current, node, lane).graph)
          return
        }
        case 'CLEAR': {
          setGraph(createGraph())
          return
        }
      }
    },
  })

  const handleReset = useCallback(() => setGraph(createGraph()), [])

  const handleRelayout = useCallback(() => {
    setGraph((current) => {
      const nodeIds = new Set(current.nodes.map((n) => n.id))
      const cleanedEdges = current.edges.filter(
        (e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId)
      )
      const hasIncoming = new Set(cleanedEdges.map((e) => e.targetId))
      const orphans = current.nodes.filter(
        (n) => n.type !== 'startEvent' && !hasIncoming.has(n.id)
      )
      const finalEdges = [...cleanedEdges]
      for (const orphan of orphans) {
        const idx = current.nodes.findIndex((n) => n.id === orphan.id)
        const prev = current.nodes[idx - 1]
        if (prev && prev.id !== orphan.id) {
          const already = finalEdges.some((e) => e.sourceId === prev.id && e.targetId === orphan.id)
          if (!already) finalEdges.push({ id: `edge_relayout_${orphan.id}`, sourceId: prev.id, targetId: orphan.id })
        }
      }
      return { ...current, edges: finalEdges }
    })
    setLayoutVersion((v) => v + 1)
  }, [])

  const handleSave = useCallback(() => {
    onSave(bpmnXml, agent.messages.map((m) => ({ role: m.role, text: m.content })))
  }, [bpmnXml, agent.messages, onSave])

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => setReadOnly((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all ${
            readOnly
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'
          }`}
        >
          {readOnly ? <EyeOff size={12} /> : <Eye size={12} />}
          {readOnly ? 'Editar' : 'Solo lectura'}
        </button>
        <button
          onClick={handleRelayout}
          disabled={nodeCount === 0 || readOnly}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Wand2 size={12} />
          Reorganizar
        </button>
        <button
          onClick={handleReset}
          disabled={nodeCount === 0 || readOnly}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw size={12} />
          Empezar de nuevo
        </button>
        {autoSaveStatus === 'pending' && (
          <span className="text-[11px] text-amber-400 animate-pulse">Guardando...</span>
        )}
        {autoSaveStatus === 'saved' && (
          <span className="text-[11px] text-emerald-400">Guardado automaticamente</span>
        )}
        {/* `readOnly` desactivaba «Reorganizar» y «Empezar de nuevo» pero NO este boton:
            era la puerta por la que se podia escribir un diagrama en modo lectura. */}
        <button
          onClick={handleSave}
          disabled={nodeCount === 0 || isSaving || readOnly}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Check size={14} />
          {isSaving ? 'Optimizando...' : 'Guardar flujograma'}
        </button>
      </div>

      {readOnly && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs">
          <Eye size={14} />
          Modo lectura — visualizacion sin edicion
        </div>
      )}

      {/* Split screen */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-[420px] shrink-0">
          <ConversationalPanel
            agent={agent}
            title="Consultor de procesos"
            subtitle={`Gemini ${QUALITY_MODEL} · flujograma en vivo`}
            placeholder="Describe el siguiente paso..."
            hideInput={readOnly}
          />
        </div>
        <div className="flex-1 flex flex-col bg-[#0a0f1a] border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="text-sm font-semibold text-white">Flujograma en vivo</h2>
            </div>
            <div className="text-[11px] text-white/40">
              {nodeCount === 0 ? 'Empieza conversando con la IA' : `${nodeCount} ${nodeCount === 1 ? 'elemento' : 'elementos'}`}
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <BpmnModeler xml={bpmnXml} readOnly hidePalette className="h-full" />
            <ChangeTimelinePanel
              processId={process.id}
              open={timelineOpen}
              onToggle={() => setTimelineOpen((v) => !v)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
