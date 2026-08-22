import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { identityMigration } from '@/utils/storeUtils'
import type { MapBrand } from '@/utils/mapSvg'

// Configuración de EXPORTACIÓN del mapa de procesos (paleta, tema y composición).
// Se elige una vez en la pantalla de exportación y queda guardada (localStorage);
// se puede editar cuando se quiera. No guarda datos del mapa — esos viven en los
// stores de procesos; aquí solo la "marca" del entregable.

export interface MapPreset { id: string; name: string; tag: string; cEst: string; cPro: string; cApo: string; accent: string }

export const MAP_PRESETS: MapPreset[] = [
  { id: 'smart', name: 'Smart Process', tag: 'Marca LeanProcess', cEst: '#4FD1C5', cPro: '#5FD35E', cApo: '#6BB8E8', accent: '#F2A81D' },
  { id: 'corp', name: 'Corporativo', tag: 'Azul institucional', cEst: '#2E6FB7', cPro: '#20A4A0', cApo: '#8FA3BC', accent: '#E8A33D' },
  { id: 'exec', name: 'Ejecutivo', tag: 'Sobrio para directorio', cEst: '#4A6FA5', cPro: '#C9A227', cApo: '#8C97A8', accent: '#3F8F6E' },
  { id: 'indus', name: 'Industrial', tag: 'Planta y operaciones', cEst: '#5B7DB1', cPro: '#F2A81D', cApo: '#7E8C99', accent: '#E2574C' },
  { id: 'salud', name: 'Salud', tag: 'Clínicas y hospitales', cEst: '#2BB6A3', cPro: '#4C9BE8', cApo: '#9AA9BC', accent: '#F06A94' },
  { id: 'fin', name: 'Financiero', tag: 'Banca y seguros', cEst: '#1F6F8B', cPro: '#1BA88B', cApo: '#A8B2C1', accent: '#D4A22F' },
  { id: 'tech', name: 'Tecnología', tag: 'Software y servicios TI', cEst: '#8B7CF6', cPro: '#22C3A6', cApo: '#60A5FA', accent: '#F59E0B' },
  { id: 'mono', name: 'Escala de gris', tag: 'Informes en blanco y negro', cEst: '#5B6B78', cPro: '#2F3E48', cApo: '#9BA9B4', accent: '#6E7B85' },
]

interface MapExportState extends MapBrand {
  preset: string
  scope: string
  version: string
  applyPreset: (id: string) => void
  setBrand: (patch: Partial<MapBrand>) => void
  setMeta: (patch: { scope?: string; version?: string }) => void
}

const DEFAULT = MAP_PRESETS[0]

export const useMapExportStore = create<MapExportState>()(
  persist(
    (set) => ({
      preset: DEFAULT.id,
      cEst: DEFAULT.cEst, cPro: DEFAULT.cPro, cApo: DEFAULT.cApo, accent: DEFAULT.accent,
      theme: 'dark',
      showHeader: true, showFooter: true, showClient: true, showNums: true,
      scope: '', version: '1.0',
      applyPreset: (id) => {
        const p = MAP_PRESETS.find((x) => x.id === id)
        if (!p) return
        set({ preset: id, cEst: p.cEst, cPro: p.cPro, cApo: p.cApo, accent: p.accent })
      },
      // Tocar un color a mano rompe la asociación con el preset (queda "personalizado").
      setBrand: (patch) => set((s) => ({ ...s, ...patch, preset: ('cEst' in patch || 'cPro' in patch || 'cApo' in patch || 'accent' in patch) ? 'custom' : s.preset })),
      setMeta: (patch) => set((s) => ({ ...s, ...patch })),
    }),
    {
      name: 'lean-process-map-export',
      version: 1,
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
