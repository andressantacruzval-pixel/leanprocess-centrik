/**
 * Codificacion de documentos (sync del 2026-08-11).
 *
 * Hasta ahora todo procedimiento nacia con el literal `LP-PRO-001`. En produccion eso
 * dejo **70 de 75 documentos con el mismo identificador**, y una sola empresa con 23.
 * La empresa elige en el onboarding el orden de los segmentos y el prefijo; el
 * correlativo lo lleva la propia app.
 */

export type DocCodePattern = 'tipo-area-num' | 'area-tipo-num' | 'tipo-num'

/**
 * El codigo que emitia la app antes de existir esta configuracion. Se trata como
 * CENTINELA de «sin codificar»: un documento que lo lleva recibe el suyo la primera
 * vez que se publica, sin necesidad de reescribir nada en la base.
 */
export const DOC_CODE_SENTINEL = 'LP-PRO-001'

/** Prefijo por defecto para la empresa que aun no ha elegido el suyo. */
export const DEFAULT_DOC_CODE_PREFIX = 'PRO'
export const DEFAULT_DOC_CODE_PATTERN: DocCodePattern = 'tipo-num'

export const DOC_CODE_PATTERNS: { value: DocCodePattern; label: string; example: string }[] = [
  { value: 'tipo-area-num', label: 'Tipo · Área · Número', example: 'PRO-VENTAS-001' },
  { value: 'area-tipo-num', label: 'Área · Tipo · Número', example: 'VENTAS-PRO-001' },
  { value: 'tipo-num', label: 'Tipo · Número', example: 'PRO-001' },
]

/** ¿Este codigo hay que asignarlo? Vacio o el literal viejo. */
export function needsDocCode(codigo: string | null | undefined): boolean {
  const c = (codigo ?? '').trim()
  return c === '' || c === DOC_CODE_SENTINEL
}

/** Mayusculas sin tildes ni espacios: «Gestión de Ventas» -> «GESTIONDEVENTAS». */
function token(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
}

/**
 * Siguiente correlativo: `max(numero final) + 1`, NO `count + 1`.
 * Cuesta lo mismo y no reutiliza un numero cuando alguien borro un documento
 * (con `count` el tercer documento tras un borrado repetiria el 002).
 */
export function nextDocSeq(existingCodes: (string | null | undefined)[]): number {
  let max = 0
  for (const code of existingCodes) {
    const m = (code ?? '').trim().match(/(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max + 1
}

export function buildDocCode(opts: {
  pattern?: DocCodePattern | null
  prefix?: string | null
  areaName?: string | null
  seq: number
}): string {
  const prefix = token(opts.prefix?.trim() || DEFAULT_DOC_CODE_PREFIX) || DEFAULT_DOC_CODE_PREFIX
  const area = opts.areaName ? token(opts.areaName) : ''
  const num = String(Math.max(1, Math.trunc(opts.seq))).padStart(3, '0')
  const pattern = opts.pattern ?? DEFAULT_DOC_CODE_PATTERN

  // Sin area asignada el segmento se omite en vez de fallar o dejar un hueco `PRO--001`.
  if (!area) return [prefix, num].join('-')

  switch (pattern) {
    case 'area-tipo-num':
      return [area, prefix, num].join('-')
    case 'tipo-num':
      return [prefix, num].join('-')
    case 'tipo-area-num':
    default:
      return [prefix, area, num].join('-')
  }
}
