import { useState } from 'react'
import { Pencil, Trash2, Building2, Link, BarChart3, FileText, Workflow } from 'lucide-react'
import type { Process, OrgUnit } from '@/types'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { ACCIONES_AL_PASAR } from '@/lib/constants'

interface SubprocessCardProps {
  process: Process
  linkedOrgUnit: OrgUnit | null
  orgUnitPath: string
  canAssignOrg: boolean
  healthScore?: number
  onEdit: () => void
  onDelete: () => void
  onAssignOrg: () => void
  onDoubleClick?: () => void
  onGoToCharacterization?: () => void
  onGoToIndicators?: () => void
  onGoToFlowchart?: () => void
  /**
   * Motivo por el que este proceso no se puede documentar, o `undefined` si sí.
   * Cuando llega, los tres botones salen apagados con el motivo como tooltip: el
   * cliente ve que la acción existe y por qué no la tiene, en vez de que el botón
   * desaparezca (que se lee como un fallo) o de chocar con un error al guardar.
   *
   * ⚠️ El texto NO se escribe aquí: viene de `mensajeSinCupo`, que es donde vive.
   * Esta tarjeta llegó a tener su propia redacción y acabó diciendo una cosa
   * distinta de las otras siete puertas — y prometiendo planes «muy pronto» cuando
   * ya se vendían.
   */
  documentacionBloqueada?: string
  /**
   * Qué hacer al pulsar una acción bloqueada. Abre el muro de plan, igual que el
   * resto de puertas. Antes salía un aviso de texto: decía que no y ahí se acababa,
   * sin enseñar cómo seguir.
   */
  onSinCupo?: () => void
}

export function SubprocessCard({
  process,
  linkedOrgUnit,
  orgUnitPath,
  canAssignOrg,
  healthScore,
  onEdit,
  onDelete,
  onAssignOrg,
  onDoubleClick,
  onGoToCharacterization,
  onGoToIndicators,
  onGoToFlowchart,
  documentacionBloqueada,
  onSinCupo,
}: SubprocessCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const bloqueado = !!documentacionBloqueada
  // Clase literal, no interpolada: Tailwind escanea el fuente y una clase construida
  // con plantilla (`bg-${color}-500`) nunca llega al CSS compilado.
  const CLASE_BLOQUEADA =
    'flex-1 min-w-[7rem] flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium bg-gray-50 text-gray-400 border border-gray-100 cursor-not-allowed'

  const handleDeleteRequest = (e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmOpen(true)
  }

  return (
    <>
      <div
        className="group relative bg-gray-50 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-4 cursor-pointer"
        onDoubleClick={() => {
          // El doble clic tambien respeta el bloqueo — antes entraba igual. Y en vez de
          // no hacer nada, explica: un doble clic que no responde se lee como un fallo.
          if (bloqueado) { onSinCupo?.(); return }
          onDoubleClick?.()
        }}
      >
        {/* Action buttons — siempre en el DOM: ver ACCIONES_AL_PASAR */}
        <div className={`absolute top-2 right-2 flex gap-0.5 z-10 ${ACCIONES_AL_PASAR}`}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-2 rounded-md bg-gray-50 hover:bg-primary-50 text-gray-500 hover:text-primary-600 transition-colors"
            title="Editar"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={handleDeleteRequest}
            className="p-2 rounded-md bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
            title="Eliminar"
          >
            <Trash2 size={13} />
          </button>
        </div>

        <div className="flex items-start justify-between pr-20">
          <h4 className="text-sm font-semibold text-gray-700 leading-tight line-clamp-2">
            {process.name}
          </h4>
          {healthScore !== undefined && (
            <span className="flex items-center gap-1 shrink-0 ml-2">
              <span className={`w-1.5 h-1.5 rounded-full ${
                healthScore >= 67 ? 'bg-emerald-500' :
                healthScore >= 33 ? 'bg-amber-500' :
                'bg-red-500'
              }`} />
              <span className={`text-[9px] font-medium ${
                healthScore >= 67 ? 'text-emerald-600' :
                healthScore >= 33 ? 'text-amber-600' :
                'text-red-600'
              }`}>{healthScore}%</span>
            </span>
          )}
        </div>

        {/* Org unit badge or assign button */}
        <div className="mt-3">
          {linkedOrgUnit ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAssignOrg()
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50
                         text-primary-600 border border-primary-200 hover:bg-primary-50 transition-colors"
              title={orgUnitPath}
            >
              <Building2 size={12} />
              <span className="truncate max-w-[150px]">{linkedOrgUnit.name}</span>
            </button>
          ) : canAssignOrg ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAssignOrg()
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50
                         text-gray-500 border border-gray-100 hover:bg-primary-50 hover:text-primary-600
                         hover:border-primary-200 transition-colors"
            >
              <Link size={12} />
              Asignar area
            </button>
          ) : null}
        </div>

        {/* Quick-access buttons */}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          {onGoToCharacterization && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (bloqueado) { onSinCupo?.(); return }
                onGoToCharacterization()
              }}
              className={
                bloqueado
                  ? CLASE_BLOQUEADA
                  : `flex-1 min-w-[7rem] flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px]
                         font-medium bg-primary-50 text-primary-600 border border-primary-200 hover:bg-primary-50
                         hover:text-primary-600 hover:border-primary-300 transition-all`
              }
              title={documentacionBloqueada ?? 'Caracterizacion'}
            >
              <FileText size={12} />
              Caracterizar
            </button>
          )}
          {onGoToIndicators && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (bloqueado) { onSinCupo?.(); return }
                onGoToIndicators()
              }}
              className={
                bloqueado
                  ? CLASE_BLOQUEADA
                  : `flex-1 min-w-[7rem] flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px]
                         font-medium bg-primary-50 text-primary-600 border border-primary-200 hover:bg-primary-50
                         hover:text-primary-600 hover:border-primary-300 transition-all`
              }
              title={documentacionBloqueada ?? 'Indicadores'}
            >
              <BarChart3 size={12} />
              Indicadores
            </button>
          )}
          {onGoToFlowchart && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (bloqueado) { onSinCupo?.(); return }
                onGoToFlowchart()
              }}
              className={
                bloqueado
                  ? CLASE_BLOQUEADA
                  : `flex-1 min-w-[7rem] flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px]
                         font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-50 hover:text-blue-600
                         hover:border-blue-300 transition-all`
              }
              title={documentacionBloqueada ?? 'Flujograma BPMN'}
            >
              <Workflow size={12} />
              Flujograma
            </button>
          )}
        </div>
      </div>

      <ConfirmDeleteModal
        open={confirmOpen}
        title={`¿Eliminar el proceso «${process.name}»?`}
        onConfirm={() => { onDelete(); setConfirmOpen(false) }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
