import { FileText, GitBranch, Gauge, ClipboardList, type LucideIcon } from 'lucide-react'

// Rutas reales de cada documento de un proceso (ver App.tsx).
export type DocKind = 'procedure' | 'flowchart' | 'indicators' | 'characterization'

interface DocDef { label: string; icon: LucideIcon; path: (id: string) => string }

export const DOC_DEFS: Record<DocKind, DocDef> = {
  procedure:        { label: 'Procedimiento',   icon: ClipboardList, path: (id) => `/app/process/${id}/procedure` },
  flowchart:        { label: 'Flujograma',      icon: GitBranch,     path: (id) => `/app/bpmn/${id}` },
  indicators:       { label: 'Indicadores',     icon: Gauge,         path: (id) => `/app/process/${id}/indicators` },
  characterization: { label: 'Caracterización', icon: FileText,      path: (id) => `/app/process/${id}/characterization` },
}

export function isDocKind(v: string): v is DocKind {
  return v === 'procedure' || v === 'flowchart' || v === 'indicators' || v === 'characterization'
}

// Ruta a un documento del proceso. Centralizada aquí (módulo .ts) a propósito:
// los widgets solo NAVEGAN a documentos que ya existen (no crean nada), y así el
// literal de ruta no vive en cada .tsx. El cupo lo gobiernan la BD y el guardián
// de la propia pantalla de destino.
export function docPath(kind: DocKind, processId: string): string {
  return DOC_DEFS[kind].path(processId)
}

export const HEAT_MAP_PATH = '/app/heat-map'
