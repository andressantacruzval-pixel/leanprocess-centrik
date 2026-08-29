import { useMemo, useState } from 'react'
import { Trash2, X, FileWarning } from 'lucide-react'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { useProcessHealth } from '@/hooks/useProcessHealth'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { usePlanLimits } from '@/hooks/useActiveCompany'
import { isDocumentable } from '@/lib/processLevels'
import { planName } from '@/lib/plans'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { toast } from '@/stores/toastStore'
import type { Process } from '@/types'

/**
 * Borrado múltiple de procesos.
 *
 * Existe por una razón concreta: **bajar de plan exige quedar por debajo del cupo
 * del plan destino**, y sin esta pantalla esa regla es un muro. El sistema no elige
 * qué procesos sacrificar —eso destruiría trabajo del cliente sin su consentimiento—
 * así que la fricción se traslada aquí, que es donde él sí puede decidir.
 *
 * Lista **plana** a propósito: el árbol de la pantalla de niveles sirve para
 * entender la estructura, no para quitar 10 de 30. Y ordena **los vacíos primero**,
 * que casi siempre son los que sobran.
 */

const CLASE_FILA =
  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors'

export function DepurarProcesosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { macroprocesses, processes } = useCompanyScopedData()
  const healthMap = useProcessHealth()
  const processLevelCount = useCompanyStore((s) => s.company?.process_level_count ?? 3)
  const deleteProcess = useProcessStore((s) => s.deleteProcess)
  const plan = usePlanLimits()

  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [confirmando, setConfirmando] = useState(false)

  const nombreMacro = useMemo(
    () => new Map(macroprocesses.map((m) => [m.id, m.name])),
    [macroprocesses]
  )

  /** Solo los del nivel más bajo: son los que consumen cupo. */
  const candidatos = useMemo(() => {
    const hijos = new Map<string, number>()
    for (const p of processes) {
      if (p.parent_process_id) hijos.set(p.parent_process_id, (hijos.get(p.parent_process_id) ?? 0) + 1)
    }
    return processes
      .filter((p) => isDocumentable(p, processLevelCount))
      .map((p) => ({
        proceso: p as Process,
        documentado: Object.values(healthMap[p.id]?.checks ?? {}).some(Boolean),
        puntuacion: healthMap[p.id]?.score ?? 0,
        descendientes: hijos.get(p.id) ?? 0,
      }))
      // Sin documentar primero, y dentro de cada grupo el menos avanzado antes:
      // quien tiene que quitar procesos quiere ver primero lo que no le duele.
      .sort(
        (a, b) =>
          Number(a.documentado) - Number(b.documentado) ||
          a.puntuacion - b.puntuacion ||
          a.proceso.name.localeCompare(b.proceso.name)
      )
  }, [processes, processLevelCount, healthMap])

  if (!open) return null

  const total = candidatos.length
  const elegidos = seleccion.size
  const quedarian = total - elegidos
  const conDocumentacion = candidatos.filter((c) => seleccion.has(c.proceso.id) && c.documentado).length
  const arrastran = candidatos
    .filter((c) => seleccion.has(c.proceso.id))
    .reduce((n, c) => n + c.descendientes, 0)

  const alternar = (id: string) =>
    setSeleccion((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const eliminar = () => {
    const ids = [...seleccion]
    // `silent` porque el resumen lo da esta pantalla: N toasts serían ruido.
    ids.forEach((id) => deleteProcess(id, { silent: true }))
    toast.success(
      ids.length === 1 ? 'Proceso eliminado.' : `${ids.length} procesos eliminados.`
    )
    setSeleccion(new Set())
    setConfirmando(false)
    onClose()
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 p-4"
        onClick={onClose}
      >
        <div
          className="bg-white border border-gray-200 rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100">
            <div>
              <h2 className="text-gray-900 font-semibold text-base">Depurar procesos</h2>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {plan.cap !== null ? (
                  <>
                    Tienes <b className="text-gray-700">{total}</b> procesos y tu plan{' '}
                    {planName(plan.level)} permite <b className="text-gray-700">{plan.cap}</b>.
                    {elegidos > 0 && (
                      <>
                        {' '}Si eliminas {elegidos}, te quedan{' '}
                        <b className={quedarian > plan.cap ? 'text-amber-600' : 'text-emerald-600'}>
                          {quedarian}
                        </b>
                        .
                      </>
                    )}
                  </>
                ) : (
                  <>Elimina los procesos que ya no necesitas. Se borra también su documentación.</>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {candidatos.map(({ proceso, documentado, puntuacion, descendientes }) => {
              const marcado = seleccion.has(proceso.id)
              return (
                <button
                  key={proceso.id}
                  onClick={() => alternar(proceso.id)}
                  className={`${CLASE_FILA} ${
                    marcado
                      ? 'bg-red-50 border-red-300'
                      : 'bg-gray-50 border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                      marcado ? 'bg-red-500 border-red-500' : 'border-gray-300'
                    }`}
                  >
                    {marcado && <span className="text-[10px] text-gray-900 leading-none">✓</span>}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs text-gray-800 truncate">{proceso.name}</span>
                    <span className="block text-[10px] text-gray-400 truncate">
                      {nombreMacro.get(proceso.macroprocess_id ?? '') ?? 'Sin macroproceso'}
                    </span>
                  </span>
                  {descendientes > 0 && (
                    <span className="text-[10px] text-amber-600 shrink-0">
                      +{descendientes} dentro
                    </span>
                  )}
                  {/* En movil cede el sitio al nombre del proceso, que es por lo
                      que se decide si sobra o no */}
                  <span
                    className={`hidden sm:block text-[10px] shrink-0 w-24 text-right ${
                      documentado ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    {documentado ? `Documentado ${puntuacion}%` : 'Sin documentar'}
                  </span>
                </button>
              )
            })}
            {total === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">
                No hay procesos en el nivel más bajo.
              </p>
            )}
          </div>

          <div className="p-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-gray-500">
              {elegidos === 0 ? 'Ninguno seleccionado' : `${elegidos} seleccionado${elegidos === 1 ? '' : 's'}`}
              {conDocumentacion > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                  <FileWarning size={11} />
                  {conDocumentacion} con documentación
                </span>
              )}
            </span>
            <button
              onClick={() => setConfirmando(true)}
              disabled={elegidos === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-red-50 text-red-600 border
                         border-red-200 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors"
            >
              <Trash2 size={13} />
              Eliminar {elegidos > 0 ? elegidos : ''}
            </button>
          </div>
        </div>
      </div>

      {/* Se reutiliza el modal de confirmación que ya existe; el texto enumera lo
          que de verdad se pierde, incluidos los descendientes que van en cascada. */}
      <ConfirmDeleteModal
        open={confirmando}
        title={`Eliminar ${elegidos} proceso${elegidos === 1 ? '' : 's'}`}
        description={[
          `Se eliminarán ${elegidos} proceso${elegidos === 1 ? '' : 's'}`,
          arrastran > 0 ? ` y ${arrastran} subproceso${arrastran === 1 ? '' : 's'} dentro` : '',
          '.',
          conDocumentacion > 0
            ? ` ${conDocumentacion} tiene${conDocumentacion === 1 ? '' : 'n'} documentación (flujograma, KPIs, riesgos…), que se borra con ellos.`
            : '',
          ' Esta acción no se puede deshacer.',
        ].join('')}
        onConfirm={eliminar}
        onCancel={() => setConfirmando(false)}
      />
    </>
  )
}
