import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { InvReportRow } from './inventoryReportData'

// Exporta el inventario COMPLETO a Excel: todas las columnas que se ven en la
// tabla del reporte (caracterización + banderas desplegadas + SIPOC + estado),
// respetando el filtrado activo del reporte. El export anterior (reportExporter)
// solo sacaba 10 campos; este saca los 25.

const boolText = (v: boolean | null | undefined): string => (v == null ? '' : v ? 'Sí' : 'No')

export async function exportInventoryExcel(rows: InvReportRow[], companyName: string, gerenciaLabel: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = companyName || 'LeanProcess'
  const ws = wb.addWorksheet('Inventario')

  const columns: { header: string; get: (r: InvReportRow) => string }[] = [
    { header: 'Área', get: (r) => r.area || '' },
    { header: 'Macroproceso', get: (r) => r.macro || '' },
    { header: 'Proceso', get: (r) => r.proceso || '' },
    { header: 'Subproceso', get: (r) => r.nombre || '' },
    { header: 'Objetivo', get: (r) => r.objetivo || '' },
    { header: 'Responsable', get: (r) => r.responsable || '' },
    { header: 'Crítico', get: (r) => boolText(r.critico) },
    { header: 'Mov. efectivo', get: (r) => boolText(r.efectivo) },
    { header: 'Nivel de ejecución', get: (r) => r.nivelEjecucion || '' },
    { header: gerenciaLabel, get: (r) => r.gerencia || '' },
    { header: 'Frecuencia', get: (r) => r.frecuencia || '' },
    { header: 'Tipo de proceso', get: (r) => r.tipoProceso || '' },
    { header: 'Tipo de ejecución', get: (r) => r.tipoEjecucion || '' },
    { header: 'Medio de entrega', get: (r) => r.medioEntrega || '' },
    { header: 'Supervisión', get: (r) => r.supervision || '' },
    { header: 'Plan de contingencia', get: (r) => boolText(r.contingencia) },
    { header: 'Operaciones tributarias', get: (r) => boolText(r.impuestos) },
    { header: 'Afecta contabilidad', get: (r) => boolText(r.contabilidad) },
    { header: 'Datos personales', get: (r) => boolText(r.datosPersonales) },
    { header: 'Provisto por terceros', get: (r) => boolText(r.terceros) },
    { header: 'Proveedores', get: (r) => r.proveedores || '' },
    { header: 'Entradas', get: (r) => r.entradas || '' },
    { header: 'Salidas', get: (r) => r.salidas || '' },
    { header: 'Clientes', get: (r) => r.clientes || '' },
    { header: 'Estado', get: (r) => (r.origen === 'confirmado' ? 'Aceptado' : 'Deducido') },
  ]

  ws.addRow(columns.map((c) => c.header))
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7490' } }
  headerRow.alignment = { vertical: 'middle' }

  rows.forEach((r) => ws.addRow(columns.map((c) => c.get(r))))

  columns.forEach((c, idx) => {
    const col = ws.getColumn(idx + 1)
    const maxLen = Math.max(c.header.length, ...rows.map((r) => c.get(r).length))
    col.width = Math.min(60, Math.max(12, maxLen + 2))
  })
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buf = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Inventario_${(companyName || 'empresa').replace(/\s+/g, '_')}.xlsx`)
}
