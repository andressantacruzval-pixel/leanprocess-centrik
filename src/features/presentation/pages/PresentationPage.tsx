import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X, Maximize } from 'lucide-react'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { useCompanyStore } from '@/stores/companyStore'
import { useProcessHealth } from '@/hooks/useProcessHealth'
import type { Slide } from '../presentationTypes'
import { exportPresentationToPptx } from '../pptxExport'
import { SlideRenderer } from '../slides/SlideRenderer'
import { PantallaEstrecha } from '@/components/ui/PantallaEstrecha'
import { PreparationScreen } from '../components/PreparationScreen'

export default function PresentationPage() {
  const navigate = useNavigate()
  const [preparing, setPreparing] = useState(true)
  const [current, setCurrent] = useState(0)
  const [fade, setFade] = useState(true)

  const { macroprocesses, processes, risks, indicators, analyses, procedures } = useCompanyScopedData()
  const healthMap = useProcessHealth()
  const company = useCompanyStore((s) => s.company)

  // ── Build all slides ──────────────────────────────────────────────────

  const allSlides = useMemo<Slide[]>(() => {
    const s: Slide[] = []

    s.push({ type: 'title', title: 'Lean Process' })
    s.push({ type: 'map-overview', title: 'Mapa de Procesos' })

    macroprocesses.forEach((m) => {
      s.push({
        type: 'macroprocess',
        title: m.name,
        data: { macro: m, children: processes.filter((p) => p.macroprocess_id === m.id) },
      })
    })

    if (risks.length > 0) s.push({ type: 'risk-heatmap', title: 'Mapa de Calor de Riesgos' })
    if (indicators.length > 0) s.push({ type: 'kpi-dashboard', title: 'Indicadores de Gestion' })
    if (Object.values(analyses).flat().length > 0) s.push({ type: 'value-analysis', title: 'Analisis de Valor' })
    if (processes.length > 0) s.push({ type: 'coverage', title: 'Cobertura por Proceso' })
    s.push({ type: 'org-stats', title: 'Estadisticas Organizacionales' })
    s.push({ type: 'summary', title: 'Resumen Ejecutivo' })

    return s
  }, [macroprocesses, processes, risks, indicators, analyses])

  // ── Slide selection state ─────────────────────────────────────────────

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() =>
    new Set(allSlides.map((_, i) => i)),
  )

  useEffect(() => {
    setSelectedIndices(new Set(allSlides.map((_, i) => i)))
  }, [allSlides])

  const toggleSlide = (idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIndices.size === allSlides.length) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(allSlides.map((_, i) => i)))
    }
  }

  const selectedCount = selectedIndices.size
  const canStart = selectedCount >= 2

  const slides = useMemo<Slide[]>(
    () => allSlides.filter((_, i) => selectedIndices.has(i)),
    [allSlides, selectedIndices],
  )

  const total = slides.length

  // ── Navigation ────────────────────────────────────────────────────────

  const goTo = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= total) return
      setFade(false)
      setTimeout(() => {
        setCurrent(idx)
        setFade(true)
      }, 150)
    },
    [total],
  )

  const next = useCallback(() => goTo(current + 1), [goTo, current])
  const prev = useCallback(() => goTo(current - 1), [goTo, current])

  useEffect(() => {
    if (preparing) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') setPreparing(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev, preparing])

  const handleSlideAreaClick = (e: React.MouseEvent) => {
    const x = e.clientX / window.innerWidth
    if (x > 0.5) next()
    else prev()
  }

  // Safari en iOS no implementa `requestFullscreen` sobre el documento: el boton
  // existia y no hacia nada. Se oculta donde no esta disponible.
  const hayPantallaCompleta =
    typeof document !== 'undefined' && !!document.documentElement.requestFullscreen

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  }

  // ── Export state ──────────────────────────────────────────────────────

  const [exporting, setExporting] = useState<'pptx' | null>(null)

  // ── PPTX Export ───────────────────────────────────────────────────────

  const exportToPptx = useCallback(async () => {
    setExporting('pptx')
    try {
      await exportPresentationToPptx(slides, {
        macroprocesses,
        processes,
        risks,
        indicators,
        analyses,
        procedures,
        healthMap,
      }, company?.name)
    } catch (err) {
      console.error('Error exporting PPTX:', err)
    } finally {
      setExporting(null)
    }
  }, [slides, macroprocesses, processes, risks, indicators, analyses, procedures, healthMap, company])

  // ── Render: Preparation screen ────────────────────────────────────────

  if (preparing) {
    return (
      <PreparationScreen
        allSlides={allSlides}
        selectedIndices={selectedIndices}
        selectedCount={selectedCount}
        canStart={canStart}
        exporting={exporting}
        toggleSlide={toggleSlide}
        toggleAll={toggleAll}
        exportToPptx={exportToPptx}
        onStart={() => { setCurrent(0); setPreparing(false) }}
        onBack={() => navigate(-1)}
      />
    )
  }

  // ── Render: Full-screen presentation ─────────────────────────────────

  const slide = slides[current]

  return (
    <div className="fixed inset-0 z-50 bg-[#070b14] select-none overflow-hidden">
      <div className="md:hidden h-full">
        <PantallaEstrecha
          que="La presentacion"
          motivo="Las diapositivas estan compuestas para pantalla ancha. Puedes prepararlas y exportarlas a PowerPoint desde aqui; para reproducirlas, abrela en una tablet u ordenador."
        />
      </div>

      <div className="hidden md:block h-full" onClick={handleSlideAreaClick}>
      {/* ESC hint */}
      <button
        onClick={(e) => { e.stopPropagation(); setPreparing(true) }}
        className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition text-sm"
      >
        <X className="w-4 h-4" />
        ESC
      </button>

      {/* Fullscreen button */}
      {hayPantallaCompleta && (
      <button
        onClick={(e) => { e.stopPropagation(); toggleFullscreen() }}
        className="absolute top-4 right-28 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition text-sm"
      >
        <Maximize className="w-4 h-4" />
      </button>
      )}

      {/* Prev arrow */}
      {current > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Next arrow */}
      {current < total - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Slide content */}
      <div
        data-slide-content
        className={`w-full h-full transition-opacity duration-150 ${fade ? 'opacity-100' : 'opacity-0'}`}
      >
        {slide && (
          <SlideRenderer
            slide={slide}
            macroprocesses={macroprocesses}
            processes={processes}
            risks={risks}
            indicators={indicators}
            analyses={analyses}
            procedures={procedures}
            healthMap={healthMap}
          />
        )}
      </div>

      {/* Progress bar + counter */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="flex justify-center pb-2">
          <span className="text-xs text-gray-500">
            {current + 1} / {total}
          </span>
        </div>
        <div className="h-1 bg-white/5">
          <div
            className="h-full bg-cyan-500 transition-all duration-300"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
      </div>
      </div>
    </div>
  )
}
