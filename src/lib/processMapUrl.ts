import type { Process } from '@/types'

/**
 * A donde vuelve «atras» desde dentro de un proceso.
 *
 * Antes todos los botones hacian `navigate('/app/process-map')` a secas, asi que
 * te devolvian a la raiz del mapa: con tres niveles declarados y 27 subprocesos,
 * el usuario tenia que volver a bajar dos niveles a mano cada vez.
 *
 * La posicion vive en la URL y no en el estado del componente, que es lo que se
 * perdia al navegar. De paso, el enlace es compartible y sobrevive a recargar.
 *
 * Hay SEIS botones de volver al mapa repartidos por la app. Van todos por aqui a
 * proposito: cablearlos uno a uno es exactamente como se desincronizaron las dos
 * pantallas de caracterizacion.
 */
export function processMapUrl(process?: Pick<Process, 'macroprocess_id' | 'parent_process_id'> | null): string {
  if (!process?.macroprocess_id) return '/app/process-map'

  const params = new URLSearchParams({ macro: process.macroprocess_id })
  // Un proceso de nivel 3 vuelve junto a sus hermanos, no al nivel de encima.
  if (process.parent_process_id) params.set('parent', process.parent_process_id)

  return `/app/process-map?${params}`
}
