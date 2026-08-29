import { Zap } from 'lucide-react'
import { useBillingStore } from '@/stores/billingStore'

interface Props {
  operationKey: string
  className?: string
}

export function TokenCostBadge({ operationKey, className }: Props) {
  const getCost = useBillingStore((s) => s.getCost)
  const cost = getCost(operationKey)

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs text-amber-600 ${className ?? ''}`}>
      <Zap size={10} className="fill-amber-600 shrink-0" />
      {cost}
    </span>
  )
}
