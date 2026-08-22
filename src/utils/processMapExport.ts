import { toBlob, toSvg, toCanvas } from 'html-to-image'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import type { InvReportRow } from '@/features/inventory/inventoryReportData'

// Exportación del mapa de procesos (imagen PNG/SVG) y de un PDF-reporte que junta
// el mapa + los gráficos del inventario + la tabla completa del inventario. Usa
// html-to-image (render por el navegador) porque html2canvas no entiende los
// colores oklch de Tailwind 4 y saldría en negro. Los controles de edición del
// mapa (botón "Agregar", flechas) se excluyen con `data-export-hide`.

const BG = '#0b1220'
// Excluye del render cualquier elemento marcado con data-export-hide (controles
// de edición que no son parte del mapa).
const exportFilter = (node: HTMLElement) => !(node instanceof HTMLElement && node.hasAttribute('data-export-hide'))
const IMG_OPTS = { backgroundColor: BG, pixelRatio: 2, cacheBust: true, filter: exportFilter }

export type MapImageFormat = 'png' | 'svg'

export async function exportMapImage(node: HTMLElement, format: MapImageFormat, name = 'mapa-de-procesos') {
  if (format === 'png') {
    const blob = await toBlob(node, IMG_OPTS)
    if (blob) saveAs(blob, `${name}.png`)
  } else {
    const dataUrl = await toSvg(node, { backgroundColor: BG, cacheBust: true, filter: exportFilter })
    const blob = await (await fetch(dataUrl)).blob()
    saveAs(blob, `${name}.svg`)
  }
  useAnalyticsStore.getState().trackEvent('export', `process-map-${format}`)
}

// ─── PDF: mapa + gráficos del inventario + tabla del inventario ─────────────

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

const norm = (v: string | null | undefined) => (v || '').trim()
function countBy(rows: InvReportRow[], key: 'area' | 'macro'): { label: string; value: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) { const k = norm(r[key]) || '(sin asignar)'; m.set(k, (m.get(k) || 0) + 1) }
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

// Lista de barras horizontales dibujada con primitivas de jsPDF (crisp, no imagen).
function drawBars(pdf: jsPDF, x: number, y: number, w: number, title: string, data: { label: string; value: number }[], rgb: [number, number, number]) {
  pdf.setTextColor(30, 41, 59); pdf.setFontSize(9); pdf.setFont('helvetica', 'bold')
  pdf.text(title, x, y)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7)
  const max = Math.max(1, ...data.map((d) => d.value))
  const labelW = Math.min(48, w * 0.42)
  const barMax = w - labelW - 12
  let yy = y + 5
  for (const d of data) {
    pdf.setTextColor(71, 85, 105)
    pdf.text(d.label.length > 26 ? d.label.slice(0, 25) + '…' : d.label, x + labelW, yy + 2.6, { align: 'right' })
    const bw = Math.max(1.5, (d.value / max) * barMax)
    pdf.setFillColor(rgb[0], rgb[1], rgb[2]); pdf.rect(x + labelW + 2, yy, bw, 3.4, 'F')
    pdf.setTextColor(30, 41, 59); pdf.text(String(d.value), x + labelW + 4 + bw, yy + 2.6)
    yy += 5.4
  }
  return yy
}

export async function exportMapReportPdf(mapNode: HTMLElement, invRows: InvReportRow[], meta: PdfMeta) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const date = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' })
  const foot = meta.generatedBy ? `${meta.company} | Generado por: ${meta.generatedBy}` : meta.company
  const pageW = pdf.internal.pageSize.getWidth()

  // 1) Mapa de procesos (imagen, sin los controles de edición)
  const mapCanvas = await toCanvas(mapNode, IMG_OPTS)
  addCanvasPaged(pdf, mapCanvas, `Mapa de Procesos — ${meta.company}`, date, foot, true)

  // 2) Gráficos del inventario (dibujados como barras/valores, no imagen)
  pdf.addPage()
  header(pdf, `Reporte de Inventario — ${meta.company}`, date)
  const margin = 10
  const total = invRows.length
  const procesos = new Set(invRows.map((r) => r.macro + '||' + r.proceso)).size
  const areasCarga = new Set(invRows.map((r) => norm(r.area)).filter(Boolean)).size
  const criticos = invRows.filter((r) => r.critico === true).length
  const confirmados = invRows.filter((r) => r.origen === 'confirmado').length
  const kpis: [string, string | number][] = [
    ['Subprocesos', total], ['Procesos', procesos], ['Áreas con carga', areasCarga],
    ['Críticos', criticos], ['Confirmado', total ? `${Math.round(confirmados / total * 100)}%` : '0%'],
  ]
  const gap = 4, boxW = (pageW - margin * 2 - gap * 4) / 5, boxH = 16
  let y = 30
  kpis.forEach(([label, value], i) => {
    const x = margin + i * (boxW + gap)
    pdf.setFillColor(238, 244, 252); pdf.rect(x, y, boxW, boxH, 'F')
    pdf.setTextColor(90, 100, 120); pdf.setFontSize(7); pdf.setFont('helvetica', 'normal')
    pdf.text(String(label), x + 2, y + 5)
    pdf.setTextColor(20, 30, 60); pdf.setFontSize(13); pdf.setFont('helvetica', 'bold')
    pdf.text(String(value), x + 2, y + 13)
  })
  pdf.setFont('helvetica', 'normal')
  y += boxH + 10
  const colW = (pageW - margin * 2 - 12) / 2
  drawBars(pdf, margin, y, colW, 'Carga por área', countBy(invRows, 'area').slice(0, 12), [6, 182, 212])
  drawBars(pdf, margin + colW + 12, y, colW, 'Subprocesos por macroproceso', countBy(invRows, 'macro').slice(0, 12), [57, 135, 229])
  footer(pdf, foot)

  // 3) Tabla completa del inventario: área + jerarquía macro→proceso→subproceso + objetivo
  const body = invRows.map((r) => [norm(r.area) || '—', norm(r.macro), norm(r.proceso), norm(r.nombre), norm(r.objetivo) || '—'])
  autoTable(pdf, {
    head: [['Área', 'Macroproceso', 'Proceso', 'Subproceso', 'Objetivo']],
    body,
    startY: 24,
    margin: { top: 24, bottom: 12, left: 8, right: 8 },
    styles: { fontSize: 7.5, cellPadding: 1.6, overflow: 'linebreak', textColor: [30, 41, 59] },
    headStyles: { fillColor: [27, 42, 74], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 247, 252] },
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 50 }, 2: { cellWidth: 55 }, 3: { cellWidth: 55 } },
    didDrawPage: () => {
      header(pdf, `Inventario de Procesos — ${meta.company}`, `${date} · ${total} subprocesos`)
      footer(pdf, foot)
    },
  })

  pdf.save(`Reporte_mapa_inventario_${Date.now()}.pdf`)
  useAnalyticsStore.getState().trackEvent('export', 'process-map-pdf')
}
