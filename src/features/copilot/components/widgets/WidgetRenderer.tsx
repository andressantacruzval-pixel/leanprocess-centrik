import type { CopilotWidget } from '@/stores/copilotStore'
import { CitationCard } from './CitationCard'
import { RiskAlertCard } from './RiskAlertCard'
import { RiskListCard } from './RiskListCard'
import { CopilotChart } from './CopilotChart'
import { ProcessCard } from './ProcessCard'

// CITE se agrupa en fila (chips de enlace); el resto va en bloque.
export function WidgetList({ widgets }: { widgets: CopilotWidget[] }) {
  if (!widgets.length) return null
  const cites = widgets.filter((w) => w.name === 'CITE')
  const blocks = widgets.filter((w) => w.name !== 'CITE')

  return (
    <div className="mt-2.5 space-y-2">
      {blocks.map((w, i) => <WidgetBlock key={i} widget={w} />)}
      {cites.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {cites.map((w, i) => <CitationCard key={i} params={w.params} />)}
        </div>
      )}
    </div>
  )
}

function WidgetBlock({ widget }: { widget: CopilotWidget }) {
  switch (widget.name) {
    case 'RISK': return <RiskAlertCard params={widget.params} />
    case 'RISKS': return <RiskListCard params={widget.params} />
    case 'CHART': return <CopilotChart params={widget.params} />
    case 'PROCESS': return <ProcessCard params={widget.params} />
    default: return null
  }
}
