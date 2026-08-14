function formatRange(min: number | null | undefined, max: number | null | undefined): string {
  const lo = min ?? null
  const hi = max ?? null
  if (lo === null && hi === null) return '—'
  if (lo !== null && hi !== null) return `${lo} – ${hi}`
  if (lo !== null) return `≥ ${lo}`
  return `≤ ${hi}`
}

interface ThresholdBadgesProps {
  greenMin?: number | null
  greenMax?: number | null
  yellowMin?: number | null
  yellowMax?: number | null
  redMin?: number | null
  redMax?: number | null
  compact?: boolean
}

export function ThresholdBadges({
  greenMin, greenMax, yellowMin, yellowMax, redMin, redMax, compact = false,
}: ThresholdBadgesProps) {
  const hasGreen = greenMin !== null && greenMin !== undefined || greenMax !== null && greenMax !== undefined
  const hasYellow = yellowMin !== null && yellowMin !== undefined || yellowMax !== null && yellowMax !== undefined
  const hasRed = redMin !== null && redMin !== undefined || redMax !== null && redMax !== undefined

  if (!hasGreen && !hasYellow && !hasRed) return null

  const greenLabel = formatRange(greenMin, greenMax)
  const yellowLabel = formatRange(yellowMin, yellowMax)
  const redLabel = formatRange(redMin, redMax)

  if (compact) {
    return (
      <div className="flex gap-1">
        {hasGreen && <span className="w-3 h-3 rounded-full bg-green-500" title={`Verde: ${greenLabel}`} />}
        {hasYellow && <span className="w-3 h-3 rounded-full bg-yellow-400" title={`Amarillo: ${yellowLabel}`} />}
        {hasRed && <span className="w-3 h-3 rounded-full bg-red-500" title={`Rojo: ${redLabel}`} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {hasGreen && (
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
          <span className="text-xs text-white/40">{greenLabel}</span>
        </div>
      )}
      {hasYellow && (
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-400 shrink-0" />
          <span className="text-xs text-white/40">{yellowLabel}</span>
        </div>
      )}
      {hasRed && (
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
          <span className="text-xs text-white/40">{redLabel}</span>
        </div>
      )}
    </div>
  )
}
