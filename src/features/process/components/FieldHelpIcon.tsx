import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

interface FieldHelpIconProps {
  text: string
  position?: 'top' | 'bottom'
}

interface Coords {
  top: number
  left: number
  placement: 'top' | 'bottom'
}

const TOOLTIP_W = 240
const TOOLTIP_MARGIN = 8
const GAP = 6
const ESTIMATED_H = 80

export function FieldHelpIcon({ text, position = 'top' }: FieldHelpIconProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const openTimeoutRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const tooltipH = tooltipRef.current?.offsetHeight ?? ESTIMATED_H
    const fitsTop = rect.top - tooltipH - GAP - TOOLTIP_MARGIN >= 0
    const fitsBottom = rect.bottom + tooltipH + GAP + TOOLTIP_MARGIN <= window.innerHeight
    let placement: 'top' | 'bottom' = position
    if (placement === 'top' && !fitsTop && fitsBottom) placement = 'bottom'
    else if (placement === 'bottom' && !fitsBottom && fitsTop) placement = 'top'

    const centerX = rect.left + rect.width / 2 - TOOLTIP_W / 2
    const left = Math.min(
      Math.max(centerX, TOOLTIP_MARGIN),
      window.innerWidth - TOOLTIP_W - TOOLTIP_MARGIN
    )
    const top = placement === 'top' ? rect.top - tooltipH - GAP : rect.bottom + GAP

    setCoords({ top, left, placement })
  }, [isOpen, position, text])

  useEffect(() => {
    if (!isOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        tooltipRef.current?.contains(target)
      ) {
        return
      }
      setIsOpen(false)
    }
    const handleScroll = () => setIsOpen(false)
    const handleResize = () => setIsOpen(false)

    document.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      if (openTimeoutRef.current !== null) {
        window.clearTimeout(openTimeoutRef.current)
      }
    }
  }, [])

  const handleMouseEnter = () => {
    if (openTimeoutRef.current !== null) window.clearTimeout(openTimeoutRef.current)
    openTimeoutRef.current = window.setTimeout(() => setIsOpen(true), 150)
  }

  const handleMouseLeave = () => {
    if (openTimeoutRef.current !== null) {
      window.clearTimeout(openTimeoutRef.current)
      openTimeoutRef.current = null
    }
    setIsOpen(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsOpen((prev) => !prev)
  }

  const tooltipNode =
    isOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              width: TOOLTIP_W,
              visibility: coords ? 'visible' : 'hidden',
            }}
            className="z-[1000] p-2 rounded-md bg-slate-900/95 border border-gray-200 shadow-lg text-xs leading-snug text-gray-800 whitespace-normal pointer-events-none"
          >
            {text}
          </div>,
          document.body
        )
      : null

  return (
    <span className="inline-flex" onMouseLeave={handleMouseLeave}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Más información"
        aria-expanded={isOpen}
        onMouseEnter={handleMouseEnter}
        onClick={handleClick}
        className="inline-flex items-center justify-center p-2 -m-2 text-gray-500 hover:text-gray-700 transition-colors cursor-help"
      >
        <Info className="w-3 h-3" />
      </button>
      {tooltipNode}
    </span>
  )
}
