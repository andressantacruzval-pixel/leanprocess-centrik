import {
  Paragraph, TextRun, Table, TableCell,
  WidthType, AlignmentType, PageBreak,
} from 'docx'
import type { ProcedureActivity, ProcedureData } from '@/lib/claude'
import type { RiskItem } from '@/types/risk'
import type { AuditItem } from '@/lib/procedureAi'
import { getRiskLevel, computeControlScore } from '@/types/risk'
import {
  BLUE, RED, RED_LIGHT, AMBER_LIGHT, GRAY_LIGHT, WHITE, BLACK, FONT,
  headerCell, textCell, bulletItem, thinBorders, fila, tabla,
} from './docxPrimitives'

const VIOLET = '7C3AED'
const VIOLET_LIGHT = 'F5F3FF'

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

// ── Activities table ────────────────────────────────────────────────────────

export function buildActividadesTable(actividades: ProcedureActivity[]): Table {
  return tabla([
      fila([
          headerCell('No.', BLUE, 8),
          headerCell('Actividad', BLUE, 20),
          headerCell('Ejecutor', BLUE, 15),
          headerCell('Descripcion', BLUE, 37),
          headerCell('Decisiones', BLUE, 20),
        ], { header: true }),
      ...actividades.map((a, i) => {
        const rowBg = a.esDecision ? AMBER_LIGHT : i % 2 === 0 ? WHITE : GRAY_LIGHT
        return fila([
            textCell(String(i + 1), { bgColor: rowBg, widthPct: 8, alignment: AlignmentType.CENTER }),
            textCell(a.nombre, { bgColor: rowBg, bold: a.esDecision, widthPct: 20 }),
            textCell(a.ejecutor, { bgColor: rowBg, widthPct: 15 }),
            textCell(a.descripcion, { bgColor: rowBg, widthPct: 37 }),
            textCell(a.decisiones, { bgColor: rowBg, widthPct: 20 }),
          ])
      }),
    ], [8, 20, 15, 37, 20])
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
