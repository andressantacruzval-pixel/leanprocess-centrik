// Vista previa de una cita: un extracto real del documento del proceso, para
// mostrar al pasar el cursor sobre el botón (verificable antes de abrir).

import { parseBpmnXml } from '@/utils/bpmnParser'
import { type ScopedData, findProcessByName, resolveRisks } from './copilotData'
import type { DocKind } from './components/widgets/docLinks'

export interface CitationPreview {
  title: string
  lines: string[]
}

export function citationPreview(data: ScopedData, processName: string, kind: DocKind): CitationPreview | null {
  const p = findProcessByName(data, processName)
  if (!p) return null

  switch (kind) {
    case 'procedure': {
      const proc = data.procedures.find((pr) => pr.process_id === p.id)
      const acts = proc?.data?.actividades ?? []
      if (!acts.length) return { title: 'Procedimiento', lines: ['Sin pasos detallados cargados.'] }
      return {
        title: 'Procedimiento — primeros pasos',
        lines: acts.slice(0, 4).map((a, i) => `${i + 1}. [${a.ejecutor || 'sin rol'}] ${a.nombre}`),
      }
    }
    case 'flowchart': {
      if (!p.bpmn_xml) return { title: 'Flujograma', lines: ['Sin flujograma documentado.'] }
      try {
        const parsed = parseBpmnXml(p.bpmn_xml)
        const roles = [...new Set(parsed.activities.map((a) => a.laneName).filter(Boolean))]
        const lines = [`${parsed.activities.length} actividades · ${roles.length} roles`]
        parsed.activities.slice(0, 3).forEach((a) => lines.push(`• [${a.laneName || 'sin rol'}] ${a.name}`))
        return { title: 'Flujograma', lines }
      } catch {
        return { title: 'Flujograma', lines: ['Diagrama no legible.'] }
      }
    }
    case 'indicators': {
      const kpis = data.indicators.filter((i) => i.process_id === p.id)
      if (!kpis.length) return { title: 'Indicadores', lines: ['Sin indicadores definidos.'] }
      return {
        title: `Indicadores (${kpis.length})`,
        lines: kpis.slice(0, 4).map((k) => `• ${k.name}${k.target_value ? ` — meta ${k.target_value}` : ' — sin meta'}`),
      }
    }
    case 'characterization':
    default: {
      const risks = resolveRisks(data).filter((r) => r.risk.process_id === p.id)
      const sinControl = risks.filter((r) => !r.adequate).length
      const kpis = data.indicators.filter((i) => i.process_id === p.id).length
      const lines: string[] = []
      if (p.description) lines.push(p.description)
      lines.push(`${risks.length} riesgos${sinControl ? ` (${sinControl} sin control)` : ''} · ${kpis} KPIs`)
      return { title: p.is_critical ? 'Caracterización · CRÍTICO' : 'Caracterización', lines }
    }
  }
}
