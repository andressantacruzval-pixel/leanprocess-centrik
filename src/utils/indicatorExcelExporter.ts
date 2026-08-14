import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { EXCEL_COLORS, THRESHOLD_COLORS } from '@/utils/excelStyles'

interface IndicatorData {
  name: string
  objective?: string
  formula?: string
  data_source?: string
  unit_of_measure?: string
  frequency?: string
  target_value?: string
  threshold_green_min?: number | null
  threshold_green_max?: number | null
  threshold_yellow_min?: number | null
  threshold_yellow_max?: number | null
  threshold_red_min?: number | null
  threshold_red_max?: number | null
  responsible_report?: string
  responsible_monitoring?: string
}

function formatRange(min: number | null | undefined, max: number | null | undefined): string {
  const lo = min ?? null
  const hi = max ?? null
  if (lo === null && hi === null) return '—'
  if (lo !== null && hi !== null) return `${lo} – ${hi}`
  if (lo !== null) return `≥ ${lo}`
  return `≤ ${hi}`
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: `FF${EXCEL_COLORS.borderLight}` } }
  return { top: side, bottom: side, left: side, right: side }
}

function mediumBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: `FF${EXCEL_COLORS.borderDark}` } }
  return { top: side, bottom: side, left: side, right: side }
}

function formatDate(): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function setFill(cell: ExcelJS.Cell, color: string) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } }
}

function setFont(cell: ExcelJS.Cell, opts: { bold?: boolean; italic?: boolean; color?: string; size?: number }) {
  cell.font = {
    name: 'Aptos',
    size: opts.size ?? 11,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    color: { argb: `FF${opts.color ?? EXCEL_COLORS.white}` },
  }
}

export async function exportIndicatorsToExcel(
  indicators: IndicatorData[],
  processName: string,
  orgName?: string
): Promise<void> {
  const org = orgName || 'Organizacion'

  const workbook = new ExcelJS.Workbook()
  workbook.creator = org
  workbook.created = new Date()

  // ========== SHEET 1: Inventario de Indicadores ==========
  const ws1 = workbook.addWorksheet('Inventario de Indicadores')

  const colCount = 12
  const colWidths = [6, 30, 35, 30, 18, 18, 18, 18, 18, 18, 18, 18]
  const headers = [
    'No.', 'Indicador', 'Objetivo', 'Formula', 'Unidad', 'Frecuencia',
    'Meta', 'Resp. Reporte', 'Resp. Monitoreo', 'Verde', 'Amarillo', 'Rojo',
  ]

  // Set column widths
  for (let i = 0; i < colCount; i++) {
    ws1.getColumn(i + 1).width = colWidths[i]
  }

  // Row 1: Merged header with org name
  ws1.mergeCells(1, 1, 1, colCount)
  const headerCell = ws1.getCell(1, 1)
  headerCell.value = org
  setFill(headerCell, EXCEL_COLORS.navyTitle)
  setFont(headerCell, { bold: true, color: EXCEL_COLORS.white, size: 16 })
  headerCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws1.getRow(1).height = 42

  // Row 2: Process name + date
  ws1.mergeCells(2, 1, 2, colCount)
  const subHeaderCell = ws1.getCell(2, 1)
  subHeaderCell.value = `Proceso: ${processName}  |  Fecha: ${formatDate()}`
  setFill(subHeaderCell, EXCEL_COLORS.darkBlue)
  setFont(subHeaderCell, { italic: true, color: EXCEL_COLORS.white, size: 11 })
  subHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws1.getRow(2).height = 28

  // Row 3: Empty spacer
  ws1.getRow(3).height = 8

  // Row 4: Column headers
  const headerRow = ws1.getRow(4)
  headerRow.height = 30
  for (let i = 0; i < colCount; i++) {
    const cell = ws1.getCell(4, i + 1)
    cell.value = headers[i]
    setFill(cell, EXCEL_COLORS.blue)
    setFont(cell, { bold: true, color: EXCEL_COLORS.white, size: 10 })
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      ...thinBorder(),
      bottom: { style: 'medium', color: { argb: 'FF1B2A4A' } },
    }
  }

  // Data rows
  indicators.forEach((ind, idx) => {
    const rowNum = 5 + idx
    const isEven = idx % 2 === 1
    const bgColor = isEven ? EXCEL_COLORS.lightGray : EXCEL_COLORS.white

    const values = [
      idx + 1,
      ind.name,
      ind.objective ?? '',
      ind.formula ?? '',
      ind.unit_of_measure ?? '',
      ind.frequency ?? '',
      ind.target_value ?? '',
      ind.responsible_report ?? '',
      ind.responsible_monitoring ?? '',
      formatRange(ind.threshold_green_min, ind.threshold_green_max),
      formatRange(ind.threshold_yellow_min, ind.threshold_yellow_max),
      formatRange(ind.threshold_red_min, ind.threshold_red_max),
    ]

    const row = ws1.getRow(rowNum)
    row.height = 24

    for (let c = 0; c < colCount; c++) {
      const cell = ws1.getCell(rowNum, c + 1)
      cell.value = values[c]
      cell.border = thinBorder()
      cell.alignment = { vertical: 'middle', wrapText: true, horizontal: c === 0 ? 'center' : 'left' }
      setFont(cell, { color: '374151', size: 10 })

      // Background: threshold columns get color-coded, others get alternating
      if (c === 9) {
        setFill(cell, THRESHOLD_COLORS.green.bg)
        setFont(cell, { color: THRESHOLD_COLORS.green.text, size: 10 })
      } else if (c === 10) {
        setFill(cell, THRESHOLD_COLORS.yellow.bg)
        setFont(cell, { color: THRESHOLD_COLORS.yellow.text, size: 10 })
      } else if (c === 11) {
        setFill(cell, THRESHOLD_COLORS.red.bg)
        setFont(cell, { color: THRESHOLD_COLORS.red.text, size: 10 })
      } else {
        setFill(cell, bgColor)
      }
    }
  })

  // Footer row
  const footerRowNum = 5 + indicators.length + 1
  ws1.mergeCells(footerRowNum, 1, footerRowNum, colCount)
  const footerCell = ws1.getCell(footerRowNum, 1)
  footerCell.value = `Generado por ${org}  |  ${formatDate()}`
  setFont(footerCell, { italic: true, color: EXCEL_COLORS.textMuted, size: 9 })
  footerCell.alignment = { horizontal: 'right', vertical: 'middle' }

  // ========== SHEET 2+: One per indicator (KPI ficha tecnica) ==========
  indicators.forEach((ind, idx) => {
    const sheetName = `KPI ${idx + 1}`
    const ws = workbook.addWorksheet(sheetName)

    ws.getColumn(1).width = 4
    ws.getColumn(2).width = 30
    ws.getColumn(3).width = 45
    ws.getColumn(4).width = 4

    // Row 1: Navy header banner
    ws.mergeCells(1, 1, 1, 4)
    const bannerCell = ws.getCell(1, 1)
    bannerCell.value = org
    setFill(bannerCell, EXCEL_COLORS.navyTitle)
    setFont(bannerCell, { bold: true, color: EXCEL_COLORS.white, size: 14 })
    bannerCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 38

    // Row 2: Title
    ws.mergeCells(2, 1, 2, 4)
    const titleCell = ws.getCell(2, 1)
    titleCell.value = 'FICHA TECNICA DEL INDICADOR'
    setFill(titleCell, EXCEL_COLORS.darkBlue)
    setFont(titleCell, { bold: true, color: EXCEL_COLORS.white, size: 13 })
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(2).height = 32

    // Row 3: Spacer
    ws.getRow(3).height = 6

    // Key-value rows
    const kvPairs: [string, string][] = [
      ['Nombre del Indicador', ind.name],
      ['Objetivo', ind.objective ?? ''],
      ['Formula de Calculo', ind.formula ?? ''],
      ['Fuente de Datos', ind.data_source ?? ''],
      ['Unidad de Medida', ind.unit_of_measure ?? ''],
      ['Frecuencia', ind.frequency ?? ''],
      ['Meta', ind.target_value ?? ''],
      ['Responsable Reporte', ind.responsible_report ?? ''],
      ['Responsable Monitoreo', ind.responsible_monitoring ?? ''],
    ]

    kvPairs.forEach(([label, value], kvIdx) => {
      const rowNum = 4 + kvIdx
      const bg = kvIdx % 2 === 0 ? EXCEL_COLORS.navyTitle : EXCEL_COLORS.darkBlue

      // Label cell (col 2)
      const labelCell = ws.getCell(rowNum, 2)
      labelCell.value = label
      setFill(labelCell, bg)
      setFont(labelCell, { bold: true, color: EXCEL_COLORS.white, size: 11 })
      labelCell.alignment = { vertical: 'middle' }
      labelCell.border = mediumBorder()

      // Value cell (col 3)
      const valueCell = ws.getCell(rowNum, 3)
      valueCell.value = value
      setFill(valueCell, bg)
      setFont(valueCell, { color: EXCEL_COLORS.white, size: 11 })
      valueCell.alignment = { vertical: 'middle', wrapText: true }
      valueCell.border = thinBorder()

      // Side gutters
      const gutterLeft = ws.getCell(rowNum, 1)
      setFill(gutterLeft, bg)
      const gutterRight = ws.getCell(rowNum, 4)
      setFill(gutterRight, bg)

      ws.getRow(rowNum).height = 26
    })

    // Threshold section
    const thresholdStartRow = 4 + kvPairs.length + 1

    // Threshold header
    ws.mergeCells(thresholdStartRow, 2, thresholdStartRow, 3)
    const threshHeader = ws.getCell(thresholdStartRow, 2)
    threshHeader.value = 'Umbrales de Desempeno'
    setFill(threshHeader, EXCEL_COLORS.navyTitle)
    setFont(threshHeader, { bold: true, color: EXCEL_COLORS.white, size: 11 })
    threshHeader.alignment = { horizontal: 'center', vertical: 'middle' }
    threshHeader.border = mediumBorder()
    ws.getRow(thresholdStartRow).height = 28

    // Threshold boxes
    const thresholds: [string, string, string, string][] = [
      ['Verde', formatRange(ind.threshold_green_min, ind.threshold_green_max), THRESHOLD_COLORS.green.bg, THRESHOLD_COLORS.green.text],
      ['Amarillo', formatRange(ind.threshold_yellow_min, ind.threshold_yellow_max), THRESHOLD_COLORS.yellow.bg, THRESHOLD_COLORS.yellow.text],
      ['Rojo', formatRange(ind.threshold_red_min, ind.threshold_red_max), THRESHOLD_COLORS.red.bg, THRESHOLD_COLORS.red.text],
    ]

    thresholds.forEach(([label, value, bg, textColor], tIdx) => {
      const rowNum = thresholdStartRow + 1 + tIdx

      const labelCell = ws.getCell(rowNum, 2)
      labelCell.value = label
      setFill(labelCell, bg)
      setFont(labelCell, { bold: true, color: textColor, size: 11 })
      labelCell.alignment = { vertical: 'middle', horizontal: 'center' }
      labelCell.border = thinBorder()

      const valueCell = ws.getCell(rowNum, 3)
      valueCell.value = value
      setFill(valueCell, bg)
      setFont(valueCell, { color: textColor, size: 11 })
      valueCell.alignment = { vertical: 'middle', wrapText: true }
      valueCell.border = thinBorder()

      ws.getRow(rowNum).height = 26
    })

    // Footer
    const kpiFooterRow = thresholdStartRow + 1 + thresholds.length + 1
    ws.mergeCells(kpiFooterRow, 1, kpiFooterRow, 4)
    const kpiFooter = ws.getCell(kpiFooterRow, 1)
    kpiFooter.value = `Generado por ${org}  |  ${formatDate()}`
    setFont(kpiFooter, { italic: true, color: EXCEL_COLORS.textMuted, size: 9 })
    kpiFooter.alignment = { horizontal: 'right', vertical: 'middle' }
  })

  // Generate and save
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const fileName = `Indicadores_${processName.replace(/\s+/g, '_')}_${formatDate().replace(/\//g, '-')}.xlsx`
  saveAs(blob, fileName)
}
