// Codificación automática de activos y de sus columnas.
// Estructura: <ORG>-<PROCESO>-ACT-NNN para el activo, y <CÓDIGO ACTIVO>-NN para
// cada columna. Los prefijos salen de la estructura organizacional (gerencia /
// área) y del proceso, para que el código cuente de dónde viene el dato.

function abbr(s: string | undefined | null, max = 3): string {
  if (!s) return ''
  const clean = s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, ' ').trim()
  if (!clean) return ''
  const words = clean.split(/\s+/).filter(Boolean)
  // Varias palabras → iniciales; una sola → primeras letras.
  const code = words.length > 1 ? words.map((w) => w[0]).join('') : words[0].slice(0, max)
  return code.toUpperCase().slice(0, max)
}

export function orgProcPrefix(management?: string, coordination?: string, processName?: string): string {
  return [abbr(management), abbr(coordination), abbr(processName)].filter(Boolean).join('-') || 'ACT'
}

export function buildAssetCode(prefix: string, seq: number): string {
  return `${prefix}-ACT-${String(seq).padStart(3, '0')}`
}

export function buildColumnCode(base: string, index: number): string {
  const root = base && base.trim() ? base.trim() : 'ACT'
  return `${root}-${String(index + 1).padStart(2, '0')}`
}
