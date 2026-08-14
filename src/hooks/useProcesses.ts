import { useMemo } from 'react'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

export function useProcesses() {
  const allMacroprocesses = useProcessStore((s) => s.macroprocesses)
  const allProcesses = useProcessStore((s) => s.processes)
  const levelDefinitions = useProcessStore((s) => s.levelDefinitions)
  const addMacroprocess = useProcessStore((s) => s.addMacroprocess)
  const updateMacroprocess = useProcessStore((s) => s.updateMacroprocess)
  const deleteMacroprocess = useProcessStore((s) => s.deleteMacroprocess)
  const reorderMacroprocesses = useProcessStore((s) => s.reorderMacroprocesses)
  const moveMacroprocessCategory = useProcessStore((s) => s.moveMacroprocessCategory)
  const addProcess = useProcessStore((s) => s.addProcess)
  const updateProcess = useProcessStore((s) => s.updateProcess)
  const deleteProcess = useProcessStore((s) => s.deleteProcess)
  const reorderProcesses = useProcessStore((s) => s.reorderProcesses)

  const company = useCompanyStore((s) => s.company)
  const processLevelNames = useCompanyStore((s) => s.processLevelNames)
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)

  // Filter by active company
  const macroprocesses = useMemo(
    () => allMacroprocesses.filter((m) => !m.company_id || m.company_id === activeCompanyId),
    [allMacroprocesses, activeCompanyId]
  )

  const processes = useMemo(
    () => allProcesses.filter((p) => !p.company_id || p.company_id === activeCompanyId),
    [allProcesses, activeCompanyId]
  )

  return {
    macroprocesses,
    processes,
    levelDefinitions,
    loading: false,

    // Filtered queries (scoped to active company)
    getMacroByCategory: (cat: string) =>
      macroprocesses
        .filter((m) => m.category === cat)
        .sort((a, b) => a.sort_order - b.sort_order),
    getProcessesByMacro: (macroId: string) =>
      processes.filter((p) => p.macroprocess_id === macroId && !p.parent_process_id)
        .sort((a, b) => a.sort_order - b.sort_order),
    getSubprocesses: (processId: string) =>
      processes.filter((p) => p.parent_process_id === processId)
        .sort((a, b) => a.sort_order - b.sort_order),

    // CRUD (company_id is auto-set by the store)
    addMacroprocess,
    updateMacroprocess,
    deleteMacroprocess,
    reorderMacroprocesses,
    moveMacroprocessCategory,
    addProcess,
    updateProcess,
    deleteProcess,
    reorderProcesses,

    // Level info
    processLevelCount: company?.process_level_count || 3,
    processLevelNames,
    getLevelName: (level: number) =>
      processLevelNames.find((l) => l.level_number === level)?.name || `Nivel ${level}`,
  }
}
