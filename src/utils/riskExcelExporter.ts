import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { getRiskLevel } from '@/types/risk'
import type { RiskItem } from '@/types/risk'
import { EXCEL_COLORS, RISK_LEVEL_COLORS } from '@/utils/excelStyles'

function addTitle(ws: ExcelJS.Worksheet, title: string, sub: string, cols: number) {
  ws.insertRow(1, [title])
  ws.mergeCells(1, 1, 1, cols)
  const c1 = ws.getCell('A1')
  c1.font = { bold: true, size: 14, color: { argb: `FF${EXCEL_COLORS.white}` }, name: EXCEL_COLORS.font }
  c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${EXCEL_COLORS.navyTitle}` } }
  c1.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 36

  ws.insertRow(2, [sub])
  ws.mergeCells(2, 1, 2, cols)
  const c2 = ws.getCell('A2')
  c2.font = { size: 9, color: { argb: `FF${EXCEL_COLORS.textMuted}` }, name: EXCEL_COLORS.font }
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${EXCEL_COLORS.darkBlue}` } }
  c2.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(2).height = 22
}

function styleHeaders(ws: ExcelJS.Worksheet, cols: number) {
  const r = ws.getRow(3)
  r.height = 28
  for (let c = 1; c <= cols; c++) {
    const cell = r.getCell(c)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${EXCEL_COLORS.blue}` } }
    cell.font = { bold: true, color: { argb: `FF${EXCEL_COLORS.white}` }, size: 9, name: EXCEL_COLORS.font }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = { bottom: { style: 'thin', color: { argb: `FF${EXCEL_COLORS.borderLight}` } } }
  }
}

function styleData(ws: ExcelJS.Worksheet, startRow: number, cols: number, count: number) {
  for (let r = startRow; r < startRow + count; r++) {
    const row = ws.getRow(r)
    row.height = 20
    const isEven = r % 2 === 0
    for (let c = 1; c <= cols; c++) {
      const cell = row.getCell(c)
      if (!cell.font?.color) {
        cell.font = { size: 9, color: { argb: `FF${EXCEL_COLORS.textDark}` }, name: EXCEL_COLORS.font }
      }
      if (!(cell.fill as ExcelJS.FillPattern)?.fgColor) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${isEven ? EXCEL_COLORS.white : EXCEL_COLORS.lightGray}` } }
      }
      cell.alignment = { vertical: 'middle', wrapText: false }
      cell.border = { bottom: { style: 'hair', color: { argb: `FF${EXCEL_COLORS.borderLight}` } } }
    }
  }
}

export async function exportRisksToExcel(
  risks: RiskItem[],
  processName: string,
  management?: string,
  coordination?: string,
  companyName?: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Lean Process by Andres Santacruz'
  wb.created = new Date()
  const company = companyName || 'Empresa'
  const now = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' })

  const ws = wb.addWorksheet('Riesgos y Controles')
  const H = ['Gerencia', 'Area', 'Proceso', 'Riesgo', 'Categoria', 'Actividad',
    'P.I', 'I.I', 'Nivel Inh.', 'Controles', 'P.R', 'I.R', 'Nivel Res.']
  ws.columns = H.map((h, i) => ({ header: h, key: `c${i}`, width: i <= 3 ? 22 : 12 }))

  const rows = risks.map((r) => {
    const inh = getRiskLevel(r.inherentProbability, r.inherentImpact)
    const res = getRiskLevel(r.residualProbability, r.residualImpact)
    return [
      management || '-',
      coordination || '-',
      processName,
      r.title,
      r.category,
      r.processStep || '-',
      r.inherentProbability,
      r.inherentImpact,
      inh.label,
      r.controls.length,
      r.residualProbability,
      r.residualImpact,
      res.label,
    ]
  })

  rows.forEach((r) => ws.addRow(r))
  styleHeaders(ws, H.length)
  addTitle(ws, `Riesgos y Controles — ${company}`, `Lean Process | ${now}`, H.length)
  styleData(ws, 4, H.length, rows.length)

  for (let r = 4; r < 4 + rows.length; r++) {
    for (const col of [9, 13]) {
      const val = String(ws.getRow(r).getCell(col).value || '')
      const level = RISK_LEVEL_COLORS[val]
      if (level) {
        const cell = ws.getRow(r).getCell(col)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${level.bg}` } }
        cell.font = { bold: true, size: 9, color: { argb: `FF${level.text}` }, name: EXCEL_COLORS.font }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buffer]), `Lean_Process_riesgos_${Date.now()}.xlsx`)
}
