// ─── Copiloto — constructor de CONTEXTO ───────────────────────────────────
// Arma el texto que recibe el modelo cada turno: un panorama de la empresa +
// las porciones más relevantes a la pregunta. "Mientras más info tiene, mejor
// responde": entre más poblados los stores, más rico es este contexto.
//
// La especificidad "quién hace qué" viene de los NODOS DE ACTIVIDAD POR LANE
// del BPMN (bpmnToTextSummary), igual que el mapeo de flujo de valor.

import { parseBpmnXml, bpmnToTextSummary } from '@/utils/bpmnParser'
import { norm } from '@/features/inventory/inventoryUtils'
import { keywords, expandSynonyms, scoreText } from './copilotSearch'
import {
  type ScopedData,
  processById,
  macroNameById,
  areaOf,
  macroOf,
  resolveRisks,
  risksWithoutAdequateControl,
} from './copilotData'
import { techRisk } from '@/types/application'
import { computeCargos } from '@/features/cargos/cargoData'
import { STATUS_LABELS } from '@/types/improvement'

// ── Panorama de la empresa (carril de datos, agregado) ─────────────────────

export function buildOrgSnapshot(data: ScopedData): string {
  const { processes, risks, indicators, procedures, analyses, improvements, assets, applications } = data
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
  const abiertas = improvements.filter((o) => o.status !== 'cerrada' && o.status !== 'descartada').length
  L.push(`Indicadores: ${indicators.length} · Oportunidades de mejora: ${improvements.length} (${abiertas} abiertas) · Análisis de valor: ${Object.keys(analyses).length} procesos`)

  // Activos de información (ISO 27001) — datos personales y criticidad.
  if (assets.length) {
    const conDP = assets.filter((a) => a.has_personal_data).length
    const critAlta = assets.filter((a) => (a.criticality ?? 0) >= 4).length
    L.push(`Activos de información: ${assets.length} (${conDP} con datos personales, ${critAlta} de criticidad alta)`)
  }
  // Aplicaciones / software — API, nube y riesgo tecnológico.
  if (applications.length) {
    const conApi = applications.filter((a) => a.has_api).length
    const cloud = applications.filter((a) => a.deployment?.startsWith('cloud')).length
    const riesgoAlto = applications.filter((a) => { const r = techRisk(a); return r.level === 'alto' || r.level === 'critico' }).length
    L.push(`Aplicaciones/software: ${applications.length} (${conApi} con API, ${cloud} en la nube, ${riesgoAlto} de riesgo tecnológico alto/crítico)`)
  }
  // Cargos derivados del lane del flujograma (los del manual de funciones).
  const cargos = computeCargos(processes, analyses, []).cargos.filter((c) => c.activities.length > 0)
  if (cargos.length) L.push(`Cargos identificados (por lane del flujograma): ${cargos.length}`)
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

  // Activos de información de este proceso.
  const assetsHere = data.assets.filter((a) => a.process_id === processId)
  if (assetsHere.length) {
    L.push('Activos de información: ' + assetsHere.map((a) => `${a.name}${a.has_personal_data ? ' (datos personales)' : ''}`).join('; '))
  }
  // Aplicaciones/software usadas en este proceso (por sus actividades diagramadas).
  const usageHere = data.appUsages.filter((u) => u.process_id === processId)
  if (usageHere.length) {
    const appNames = [...new Set(usageHere.map((u) => data.applications.find((ap) => ap.id === u.application_id)?.name).filter((n): n is string => !!n))]
    if (appNames.length) L.push('Aplicaciones usadas: ' + appNames.join('; '))
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
  // Híbrido: sinónimos del dominio + coincidencia fuzzy (tolera typos como
  // "peronal" → "personal" y sinónimos como "reclutamiento" → "contratación").
  const terms = expandSynonyms(kws)
  const scored = data.processes.map((p) => ({ id: p.id, score: scoreText(searchableText(data, p.id), terms) }))
  const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
  return (hits.length ? hits : scored).slice(0, max).map((s) => s.id)
}

// ── Contexto completo del turno ────────────────────────────────────────────

// Índice global compacto: permite responder "todos los X y de qué proceso" sin
// depender de que el proceso esté entre los 5 relevantes. Acotado para no inflar.
export function buildGlobalIndex(data: ScopedData): string {
  const macros = macroNameById(data)
  const procs = processById(data)
  const L: string[] = ['## ÍNDICE GLOBAL (para listados y totales)']
  const more = (total: number, shown: number) => { if (total > shown) L.push(`- …y ${total - shown} más`) }

  if (data.indicators.length) {
    L.push(`Indicadores (${data.indicators.length}) — nombre · proceso · meta:`)
    data.indicators.slice(0, 80).forEach((i) => {
      const p = procs.get(i.process_id)
      L.push(`- ${i.name} · ${p?.name ?? '(proceso?)'}${i.target_value ? ` · meta ${i.target_value}` : ' · SIN meta'}`)
    })
    more(data.indicators.length, 80)
  }

  const risks = resolveRisks(data)
  if (risks.length) {
    L.push(`Riesgos (${risks.length}) — título · proceso · nivel · categoría · control:`)
    risks.slice(0, 80).forEach((r) => {
      L.push(`- ${r.risk.title} · ${r.processName} · ${r.level} · ${r.risk.category} · ${r.adequate ? 'con control' : 'SIN control'}`)
    })
    more(risks.length, 80)
  }

  L.push(`Procesos (${data.processes.length}) — nombre · macroproceso · área:`)
  data.processes.slice(0, 60).forEach((p) => L.push(`- ${p.name} · ${macroOf(p, macros)} · ${areaOf(p)}`))
  more(data.processes.length, 60)

  if (data.assets.length) {
    L.push(`Activos de información (${data.assets.length}) — nombre · tipo · proceso · datos personales:`)
    data.assets.slice(0, 60).forEach((a) => {
      const p = procs.get(a.process_id ?? '')
      L.push(`- ${a.name} · ${a.asset_type || 'sin tipo'} · ${p?.name ?? 'sin proceso'}${a.has_personal_data ? ' · DATOS PERSONALES' : ''}`)
    })
    more(data.assets.length, 60)
  }

  if (data.applications.length) {
    L.push(`Aplicaciones (${data.applications.length}) — nombre · categoría · API · riesgo tecnológico:`)
    data.applications.slice(0, 60).forEach((a) => {
      const r = techRisk(a)
      L.push(`- ${a.name}${a.vendor ? ` (${a.vendor})` : ''} · ${a.category || 'sin categoría'} · ${a.has_api ? 'con API' : 'sin API'} · riesgo ${r.label}`)
    })
    more(data.applications.length, 60)
  }

  const cargos = computeCargos(data.processes, data.analyses, []).cargos.filter((c) => c.activities.length > 0)
  if (cargos.length) {
    L.push(`Cargos (${cargos.length}) — cargo · nº actividades · nº procesos:`)
    cargos.slice(0, 40).forEach((c) => L.push(`- ${c.cargo} · ${c.activities.length} actividades · ${c.processes.size} procesos`))
    more(cargos.length, 40)
  }

  if (data.improvements.length) {
    L.push(`Oportunidades de mejora (${data.improvements.length}) — nombre · proceso · estado:`)
    data.improvements.slice(0, 40).forEach((o) => {
      const p = procs.get(o.processId)
      L.push(`- ${o.name} · ${p?.name ?? '(proceso?)'} · ${STATUS_LABELS[o.status] ?? o.status}`)
    })
    more(data.improvements.length, 40)
  }

  return L.join('\n')
}

export function buildTurnContext(data: ScopedData, query: string, memoryHint = ''): string {
  // El hint (turnos recientes) permite resolver referencias como "y sus riesgos?"
  // trayendo el proceso del que se venía hablando aunque no se nombre ahora.
  const relevant = selectRelevantProcessIds(data, `${memoryHint} ${query}`)
  const blocks = relevant.map((id) => processBlock(data, id)).filter(Boolean)
  return [
    '## PANORAMA DE LA EMPRESA',
    buildOrgSnapshot(data),
    '',
    buildGlobalIndex(data),
    '',
    '## PROCESOS RELEVANTES A LA CONSULTA',
    blocks.length ? blocks.join('\n\n') : 'Ninguno coincide directamente; usa el panorama y el índice global.',
  ].join('\n')
}
