export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Sube la version semantica menor en 0.1.
 * "1.0" -> "1.1", "1.9" -> "1.10", "" -> "1.0", "abc" -> "abc.1"
 * Si el usuario edito la version manualmente con un formato no
 * estandar, anadimos ".1" al final como sufijo de revision.
 */
export function bumpMinorVersion(current: string | undefined | null): string {
  const v = (current ?? '').trim()
  if (!v) return '1.0'
  const m = v.match(/^(\d+)\.(\d+)$/)
  if (m) {
    const major = parseInt(m[1], 10)
    const minor = parseInt(m[2], 10) + 1
    return `${major}.${minor}`
  }
  // Formato libre — append rev suffix
  const revMatch = v.match(/^(.*)\.(\d+)$/)
  if (revMatch) {
    return `${revMatch[1]}.${parseInt(revMatch[2], 10) + 1}`
  }
  return `${v}.1`
}
