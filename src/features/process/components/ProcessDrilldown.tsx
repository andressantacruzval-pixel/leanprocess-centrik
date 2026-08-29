import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'
import { useProcesses } from '@/hooks/useProcesses'
import { useCompanyStore } from '@/stores/companyStore'
import { useProcessHealth } from '@/hooks/useProcessHealth'
import { usePlanLimits } from '@/hooks/useActiveCompany'
import { planName } from '@/lib/plans'
import { avisarSiSinCupo, mensajeSinCupo } from '@/lib/planGateMessage'
import { ACCIONES_AL_PASAR } from '@/lib/constants'
import { SubprocessCard } from './SubprocessCard'
import { OrgUnitSelector } from './OrgUnitSelector'
import type { Process, OrgUnit } from '@/types'

interface ProcessDrilldownProps {
  macroId: string
  onBack: () => void
}

export function ProcessDrilldown({ macroId, onBack }: ProcessDrilldownProps) {
  const navigate = useNavigate()
  const {
    macroprocesses,
    processes,
    getProcessesByMacro,
    getSubprocesses,
    addProcess,
    updateProcess,
    deleteProcess,
    reorderProcesses,
    processLevelCount,
    getLevelName,
  } = useProcesses()

  const orgUnits = useCompanyStore((s) => s.orgUnits)
  const healthMap = useProcessHealth()
  const plan = usePlanLimits()
  // Crear procesos es libre; el plan gobierna DOCUMENTAR. El contador refleja
  // cuántos procesos has documentado (caracterizado, diagramado, etc.) vs el cupo.
  const subLimit = plan.cap
  const docCount = plan.documented.count
  const docReached = plan.documented.reached
  const isCommunity = plan.isCommunity

  const macro = macroprocesses.find((m) => m.id === macroId)

  // En que nivel estas vive en la URL (`?parent=`), no en estado local: asi volver
  // desde un proceso te deja donde estabas. Ver `lib/processMapUrl.ts`.
  const [searchParams, setSearchParams] = useSearchParams()
  const parentProcessId = searchParams.get('parent')

  const irANivel = (id: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (id) next.set('parent', id)
    else next.delete('parent')
    setSearchParams(next, { replace: true })
  }

  // El breadcrumb NO se guarda: se deriva del padre. Solo hay un nivel bajo el
  // macroproceso, asi que mantener un array aparte era un segundo estado que
  // sincronizar con el primero, sin ganar nada.
  const parentProcess = parentProcessId ? processes.find((p) => p.id === parentProcessId) : null
  const breadcrumb = parentProcess ? [{ id: parentProcess.id, name: parentProcess.name }] : []

  // Current level (1 = macroprocess view showing level 2, 2 = level 2 showing level 3)
  const currentDepth = breadcrumb.length // 0 = showing level 2 children of macro, 1 = showing level 3 children

  // Determine max depth for processes (macroprocess = level 1, so levels 2..N)
  const maxProcessDepth = processLevelCount - 1 // How many sub-levels under macro
  const isAtLowestLevel = currentDepth >= maxProcessDepth - 1

  // Get current processes to display
  const currentProcesses = useMemo(() => {
    if (parentProcessId) {
      return getSubprocesses(parentProcessId)
    }
    return getProcessesByMacro(macroId)
  }, [parentProcessId, macroId, getProcessesByMacro, getSubprocesses])

  // Current level number (for naming)
  const currentLevelNumber = currentDepth + 2 // depth 0 = level 2, depth 1 = level 3
  const currentLevelName = getLevelName(currentLevelNumber)
  const nextLevelName = getLevelName(currentLevelNumber + 1)

  // Inline editing
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // Drag-and-drop state
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Org unit selector
  const [orgSelectorProcess, setOrgSelectorProcess] = useState<Process | null>(null)

  // Build org unit path
  const orgUnitMap = useMemo(() => {
    const map = new Map<string, OrgUnit>()
    for (const u of orgUnits) map.set(u.id, u)
    return map
  }, [orgUnits])

  const getOrgUnitPath = (unitId: string): string => {
    const parts: string[] = []
    let current = orgUnitMap.get(unitId)
    while (current) {
      parts.unshift(current.name)
      current = current.parent_id ? orgUnitMap.get(current.parent_id) : undefined
    }
    return parts.join(' > ')
  }

  // Handle adding new process
  const handleAdd = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    // Crear la tarjeta del proceso/subproceso es LIBRE: el usuario arma todo su
    // mapa sin tope. Lo que gobierna el plan es DOCUMENTAR (caracterizar, flujograma,
    // riesgos, controles…), y eso se controla en la tarjeta, no aquí.
    addProcess(trimmed, macroId, parentProcessId)
    setNewName('')
    setAddingNew(false)
  }

  // Handle editing process
  const handleEditSave = (id: string) => {
    const trimmed = editName.trim()
    if (!trimmed) return
    updateProcess(id, { name: trimmed })
    setEditingId(null)
    setEditName('')
  }

  // Navigate into a process (drill deeper)
  const handleDrillInto = (process: Process) => {
    if (isAtLowestLevel) return
    irANivel(process.id)
  }

  // Navigate back one level
  const handleBreadcrumbClick = (index: number) => {
    irANivel(index < 0 ? null : (breadcrumb[index]?.id ?? null))
  }

  if (!macro) {
    return (
      <div className="text-center py-12 text-gray-400">
        Macroproceso no encontrado.
        <button onClick={onBack} className="ml-2 text-primary-600 hover:underline">
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Breadcrumb — envuelve: con tres niveles y nombres reales no cabe en una línea */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-gray-500 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Mapa de Procesos</span>
        </button>

        <ChevronRight size={14} className="text-gray-400" />

        <button
          onClick={() => handleBreadcrumbClick(-1)}
          className={`font-medium transition-colors ${
            breadcrumb.length === 0
              ? 'text-gray-900'
              : 'text-gray-500 hover:text-primary-600'
          }`}
        >
          {macro.name}
        </button>

        {breadcrumb.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-2">
            <ChevronRight size={14} className="text-gray-400" />
            <button
              onClick={() => handleBreadcrumbClick(i)}
              className={`font-medium transition-colors ${
                i === breadcrumb.length - 1
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-primary-600'
              }`}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* Title area */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            {breadcrumb.length > 0
              ? breadcrumb[breadcrumb.length - 1].name
              : macro.name}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {currentProcesses.length} {currentLevelName.toLowerCase()}
            {currentProcesses.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isCommunity && subLimit !== null && (
          <button
            onClick={() => { if (docReached) avisarSiSinCupo(true, plan.level, subLimit) }}
            title={docReached ? `Documentar uno nuevo requiere ampliar tu ${planName(plan.level)}` : `Has documentado ${docCount} de ${subLimit} procesos que incluye tu ${planName(plan.level)}`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
              docReached
                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                : docCount >= subLimit * 0.8
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}>
            {docCount} / {subLimit} documentados{docReached ? ' · ampliar' : ''}
          </button>
        )}
      </div>

      {/* Process grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {currentProcesses.map((process) => {
          const isEditing = editingId === process.id
          const childCount = getSubprocesses(process.id).length
          const linkedOrg = process.org_unit_id ? orgUnitMap.get(process.org_unit_id) || null : null
          const orgPath = process.org_unit_id ? getOrgUnitPath(process.org_unit_id) : ''

          if (isAtLowestLevel) {
            // Show subprocess cards with org unit linking
            return (
              <div
                key={process.id}
                draggable
                onDragStart={(e) => {
                  setDraggedId(process.id)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', process.id)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverId(process.id)
                }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverId(null)
                  if (!draggedId || draggedId === process.id) return
                  const ids = currentProcesses.map((p) => p.id)
                  const fromIndex = ids.indexOf(draggedId)
                  const toIndex = ids.indexOf(process.id)
                  if (fromIndex < 0 || toIndex < 0) return
                  ids.splice(fromIndex, 1)
                  ids.splice(toIndex, 0, draggedId)
                  reorderProcesses(parentProcessId, macroId, ids)
                  setDraggedId(null)
                }}
                onDragEnd={() => {
                  setDraggedId(null)
                  setDragOverId(null)
                }}
                className={`transition-all duration-200 ${
                  draggedId === process.id ? 'opacity-40 scale-95' : ''
                } ${
                  dragOverId === process.id ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-surface-ground rounded-lg' : ''
                }`}
              >
                {isEditing ? (
                  <div className="bg-white rounded-lg border border-primary-200 shadow-sm p-4">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditSave(process.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-300"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleEditSave(process.id)}
                        className="px-3 py-1 text-xs font-medium text-white rounded-md bg-primary-500 hover:bg-primary-600"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <SubprocessCard
                    process={process}
                    linkedOrgUnit={linkedOrg}
                    orgUnitPath={orgPath}
                    canAssignOrg={orgUnits.length > 0}
                    healthScore={healthMap[process.id]?.score}
                    documentacionBloqueada={
                      plan.puedeDocumentar(process.id)
                        ? undefined
                        : mensajeSinCupo(plan.level, subLimit)
                    }
                    onSinCupo={() => avisarSiSinCupo(true, plan.level, subLimit)}
                    onEdit={() => {
                      setEditingId(process.id)
                      setEditName(process.name)
                    }}
                    onDelete={() => deleteProcess(process.id)}
                    onAssignOrg={() => setOrgSelectorProcess(process)}
                    onDoubleClick={() => navigate(`/app/process/${process.id}`)}
                    onGoToCharacterization={() => navigate(`/app/process/${process.id}`)}
                    onGoToIndicators={() => navigate(`/app/process/${process.id}/indicators`)}
                    onGoToFlowchart={() => navigate(`/app/process/${process.id}/characterization`)}
                  />
                )}
              </div>
            )
          }

          // Intermediate level — show clickable cards
          return (
            <div
              key={process.id}
              draggable
              onDragStart={(e) => {
                setDraggedId(process.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', process.id)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDragOverId(process.id)
              }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverId(null)
                if (!draggedId || draggedId === process.id) return
                const ids = currentProcesses.map((p) => p.id)
                const fromIndex = ids.indexOf(draggedId)
                const toIndex = ids.indexOf(process.id)
                if (fromIndex < 0 || toIndex < 0) return
                ids.splice(fromIndex, 1)
                ids.splice(toIndex, 0, draggedId)
                reorderProcesses(parentProcessId, macroId, ids)
                setDraggedId(null)
              }}
              onDragEnd={() => {
                setDraggedId(null)
                setDragOverId(null)
              }}
              className={`transition-all duration-200 ${
                draggedId === process.id ? 'opacity-40 scale-95' : ''
              } ${
                dragOverId === process.id ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-surface-ground rounded-lg' : ''
              }`}
            >
              {isEditing ? (
                <div className="bg-white rounded-lg border border-primary-200 shadow-sm p-4">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditSave(process.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-300"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleEditSave(process.id)}
                      className="px-3 py-1 text-xs font-medium text-white rounded-md bg-primary-500 hover:bg-primary-600"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <ProcessDrillCard
                  process={process}
                  childCount={childCount}
                  nextLevelName={nextLevelName}
                  onDrill={() => handleDrillInto(process)}
                  onEdit={() => {
                    setEditingId(process.id)
                    setEditName(process.name)
                  }}
                  onDelete={() => deleteProcess(process.id)}
                />
              )}
            </div>
          )
        })}

        {/* Add new card */}
        {addingNew ? (
          <div className="bg-white rounded-lg border border-primary-200 shadow-sm p-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') {
                  setAddingNew(false)
                  setNewName('')
                }
              }}
              placeholder={`Nombre del ${currentLevelName.toLowerCase()}`}
              className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-300 placeholder:text-gray-400"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleAdd}
                className="px-3 py-1 text-xs font-medium text-white rounded-md bg-primary-500 hover:bg-primary-600"
              >
                Crear
              </button>
              <button
                onClick={() => {
                  setAddingNew(false)
                  setNewName('')
                }}
                className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingNew(true)}
            className="min-h-[100px] rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center
                       justify-center gap-1.5 hover:border-primary-500 hover:bg-primary-50 transition-colors group"
          >
            <Plus size={20} className="text-gray-400 group-hover:text-primary-600 transition-colors" />
            <span className="text-xs text-gray-400 group-hover:text-primary-600 transition-colors">
              Agregar {currentLevelName.toLowerCase()}
            </span>
          </button>
        )}
      </div>

      {/* Org unit selector modal */}
      {orgSelectorProcess && (
        <OrgUnitSelector
          open={true}
          onClose={() => setOrgSelectorProcess(null)}
          leafOnly={isAtLowestLevel}
          onSelect={(orgUnitId) => {
            if (orgUnitId) {
              const chain: OrgUnit[] = []
              let cur = orgUnitMap.get(orgUnitId)
              while (cur) {
                chain.unshift(cur)
                cur = cur.parent_id ? orgUnitMap.get(cur.parent_id) : undefined
              }
              const len = chain.length
              const management = chain[0]?.name ?? ''
              const coordination =
                len >= 3 ? (chain[len - 2]?.name ?? '') : len === 2 ? (chain[1]?.name ?? '') : ''
              const operative = len >= 3 ? (chain[len - 1]?.name ?? '') : ''
              updateProcess(orgSelectorProcess.id, {
                org_unit_id: orgUnitId,
                management,
                coordination,
                operative,
              })
            } else {
              updateProcess(orgSelectorProcess.id, {
                org_unit_id: null,
                management: '',
                coordination: '',
                operative: '',
              })
            }
            setOrgSelectorProcess(null)
          }}
          currentOrgUnitId={orgSelectorProcess.org_unit_id}
        />
      )}
    </div>
  )
}

// --- Internal sub-component for intermediate drill cards ---

function ProcessDrillCard({
  process,
  childCount,
  nextLevelName,
  onDrill,
  onEdit,
  onDelete,
}: {
  process: Process
  childCount: number
  nextLevelName: string
  onDrill: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => { clearTimeout(timerRef.current) }, [])

  return (
    <div
      onClick={onDrill}
      // Solo resetea la confirmacion de borrado. En tactil no se dispara, pero el
      // temporizador de 3 s la deshace igual.
      onMouseLeave={() => setConfirmDelete(false)}
      className="relative bg-gray-50 hover:bg-gray-50 rounded-lg shadow-sm border border-gray-100 cursor-pointer transition-all duration-200 p-4 group"
    >
      <div className={`absolute top-2 right-2 flex gap-0.5 z-10 ${ACCIONES_AL_PASAR}`}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          title="Editar"
          className="p-2 rounded-md bg-gray-50 text-gray-400 hover:text-white transition-colors bg-primary-500 hover:bg-primary-600"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (confirmDelete) {
              onDelete()
            } else {
              setConfirmDelete(true)
              timerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
            }
          }}
          title={confirmDelete ? 'Pulsa otra vez para eliminar' : 'Eliminar'}
          className={`p-2 rounded-md transition-colors ${
            confirmDelete
              ? 'bg-red-600 text-white'
              : 'bg-gray-50 hover:bg-red-600 text-gray-400 hover:text-white'
          }`}
        >
          <Trash2 size={13} />
        </button>
      </div>

      <h4 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 pr-12">
        {process.name}
      </h4>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {childCount} {nextLevelName.toLowerCase()}{childCount !== 1 ? 's' : ''}
        </span>
        <ChevronRight size={14} className="text-gray-500 group-hover:text-primary-600 transition-colors" />
      </div>
    </div>
  )
}
