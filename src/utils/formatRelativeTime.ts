/**
 * Formatea un timestamp como tiempo relativo en espanol.
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} min`
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  if (days < 7) return `hace ${days} ${days === 1 ? 'dia' : 'dias'}`

  const date = new Date(timestamp)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}
