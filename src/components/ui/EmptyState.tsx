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
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-medium shadow-lg transition-all bg-primary-500 hover:bg-primary-600"
      >
        {actionLabel}
      </Link>
    ) : (
      <button
        onClick={onAction}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-medium shadow-lg transition-all bg-primary-500 hover:bg-primary-600"
      >
        {actionLabel}
      </button>
    )
  ) : null

  const secondaryButton =
    secondaryLabel && secondaryHref ? (
      <Link
        to={secondaryHref}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm font-medium hover:border-gray-300 hover:text-gray-700 transition-all"
      >
        {secondaryLabel}
      </Link>
    ) : null

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 ring-1 ring-gray-300 bg-primary-50">
        <Icon size={32} className="text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">{description}</p>
      {(actionButton || secondaryButton) && (
        <div className="flex items-center gap-3">
          {actionButton}
          {secondaryButton}
        </div>
      )}
    </div>
  )
}
