import { AlertTriangle, X } from 'lucide-react'

export function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg p-5 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wider">
        <Icon size={14} style={{ color }} />
        {label}
      </div>
      <span className="text-3xl font-bold text-gray-900" style={{ color }}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{children}</h3>
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-50 border border-gray-100 rounded-lg p-5 ${className}`}>
      {children}
    </div>
  )
}

export function AlertBanner({ variant, message, onDismiss }: {
  variant: 'red' | 'amber'
  message: string
  onDismiss: () => void
}) {
  const colors = variant === 'red'
    ? 'bg-red-50 border-red-200 text-red-600'
    : 'bg-amber-50 border-amber-200 text-amber-600'
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${colors}`}>
      <AlertTriangle size={16} className="shrink-0" />
      <span className="text-sm flex-1">{message}</span>
      <button onClick={onDismiss} className="hover:opacity-70 transition-opacity shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}
