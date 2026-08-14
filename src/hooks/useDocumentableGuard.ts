/**
 * useDocumentableGuard
 * --------------------
 * Cierra las pantallas de documentacion cuando no toca documentar. Dos motivos
 * distintos, misma puerta:
 *
 *   1. NIVEL  — el proceso no esta en el nivel mas bajo declarado (agrupador).
 *   2. CUPO   — el plan no da para documentar un proceso mas.
 *
 * En ambos casos redirige a la ficha del proceso, que explica cual de los dos es.
 * La garantia real esta en la base (triggers `enforce_documentable_level*`); esto
 * evita que el usuario llegue a escribir y se coma el error al guardar.
 *
 * Lo usan las 7 pantallas de documentacion. Ver `@/lib/processLevels` y
 * `usePlanLimits` para los dos predicados.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { isDocumentable } from '@/lib/processLevels'
import { usePlanLimits } from '@/hooks/useActiveCompany'

export function useDocumentableGuard(processId: string | undefined) {
  const navigate = useNavigate()
  const processes = useProcessStore((s) => s.processes)
  const processLevelCount = useCompanyStore((s) => s.company?.process_level_count ?? 3)
  const { puedeDocumentar } = usePlanLimits()

  const process = processId ? processes.find((p) => p.id === processId) : undefined
  // Mientras el store carga, `process` es undefined: no redirigir todavia o se
  // expulsaria al usuario de una pantalla valida en cada refresco.
  const allowed =
    !process || (isDocumentable(process, processLevelCount) && puedeDocumentar(process.id))

  useEffect(() => {
    if (!allowed && processId) {
      navigate(`/app/process/${processId}`, { replace: true })
    }
  }, [allowed, processId, navigate])

  return allowed
}
