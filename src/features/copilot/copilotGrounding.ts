// Guardarraíl de grounding: valida los widgets que emite el modelo contra los
// datos reales. Si cita un proceso/riesgo con typo o sinónimo, lo corrige al
// nombre exacto; si es irreconocible, lo descarta (mejor sin tarjeta que una
// tarjeta "no encontrado"). Los widgets deterministas (CHART/HEATMAP/RISKS) se
// dejan pasar: se autovalidan al renderizar.

import type { CopilotWidget } from '@/stores/copilotStore'
import { type ScopedData, findProcessByName, findRisk, resolveRisks } from './copilotData'
import { bestMatch } from './copilotSearch'

export function groundWidgets(data: ScopedData, widgets: CopilotWidget[]): CopilotWidget[] {
  if (!widgets.length) return widgets
  const procNames = data.processes.map((p) => p.name)
  const out: CopilotWidget[] = []

  for (const w of widgets) {
    if (w.name === 'CITE' || w.name === 'PROCESS') {
      const key = w.name === 'CITE' ? 'process' : 'name'
      const raw = w.params[key] ?? ''
      let p = findProcessByName(data, raw)
      if (!p) { const m = bestMatch(raw, procNames); if (m) p = findProcessByName(data, m) }
      if (!p) continue // irresoluble → se descarta
      out.push({ name: w.name, params: { ...w.params, [key]: p.name } })
    } else if (w.name === 'RISK') {
      let r = findRisk(data, w.params.process ?? '', w.params.title ?? '')
      if (!r) {
        const m = bestMatch(w.params.title ?? '', resolveRisks(data).map((x) => x.risk.title))
        if (m) r = findRisk(data, '', m)
      }
      if (!r) continue
      out.push({ name: 'RISK', params: { ...w.params, process: r.processName, title: r.risk.title } })
    } else {
      out.push(w)
    }
  }
  return out
}
