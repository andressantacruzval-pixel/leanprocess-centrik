import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { identityMigration } from '@/utils/storeUtils'
import type { Process } from '@/types/process'
import type { StoredIndicator } from '@/stores/indicatorStore'
import { normCargo, scaleDaily, type CargoAgg } from './cargoData'

// Perfil / manual de cargo. La IA genera las partes cualitativas (objetivo,
// responsabilidades y perfil requerido, inferido de las actividades reales del
// cargo). Las métricas factuales (procesos, actividades, tiempo VA/NVA) se
// combinan en pantalla desde la analítica ya existente (computeCargos).

export interface CargoRequisitos {
  educacion: string
  experiencia: string
  conocimientos: string[]
  tecnologia: string[]
  competencias: string[]
}

export interface CargoProfile {
  cargo: string
  reportaA: string
  objetivo: string
  responsabilidades: string[]
  requisitos: CargoRequisitos
  relacionesInternas: string[]
  relacionesExternas: string[]
  indicadores: string[]
  generatedAt: string
}

// ─── Armador de contexto para la IA ────────────────────────────────────────

export interface CargoContextInput {
  agg: CargoAgg
  processes: Process[]
  indicators: StoredIndicator[]
  companyName: string
  industry?: string
}

export function buildCargoContext({ agg, processes, indicators, companyName, industry }: CargoContextInput): string {
  const procById = new Map(processes.map((p) => [p.id, p]))
  const procNames = [...agg.processes].map((id) => procById.get(id)?.name).filter(Boolean)
  const areas = [...new Set([...agg.processes].map((id) => procById.get(id)?.management).filter(Boolean))]
  const coords = [...new Set([...agg.processes].map((id) => procById.get(id)?.coordination).filter(Boolean))]
  const kpis = indicators.filter((i) => agg.processes.has(i.process_id)).map((i) => i.name).slice(0, 12)

  const actsByClass = (cls: string) => agg.activities.filter((a) => a.classification === cls).map((a) => a.activityName)
  const va = actsByClass('VA'), nva = actsByClass('NVA'), nvabn = actsByClass('NVABN')
  const sinClass = agg.activities.filter((a) => a.classification == null).map((a) => a.activityName)

  const list = (xs: string[], max = 40) => xs.slice(0, max).map((x) => `- ${x}`).join('\n') || '(ninguna)'

  return [
    `EMPRESA: ${companyName}${industry ? ` — Industria: ${industry}` : ''}`,
    `CARGO: ${agg.cargo}`,
    `PARTICIPA EN ${agg.processes.size} PROCESO(S): ${procNames.join(', ') || '(sin nombre)'}`,
    areas.length ? `GERENCIA(S): ${areas.join(', ')}` : '',
    coords.length ? `ÁREA(S): ${coords.join(', ')}` : '',
    `CARGA MENSUAL ESTIMADA: ${Math.round(scaleDaily(agg.totalDaily, 'mes', 'min'))} min/mes (VA ${Math.round(scaleDaily(agg.vaDaily, 'mes', 'min'))} · NVA ${Math.round(scaleDaily(agg.nvaDaily, 'mes', 'min'))} · NVABN ${Math.round(scaleDaily(agg.nvabnDaily, 'mes', 'min'))}).`,
    `ACTIVIDADES QUE AGREGAN VALOR (VA):\n${list(va)}`,
    `ACTIVIDADES SIN VALOR NECESARIAS (NVABN):\n${list(nvabn)}`,
    `ACTIVIDADES SIN VALOR (NVA):\n${list(nva)}`,
    sinClass.length ? `OTRAS ACTIVIDADES (sin clasificar):\n${list(sinClass)}` : '',
    kpis.length ? `INDICADORES DE SUS PROCESOS: ${kpis.join(', ')}` : '',
  ].filter(Boolean).join('\n\n')
}

// ─── Store (persistencia local; sin migración de DB) ────────────────────────

const key = (companyId: string, cargo: string) => `${companyId}::${normCargo(cargo)}`

interface CargoProfileState {
  profiles: Record<string, CargoProfile>
  getProfile: (companyId: string, cargo: string) => CargoProfile | undefined
  setProfile: (companyId: string, cargo: string, profile: CargoProfile) => void
  patchProfile: (companyId: string, cargo: string, patch: Partial<CargoProfile>) => void
  removeProfile: (companyId: string, cargo: string) => void
}

export const useCargoProfileStore = create<CargoProfileState>()(
  persist(
    (set, get) => ({
      profiles: {},
      getProfile: (companyId, cargo) => get().profiles[key(companyId, cargo)],
      setProfile: (companyId, cargo, profile) => set((s) => ({ profiles: { ...s.profiles, [key(companyId, cargo)]: profile } })),
      patchProfile: (companyId, cargo, patch) => set((s) => {
        const k = key(companyId, cargo)
        const cur = s.profiles[k]
        if (!cur) return s
        return { profiles: { ...s.profiles, [k]: { ...cur, ...patch } } }
      }),
      removeProfile: (companyId, cargo) => set((s) => {
        const next = { ...s.profiles }
        delete next[key(companyId, cargo)]
        return { profiles: next }
      }),
    }),
    { name: 'lean-process-cargo-profiles', version: 1, migrate: identityMigration() }
  )
)
