export const APP_NAME = 'Lean Process'
export const APP_DESCRIPTION = 'Gestion de procesos simplificada con inteligencia artificial'

export const PROCESS_CATEGORIES = {
  estrategico: { label: 'Estrategico', color: '#DC2626', bgColor: '#FEE2E2' },
  productivo: { label: 'Productivo', color: '#6B7280', bgColor: '#F3F4F6' },
  apoyo: { label: 'Apoyo', color: '#7C3AED', bgColor: '#EDE9FE' },
} as const

export const FEATURE_LABELS: Record<string, string> = {
  max_processes: 'Maximo de procesos',
  max_sipoc_per_process: 'Entradas SIPOC por proceso',
  ai_tokens_monthly: 'Tokens IA mensuales',
  export_bpmn: 'Exportar BPMN',
  export_pdf: 'Exportar PDF',
  export_image: 'Exportar imagen',
  process_map: 'Mapa de procesos',
  process_characterization: 'Caracterizacion de procesos',
}

export const CATALOG_TYPES = {
  execution_level: 'Nivel de ejecucion',
  management: 'Gerencia',
  coordination: 'Jefatura/Coordinacion',
  business_line: 'Linea de negocio',
  supervision_level: 'Nivel de supervision',
  delivery_method: 'Medio de entrega',
  execution_type: 'Tipo de ejecucion',
  process_type: 'Tipo de proceso',
  execution_frequency: 'Frecuencia de ejecucion',
} as const

// Solo 2 y 3 niveles. La opcion de 1 nivel existio pero nunca se implemento: el
// mapa de procesos siempre pinta macroprocesos y `addProcess` siempre exige un
// `macroprocess_id`, asi que "1 nivel" producia exactamente la misma estructura
// que "2 niveles" (macroproceso -> proceso) mientras prometia "sin jerarquia".
// Retirada el 2026-07-31; las 3 empresas que la tenian se pasaron a 2 niveles.
export const PROCESS_LEVEL_OPTIONS = [
  {
    count: 2,
    defaultNames: ['Macroproceso', 'Proceso'],
    pros: ['Balance entre simplicidad y estructura', 'Permite agrupar procesos relacionados', 'Buena para empresas medianas'],
    cons: ['No permite documentar a nivel detallado de actividades'],
  },
  {
    count: 3,
    defaultNames: ['Macroproceso', 'Proceso', 'Subproceso'],
    pros: ['Estructura completa y profesional', 'Documentacion detallada', 'Estandar de la industria (ISO, BPM)', 'Maximo control y trazabilidad'],
    cons: ['Requiere mas tiempo de configuracion inicial'],
    recommended: true,
  },
] as const

export const DEFAULT_ORG_LEVELS = ['Gerencia', 'Jefatura', 'Coordinacion']

export const ORG_LEVEL_COLORS = ['#DC2626', '#2563EB', '#059669', '#7C3AED', '#D97706']

/**
 * Acciones que se revelan al pasar el raton por encima (editar, eliminar…).
 *
 * Tailwind envuelve `hover:` en `@media (hover: hover)`, asi que en una pantalla
 * tactil `group-hover:opacity-100` NUNCA se dispara: el boton queda a `opacity-0`
 * para siempre. `pointer-coarse:opacity-100` lo devuelve. Sin esa tercera clase,
 * eliminar una fila SIPOC o editar un subproceso es imposible desde un movil.
 *
 * Requiere `group` en el contenedor. Y NO envolver esto en un `{hovered && …}`:
 * el render condicional deja el boton fuera del DOM, donde ninguna clase lo salva.
 *
 * `focus-within` no es adorno: a `opacity-0` el boton SIGUE existiendo y sigue en el
 * orden de tabulacion, asi que sin el se podria enfocar con el teclado un boton
 * invisible. Con el, al enfocarlo se ve. (`:focus-within` tambien casa con el propio
 * elemento enfocado, asi que sirve igual si la clase va en el boton o en su envoltorio.)
 */
export const ACCIONES_AL_PASAR =
  'opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100 transition-opacity'
