import { Info, ShoppingCart } from 'lucide-react'
import type { AdminMetrics } from '@/stores/analyticsStore'
import { SectionTitle, Card } from '../components/AdminShared'
import { fmtNumber } from '../adminConstants'

interface Props {
  metrics: AdminMetrics
}

export function RevenueTab({ metrics }: Props) {
  const hasAddOns = metrics.addOnsSold.length > 0

  return (
    <div className="space-y-6">
      {/* Sin datos de pagos */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300/80">
        <Info size={16} className="shrink-0 mt-0.5" />
        <span>
          Las métricas de revenue (MRR, ARPU, LTV, cohortes) requieren integración de pagos
          con datos de suscripciones y transacciones. Actualmente no están disponibles en este sistema.
        </span>
      </div>

      {/* Add-ons — solo si hay datos reales */}
      {hasAddOns && (
        <Card>
          <SectionTitle>Add-ons activos</SectionTitle>
          <div className="overflow-x-auto mt-3">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-white/30 text-xs uppercase border-b border-white/5">
                  <th className="text-left py-2 pr-4">Add-on</th>
                  <th className="text-right py-2 px-4">Cantidad</th>
                  <th className="text-right py-2 pl-4">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {metrics.addOnsSold.map((a) => (
                  <tr key={a.name} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4 text-white/80 flex items-center gap-2">
                      <ShoppingCart size={13} className="text-amber-400" />
                      {a.name}
                    </td>
                    <td className="py-2.5 px-4 text-right text-white/60">{fmtNumber(a.count)}</td>
                    <td className="py-2.5 pl-4 text-right text-emerald-400 font-medium">${a.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!hasAddOns && (
        <div className="text-center py-16 text-white/20 text-sm">
          Sin add-ons activos registrados
        </div>
      )}
    </div>
  )
}
