// Investigación profunda: recorre TODA la empresa y arma un dossier determinista
// exhaustivo; luego el modelo lo sintetiza en un informe estructurado con
// gráficos embebidos. El dossier garantiza que el análisis cubra todo, no una
// muestra.

import { sanitizePromptInput } from '@/lib/aiSanitizer'
import {
  type ScopedData,
  resolveRisks,
  processById,
  macroNameById,
  areaOf,
  macroOf,
} from './copilotData'

export function buildDeepDossier(data: ScopedData): string {
  const { processes, indicators, procedures, analyses, improvements } = data
  const macros = macroNameById(data)
  const procs = processById(data)
  const withKpi = new Set(indicators.map((i) => i.process_id))
  const withProc = new Set(procedures.map((p) => p.process_id))
  const risks = resolveRisks(data)
  const riskByProc = new Map<string, number>()
  const inadByProc = new Map<string, number>()
  for (const r of risks) {
    riskByProc.set(r.risk.process_id, (riskByProc.get(r.risk.process_id) ?? 0) + 1)
    if (!r.adequate) inadByProc.set(r.risk.process_id, (inadByProc.get(r.risk.process_id) ?? 0) + 1)
  }

  const L: string[] = []

  // 1) Totales y cobertura documental
  L.push('## COBERTURA DOCUMENTAL')
  L.push(`Procesos: ${processes.length} · críticos: ${processes.filter((p) => p.is_critical).length}`)
  L.push(`Con flujograma: ${processes.filter((p) => !!p.bpmn_xml).length} · con procedimiento: ${withProc.size} · con indicadores: ${withKpi.size} · con riesgos: ${new Set(risks.map((r) => r.risk.process_id)).size}`)

  // 2) Riesgos
  const inad = risks.filter((r) => !r.adequate)
  const byLevel = (lvl: string) => risks.filter((r) => r.level === lvl).length
  L.push('## RIESGOS')
  L.push(`Total: ${risks.length} · SIN control adecuado: ${inad.length}`)
  L.push(`Por nivel — Extremo: ${byLevel('Extremo')}, Alto: ${byLevel('Alto')}, Moderado: ${byLevel('Moderado')}, Bajo: ${byLevel('Bajo')}`)
  const topExtremos = risks.filter((r) => r.level === 'Extremo' && !r.adequate).slice(0, 8)
  if (topExtremos.length) {
    L.push('Extremos sin control (prioridad máxima):')
    topExtremos.forEach((r) => L.push(`- ${r.risk.title} — ${r.processName} (${r.risk.category})`))
  }

  // 3) Indicadores
  const sinMeta = indicators.filter((i) => !i.target_value).length
  L.push('## INDICADORES')
  L.push(`Total: ${indicators.length} · sin meta: ${sinMeta}`)

  // 4) Análisis de valor
  const vaEntries = Object.entries(analyses)
  if (vaEntries.length) {
    let va = 0, tot = 0
    for (const [, acts] of vaEntries) for (const a of acts) { tot += a.dailyMinutes; if (a.classification === 'VA') va += a.dailyMinutes }
    L.push('## ANÁLISIS DE VALOR')
    L.push(`Procesos analizados: ${vaEntries.length} · eficiencia VA global: ${tot > 0 ? Math.round((va / tot) * 100) : 0}%`)
  }

  // 5) Mejoras
  if (improvements.length) {
    const byStatus: Record<string, number> = {}
    for (const o of improvements) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
    L.push('## MEJORAS')
    L.push(`Total: ${improvements.length} — ${Object.entries(byStatus).map(([s, n]) => `${s}: ${n}`).join(', ')}`)
  }

  // 6) Inventario proceso a proceso (para recorrer todo)
  L.push('## INVENTARIO (proceso · macro · área · cobertura)')
  processes.slice(0, 60).forEach((p) => {
    const flags = [
      p.bpmn_xml ? 'flujo' : null,
      withProc.has(p.id) ? 'proc' : null,
      withKpi.has(p.id) ? 'kpi' : null,
      riskByProc.get(p.id) ? `riesgos:${riskByProc.get(p.id)}${inadByProc.get(p.id) ? `(${inadByProc.get(p.id)} s/control)` : ''}` : null,
    ].filter(Boolean).join(', ') || 'sin documentar'
    L.push(`- ${p.name} · ${macroOf(p, macros)} · ${areaOf(procs.get(p.id))} · ${flags}`)
  })

  return L.join('\n')
}

export function buildDeepResearchPrompt(companyName: string, dossier: string): string {
  const empresa = sanitizePromptInput(companyName || 'la empresa')
  return `Eres el **Copiloto de Procesos** de "${empresa}" en modo INVESTIGACIÓN PROFUNDA: actúas como un consultor senior que entrega un INFORME EJECUTIVO completo, no una respuesta corta.

Usa EXCLUSIVAMENTE el dossier de abajo (datos deterministas de toda la empresa). No inventes cifras.

Entrega un informe MARKDOWN bien estructurado con estas secciones (usa encabezados ## y listas/tablas):
1. **Resumen ejecutivo** (3-5 bullets con lo más importante y accionable).
2. **Cobertura documental** — qué está documentado y qué falta. Incluye <<CHART entity="processes" groupBy="macro" title="Procesos por macroproceso">>.
3. **Riesgos** — foco en los extremos sin control. Incluye <<HEATMAP title="Mapa de calor de riesgos">> y <<CHART entity="risks" groupBy="level" chartType="pie" title="Riesgos por nivel">>.
4. **Indicadores** — brechas (sin meta). Incluye <<CHART entity="indicators" groupBy="meta" title="KPIs con y sin meta">> si hay indicadores.
5. **Análisis de valor y mejoras** — eficiencia y estado de las mejoras. Incluye <<CHART entity="improvements" groupBy="status" title="Mejoras por estado">> si hay mejoras.
6. **Recomendaciones priorizadas** — tabla con Acción | Impacto | Por qué, ordenadas por prioridad (primero riesgos extremos sin control y procesos críticos sin documentar).

Reglas: escribe los marcadores de widget TAL CUAL (el sistema los renderiza). Sé concreto, ejecutivo y accionable. Nombra procesos y riesgos exactos del dossier.

DOSSIER DE LA EMPRESA:
${dossier}`
}
