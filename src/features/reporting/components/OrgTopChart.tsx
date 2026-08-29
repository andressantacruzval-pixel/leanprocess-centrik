import { useMemo, useState } from 'react'
import { Card, HBars, type Datum } from './reportUi'
import type { OrgLabels } from '@/hooks/useOrgLabels'

// Gráfico "top" con selector de nivel: el mismo ranking se ve por Gerencia,
// Jefatura, Área (si la empresa usa 3 niveles) o por Proceso. Un solo control
// —en vez de tres tarjetas— mantiene el tablero limpio y responde a "top por
// cada nivel de la estructura organizacional". Suma `value` (default 1 = conteo)
// agrupando por el nivel elegido y muestra el top 8.

export interface OrgTopItem {
  management?: string | null
  coordination?: string | null
  operative?: string | null
  process?: string | null
  value?: number
}

type Lvl = 'l0' | 'l1' | 'l2' | 'proc'

export function OrgTopChart({ title, sub, items, org, color = '#06b6d4' }: {
  title: string
  sub?: string
  items: OrgTopItem[]
  org: OrgLabels
  color?: string
}) {
  const [lvl, setLvl] = useState<Lvl>('l0')

  const data = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    for (const it of items) {
      const raw = lvl === 'l0' ? it.management : lvl === 'l1' ? it.coordination : lvl === 'l2' ? it.operative : it.process
      const key = (raw || '').trim() || 'Sin asignar'
      m.set(key, (m.get(key) || 0) + (it.value ?? 1))
    }
    return [...m.entries()]
      .map(([label, value]) => ({ label, value: Math.round(value), color }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [items, lvl, color])

  const tabs: { k: Lvl; label: string }[] = [
    { k: 'l0', label: org.l0 },
    { k: 'l1', label: org.l1 },
    ...(org.hasL2 ? [{ k: 'l2' as Lvl, label: org.l2 }] : []),
    { k: 'proc', label: 'Proceso' },
  ]

  const toggle = (
    <div className="flex flex-wrap gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {tabs.map((t) => (
        <button key={t.k} onClick={() => setLvl(t.k)}
          className={`px-2 py-0.5 rounded-md text-[10px] transition-colors ${lvl === t.k ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>
          {t.label}
        </button>
      ))}
    </div>
  )

  return <Card title={title} sub={sub} right={toggle}><HBars data={data} /></Card>
}
