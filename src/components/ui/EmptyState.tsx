import { Link } from 'react-router-dom'

interface EmptyStateProps {
  icon: React.ElementType
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  secondaryLabel?: string
  secondaryHref?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryLabel,
  secondaryHref,
}: EmptyStateProps) {
  const actionButton = actionLabel ? (
    actionHref ? (
      <Link
        to={actionHref}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-medium hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-500/20 transition-all"
      >
        {actionLabel}
      </Link>
    ) : (
      <button
        onClick={onAction}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-medium hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-500/20 transition-all"
      >
        {actionLabel}
      </button>
    )
  ) : null

  const secondaryButton =
    secondaryLabel && secondaryHref ? (
      <Link
        to={secondaryHref}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/50 text-sm font-medium hover:border-white/20 hover:text-white/70 transition-all"
      >
        {secondaryLabel}
      </Link>
    ) : null

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/[0.08] to-white/[0.02] flex items-center justify-center mb-5 ring-1 ring-white/5">
        <Icon size={32} className="text-white/25" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1.5">{title}</h3>
      <p className="text-sm text-white/40 max-w-sm mb-6">{description}</p>
      {(actionButton || secondaryButton) && (
        <div className="flex items-center gap-3">
          {actionButton}
          {secondaryButton}
        </div>
      )}
    </div>
  )
}
