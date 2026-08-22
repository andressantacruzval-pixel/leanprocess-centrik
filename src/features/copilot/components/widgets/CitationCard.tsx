import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { findProcessByName } from '../../copilotData'
import { DOC_DEFS, isDocKind, type DocKind } from './docLinks'

// Cita con enlace directo al documento del proceso (procedimiento, flujograma…).
export function CitationCard({ params }: { params: Record<string, string> }) {
  const data = useCompanyScopedData()
  const process = findProcessByName(data, params.process ?? '')
  const kind: DocKind = isDocKind(params.doc ?? '') ? (params.doc as DocKind) : 'characterization'
  const def = DOC_DEFS[kind]
  const Icon = def.icon
  const label = params.label || `Abrir ${def.label.toLowerCase()}`

  if (!process) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-white/35 border border-white/10 rounded-lg px-2.5 py-1.5">
        <Icon size={13} /> {label} <span className="text-white/25">(no encontrado)</span>
      </span>
    )
  }

  return (
    <Link
      to={def.path(process.id)}
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 rounded-lg px-2.5 py-1.5 hover:bg-cyan-500/20 transition-colors"
    >
      <Icon size={13} />
      {label}
      <ExternalLink size={11} className="opacity-60" />
    </Link>
  )
}
