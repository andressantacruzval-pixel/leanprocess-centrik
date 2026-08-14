import pptxgen from 'pptxgenjs'
import type { Macroprocess, Process } from '@/types/process'

type PptxInstance = InstanceType<typeof pptxgen>
type PptxSlide = ReturnType<PptxInstance['addSlide']>

const CATEGORIES = ['estrategico', 'productivo', 'apoyo'] as const
type Category = typeof CATEGORIES[number]

const CAT_COLORS: Record<Category, string> = {
  estrategico: '22D3EE',
  productivo: '34D399',
  apoyo: 'FBBF24',
}
const CAT_LABELS: Record<Category, string> = {
  estrategico: 'Estratégico',
  productivo: 'Productivo',
  apoyo: 'Apoyo',
}

const SLIDE_BG = '070b14'
const SLIDE_H = 7.5
const STRIP_W = 0.65
const CONTENT_X = 0.9
const TITLE_Y = 0.25
const TITLE_H = 0.85
const CARDS_START_Y = 1.25
const CARDS_PER_ROW = 5
const MAX_PER_SLIDE = 15   // 5 cols × 3 rows
const CARD_W = 2.33
const CARD_H = 1.75
const CARD_GAP_H = 0.12
const CARD_GAP_V = 0.15

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

function renderCategorySlide(
  slide: PptxSlide,
  category: Category,
  macros: Macroprocess[],
  processes: Process[],
  pageLabel: string,
): void {
  const color = CAT_COLORS[category]
  const label = CAT_LABELS[category]

  // Franja de color izquierda (toda la altura del slide)
  slide.addShape('rect' as pptxgen.SHAPE_NAME, {
    x: 0, y: 0, w: STRIP_W, h: SLIDE_H,
    fill: { color },
    line: { color, width: 0 },
  })

  // Título de categoría
  const titleText = pageLabel ? `${label}  ${pageLabel}` : label
  slide.addText(titleText, {
    x: CONTENT_X, y: TITLE_Y, w: 12.13, h: TITLE_H,
    fontSize: 28, fontFace: 'Arial', color, bold: true, valign: 'middle',
  })

  if (macros.length === 0) {
    slide.addText('Sin macroprocesos registrados', {
      x: CONTENT_X, y: 3.0, w: 12.13, h: 1.0,
      fontSize: 16, fontFace: 'Arial', color: '374151', align: 'center', italic: true,
    })
    return
  }

  macros.forEach((macro, idx) => {
    const row = Math.floor(idx / CARDS_PER_ROW)
    const col = idx % CARDS_PER_ROW
    const cardX = CONTENT_X + col * (CARD_W + CARD_GAP_H)
    const cardY = CARDS_START_Y + row * (CARD_H + CARD_GAP_V)
    const count = processes.filter((p) => p.macroprocess_id === macro.id).length

    // Fondo de la card
    slide.addShape('rect' as pptxgen.SHAPE_NAME, {
      x: cardX, y: cardY, w: CARD_W, h: CARD_H,
      fill: { color: '131B2E' },
      line: { color, width: 0.75 },
    })

    // Nombre del macroproceso
    slide.addText(macro.name, {
      x: cardX + 0.12, y: cardY + 0.12, w: CARD_W - 0.24, h: CARD_H - 0.45,
      fontSize: 13, fontFace: 'Arial', color: 'FFFFFF', bold: true, valign: 'middle', wrap: true,
    })

    // Conteo de procesos
    slide.addText(`${count} proceso${count !== 1 ? 's' : ''}`, {
      x: cardX + 0.12, y: cardY + CARD_H - 0.38, w: CARD_W - 0.24, h: 0.32,
      fontSize: 10, fontFace: 'Arial', color: '6B7280',
    })
  })
}

export function addMapOverviewSlides(
  pptx: PptxInstance,
  firstSlide: PptxSlide,
  macroprocesses: Macroprocess[],
  processes: Process[],
): void {
  let slideCount = 0

  for (const cat of CATEGORIES) {
    const macros = macroprocesses.filter((m) => m.category === cat)
    const chunks = macros.length > 0 ? chunkArray(macros, MAX_PER_SLIDE) : [[]] as Macroprocess[][]
    const totalPages = chunks.length

    chunks.forEach((chunk, chunkIdx) => {
      const slide: PptxSlide = slideCount === 0
        ? firstSlide
        : (() => {
            const s = pptx.addSlide()
            s.background = { color: SLIDE_BG }
            return s
          })()
      slideCount++

      const pageLabel = totalPages > 1 ? `(${chunkIdx + 1}/${totalPages})` : ''
      renderCategorySlide(slide, cat, chunk, processes, pageLabel)
    })
  }
}
