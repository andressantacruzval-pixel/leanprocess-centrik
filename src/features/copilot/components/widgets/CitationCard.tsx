import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { findProcessByName } from '../../copilotData'
import { citationPreview } from '../../copilotPreview'
import { DOC_DEFS, isDocKind, type DocKind } from './docLinks'

// Cita con enlace directo al documento del proceso + vista previa al hover
// (un extracto real del documento, verificable antes de abrir).
export function CitationCard({ params }: { params: Record<string, string> }) {
  const data = useCompanyScopedData()
  const [open, setOpen] = useState(false)
  const process = findProcessByName(data, params.process ?? '')
  const kind: DocKind = isDocKind(params.doc ?? '') ? (params.doc as DocKind) : 'characterization'
  const def = DOC_DEFS[kind]
  const Icon = def.icon
  const label = params.label || `Abrir ${def.label.toLowerCase()}`

  if (!process) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1.5">
        <Icon size={13} /> {label} <span className="text-gray-400">(no encontrado)</span>
      </span>
    )
  }

  const preview = open ? citationPreview(data, process.name, kind) : null

  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Link
        to={def.path(process.id)}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg px-2.5 py-1.5 hover:bg-primary-100 transition-colors"
      >
        <Icon size={13} />
        {label}
        <ExternalLink size={11} className="opacity-60" />
      </Link>
      {preview && (
        <span className="absolute z-20 bottom-full left-0 mb-1.5 w-64 rounded-lg border border-gray-200 bg-white shadow-xl p-3 copilot-fade block">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-700 mb-1.5"><Icon size={12} /> {preview.title}</span>
          <span className="block space-y-0.5">
            {preview.lines.map((l, i) => <span key={i} className="block text-[11.5px] text-gray-600 leading-snug truncate">{l}</span>)}
          </span>
          <span className="block text-[10px] text-gray-400 mt-1.5">Clic para abrir →</span>
        </span>
      )}
    </span>
  )
}
