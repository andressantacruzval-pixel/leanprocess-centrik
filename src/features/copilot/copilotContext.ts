// ─── Copiloto — constructor de CONTEXTO ───────────────────────────────────
// Arma el texto que recibe el modelo cada turno: un panorama de la empresa +
// las porciones más relevantes a la pregunta. "Mientras más info tiene, mejor
// responde": entre más poblados los stores, más rico es este contexto.
//
// La especificidad "quién hace qué" viene de los NODOS DE ACTIVIDAD POR LANE
// del BPMN (bpmnToTextSummary), igual que el mapeo de flujo de valor.

import { parseBpmnXml, bpmnToTextSummary } from '@/utils/bpmnParser'
import { norm } from '@/features/inventory/inventoryUtils'
import {
  type ScopedData,
  processById,
  macroNameById,
  areaOf,
  macroOf,
  resolveRisks,
  risksWithoutAdequateControl,
} from './copilotData'

const STOPWORDS = new Set([
  'como','cómo','para','que','qué','cual','cuál','cuales','cuáles','donde','dónde','quien','quién',
  'los','las','del','una','uno','con','por','sin','sobre','entre','este','esta','estos','estas',
  'tiene','tienen','hace','hacen','proceso','procesos','the','and','and/or','mis','sus','tengo',
])

function keywords(q: string): string[] {
  return [...new Set(norm(q).split(/\s+/).filter((w) => w.length >= 4 && !STOPWORDS.has(w)))]
}

// ── Panorama de la empresa (carril de datos, agregado) ─────────────────────

export function buildOrgSnapshot(data: ScopedData): string {
  const { processes, risks, indicators, procedures, analyses, improvements } = data
  const procIds = new Set(processes.map((p) => p.id))
  const withRisk = new Set(risks.map((r) => r.process_id))
  const withKpi = new Set(indicators.map((i) => i.process_id))
  const withProc = new Set(procedures.map((p) => p.process_id))
  const withBpmn = processes.filter((p) => !!p.bpmn_xml).length
  const sinControl = risksWithoutAdequateControl(data).length
  const critical = processes.filter((p) => p.is_critical).length

  const L: string[] = []
  L.push(`Procesos: ${processes.length} (${critical} críticos, ${withBpmn} con flujograma)`)
  L.push(`Con procedimiento: ${withProc.size} · Con indicadores: ${withKpi.size} · Con riesgos: ${withRisk.size}`)
  L.push(`Riesgos: ${risks.length} en total, ${sinControl} SIN control adecuado`)
  L.push(`Indicadores: ${indicators.length} · Mejoras registradas: ${improvements.length} · Análisis de valor: ${Object.keys(analyses).length} procesos`)
  const sinRiesgo = processes.filter((p) => !withRisk.has(p.id) && procIds.has(p.id)).map((p) => p.name)
  if (sinRiesgo.length) L.push(`Procesos sin riesgos identificados: ${sinRiesgo.slice(0, 12).join(', ')}${sinRiesgo.length > 12 ? '…' : ''}`)
  const sinKpi = processes.filter((p) => !withKpi.has(p.id)).map((p) => p.name)
  if (sinKpi.length) L.push(`Procesos sin indicadores: ${sinKpi.slice(0, 12).join(', ')}${sinKpi.length > 12 ? '…' : ''}`)
  return L.join('\n')
}

// ── Ficha detallada de un proceso (incluye actividades por ejecutor) ───────

function processBlock(data: ScopedData, processId: string): string {
  const p = processById(data).get(processId)
  if (!p) return ''
  const macros = macroNameById(data)
  const risks = resolveRisks(data).filter((r) => r.risk.process_id === processId)
  const kpis = data.indicators.filter((i) => i.process_id === processId)
  const hasProc = data.procedures.some((pr) => pr.process_id === processId)
  const value = data.analyses[processId] ?? []
  const improvements = data.improvements.filter((o) => o.processId === processId)

  const L: string[] = []
  L.push(`### Proceso: ${p.name}`)
  L.push(`Macroproceso: ${macroOf(p, macros)} · Área: ${areaOf(p)}${p.is_critical ? ' · CRÍTICO' : ''}`)
  if (p.description) L.push(`Objetivo: ${p.description}`)

  // Actividades por lane/ejecutor desde el BPMN — el "quién hace qué".
  if (p.bpmn_xml) {
    try {
      const parsed = parseBpmnXml(p.bpmn_xml)
      if (parsed.orderedSteps.length || parsed.activities.length) {
        L.push('Actividades por ejecutor (del flujograma):')
        L.push(bpmnToTextSummary(parsed).trim())
      }
    } catch { /* xml corrupto: se omite */ }
  } else {
    L.push('Sin flujograma documentado.')
  }

  // Procedimiento: pasos y responsables (lo que responde "quién hace qué paso a paso").
  const procedure = data.procedures.find((pr) => pr.process_id === processId)
  const actividades = procedure?.data?.actividades ?? []
  if (actividades.length) {
    if (procedure?.data?.alcance) L.push(`Alcance: ${procedure.data.alcance}`)
    L.push('Procedimiento — pasos y responsables:')
    actividades.slice(0, 20).forEach((a, i) => {
      const rol = a.ejecutor || 'sin rol'
      const desc = a.descripcion ? `: ${a.descripcion}` : ''
      const dec = a.esDecision && a.decisiones ? ` (decisión: ${a.decisiones})` : ''
      L.push(`${i + 1}. [${rol}] ${a.nombre}${desc}${dec}`)
    })
  } else {
    L.push(hasProc ? 'Tiene procedimiento documentado (sin pasos detallados cargados).' : 'Sin procedimiento documentado.')
  }

  const auditItems = data.audits[processId] ?? []
  if (auditItems.length) L.push(`Programa de auditoría: ${auditItems.length} puntos de control.`)

  if (kpis.length) {
    L.push('Indicadores: ' + kpis.map((k) => `${k.name}${k.target_value ? ` (meta ${k.target_value})` : ' (SIN meta)'}`).join('; '))
  } else L.push('Sin indicadores.')

  if (risks.length) {
    L.push('Riesgos:')
    for (const r of risks) {
      L.push(`- [${r.level}] ${r.risk.title} — ejecutor: ${r.executor}. ${r.adequate ? 'Con control adecuado.' : 'SIN control adecuado.'}${r.risk.description ? ` (${r.risk.description})` : ''}`)
    }
  } else L.push('Sin riesgos identificados.')

  if (value.length) {
    const va = value.filter((a) => a.classification === 'VA').length
    L.push(`Análisis de valor: ${value.length} actividades (${va} de valor agregado).`)
  }
  if (improvements.length) {
    L.push('Mejoras: ' + improvements.map((o) => `${o.name} (${o.status})`).join('; '))
  }
  return L.join('\n')
}

// ── Selección de procesos relevantes a la pregunta ────────────────────────

function searchableText(data: ScopedData, processId: string): string {
  const p = processById(data).get(processId)
  if (!p) return ''
  const macros = macroNameById(data)
  const parts = [p.name, p.description ?? '', areaOf(p), macroOf(p, macros)]
  const risks = data.risks.filter((r) => r.process_id === processId)
  parts.push(...risks.map((r) => `${r.title} ${r.processStep}`))
  if (p.bpmn_xml) {
    try { parts.push(...parseBpmnXml(p.bpmn_xml).activities.map((a) => `${a.name} ${a.laneName ?? ''}`)) } catch { /* */ }
  }
  return norm(parts.join(' '))
}

export function selectRelevantProcessIds(data: ScopedData, query: string, max = 5): string[] {
  const kws = keywords(query)
  if (!kws.length) return data.processes.slice(0, max).map((p) => p.id)
  const scored = data.processes.map((p) => {
    const text = searchableText(data, p.id)
    const score = kws.reduce((s, kw) => s + (text.includes(kw) ? 1 : 0), 0)
    return { id: p.id, score }
  })
  const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
  return (hits.length ? hits : scored).slice(0, max).map((s) => s.id)
}

// ── Contexto completo del turno ────────────────────────────────────────────

export function buildTurnContext(data: ScopedData, query: string): string {
  const relevant = selectRelevantProcessIds(data, query)
  const blocks = relevant.map((id) => processBlock(data, id)).filter(Boolean)
  return [
    '## PANORAMA DE LA EMPRESA',
    buildOrgSnapshot(data),
    '',
    '## PROCESOS RELEVANTES A LA CONSULTA',
    blocks.length ? blocks.join('\n\n') : 'Ninguno coincide directamente; usa el panorama.',
  ].join('\n')
}
