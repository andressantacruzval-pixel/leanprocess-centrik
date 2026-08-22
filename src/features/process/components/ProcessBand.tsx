import { useRef, useState, useEffect } from 'react'
import { Plus, BarChart3, Users, Wrench, ChevronLeft, ChevronRight } from 'lucide-react'
import { PROCESS_CATEGORIES } from '@/lib/constants'
import type { Macroprocess } from '@/types'
import { ProcessCard } from './ProcessCard'

const CATEGORY_ICONS = {
  estrategico: BarChart3,
  productivo: Users,
  apoyo: Wrench,
} as const

interface ProcessBandProps {
  category: 'estrategico' | 'productivo' | 'apoyo'
  macroprocesses: Macroprocess[]
  getChildCount: (macroId: string) => number
  levelName: string
  onAddMacro: () => void
  onDrillDown: (macroId: string) => void
  onEditMacro: (macro: Macroprocess) => void
  onDeleteMacro: (id: string) => void
  onReorder: (category: string, ids: string[]) => void
  onMoveCategory: (id: string, newCategory: 'estrategico' | 'productivo' | 'apoyo') => void
  onOrderChanged?: () => void
}

export function ProcessBand({
  category,
  macroprocesses,
  getChildCount,
  levelName,
  onAddMacro,
  onDrillDown,
  onEditMacro,
  onDeleteMacro,
  onReorder,
  onMoveCategory,
  onOrderChanged,
}: ProcessBandProps) {
  const config = PROCESS_CATEGORIES[category]
  const Icon = CATEGORY_ICONS[category]
  const dragItem = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [bandDragOver, setBandDragOver] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScrollState = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  // Sin el `resize`, al rotar el movil o estrechar la ventana las flechas se quedaban
  // con el estado del ancho anterior: aparecian sin nada que desplazar, o faltaban
  // teniendo tarjetas fuera de vista.
  useEffect(() => {
    checkScrollState()
    window.addEventListener('resize', checkScrollState)
    return () => window.removeEventListener('resize', checkScrollState)
  }, [macroprocesses])

  // Casi una pantalla por pulsacion. Antes eran 220px fijos, que ya no coincidian con
  // el ancho real de la tarjeta y dejaban una franja cortada en cada salto.
  const scrollCards = (signo: 1 | -1) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: signo * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragItem.current = id
    e.dataTransfer.effectAllowed = 'move'
    // Store both the ID and the source category for cross-band drops
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.setData('application/x-source-category', category)
    // Make the drag image slightly transparent
    const el = e.currentTarget as HTMLElement
    el.style.opacity = '0.5'
    setTimeout(() => {
      el.style.opacity = '1'
    }, 0)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(null)
    setBandDragOver(false)
    const sourceId = e.dataTransfer.getData('text/plain')
    const sourceCategory = e.dataTransfer.getData('application/x-source-category')
    if (!sourceId || sourceId === targetId) return

    // Cross-category move
    if (sourceCategory && sourceCategory !== category) {
      onMoveCategory(sourceId, category)
      onOrderChanged?.()
      dragItem.current = null
      return
    }

    // Same-category reorder
    const ids = macroprocesses.map((m) => m.id)
    const sourceIdx = ids.indexOf(sourceId)
    const targetIdx = ids.indexOf(targetId)
    if (sourceIdx < 0 || targetIdx < 0) return

    ids.splice(sourceIdx, 1)
    ids.splice(targetIdx, 0, sourceId)
    onReorder(category, ids)
    onOrderChanged?.()
    dragItem.current = null
  }

  // Band-level drop (for dropping onto empty area or between cards)
  const handleBandDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setBandDragOver(true)
  }

  const handleBandDragLeave = (e: React.DragEvent) => {
    // Only clear if we actually left the band area
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const { clientX, clientY } = e
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      setBandDragOver(false)
    }
  }

  const handleBandDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setBandDragOver(false)
    setDragOver(null)
    const sourceId = e.dataTransfer.getData('text/plain')
    const sourceCategory = e.dataTransfer.getData('application/x-source-category')
    if (!sourceId) return

    // Cross-category: move to this band (appends at end)
    if (sourceCategory && sourceCategory !== category) {
      onMoveCategory(sourceId, category)
      onOrderChanged?.()
    }
    // Same-category drop on empty area — no-op (already in this band)
    dragItem.current = null
  }

  const handleDragEnter = (id: string) => {
    if (dragItem.current && dragItem.current !== id) {
      setDragOver(id)
    }
  }

  // Colores opacos que equivalen a bg-[color]-500/10 sobre #070b14
  // Usar opaco garantiza que el scroll canvas de overflow-x-auto no quede blanco
  const bandBg = category === 'estrategico'
    ? 'bg-[#0c172b]'
    : category === 'productivo'
    ? 'bg-[#071c27]'
    : 'bg-[#17122b]'

  return (
    <div
      className={`rounded-xl overflow-hidden border bg-[#070b14] transition-colors duration-200 ${
        bandDragOver
          ? 'border-cyan-400/60 border-dashed shadow-[inset_0_0_20px_rgba(34,211,238,0.08)]'
          : 'border-white/5'
      }`}
    >
      <div className="flex min-h-[140px]">
        {/* Vertical category label */}
        <div
          className="w-9 sm:w-12 flex-shrink-0 flex flex-col items-center justify-center gap-2"
          style={{ backgroundColor: config.color }}
        >
          <Icon size={18} className="text-white" />
          <span
            className="text-white text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
            style={{
              writingMode: 'vertical-lr',
              transform: 'rotate(180deg)',
            }}
          >
            {config.label + 's'}
          </span>
        </div>

        {/* Cards + Agregar: scroll area a la izquierda, botón fijo a la derecha */}
        <div className="flex-1 flex min-w-0">
          {/* `relative` envolviendo SOLO el área scrollable: así los ◀▶ se anclan a los
              bordes de lo que de verdad se desplaza. Antes colgaban de la banda entera
              y compensaban a mano el ancho de la etiqueta vertical (`left-12`) y el del
              botón Agregar — dos números que había que mantener en sincronía y que se
              descuadran en cuanto cualquiera de los dos cambia de ancho. */}
          <div className="relative flex-1 min-w-0 flex">
            {/* Área scrollable — solo las cards */}
            <div
              ref={scrollRef}
              className={`flex-1 min-w-0 p-3 sm:p-4 flex items-center gap-3 overflow-x-auto ${bandBg}`}
              onScroll={checkScrollState}
              onDragOver={handleBandDragOver}
              onDragLeave={handleBandDragLeave}
              onDrop={handleBandDrop}
            >
              {macroprocesses.map((macro) => (
                <div
                  key={macro.id}
                  onDragEnter={() => handleDragEnter(macro.id)}
                  onDragLeave={() => setDragOver(null)}
                  className={`transition-transform duration-150 ${
                    dragOver === macro.id ? 'scale-105' : ''
                  }`}
                >
                  <ProcessCard
                    macro={macro}
                    childCount={getChildCount(macro.id)}
                    levelName={levelName}
                    onDrillDown={() => onDrillDown(macro.id)}
                    onEdit={() => onEditMacro(macro)}
                    onDelete={() => onDeleteMacro(macro.id)}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                </div>
              ))}
            </div>

            {/* Botones de navegación — fuera del div con scroll para que el canvas
                de desplazamiento no se los lleve */}
            {canScrollLeft && (
              <button
                onClick={() => scrollCards(-1)}
                aria-label="Desplazar a la izquierda"
                data-export-hide
                className="absolute left-0 top-0 bottom-0 w-8 z-10 flex items-center justify-center
                           bg-gradient-to-r from-black/50 to-transparent hover:from-black/70
                           text-white/60 hover:text-white transition-all"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {canScrollRight && (
              <button
                onClick={() => scrollCards(1)}
                aria-label="Desplazar a la derecha"
                data-export-hide
                className="absolute right-0 top-0 bottom-0 w-8 z-10 flex items-center justify-center
                           bg-gradient-to-l from-black/50 to-transparent hover:from-black/70
                           text-white/60 hover:text-white transition-all"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          {/* Botón "Agregar" — fuera del scroll, siempre visible. `data-export-hide`
              lo excluye de las exportaciones (imagen/PDF): es un control de edición,
              no parte del mapa. */}
          <div data-export-hide className={`flex-shrink-0 p-3 sm:p-4 flex items-center border-l border-white/[0.04] ${bandBg}`}>
            <button
              onClick={onAddMacro}
              className="w-16 sm:w-20 min-h-[80px] rounded-lg border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1.5
                         transition-colors duration-200 hover:border-cyan-500 hover:bg-cyan-500/10 group"
            >
              <Plus size={20} className="text-white/30 group-hover:text-cyan-400 transition-colors" />
              <span className="text-xs text-white/30 group-hover:text-cyan-400 transition-colors">
                Agregar
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
