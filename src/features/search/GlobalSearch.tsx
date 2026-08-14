import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Map as MapIcon, ShieldAlert, TrendingUp, BookOpen, Building2, X } from 'lucide-react'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { useCompanyStore } from '@/stores/companyStore'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { isDocumentable } from '@/lib/processLevels'
import type { ResultCategory, SearchResult } from './searchConstants'
import {
  CATEGORY_META,
  BADGE_COLORS,
  PATH_DISPLAY_NAMES,
  PATH_ICONS,
  QUICK_ACTIONS,
  MAX_RESULTS,
  fuzzyMatch,
} from './searchConstants'

// ── Re-export SearchTrigger for backward compatibility ────────────────────
export { SearchTrigger } from './SearchTrigger'

// ── GlobalSearch (modal) ──────────────────────────────────────────────────

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { macroprocesses, processes, risks, indicators, procedures } = useCompanyScopedData()
  const orgUnits = useCompanyStore((s) => s.orgUnits)
  const processLevelCount = useCompanyStore((s) => s.company?.process_level_count ?? 3)
  const analyticsEvents = useAnalyticsStore((s) => s.events)

  // ── Global keyboard shortcut ───────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reset del estado al abrir el modal de búsqueda. setState en effect es la
  // forma idiomática para sincronizar con el toggle externo de `open`.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setQuery('')
      setDebouncedQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(timer)
  }, [query])

  // ── Recent & Frequent pages ────────────────────────────────────────────

  const recentPages = useMemo<SearchResult[]>(() => {
    const pageViews = analyticsEvents.filter((e) => e.type === 'page_view')
    const seen = new Set<string>()
    const results: SearchResult[] = []
    for (let i = pageViews.length - 1; i >= 0 && results.length < 5; i--) {
      const path = pageViews[i].feature
      if (seen.has(path) || !PATH_DISPLAY_NAMES[path]) continue
      seen.add(path)
      results.push({
        id: `recent-${path}`,
        category: 'Recientes',
        title: PATH_DISPLAY_NAMES[path],
        description: path,
        path,
        icon: PATH_ICONS[path] || MapIcon,
      })
    }
    return results
  }, [analyticsEvents])

  const frequentPages = useMemo<SearchResult[]>(() => {
    const counts: Record<string, number> = {}
    for (const e of analyticsEvents) {
      if (e.type === 'page_view' && PATH_DISPLAY_NAMES[e.feature]) {
        counts[e.feature] = (counts[e.feature] || 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, count]) => ({
        id: `frequent-${path}`,
        category: 'Frecuentes' as ResultCategory,
        title: PATH_DISPLAY_NAMES[path],
        description: `${count} visitas`,
        path,
        icon: PATH_ICONS[path] || MapIcon,
      }))
  }, [analyticsEvents])

  // ── Build results ──────────────────────────────────────────────────────

  const results = useMemo<SearchResult[]>(() => {
    const q = debouncedQuery.trim()

    if (!q) return [...recentPages, ...frequentPages]

    const scored: { result: SearchResult; score: number }[] = []

    for (const action of QUICK_ACTIONS) {
      const score = fuzzyMatch(action.label, q)
      if (score > 0) {
        scored.push({
          result: {
            id: action.id,
            category: 'Acciones',
            title: action.label,
            description: PATH_DISPLAY_NAMES[action.path] || action.path,
            path: action.path,
            icon: action.icon,
          },
          score: score + 1,
        })
      }
    }

    for (const p of processes) {
      const nameScore = fuzzyMatch(p.name, q)
      const codeScore = p.code ? fuzzyMatch(p.code, q) : 0
      const descScore = p.description ? fuzzyMatch(p.description, q) * 0.5 : 0
      const best = Math.max(nameScore, codeScore, descScore)
      if (best > 0) {
        const macro = macroprocesses.find((m) => m.id === p.macroprocess_id)
        scored.push({
          result: {
            id: p.id,
            category: 'Procesos',
            title: p.name,
            description: [p.code, p.process_type, macro?.name].filter(Boolean).join(' \u00B7 '),
            // Un proceso agrupador no se documenta: se lleva a su ficha, no al
            // diagramador. Ver @/lib/processLevels.
            path: isDocumentable(p, processLevelCount)
              ? `/app/process/${p.id}/characterization`
              : `/app/process/${p.id}`,
            icon: MapIcon,
          },
          score: best,
        })
      }
    }

    for (const r of risks) {
      const titleScore = fuzzyMatch(r.title, q)
      const eventScore = fuzzyMatch(r.riskEvent, q)
      const catScore = fuzzyMatch(r.category, q) * 0.5
      const best = Math.max(titleScore, eventScore, catScore)
      if (best > 0) {
        const proc = processes.find((p) => p.id === r.process_id)
        scored.push({
          result: {
            id: r.id,
            category: 'Riesgos',
            title: r.title,
            description: [r.category, proc?.name].filter(Boolean).join(' \u00B7 '),
            path: `/app/process/${r.process_id}/characterization`,
            icon: ShieldAlert,
          },
          score: best,
        })
      }
    }

    for (const ind of indicators) {
      const nameScore = fuzzyMatch(ind.name, q)
      const objScore = ind.description ? fuzzyMatch(ind.description, q) * 0.5 : 0
      const best = Math.max(nameScore, objScore)
      if (best > 0) {
        const proc = processes.find((p) => p.id === ind.process_id)
        scored.push({
          result: {
            id: ind.id,
            category: 'Indicadores',
            title: ind.name,
            description: [ind.description, proc?.name].filter(Boolean).join(' \u00B7 '),
            path: `/app/process/${ind.process_id}/indicators`,
            icon: TrendingUp,
          },
          score: best,
        })
      }
    }

    for (const proc of procedures) {
      const titulo = proc.data?.titulo || ''
      if (!titulo) continue
      const score = fuzzyMatch(titulo, q)
      if (score > 0) {
        const parentProc = processes.find((p) => p.id === proc.process_id)
        scored.push({
          result: {
            id: proc.id,
            category: 'Procedimientos',
            title: titulo,
            description: parentProc?.name || '',
            path: `/app/process/${proc.process_id}/procedure`,
            icon: BookOpen,
          },
          score,
        })
      }
    }

    for (const unit of orgUnits) {
      const score = fuzzyMatch(unit.name, q)
      if (score > 0) {
        scored.push({
          result: {
            id: unit.id,
            category: 'Unidades Organizacionales',
            title: unit.name,
            description: 'Estructura organizacional',
            path: '/app/org-structure',
            icon: Building2,
          },
          score,
        })
      }
    }

    scored.sort((a, b) => b.score - a.score || a.result.title.localeCompare(b.result.title))
    return scored.slice(0, MAX_RESULTS).map((s) => s.result)
  }, [debouncedQuery, processes, macroprocesses, risks, indicators, procedures, orgUnits, recentPages, frequentPages, processLevelCount])

  // Reset del activeIndex cuando cambia la lista de resultados.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setActiveIndex(0) }, [results])

  const goToResult = useCallback(
    (result: SearchResult) => { setOpen(false); navigate(result.path) },
    [navigate],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((prev) => (prev + 1) % Math.max(results.length, 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((prev) => prev <= 0 ? Math.max(results.length - 1, 0) : prev - 1); return }
      if (e.key === 'Enter' && results[activeIndex]) { e.preventDefault(); goToResult(results[activeIndex]) }
    },
    [results, activeIndex, goToResult],
  )

  useEffect(() => {
    const container = listRef.current
    if (!container) return
    const active = container.querySelector('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const grouped = useMemo(() => {
    const map = new Map<ResultCategory, { result: SearchResult; globalIdx: number }[]>()
    results.forEach((r, idx) => {
      const list = map.get(r.category) || []
      list.push({ result: r, globalIdx: idx })
      map.set(r.category, list)
    })
    return map
  }, [results])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[10vh] sm:pt-[15vh]" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="relative w-full max-w-xl max-h-[80vh] flex flex-col bg-[#0d1420] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Search input */}
        <div className="shrink-0 flex items-center gap-3 px-4 border-b border-white/10">
          <Search size={18} className="text-white/30 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar procesos, riesgos, indicadores..."
            className="flex-1 h-12 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {debouncedQuery.trim() && results.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-white/30">No se encontraron resultados</div>
          )}
          {!debouncedQuery.trim() && results.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-white/30">Escribe para buscar o navega con acciones rapidas</div>
          )}

          {Array.from(grouped.entries()).map(([category, items]) => {
            const meta = CATEGORY_META[category]
            return (
              <div key={category}>
                <div className="px-4 pt-3 pb-1.5 flex items-center gap-2">
                  <meta.icon size={12} className={meta.color} />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">{category}</span>
                </div>
                {items.map(({ result, globalIdx }) => {
                  const isActive = globalIdx === activeIndex
                  const Icon = result.icon
                  return (
                    <button
                      key={result.id}
                      data-active={isActive}
                      onClick={() => goToResult(result)}
                      onMouseEnter={() => setActiveIndex(globalIdx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isActive ? 'bg-cyan-500/10 border-l-2 border-cyan-500/30' : 'border-l-2 border-transparent hover:bg-white/5'
                      }`}
                    >
                      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-cyan-500/15' : 'bg-white/5'}`}>
                        <Icon size={15} className={isActive ? 'text-cyan-400' : 'text-white/40'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white/90 truncate">{result.title}</span>
                          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ring-1 ${BADGE_COLORS[result.category]}`}>
                            {result.category}
                          </span>
                        </div>
                        {result.description && (
                          <p className="text-xs text-white/30 truncate mt-0.5">{result.description}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer hints */}
        <div className="hidden sm:flex shrink-0 px-4 py-2.5 border-t border-white/10 items-center gap-4 text-[11px] text-white/25">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px]">Esc</kbd>
            para cerrar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px]">Enter</kbd>
            para ir
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px]">&uarr;&darr;</kbd>
            para navegar
          </span>
        </div>
      </div>
    </div>
  )
}
