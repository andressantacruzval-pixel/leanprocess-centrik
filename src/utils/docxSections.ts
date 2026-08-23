import {
  Paragraph, TextRun, Table, TableCell,
  WidthType, AlignmentType, PageBreak, BorderStyle, ShadingType,
} from 'docx'
import type { ProcedureActivity, ProcedureData } from '@/lib/claude'
import type { RiskItem } from '@/types/risk'
import type { AuditItem } from '@/lib/procedureAi'
import type { StoredIndicator } from '@/stores/indicatorStore'
import { getRiskLevel, computeControlScore } from '@/types/risk'
import {
  BLUE, RED, RED_LIGHT, AMBER_LIGHT, GRAY_LIGHT, WHITE, BLACK, FONT,
  headerCell, textCell, bulletItem, thinBorders, fila, tabla,
} from './docxPrimitives'

const VIOLET = '7C3AED'
const VIOLET_LIGHT = 'F5F3FF'
const TEAL = '0D9488'
const GRAY_HEADER = '6B7280'
const AMBER = 'F59E0B'
const GREEN = '059669'
const GREEN_LIGHT = 'ECFDF5'

// El SIPOC relacional es el MISMO dato que pinta la herramienta: cuatro columnas
// con la fila proveedor→entrada / salida→cliente enlazada. No el desglose en dos
// tablas que generaba la IA (proveedores por un lado, clientes por otro).
export interface SipocEntryRow {
  supplier_name: string
  input_description: string
  output_description: string
  customer_name: string
}

// ── Title page builder ──────────────────────────────────────────────────────

export function buildTitlePage(
  data: ProcedureData,
  metadata: { companyName: string; processName: string }
): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 3000 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: metadata.companyName.toUpperCase(), bold: true, font: FONT, size: 40, color: BLUE }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', font: FONT, size: 20, color: BLUE }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({ text: data.titulo, bold: true, font: FONT, size: 48, color: BLACK }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: 'Codigo: ', bold: true, font: FONT, size: 24, color: '666666' }),
        new TextRun({ text: data.codigo, font: FONT, size: 24, color: BLACK }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: 'Version: ', bold: true, font: FONT, size: 24, color: '666666' }),
        new TextRun({ text: data.version, font: FONT, size: 24, color: BLACK }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: 'Fecha: ', bold: true, font: FONT, size: 24, color: '666666' }),
        new TextRun({ text: data.fecha, font: FONT, size: 24, color: BLACK }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ]
}

// ── SIPOC tables ────────────────────────────────────────────────────────────

export function buildSipocEntradas(entradas: ProcedureData['sipocEntradas']): Table {
  return tabla([
      fila([headerCell('Proveedor', BLUE, 50), headerCell('Entrada', BLUE, 50)], { header: true }),
      ...entradas.map((e, i) =>
        fila([
            textCell(e.proveedor, { bgColor: i % 2 === 0 ? WHITE : GRAY_LIGHT, widthPct: 50 }),
            textCell(e.entrada, { bgColor: i % 2 === 0 ? WHITE : GRAY_LIGHT, widthPct: 50 }),
          ])
      ),
    ], [50, 50])
}

export function buildSipocSalidas(salidas: ProcedureData['sipocSalidas']): Table {
  return tabla([
      fila([headerCell('Salida', BLUE, 50), headerCell('Cliente', BLUE, 50)], { header: true }),
      ...salidas.map((s, i) =>
        fila([
            textCell(s.salida, { bgColor: i % 2 === 0 ? WHITE : GRAY_LIGHT, widthPct: 50 }),
            textCell(s.cliente, { bgColor: i % 2 === 0 ? WHITE : GRAY_LIGHT, widthPct: 50 }),
          ])
      ),
    ], [50, 50])
}

// ── SIPOC relacional (4 columnas, como en la herramienta) ────────────────────

export function buildSipocRelacional(entries: SipocEntryRow[]): Table {
  const headerRow = fila([
      headerCell('Proveedor', RED, 25),
      headerCell('Entrada', GRAY_HEADER, 25),
      headerCell('Salida', TEAL, 25),
      headerCell('Cliente', BLUE, 25),
    ], { header: true })
  if (entries.length === 0) {
    return tabla([headerRow, fila([textCell('Sin datos SIPOC', { span: 4 })])], [25, 25, 25, 25])
  }
  return tabla([
      headerRow,
      ...entries.map((e, i) => {
        const bg = i % 2 === 0 ? WHITE : GRAY_LIGHT
        return fila([
            textCell(e.supplier_name || '-', { bgColor: bg, widthPct: 25 }),
            textCell(e.input_description || '-', { bgColor: bg, widthPct: 25 }),
            textCell(e.output_description || '-', { bgColor: bg, widthPct: 25 }),
            textCell(e.customer_name || '-', { bgColor: bg, widthPct: 25 }),
          ])
      }),
    ], [25, 25, 25, 25])
}

// ── Actividades en TEXTO (no tabla) ──────────────────────────────────────────
// Replica la ficha de la herramienta: número + nombre, «Responsable:», la
// descripción como párrafo, y para las decisiones el bloque «Lógica de Decisión».
// Una barra de color a la izquierda (azul actividad, ámbar decisión) recrea el
// borde de la tarjeta. Antes esto salía como tabla de 5 columnas, que no se
// parecía a la herramienta y aplastaba las descripciones largas.

function accentBorder(color: string) {
  return { left: { style: BorderStyle.SINGLE, size: 18, color, space: 10 } }
}

export function buildActividadesTexto(actividades: ProcedureActivity[]): Paragraph[] {
  if (actividades.length === 0) {
    return [new Paragraph({ children: [new TextRun({ text: 'Sin actividades registradas', italics: true, font: FONT, size: 20, color: '9CA3AF' })] })]
  }
  const bloques: Paragraph[] = []
  actividades.forEach((a, i) => {
    const accent = a.esDecision ? AMBER : BLUE
    const border = accentBorder(accent)
    bloques.push(new Paragraph({
      spacing: { before: 220, after: 40 },
      border,
      keepNext: true,
      children: [
        new TextRun({ text: `${i + 1}. `, bold: true, font: FONT, size: 22, color: accent }),
        new TextRun({ text: a.nombre, bold: true, font: FONT, size: 22, color: BLACK }),
        ...(a.esDecision ? [new TextRun({ text: '   (Decisión)', bold: true, font: FONT, size: 16, color: 'B45309' })] : []),
      ],
    }))
    bloques.push(new Paragraph({
      spacing: { before: 20, after: 40 },
      border,
      keepNext: true,
      children: [
        new TextRun({ text: 'Responsable: ', bold: true, font: FONT, size: 16, color: GRAY_HEADER }),
        new TextRun({ text: a.ejecutor || '—', font: FONT, size: 20, color: '374151' }),
      ],
    }))
    if (a.descripcion) {
      bloques.push(new Paragraph({
        spacing: { before: 20, after: a.esDecision ? 40 : 160 },
        border,
        children: [new TextRun({ text: a.descripcion, font: FONT, size: 20, color: '4B5563' })],
      }))
    }
    if (a.esDecision && a.decisiones) {
      bloques.push(new Paragraph({
        spacing: { before: 20, after: 160 },
        border,
        shading: { type: ShadingType.CLEAR, fill: AMBER_LIGHT, color: AMBER_LIGHT },
        children: [
          new TextRun({ text: 'Lógica de Decisión: ', bold: true, font: FONT, size: 16, color: 'B45309' }),
          new TextRun({ text: a.decisiones, font: FONT, size: 20, color: '92400E' }),
        ],
      }))
    }
  })
  return bloques
}

// ── Glosario table ──────────────────────────────────────────────────────────

export function buildGlosarioTable(glosario: ProcedureData['glosario']): Table {
  return tabla([
      fila([headerCell('Termino', BLUE, 30), headerCell('Definicion', BLUE, 70)], { header: true }),
      ...glosario.map((g, i) =>
        fila([
            textCell(g.termino, { bold: true, bgColor: i % 2 === 0 ? WHITE : GRAY_LIGHT, widthPct: 30 }),
            textCell(g.definicion, { bgColor: i % 2 === 0 ? WHITE : GRAY_LIGHT, widthPct: 70 }),
          ])
      ),
    ], [30, 70])
}

// ── Riesgos table ───────────────────────────────────────────────────────────

export function buildRiesgosTable(riesgos: ProcedureData['riesgos']): Table {
  return tabla([
      fila([
          headerCell('Actividad', RED, 30),
          headerCell('Riesgo', RED, 35),
          headerCell('Control', RED, 35),
        ], { header: true }),
      ...riesgos.map((r, i) =>
        fila([
            textCell(r.actividad, { bold: true, bgColor: i % 2 === 0 ? WHITE : RED_LIGHT, widthPct: 30 }),
            textCell(r.riesgo, { bgColor: i % 2 === 0 ? WHITE : RED_LIGHT, widthPct: 35 }),
            textCell(r.control, { bgColor: i % 2 === 0 ? WHITE : RED_LIGHT, widthPct: 35 }),
          ])
      ),
    ], [30, 35, 35])
}

// ── Riesgos from Risk Store table (rich data) ───────────────────────────────

export function buildRiesgosFromStoreTable(risks: RiskItem[]): Table {
  const headerRow = fila([
      headerCell('Actividad', RED, 20),
      headerCell('Riesgo', RED, 30),
      headerCell('Nivel', RED, 15),
      headerCell('Controles', RED, 35),
    ], { header: true })

  if (risks.length === 0) {
    return tabla([headerRow, fila([textCell('Sin riesgos identificados', { span: 4 })])], [20, 30, 15, 35])
  }

  return tabla([
      headerRow,
      ...risks.map((risk, i) => {
        const { label } = getRiskLevel(risk.inherentProbability, risk.inherentImpact)
        const rowBg = i % 2 === 0 ? WHITE : RED_LIGHT
        const riesgoCell = new TableCell({
          children: [
            new Paragraph({
              spacing: { before: 30, after: 8 },
              children: [new TextRun({ text: risk.title, bold: true, font: FONT, size: 20, color: BLACK })],
            }),
            ...(risk.description
              ? [new Paragraph({ spacing: { before: 8, after: 30 }, children: [new TextRun({ text: risk.description, font: FONT, size: 18, color: '6B7280' })] })]
              : []),
          ],
          borders: thinBorders(),
          shading: { type: 'clear' as never, fill: rowBg, color: rowBg },
          width: { size: 30, type: WidthType.PERCENTAGE },
        } as never)
        const controlesCell = new TableCell({
          children: risk.controls.length > 0
            ? risk.controls.map((c) => {
                const { effectiveness } = computeControlScore(c)
                return new Paragraph({
                  spacing: { before: 20, after: 20 },
                  children: [
                    new TextRun({ text: `[${effectiveness}] `, bold: true, font: FONT, size: 18, color: '374151' }),
                    new TextRun({ text: c.description || 'Sin descripcion', font: FONT, size: 18, color: BLACK }),
                  ],
                })
              })
            : [new Paragraph({ children: [new TextRun({ text: 'Sin controles', font: FONT, size: 18, color: '9CA3AF' })] })],
          borders: thinBorders(),
          shading: { type: 'clear' as never, fill: rowBg, color: rowBg },
          width: { size: 35, type: WidthType.PERCENTAGE },
        } as never)
        return fila([
            textCell(risk.processStep || '-', { bgColor: rowBg, widthPct: 20 }),
            riesgoCell,
            textCell(label, { bgColor: rowBg, widthPct: 15, alignment: AlignmentType.CENTER }),
            controlesCell,
          ])
      }),
  ], [20, 30, 15, 35])
}

// ── Audit program table ─────────────────────────────────────────────────────

export function buildAuditTable(items: AuditItem[]): Table {
  const headerRow = fila([
      headerCell('Actividad', VIOLET, 20),
      headerCell('Que Auditar', VIOLET, 25),
      headerCell('Criterio', VIOLET, 25),
      headerCell('Evidencia', VIOLET, 15),
      headerCell('Frecuencia', VIOLET, 15),
    ], { header: true })

  if (items.length === 0) {
    return tabla([headerRow, fila([textCell('Sin programa de auditoria', { span: 5 })])], [20, 25, 25, 15, 15])
  }

  return tabla([
      headerRow,
      ...items.map((item, i) => {
        const bg = i % 2 === 0 ? WHITE : VIOLET_LIGHT
        return fila([
            textCell(item.actividad || '-', { bgColor: bg, widthPct: 20 }),
            textCell(item.queAuditar || '-', { bgColor: bg, widthPct: 25 }),
            textCell(item.criterio || '-', { bgColor: bg, widthPct: 25 }),
            textCell(item.evidencia || '-', { bgColor: bg, widthPct: 15 }),
            textCell(item.frecuencia || '-', { bgColor: bg, widthPct: 15, alignment: AlignmentType.CENTER }),
          ])
      }),
    ], [20, 25, 25, 15, 15])
}

// ── Indicadores (KPI) table ─────────────────────────────────────────────────

export function buildIndicadoresTable(indicators: StoredIndicator[]): Table {
  const headerRow = fila([
      headerCell('Indicador', GREEN, 26),
      headerCell('Formula', GREEN, 24),
      headerCell('Meta', GREEN, 14),
      headerCell('Frecuencia', GREEN, 16),
      headerCell('Responsable', GREEN, 20),
    ], { header: true })

  if (indicators.length === 0) {
    return tabla([headerRow, fila([textCell('Sin indicadores definidos', { span: 5 })])], [26, 24, 14, 16, 20])
  }

  return tabla([
      headerRow,
      ...indicators.map((ind, i) => {
        const bg = i % 2 === 0 ? WHITE : GREEN_LIGHT
        const meta = [ind.target_value, ind.unit].filter(Boolean).join(' ')
        return fila([
            textCell(ind.name || '-', { bold: true, bgColor: bg, widthPct: 26 }),
            textCell(ind.formula || '-', { bgColor: bg, widthPct: 24 }),
            textCell(meta || '-', { bgColor: bg, widthPct: 14, alignment: AlignmentType.CENTER }),
            textCell(ind.frequency || '-', { bgColor: bg, widthPct: 16, alignment: AlignmentType.CENTER }),
            textCell(ind.owner || '-', { bgColor: bg, widthPct: 20 }),
          ])
      }),
    ], [26, 24, 14, 16, 20])
}

// ── Objectives subsection ───────────────────────────────────────────────────

export function buildObjectivosEspecificos(objetivos: string[]): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 150, after: 80 },
      children: [
        new TextRun({ text: 'Objetivos Especificos:', bold: true, font: FONT, size: 22, color: '374151' }),
      ],
    }),
    ...objetivos.map((obj) => bulletItem(obj)),
  ]
}
