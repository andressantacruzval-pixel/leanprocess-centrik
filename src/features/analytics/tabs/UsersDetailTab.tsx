import { useState, useMemo } from 'react'
import { Search, ChevronDown, UserCheck } from 'lucide-react'
import type { AdminMetrics, OnboardingUserSummary } from '@/stores/analyticsStore'
import { SectionTitle, Card } from '../components/AdminShared'
import { UserDetailPanel } from '../components/UserDetailPanel'
import { fmtNumber } from '../adminConstants'

interface Props {
  metrics: AdminMetrics
}

const PLAN_BADGE: Record<string, string> = {
  free:      'text-gray-500',
  community: 'text-primary-600',
  pro:       'text-blue-600',
  max:       'text-primary-600',
}

export function UsersDetailTab({ metrics }: Props) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<keyof OnboardingUserSummary>('topLevelProcessCount')
  const [sortAsc, setSortAsc] = useState(false)

  const users = metrics.usersWithOnboarding

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users
      .filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.companyName.toLowerCase().includes(q))
      .sort((a, b) => {
        const av = a[sortBy] as number | string
        const bv = b[sortBy] as number | string
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return sortAsc ? cmp : -cmp
      })
  }, [users, search, sortBy, sortAsc])

  const selected = useMemo(() => users.find(u => u.id === selectedId) ?? null, [users, selectedId])

  function handleSort(col: keyof OnboardingUserSummary) {
    if (sortBy === col) setSortAsc(p => !p)
    else { setSortBy(col); setSortAsc(false) }
  }

  const sortIcon = (col: keyof OnboardingUserSummary) =>
    sortBy !== col
      ? <ChevronDown size={11} className="text-gray-300" />
      : <ChevronDown size={11} className={`text-primary-600 transition-transform ${sortAsc ? 'rotate-180' : ''}`} />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <UserCheck size={16} className="text-emerald-600" />
            Usuarios con Onboarding Completado
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{users.length} usuarios — haz clic en una fila para ver sus métricas</p>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o empresa..."
            className="pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700
              placeholder-gray-400 focus:outline-none focus:border-primary-300 w-64 transition-all"
          />
        </div>
      </div>

      {/* Modal de detalle — overlay sobre toda la página */}
      {selected && (
        <UserDetailPanel user={selected} onClose={() => setSelectedId(null)} />
      )}

      {/* Tabla */}
      <Card>
        <SectionTitle>Listado ({filtered.length})</SectionTitle>
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">
            {users.length === 0 ? 'Ningún usuario ha completado el onboarding aún.' : 'Sin resultados para la búsqueda.'}
          </p>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase border-b border-gray-100">
                  <th className="text-left py-2 pr-4">Usuario</th>
                  <th className="text-left py-2 px-3">Empresa</th>
                  <th
                    className="text-right py-2 px-3 cursor-pointer hover:text-gray-600 select-none"
                    onClick={() => handleSort('plan')}
                  >
                    <span className="flex items-center justify-end gap-1">Plan {sortIcon('plan')}</span>
                  </th>
                  <th
                    className="text-right py-2 px-3 cursor-pointer hover:text-gray-600 select-none"
                    onClick={() => handleSort('macroprocessCount')}
                  >
                    <span className="flex items-center justify-end gap-1">Macro {sortIcon('macroprocessCount')}</span>
                  </th>
                  <th
                    className="text-right py-2 px-3 cursor-pointer hover:text-gray-600 select-none"
                    onClick={() => handleSort('topLevelProcessCount')}
                  >
                    <span className="flex items-center justify-end gap-1">Procesos {sortIcon('topLevelProcessCount')}</span>
                  </th>
                  <th
                    className="text-right py-2 px-3 cursor-pointer hover:text-gray-600 select-none"
                    onClick={() => handleSort('totalTokens')}
                  >
                    <span className="flex items-center justify-end gap-1">Tokens IA {sortIcon('totalTokens')}</span>
                  </th>
                  <th
                    className="text-right py-2 pl-3 cursor-pointer hover:text-gray-600 select-none"
                    onClick={() => handleSort('totalAiCostUsd')}
                  >
                    <span className="flex items-center justify-end gap-1">USD IA {sortIcon('totalAiCostUsd')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedId(u.id)}
                      className="border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50"
                    >
                      <td className="py-3 pr-4">
                        <div>
                          <p className="text-gray-800 font-medium text-sm">{u.email}</p>
                          {u.name !== u.email && (
                            <p className="text-gray-400 text-[11px] mt-0.5">{u.name}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-600 text-xs">{u.companyName}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`text-xs font-medium capitalize ${PLAN_BADGE[u.plan] ?? PLAN_BADGE.free}`}>{u.plan}</span>
                      </td>
                      <td className="py-3 px-3 text-right text-gray-600">{fmtNumber(u.macroprocessCount ?? 0)}</td>
                      <td className="py-3 px-3 text-right text-gray-600">
                        {fmtNumber((u.topLevelProcessCount ?? 0) + (u.subprocessCount ?? 0))}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-600">{fmtNumber(u.totalTokens ?? 0)}</td>
                      <td className="py-3 pl-3 text-right">
                        <span className={(u.totalAiCostUsd ?? 0) > 0 ? 'text-amber-600' : 'text-gray-400'}>
                          ${(u.totalAiCostUsd ?? 0).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
