// Modelo del Inventario de Procesos (área → macroproceso → proceso → subproceso).
// Espejo del esquema de la herramienta AI Process Manager, adaptado a la app.

export type InvOrigen = 'confirmado' | 'deducido'
export type InvTipo = 'Estratégico' | 'Productivo' | 'Apoyo'
export type InvMetodo = 'bigbang' | 'incremental'

export interface InvSub {
  nombre: string
  area: string
  objetivo: string
  origen: InvOrigen
}

export interface InvProceso {
  nombre: string
  subprocesos: InvSub[]
}

export interface InvMacro {
  nombre: string
  tipo: InvTipo
  procesos: InvProceso[]
}

/** Unidad organizacional. El área HOJA (sin hijas) es la que recibe subprocesos. */
export interface InvArea {
  nombre: string
  padre: string
}

export interface InvProyecto {
  consultor: string
  cliente: string
  alcance: string
  sector: string
  fecha: string
  ver: string
  metodo: InvMetodo
}

/** Documento completo del inventario de una empresa. */
export interface InvDoc {
  proyecto: InvProyecto
  areas: InvArea[]
  macros: InvMacro[]
}

/** Formato de archivo .json (compatible con la herramienta externa). */
export interface InvFile extends InvDoc {
  tipo: 'ai-process-manager-inventario'
  version: number
  mapa?: unknown
}

export const TIPO_COLOR: Record<InvTipo, string> = {
  'Estratégico': '#3987e5',
  'Productivo': '#199e70',
  'Apoyo': '#d95926',
}

export const CAT_TO_TIPO: Record<'estrategico' | 'productivo' | 'apoyo', InvTipo> = {
  estrategico: 'Estratégico',
  productivo: 'Productivo',
  apoyo: 'Apoyo',
}
