import { toBlob, toSvg, toCanvas } from 'html-to-image'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import { useAnalyticsStore } from '@/stores/analyticsStore'

// Exportación del mapa de procesos (imagen PNG/SVG) y de un PDF que junta el
// mapa con el reporte de inventario y sus gráficos. Usa html-to-image (render
// por el navegador) porque html2canvas no entiende los colores oklch de
// Tailwind 4 y saldría en negro.

const BG = '#0b1220'
const IMG_OPTS = { backgroundColor: BG, pixelRatio: 2, cacheBust: true }

export type MapImageFormat = 'png' | 'svg'

export async function exportMapImage(node: HTMLElement, format: MapImageFormat, name = 'mapa-de-procesos') {
  if (format === 'png') {
    const blob = await toBlob(node, IMG_OPTS)
    if (blob) saveAs(blob, `${name}.png`)
  } else {
    // toSvg devuelve un data URL; lo convertimos a Blob para guardarlo como .svg
    const dataUrl = await toSvg(node, { backgroundColor: BG, cacheBust: true })
    const blob = await (await fetch(dataUrl)).blob()
    saveAs(blob, `${name}.svg`)
  }
  useAnalyticsStore.getState().trackEvent('export', `process-map-${format}`)
}

// ─── PDF: mapa + inventario ────────────────────────────────────────────────

interface PdfMeta { company: string; generatedBy?: string | null }

function header(pdf: jsPDF, title: string, sub: string) {
  const w = pdf.internal.pageSize.getWidth()
  pdf.setFillColor(27, 42, 74); pdf.rect(0, 0, w, 20, 'F')
  pdf.setFillColor(37, 99, 235); pdf.rect(0, 19.2, w, 0.8, 'F')
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(13); pdf.setFont('helvetica', 'bold')
  pdf.text(title, 10, 10)
  pdf.setTextColor(156, 163, 175); pdf.setFontSize(8); pdf.setFont('helvetica', 'normal')
  pdf.text(sub, 10, 16)
}

function footer(pdf: jsPDF, left: string) {
  const w = pdf.internal.pageSize.getWidth(), h = pdf.internal.pageSize.getHeight()
  pdf.setFillColor(27, 42, 74); pdf.rect(0, h - 8, w, 8, 'F')
  pdf.setFontSize(7); pdf.setTextColor(156, 163, 175)
  pdf.text(left, 10, h - 3)
  pdf.text(`Pagina ${pdf.getCurrentPageInfo().pageNumber}`, w - 10, h - 3, { align: 'right' })
}

// Añade un canvas (posiblemente muy alto) troceándolo en páginas del PDF.
function addCanvasPaged(pdf: jsPDF, canvas: HTMLCanvasElement, title: string, sub: string, foot: string, isFirst: boolean) {
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 8, headerH = 24, footerH = 10
  const availW = pageW - margin * 2
  const availH = pageH - headerH - footerH
  const mmPerPx = availW / canvas.width
  const sliceHpx = Math.max(1, Math.floor(availH / mmPerPx))
  let y = 0, page = 0
  while (y < canvas.height) {
    if (!isFirst || page > 0) pdf.addPage()
    const sh = Math.min(sliceHpx, canvas.height - y)
    const slice = document.createElement('canvas')
    slice.width = canvas.width; slice.height = sh
    slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, sh, 0, 0, canvas.width, sh)
    header(pdf, title, page > 0 ? `${sub} (cont.)` : sub)
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, headerH, availW, sh * mmPerPx)
    footer(pdf, foot)
    y += sh; page++
  }
}

export async function exportMapAndInventoryPdf(mapNode: HTMLElement, inventoryNode: HTMLElement | null, meta: PdfMeta) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const date = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' })
  const foot = meta.generatedBy ? `${meta.company} | Generado por: ${meta.generatedBy}` : meta.company

  const mapCanvas = await toCanvas(mapNode, IMG_OPTS)
  addCanvasPaged(pdf, mapCanvas, `Mapa de Procesos — ${meta.company}`, date, foot, true)

  if (inventoryNode) {
    const invCanvas = await toCanvas(inventoryNode, IMG_OPTS)
    addCanvasPaged(pdf, invCanvas, `Inventario de Procesos — ${meta.company}`, date, foot, false)
  }

  pdf.save(`Lean_Process_mapa_inventario_${Date.now()}.pdf`)
  useAnalyticsStore.getState().trackEvent('export', 'process-map-pdf')
}
