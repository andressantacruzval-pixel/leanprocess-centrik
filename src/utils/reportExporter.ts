import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable, { type CellHookData } from 'jspdf-autotable'
import { getRiskLevel, type RiskItem } from '@/types/risk'
import { scaleToPeriod, type ValueActivity } from '@/utils/valueAnalysis'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { EXCEL_COLORS, RISK_LEVEL_COLORS, VA_COLORS, THRESHOLD_COLORS } from '@/utils/excelStyles'
import type { Company } from '@/types/organization'
import type { Macroprocess, Process } from '@/types/process'
import type { StoredIndicator } from '@/stores/indicatorStore'
import type { StoredProcedure } from '@/stores/procedureStore'
import type { AuditItem } from '@/lib/procedureAi'
import {
  type ImprovementOpportunity, priorityScore, priorityLabel, STATUS_LABELS, IMPROVEMENT_TYPE_LABELS,
} from '@/types/improvement'
import { computeCargos, scaleDaily } from '@/features/cargos/cargoData'
import { hierarchyHeaders, hierarchyCells, resolveProcessHierarchy, type OrgLabelsLike } from '@/lib/reportHierarchy'

// Jerarquía canónica (organizacional + procesos) para anteponer en TODA tabla:
// [l0, l1, (l2), Macroproceso, Proceso, Subproceso]. `W` = nº de esas columnas
// (5 o 6), para recalcular los índices de coloreado que van después.
function hierParts(d: ReportData) {
  const org: OrgLabelsLike = d.orgLabels ?? { l0: 'Gerencia', l1: 'Area', l2: 'Nivel 3', hasL2: false }
  const headers = hierarchyHeaders(org)
  const cells = (p: Process | undefined) =>
    hierarchyCells({ management: p?.management, coordination: p?.coordination, operative: p?.operative, ...resolveProcessHierarchy(p, d.macroMap, d.processMap) }, org)
  return { headers, W: headers.length, cells }
}

// Filas de detalle por actividad de cada cargo, con su jerarquía (macro →
// proceso → subproceso) resuelta desde el mapa de procesos. Base para la
// pestaña "Detalle" de Excel y PDF.
function cargoDetailRows(data: ReportData) {
  const { cargos } = computeCargos(data.processes, data.allAnalyses, data.cargoCatalog ?? [])
  const out: { cargo: string; macro: string; proceso: string; sub: string; actividad: string; clase: string; daily: number }[] = []
  for (const c of cargos) {
    for (const a of c.activities) {
      const p = data.processMap.get(a.processId)
      const parent = p?.parent_process_id ? data.processMap.get(p.parent_process_id) : null
      const macro = p ? (data.macroMap.get(p.macroprocess_id)?.name ?? '-') : '-'
      const proceso = parent ? parent.name : (p?.name ?? '-')
      const sub = parent ? (p?.name ?? '') : ''
      out.push({ cargo: c.cargo, macro, proceso, sub, actividad: a.activityName, clase: a.classification ?? '-', daily: a.dailyMinutes })
    }
  }
  return out
}
const r0 = (n: number) => Math.round(n)
const r1 = (n: number) => Math.round(n * 10) / 10

export interface ReportData {
  tab: string
  company: Company | null
  generatedBy?: string | null
  processes: Process[]
  macroMap: Map<string, Macroprocess>
  processMap: Map<string, Process>
  allRisks: RiskItem[]
  allIndicators: StoredIndicator[]
  allProcedures: StoredProcedure[]
  allAudits: Record<string, AuditItem[]>
  allAnalyses: Record<string, ValueActivity[]>
  allImprovements?: ImprovementOpportunity[]
  cargoCatalog?: string[]
  orgLabels?: { l0: string; l1: string; l2: string; hasL2: boolean }
}

// Efectividad promedio de los controles de un riesgo (0–40) → etiqueta.
function controlEffLabel(r: RiskItem): string {
  if (!r.controls.length) return 'Sin control'
  const avg = r.controls.reduce((s, c) => s + (c.score || 0), 0) / r.controls.length
  if (avg >= 33) return 'Optimo'
  if (avg >= 25) return 'Bueno'
  if (avg >= 17) return 'Regular'
  if (avg >= 9) return 'Debil'
  return 'Deficiente'
}

// Rango de umbral verde/amarillo/rojo de un KPI en texto.
function thresholdRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return '-'
  if (min != null && max != null) return `${min}-${max}`
  if (min != null) return `>=${min}`
  return `<=${max}`
}

// Colores semánticos para inventario de procesos (sin equivalente en excelStyles)
const INVENTORY_COLORS = {
  criticalBg: 'FEE2E2', criticalText: '991B1B',
  yesBg: THRESHOLD_COLORS.green.bg, yesText: THRESHOLD_COLORS.green.text,
  noBg: 'F9FAFB', noText: EXCEL_COLORS.textMuted,
}

// ═══════════════════════════════════════════════════════════════════════
// EXCEL
// ═══════════════════════════════════════════════════════════════════════

export async function exportReportToExcel(data: ReportData) {
  const wb = new ExcelJS.Workbook()
  wb.creator = data.company?.name || 'LeanProcess'
  wb.created = new Date()
  const company = data.company?.name || 'Empresa'
  const now = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' })

  switch (data.tab) {
    case 'inventario': excelInventory(wb, data, company, now); break
    case 'riesgos': excelRisks(wb, data, company, now); break
    case 'kpis': excelKpis(wb, data, company, now); break
    case 'valor': excelValue(wb, data, company, now); break
    case 'auditoria': excelAudit(wb, data, company, now); break
    case 'mejoras': excelMejoras(wb, data, company, now); break
    case 'cargos': excelCargos(wb, data, company, now); break
  }

  const buffer = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buffer]), `Lean_Process_${data.tab}_${Date.now()}.xlsx`)
  useAnalyticsStore.getState().trackEvent('export', `report-excel-${data.tab}`)
}

function addTitle(ws: ExcelJS.Worksheet, title: string, sub: string, cols: number, companyLabel = 'LeanProcess', authorLabel = '') {
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
  const footerLeft = authorLabel ? `${companyLabel} | Generado por: ${authorLabel}` : companyLabel
  ws.headerFooter.oddFooter = `&L&8${footerLeft}&R&8Pagina &P de &N`
}

function styleHeaders(ws: ExcelJS.Worksheet, cols: number, row = 3) {
  const r = ws.getRow(row)
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

function colorCell(cell: ExcelJS.Cell, textArgb: string, bgArgb: string) {
  cell.font = { bold: true, size: 9, color: { argb: textArgb }, name: EXCEL_COLORS.font }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
}

function excelInventory(wb: ExcelJS.Workbook, data: ReportData, company: string, date: string) {
  const ws = wb.addWorksheet('Inventario de Procesos')
  const { headers: HH, W, cells } = hierParts(data)
  const H = [...HH, 'Responsable', 'Tipo', 'Frecuencia', 'Critico', 'BPMN', 'Procedimiento']
  ws.columns = H.map((h, i) => ({ header: h, key: `c${i}`, width: i < W ? 22 : 14 }))
  const procSet = new Set(data.allProcedures.map(p => p.process_id))
  const rows: (string | number)[][] = data.processes.map(p =>
    [...cells(p), p.responsible || '-', p.process_type || '-', p.execution_frequency || '-', p.is_critical ? 'Si' : 'No', p.bpmn_xml ? 'Si' : 'No', procSet.has(p.id) ? 'Si' : 'No']
  )
  rows.forEach(r => ws.addRow(r))
  styleHeaders(ws, H.length, 1)
  addTitle(ws, `Inventario de Procesos — ${company}`, `${company} | ${date}`, H.length, company, data.generatedBy || '')
  styleData(ws, 4, H.length, rows.length)
  // Color critical (W+4), bpmn (W+5), procedure (W+6) — índices 1-based tras la jerarquía.
  const cCrit = W + 4, cBpmn = W + 5, cProc = W + 6
  for (let r = 4; r < 4 + rows.length; r++) {
    if (ws.getRow(r).getCell(cCrit).value === 'Si') colorCell(ws.getRow(r).getCell(cCrit), `FF${INVENTORY_COLORS.criticalText}`, `FF${INVENTORY_COLORS.criticalBg}`)
    const bpmn = ws.getRow(r).getCell(cBpmn).value
    colorCell(ws.getRow(r).getCell(cBpmn), bpmn === 'Si' ? `FF${INVENTORY_COLORS.yesText}` : `FF${INVENTORY_COLORS.noText}`, bpmn === 'Si' ? `FF${INVENTORY_COLORS.yesBg}` : `FF${INVENTORY_COLORS.noBg}`)
    const proc = ws.getRow(r).getCell(cProc).value
    colorCell(ws.getRow(r).getCell(cProc), proc === 'Si' ? `FF${INVENTORY_COLORS.yesText}` : `FF${INVENTORY_COLORS.noText}`, proc === 'Si' ? `FF${INVENTORY_COLORS.yesBg}` : `FF${INVENTORY_COLORS.noBg}`)
  }
}

function excelRisks(wb: ExcelJS.Workbook, data: ReportData, company: string, date: string) {
  const ws = wb.addWorksheet('Riesgos y Controles')
  const { headers: HH, W, cells } = hierParts(data)
  const H = [...HH, 'Riesgo', 'Descripcion', 'Causa', 'Evento', 'Efecto', 'Categoria', 'Actividad', 'P.I', 'I.I', 'Nivel Inh.', 'Controles', 'Efectividad', 'P.R', 'I.R', 'Nivel Res.']
  ws.columns = H.map((h, i) => ({ header: h, key: `c${i}`, width: i < W ? 22 : i === W ? 32 : (i >= W + 2 && i <= W + 4) ? 24 : 12 }))
  const pIds = new Set(data.processes.map(p => p.id))
  const pMap = new Map(data.processes.map(p => [p.id, p]))
  const risks = data.allRisks.filter(r => pIds.has(r.process_id))
  const rows = risks.map(r => {
    const proc = pMap.get(r.process_id)
    const inh = getRiskLevel(r.inherentProbability, r.inherentImpact)
    const res = getRiskLevel(r.residualProbability, r.residualImpact)
    return [...cells(proc), r.title, r.description || '-', r.riskCause || '-', r.riskEvent || '-', r.riskEffect || '-', r.category, r.processStep || '-', r.inherentProbability, r.inherentImpact, inh.label, r.controls.length, controlEffLabel(r), r.residualProbability, r.residualImpact, res.label]
  })
  rows.forEach(r => ws.addRow(r))
  styleHeaders(ws, H.length, 1)
  addTitle(ws, `Riesgos y Controles — ${company}`, `${company} | ${date}`, H.length, company, data.generatedBy || '')
  styleData(ws, 4, H.length, rows.length)
  // Color nivel cells: Nivel Inh. = W+10, Nivel Res. = W+15 (1-based tras la jerarquía).
  for (let r = 4; r < 4 + rows.length; r++) {
    for (const col of [W + 10, W + 15]) {
      const val = String(ws.getRow(r).getCell(col).value || '')
      const level = RISK_LEVEL_COLORS[val]
      if (level) colorCell(ws.getRow(r).getCell(col), `FF${level.text}`, `FF${level.bg}`)
    }
  }
}

function excelKpis(wb: ExcelJS.Workbook, data: ReportData, company: string, date: string) {
  const ws = wb.addWorksheet('Indicadores KPI')
  const { headers: HH, W, cells } = hierParts(data)
  const H = [...HH, 'Indicador', 'Objetivo', 'Formula', 'Fuente', 'Unidad', 'Frecuencia', 'Meta', 'Verde', 'Amarillo', 'Rojo', 'Resp. Reporte', 'Resp. Monitoreo']
  ws.columns = H.map((h, i) => ({ header: h, key: `c${i}`, width: i < W ? 22 : (i >= W + 7 && i <= W + 9) ? 11 : 14 }))
  const pIds = new Set(data.processes.map(p => p.id))
  const pMap = new Map(data.processes.map(p => [p.id, p]))
  const items = data.allIndicators.filter(i => pIds.has(i.process_id))
  const rows = items.map(i => {
    const proc = pMap.get(i.process_id)
    return [...cells(proc), i.name, i.description, i.formula, i.data_source || '-', i.unit, i.frequency, i.target_value, thresholdRange(i.threshold_green_min, i.threshold_green_max), thresholdRange(i.threshold_yellow_min, i.threshold_yellow_max), thresholdRange(i.threshold_red_min, i.threshold_red_max), i.owner, i.reporter || '-']
  })
  rows.forEach(r => ws.addRow(r))
  styleHeaders(ws, H.length, 1)
  addTitle(ws, `Indicadores KPI — ${company}`, `${company} | ${date}`, H.length, company, data.generatedBy || '')
  styleData(ws, 4, H.length, rows.length)
  // Color umbrales: Verde=W+8, Amarillo=W+9, Rojo=W+10 (1-based tras la jerarquía).
  for (let r = 4; r < 4 + rows.length; r++) {
    const paint = (col: number, key: keyof typeof THRESHOLD_COLORS) => {
      const v = String(ws.getRow(r).getCell(col).value || '')
      if (v && v !== '-') colorCell(ws.getRow(r).getCell(col), `FF${THRESHOLD_COLORS[key].text}`, `FF${THRESHOLD_COLORS[key].bg}`)
    }
    paint(W + 8, 'green'); paint(W + 9, 'yellow'); paint(W + 10, 'red')
  }
}

function excelCargos(wb: ExcelJS.Workbook, data: ReportData, company: string, date: string) {
  const { cargos } = computeCargos(data.processes, data.allAnalyses, data.cargoCatalog ?? [])
  const conAct = cargos.filter((c) => c.activities.length > 0)

  // ── Pestaña 1: Resumen de tiempos por cargo (min y horas: día/mes/semestre/año) ──
  const ws1 = wb.addWorksheet('Resumen por Cargo')
  const H1 = ['Cargo', 'En catalogo', 'Procesos', 'Actividades',
    'Min/dia', 'Min/mes', 'Min/semestre', 'Min/año', 'Horas/dia', 'Horas/mes', 'Horas/semestre', 'Horas/año', '% Valor']
  ws1.columns = H1.map((h, i) => ({ header: h, key: `c${i}`, width: i === 0 ? 30 : 13 }))
  const rows1 = conAct.map((c) => {
    const d = c.totalDaily
    const pv = c.totalDaily > 0 ? `${Math.round(c.vaDaily / c.totalDaily * 100)}%` : '-'
    return [c.cargo, c.inCatalog ? 'Si' : 'No', c.processes.size, c.activities.length,
      r0(scaleDaily(d, 'dia', 'min')), r0(scaleDaily(d, 'mes', 'min')), r0(scaleDaily(d, 'semestre', 'min')), r0(scaleDaily(d, 'anio', 'min')),
      r1(scaleDaily(d, 'dia', 'h')), r1(scaleDaily(d, 'mes', 'h')), r1(scaleDaily(d, 'semestre', 'h')), r1(scaleDaily(d, 'anio', 'h')), pv]
  })
  rows1.forEach((r) => ws1.addRow(r))
  styleHeaders(ws1, H1.length, 1)
  addTitle(ws1, `Analitica por Cargo — Resumen — ${company}`, `${company} | ${date}`, H1.length, company, data.generatedBy || '')
  styleData(ws1, 4, H1.length, rows1.length)

  // ── Pestaña 2: Detalle por actividad (para tablas dinámicas) ──
  const ws2 = wb.addWorksheet('Detalle por Actividad')
  const H2 = ['Cargo', 'Macroproceso', 'Proceso', 'Subproceso', 'Actividad', 'Clasificacion', 'Min/dia', 'Min/mes', 'Horas/mes']
  ws2.columns = H2.map((h, i) => ({ header: h, key: `d${i}`, width: i >= 6 ? 12 : 24 }))
  const det = cargoDetailRows(data)
  const rows2 = det.map((x) => [x.cargo, x.macro, x.proceso, x.sub, x.actividad, x.clase, r0(scaleDaily(x.daily, 'dia', 'min')), r0(scaleDaily(x.daily, 'mes', 'min')), r1(scaleDaily(x.daily, 'mes', 'h'))])
  rows2.forEach((r) => ws2.addRow(r))
  styleHeaders(ws2, H2.length, 1)
  addTitle(ws2, `Analitica por Cargo — Detalle por Actividad — ${company}`, `${company} | ${date}`, H2.length, company, data.generatedBy || '')
  styleData(ws2, 4, H2.length, rows2.length)
}

function excelMejoras(wb: ExcelJS.Workbook, data: ReportData, company: string, date: string) {
  const ws = wb.addWorksheet('Plan de Mejoras')
  const { headers: HH, W, cells } = hierParts(data)
  const H = [...HH, 'Oportunidad', 'Tipo', 'Descripcion', 'Prioridad', 'Costo', 'Complejidad', 'Tiempo', 'Responsable', 'Inicio', 'Fin', 'Estado', 'Avance %', 'Cierre']
  ws.columns = H.map((h, i) => ({ header: h, key: `c${i}`, width: i === W || i === W + 2 ? 30 : i < W ? 20 : 14 }))
  const pIds = new Set(data.processes.map(p => p.id))
  const pMap = new Map(data.processes.map(p => [p.id, p]))
  const items = (data.allImprovements || []).filter(o => pIds.has(o.processId))
  const rows = items.map(o => {
    const proc = pMap.get(o.processId)
    const total = priorityScore(o)
    return [...cells(proc), o.name, IMPROVEMENT_TYPE_LABELS[o.type], o.description || '-', `${total}/15 ${priorityLabel(total).label}`, o.costScore, o.complexityScore, o.timeScore, o.responsible || '-', o.startDate || '-', o.endDate || '-', STATUS_LABELS[o.status], o.progressPct ?? 0, o.closeDate || '-']
  })
  rows.forEach(r => ws.addRow(r))
  styleHeaders(ws, H.length, 1)
  addTitle(ws, `Plan de Mejoras — ${company}`, `${company} | ${date}`, H.length, company, data.generatedBy || '')
  styleData(ws, 4, H.length, rows.length)
}

function excelValue(wb: ExcelJS.Workbook, data: ReportData, company: string, date: string) {
  const ws = wb.addWorksheet('Analisis de Valor')
  const { headers: HH, W, cells } = hierParts(data)
  const H = [...HH, 'Actividad', 'Responsable', 'Clasificacion', 'Frecuencia', 'Min', 'Ocurr.', 'Min/Dia', 'Min/Mes', 'Hrs/Ano']
  ws.columns = H.map((h, i) => ({ header: h, key: `c${i}`, width: i < W ? 22 : 12 }))
  const rows: (string | number)[][] = []
  for (const p of data.processes) {
    for (const a of (data.allAnalyses[p.id] || [])) {
      rows.push([...cells(p), a.name, a.laneName || '-', a.classification || '-', a.frequency || '-', a.timePerOccurrence || 0, a.occurrences || 0, a.dailyMinutes ? Math.round(a.dailyMinutes * 10) / 10 : 0, a.dailyMinutes ? Math.round(scaleToPeriod(a.dailyMinutes, 'mes')) : 0, a.dailyMinutes ? Math.round(scaleToPeriod(a.dailyMinutes, 'año') / 60 * 10) / 10 : 0])
    }
  }
  rows.forEach(r => ws.addRow(r))
  styleHeaders(ws, H.length, 1)
  addTitle(ws, `Analisis de Valor — ${company}`, `${company} | ${date}`, H.length, company, data.generatedBy || '')
  styleData(ws, 4, H.length, rows.length)
  // Color Clasificacion (W+3, 1-based tras la jerarquía).
  const cCls = W + 3
  for (let r = 4; r < 4 + rows.length; r++) {
    const val = String(ws.getRow(r).getCell(cCls).value || '')
    const vaColor = VA_COLORS[val]
    if (vaColor) colorCell(ws.getRow(r).getCell(cCls), `FF${vaColor.text}`, `FF${vaColor.bg}`)
  }
}

function excelAudit(wb: ExcelJS.Workbook, data: ReportData, company: string, date: string) {
  const ws = wb.addWorksheet('Programa de Auditoria')
  const { headers: HH, W, cells } = hierParts(data)
  const H = [...HH, 'Actividad', 'Que Auditar', 'Criterio', 'Evidencia', 'Frecuencia', 'Responsable']
  ws.columns = H.map((h, i) => ({ header: h, key: `c${i}`, width: i < W + 2 ? 24 : 16 }))
  const rows: string[][] = []
  for (const p of data.processes) {
    for (const item of (data.allAudits[p.id] || [])) {
      rows.push([...cells(p), item.actividad, item.queAuditar, item.criterio, item.evidencia, item.frecuencia, item.responsable])
    }
  }
  rows.forEach(r => ws.addRow(r))
  styleHeaders(ws, H.length, 1)
  addTitle(ws, `Programa de Auditoria — ${company}`, `${company} | ${date}`, H.length, company, data.generatedBy || '')
  styleData(ws, 4, H.length, rows.length)
}

// ═══════════════════════════════════════════════════════════════════════
// PDF
// ═══════════════════════════════════════════════════════════════════════

type PdfColorPair = { bg: [number,number,number]; text: [number,number,number] }
const RISK_COLORS: Record<string, PdfColorPair> = {
  Extremo:  { bg: [254,226,226], text: [153,27,27]  },
  Alto:     { bg: [254,243,199], text: [146,64,14]  },
  Moderado: { bg: [254,249,195], text: [113,63,18]  },
  Bajo:     { bg: [209,250,229], text: [6,95,70]    },
}
const VA_COLORS_PDF: Record<string, PdfColorPair> = {
  VA:    { bg: [209,250,229], text: [6,95,70]   },
  NVA:   { bg: [254,226,226], text: [153,27,27] },
  NVABN: { bg: [254,243,199], text: [146,64,14] },
}

export function exportReportToPdf(data: ReportData) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const company = data.company?.name || 'Empresa'
  const now = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' })
  const titleMap: Record<string, string> = { inventario: 'Inventario de Procesos', riesgos: 'Riesgos y Controles', kpis: 'Indicadores KPI', valor: 'Analisis de Valor', auditoria: 'Programa de Auditoria', mejoras: 'Plan de Mejoras', cargos: 'Analitica por Cargo' }

  // Header
  doc.setFillColor(27, 42, 74); doc.rect(0, 0, 297, 35, 'F')
  doc.setFillColor(37, 99, 235); doc.rect(0, 33, 297, 1, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text(titleMap[data.tab] || 'Reporte', 14, 16)
  doc.setTextColor(156, 163, 175); doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text(`${company} | ${now}`, 14, 24)
  doc.setTextColor(255, 255, 255); doc.setFontSize(8)
  doc.text(company, 283, 16, { align: 'right' })

  let head: string[][] = []
  let body: string[][] = []
  const pIds = new Set(data.processes.map(p => p.id))
  const pMap = new Map(data.processes.map(p => [p.id, p]))
  const { headers: HH, W, cells } = hierParts(data)

  // Column indices that need coloring (0-based, tras la jerarquía de ancho W).
  let colorCols: { col: number; map: Record<string, PdfColorPair> }[] = []

  switch (data.tab) {
    case 'inventario': {
      const procSet = new Set(data.allProcedures.map(p => p.process_id))
      head = [[...HH, 'Responsable', 'Tipo', 'Critico', 'BPMN', 'Proced.']]
      body = data.processes.map(p =>
        [...cells(p), p.responsible || '-', p.process_type || '-', p.is_critical ? 'SI' : 'No', p.bpmn_xml ? 'SI' : 'No', procSet.has(p.id) ? 'SI' : 'No']
      )
      break
    }
    case 'riesgos': {
      head = [[...HH, 'Riesgo', 'Descripcion', 'Categ.', 'P.I', 'I.I', 'Nivel I.', 'Ctrl', 'Efect.', 'P.R', 'I.R', 'Nivel R.']]
      const risks = data.allRisks.filter(r => pIds.has(r.process_id))
      body = risks.map(r => {
        const proc = pMap.get(r.process_id)
        const inh = getRiskLevel(r.inherentProbability, r.inherentImpact)
        const res = getRiskLevel(r.residualProbability, r.residualImpact)
        return [...cells(proc), r.title, r.description || '-', r.category, String(r.inherentProbability), String(r.inherentImpact), inh.label, String(r.controls.length), controlEffLabel(r), String(r.residualProbability), String(r.residualImpact), res.label]
      })
      colorCols = [{ col: W + 5, map: RISK_COLORS }, { col: W + 10, map: RISK_COLORS }]
      break
    }
    case 'kpis': {
      head = [[...HH, 'Indicador', 'Objetivo', 'Formula', 'Fuente', 'Unidad', 'Frecuencia', 'Meta', 'Umbrales V/A/R']]
      const items = data.allIndicators.filter(i => pIds.has(i.process_id))
      body = items.map(i => {
        const proc = pMap.get(i.process_id)
        const umbral = `${thresholdRange(i.threshold_green_min, i.threshold_green_max)} / ${thresholdRange(i.threshold_yellow_min, i.threshold_yellow_max)} / ${thresholdRange(i.threshold_red_min, i.threshold_red_max)}`
        return [...cells(proc), i.name, i.description, i.formula, i.data_source || '-', i.unit, i.frequency, i.target_value, umbral]
      })
      break
    }
    case 'valor': {
      head = [[...HH, 'Actividad', 'Resp.', 'Clasif.', 'Freq.', 'Min', 'Ocurr.', 'Min/Dia', 'Min/Mes', 'Hrs/Ano']]
      body = []
      for (const p of data.processes) {
        for (const a of (data.allAnalyses[p.id] || [])) {
          body.push([...cells(p), a.name, a.laneName || '-', a.classification || '-', a.frequency || '-', String(a.timePerOccurrence || 0), String(a.occurrences || 0), String(a.dailyMinutes ? Math.round(a.dailyMinutes * 10) / 10 : 0), String(a.dailyMinutes ? Math.round(scaleToPeriod(a.dailyMinutes, 'mes')) : 0), String(a.dailyMinutes ? Math.round(scaleToPeriod(a.dailyMinutes, 'año') / 60 * 10) / 10 : 0)])
        }
      }
      colorCols = [{ col: W + 2, map: VA_COLORS_PDF }]
      break
    }
    case 'auditoria': {
      head = [[...HH, 'Actividad', 'Que Auditar', 'Criterio', 'Evidencia', 'Frecuencia', 'Responsable']]
      body = []
      for (const p of data.processes) {
        for (const item of (data.allAudits[p.id] || [])) {
          body.push([...cells(p), item.actividad, item.queAuditar, item.criterio, item.evidencia, item.frecuencia, item.responsable])
        }
      }
      break
    }
    case 'mejoras': {
      head = [[...HH, 'Oportunidad', 'Tipo', 'Prioridad', 'Responsable', 'Estado', 'Avance', 'Cierre']]
      const items = (data.allImprovements || []).filter(o => pIds.has(o.processId))
      body = items.map(o => {
        const proc = pMap.get(o.processId)
        const total = priorityScore(o)
        return [...cells(proc), o.name, IMPROVEMENT_TYPE_LABELS[o.type], `${total}/15 ${priorityLabel(total).label}`, o.responsible || '-', STATUS_LABELS[o.status], `${o.progressPct ?? 0}%`, o.closeDate || '-']
      })
      break
    }
    case 'cargos': {
      head = [['Cargo', 'Procesos', 'Actividades', 'Min/mes', 'Horas/mes', 'VA min/mes', 'NVA min/mes', '% Valor']]
      const { cargos } = computeCargos(data.processes, data.allAnalyses, data.cargoCatalog ?? [])
      body = cargos.filter((c) => c.activities.length > 0).map((c) => {
        const pv = c.totalDaily > 0 ? `${Math.round(c.vaDaily / c.totalDaily * 100)}%` : '-'
        return [c.cargo, String(c.processes.size), String(c.activities.length), String(r0(scaleDaily(c.totalDaily, 'mes', 'min'))), String(r1(scaleDaily(c.totalDaily, 'mes', 'h'))), String(r0(scaleDaily(c.vaDaily, 'mes', 'min'))), String(r0(scaleDaily(c.nvaDaily, 'mes', 'min'))), pv]
      })
      break
    }
  }

  autoTable(doc, {
    head, body, startY: 40, theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, textColor: [55, 65, 81], fillColor: [255, 255, 255], lineColor: [209, 213, 219], lineWidth: 0.3 },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 10, right: 10 },
    didParseCell: (hookData: CellHookData) => {
      if (hookData.section !== 'body') return
      for (const cc of colorCols) {
        if (hookData.column.index === cc.col) {
          const colors = cc.map[String(hookData.cell.raw)]
          if (colors) {
            hookData.cell.styles.fillColor = colors.bg
            hookData.cell.styles.textColor = colors.text
            hookData.cell.styles.fontStyle = 'bold'
            hookData.cell.styles.halign = 'center'
          }
        }
      }
    },
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight()
      doc.setFillColor(27, 42, 74); doc.rect(0, h - 10, 297, 10, 'F')
      doc.setFontSize(7); doc.setTextColor(156, 163, 175)
      const footerLeft = data.generatedBy ? `${company} | Generado por: ${data.generatedBy}` : company
      doc.text(footerLeft, 10, h - 4)
      doc.text(`Pagina ${doc.getCurrentPageInfo().pageNumber}`, 287, h - 4, { align: 'right' })
    },
  })

  // Cargos: segunda tabla con el DETALLE por actividad (macro → proceso → subproceso).
  if (data.tab === 'cargos') {
    const det = cargoDetailRows(data)
    if (det.length) {
      doc.addPage()
      doc.setFillColor(27, 42, 74); doc.rect(0, 0, 297, 12, 'F')
      doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text('Detalle por Actividad', 10, 8)
      autoTable(doc, {
        startY: 16, theme: 'grid',
        head: [['Cargo', 'Macroproceso', 'Proceso', 'Subproceso', 'Actividad', 'Clasif.', 'Min/mes', 'Horas/mes']],
        body: det.map((x) => [x.cargo, x.macro, x.proceso, x.sub, x.actividad, x.clase, String(r0(scaleDaily(x.daily, 'mes', 'min'))), String(r1(scaleDaily(x.daily, 'mes', 'h')))]),
        styles: { fontSize: 7, cellPadding: 2, textColor: [55, 65, 81], lineColor: [209, 213, 219], lineWidth: 0.3 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 10, right: 10 },
      })
    }
  }

  doc.save(`Lean_Process_${data.tab}_${Date.now()}.pdf`)
  useAnalyticsStore.getState().trackEvent('export', `report-pdf-${data.tab}`)
}
