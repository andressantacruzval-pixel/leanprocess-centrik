import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react'
import type { DateRange } from '@/stores/analyticsStore'

interface Props {
  range: DateRange
  customFrom: string   // 'YYYY-MM-DD' o ''
  customTo: string     // 'YYYY-MM-DD' o ''
  onSelect: (range: DateRange, from?: string, to?: string) => void
}

const SHORTCUTS: { value: DateRange; label: string }[] = [
  { value: '7d',  label: 'Últimos 7 días'  },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '90d', label: 'Últimos 90 días' },
  { value: 'all', label: 'Todo el período' },
]

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function toStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function displayLabel(range: DateRange, from: string, to: string): string {
  if (range === '7d')  return 'Últimos 7 días'
  if (range === '30d') return 'Últimos 30 días'
  if (range === '90d') return 'Últimos 90 días'
  if (range === 'all') return 'Todo el período'
  if (from && to) {
    const fmt = (s: string) => s.slice(5).replace('-', '/')
    return `${fmt(from)} — ${fmt(to)}`
  }
  if (from) return `Desde ${from.slice(5).replace('-', '/')}`
  return 'Seleccionar rango'
}

export function DateRangePicker({ range, customFrom, customTo, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [picking, setPicking] = useState<string | null>(null) // primer clic

  const today = toStr(new Date())
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setPicking(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Genera las celdas del mes
  function buildCells(): (string | null)[] {
    const first = new Date(viewYear, viewMonth, 1)
    const dow = (first.getDay() + 6) % 7 // 0=Lun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: (string | null)[] = Array(dow).fill(null)
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(toStr(new Date(viewYear, viewMonth, d)))
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function handleDayClick(day: string) {
    if (!picking) {
      setPicking(day)
    } else {
      const [from, to] = day < picking ? [day, picking] : [picking, day]
      onSelect('custom', from, to)
      setPicking(null)
      setOpen(false)
    }
  }

  function inRange(day: string): boolean {
    const from = picking ?? customFrom
    const to   = picking ? (hover ?? day) : customTo
    if (!from || !to) return false
    const lo = from < to ? from : to
    const hi = from < to ? to   : from
    return day > lo && day < hi
  }

  function isStart(day: string) { return day === (picking ?? customFrom) }
  function isEnd(day: string)   { return !picking && day === customTo }

  const cells = buildCells()

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
          whitespace-nowrap
          ${open || range === 'custom'
            ? 'bg-primary-50 text-primary-600 border-primary-200'
            : 'text-gray-500 bg-gray-50 border-gray-100 hover:text-gray-700 hover:bg-gray-50'
          }`}
      >
        <CalendarRange size={13} />
        {displayLabel(range, customFrom, customTo)}
      </button>

      {/* Popover — `w-44` + `w-64` + padding sumaban ~448px anclados a la derecha: en
          una pantalla de 375px se salian 73px por la izquierda. Apilado en movil. */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-2xl flex flex-col sm:flex-row overflow-hidden">
          {/* Shortcuts */}
          <div className="flex flex-col border-b sm:border-b-0 sm:border-r border-gray-100 py-2 w-full sm:w-44">
            {SHORTCUTS.map(s => (
              <button
                key={s.value}
                onClick={() => { onSelect(s.value); setOpen(false); setPicking(null) }}
                className={`px-4 py-2.5 text-xs text-left transition-colors
                  ${range === s.value && !picking
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Calendario */}
          <div className="p-4 w-full sm:w-64">
            {/* Nav */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-medium text-gray-700">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Días semana */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[10px] text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Celdas */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />
                const start  = isStart(day)
                const end    = isEnd(day)
                const inRng  = inRange(day)
                const isToday = day === today
                const future = day > today

                let cls = 'text-center text-[11px] py-1 cursor-pointer rounded-lg transition-all select-none '
                if (start || end) {
                  cls += 'bg-primary-500 text-white font-semibold '
                } else if (inRng) {
                  cls += 'bg-primary-50 text-primary-700 '
                } else if (isToday) {
                  cls += 'text-primary-600 font-medium hover:bg-gray-50 '
                } else if (future) {
                  cls += 'text-gray-300 cursor-not-allowed '
                } else {
                  cls += 'text-gray-600 hover:bg-gray-50 hover:text-gray-800 '
                }

                return (
                  <div
                    key={day}
                    className={cls}
                    onClick={() => !future && handleDayClick(day)}
                    onMouseEnter={() => picking && setHover(day)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {day.slice(8)}
                  </div>
                )
              })}
            </div>

            {/* Hint */}
            <p className="text-[10px] text-gray-400 text-center mt-3">
              {picking ? 'Haz clic en la fecha de fin' : 'Haz clic en la fecha de inicio'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
