import { useCallback, useMemo } from 'react'
import { useProcessStore } from '@/stores/processStore'
import { useProcedureStore } from '@/stores/procedureStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { bumpMinorVersion } from '@/utils/helpers'
import { buildDocCode, needsDocCode, nextDocSeq } from '@/utils/docCode'

/**
 * Aprobar y publicar un proceso (sync del 2026-08-11).
 *
 * Existe para que la version deje de moverse en cada guardado. Antes,
 * `handleSave` llamaba a `bumpMinorVersion` sin comparar nada, duplicado en las DOS
 * pantallas de caracterizacion: guardar sin tocar un campo subia la version, y en
 * produccion un proceso llego a la 1.37. Ese es justo el motivo de que esto viva en
 * un hook y no copiado otra vez en cada pantalla.
 *
 * Publicar es ademas el momento en que el documento adquiere identidad: si el
 * procedimiento sigue con el codigo centinela (`LP-PRO-001`, que comparten 70 de los
 * 75 documentos en produccion), recibe aqui el suyo. Asi los viejos se codifican solos
 * sin reescribir una sola fila por migracion.
 */
export function usePublishProcess(processId: string | undefined) {
  const process = useProcessStore((s) => s.processes.find((p) => p.id === processId))
  const updateProcess = useProcessStore((s) => s.updateProcess)
  const updateProcedureData = useProcedureStore((s) => s.updateProcedureData)
  const getProcedureByProcess = useProcedureStore((s) => s.getProcedureByProcess)
  const orgUnits = useCompanyStore((s) => s.orgUnits)
  const activeCompany = useWorkspaceStore((s) =>
    s.companies.find((c) => c.id === s.activeCompanyId)
  )
  const { procedures } = useCompanyScopedData()

  const published = !!process?.published_at

  const orgUnitId = process?.org_unit_id
  const areaName = useMemo(
    () => (orgUnitId ? orgUnits.find((u) => u.id === orgUnitId)?.name ?? null : null),
    [orgUnitId, orgUnits]
  )

  const publish = useCallback(() => {
    if (!processId || !process) return

    updateProcess(processId, {
      version: bumpMinorVersion(process.version),
      published_at: new Date().toISOString(),
    })

    // Solo si nunca se le asigno uno: un codigo escrito a mano no se pisa.
    const procedure = getProcedureByProcess(processId)
    if (procedure && needsDocCode(procedure.data?.codigo)) {
      const seq = nextDocSeq(
        procedures
          .filter((p) => p.process_id !== processId)
          .map((p) => p.data?.codigo)
      )
      updateProcedureData(processId, {
        codigo: buildDocCode({
          pattern: activeCompany?.doc_code_pattern ?? null,
          prefix: activeCompany?.doc_code_prefix ?? null,
          areaName,
          seq,
        }),
      })
    }
  }, [
    processId, process, updateProcess, getProcedureByProcess, updateProcedureData,
    procedures, activeCompany, areaName,
  ])

  /** Devuelve el documento a borrador para poder editarlo. No toca la version. */
  const unlock = useCallback(() => {
    if (!processId) return
    updateProcess(processId, { published_at: null })
  }, [processId, updateProcess])

  return { published, publish, unlock }
}
