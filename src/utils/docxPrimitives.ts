import {
  Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle,
  ShadingType, TableLayoutType,
} from 'docx'

// ── Pagina A4 ───────────────────────────────────────────────────────────────
//
// `docx` no declara tamaño de pagina si no se le dice, y su defecto es US LETTER
// (216×279mm). El documento salia en Carta, no en A4: en una impresora europea o
// latinoamericana eso son margenes desiguales y una franja en blanco abajo.
//
// Todo en TWIPS (1/1440 de pulgada), que es la unidad de OOXML.

export const A4_ANCHO = 11906  // 210mm
export const A4_ALTO = 16838   // 297mm
export const MARGEN_LATERAL = 1080  // 0.75"
export const MARGEN_VERTICAL = 1440 // 1"

/** Lo que queda para el contenido entre los dos margenes. Las tablas miden esto. */
export const ANCHO_UTIL = A4_ANCHO - MARGEN_LATERAL * 2  // 9746

/**
 * Reparte el ancho util entre columnas segun porcentajes.
 *
 * Hace falta porque una tabla con anchos en % pero sin `tblGrid` deja que Word
 * autoajuste, y Word reparte por el contenido: la columna con textos largos se
 * comia a las demas y las tablas salian descuadradas. Con la rejilla explicita el
 * resultado es el mismo en Word, LibreOffice y Google Docs.
 */
export function anchosDeColumna(porcentajes: number[]): number[] {
  return porcentajes.map((p) => Math.round((ANCHO_UTIL * p) / 100))
}

// ── Color constants ─────────────────────────────────────────────────────────

export const BLUE = '2563EB'
export const RED = 'DC2626'
export const RED_LIGHT = 'FEF2F2'
export const AMBER_LIGHT = 'FEF3C7'
export const GRAY_LIGHT = 'F9FAFB'
export const WHITE = 'FFFFFF'
export const BLACK = '000000'
export const FONT = 'Aptos'

// ── Helpers ─────────────────────────────────────────────────────────────────

export function thinBorders() {
  const side = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
  return { top: side, bottom: side, left: side, right: side }
}

export function headerCell(text: string, bgColor: string = BLUE, widthPct?: number): TableCell {
  const cellOpts: Record<string, unknown> = {
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({ text, bold: true, color: WHITE, font: FONT, size: 20 }),
        ],
      }),
    ],
    shading: { type: ShadingType.CLEAR, fill: bgColor, color: bgColor },
    borders: thinBorders(),
    verticalAlign: 'center' as unknown as undefined,
  }
  if (widthPct !== undefined) {
    cellOpts.width = { size: widthPct, type: WidthType.PERCENTAGE }
  }
  return new TableCell(cellOpts as never)
}

export function textCell(
  text: string,
  opts?: { bold?: boolean; bgColor?: string; widthPct?: number; span?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] }
): TableCell {
  const cellOpts: Record<string, unknown> = {
    children: [
      new Paragraph({
        alignment: opts?.alignment ?? AlignmentType.LEFT,
        spacing: { before: 30, after: 30 },
        children: [
          new TextRun({ text, bold: opts?.bold ?? false, font: FONT, size: 20, color: BLACK }),
        ],
      }),
    ],
    borders: thinBorders(),
  }
  if (opts?.bgColor) {
    cellOpts.shading = { type: ShadingType.CLEAR, fill: opts.bgColor, color: opts.bgColor }
  }
  if (opts?.widthPct !== undefined) {
    cellOpts.width = { size: opts.widthPct, type: WidthType.PERCENTAGE }
  }
  // Con rejilla fija, una fila de «sin datos» sin `columnSpan` se dibujaria solo en
  // la primera columna y dejaria el resto en blanco.
  if (opts?.span !== undefined) {
    cellOpts.columnSpan = opts.span
  }
  return new TableCell(cellOpts as never)
}

/**
 * Una fila. SIEMPRE con `cantSplit`.
 *
 * Sin eso Word parte la fila por la mitad al cambiar de pagina: media celda en una
 * hoja y el resto en la siguiente, con los bordes abiertos. Es lo que se veia en
 * las tablas de actividades y riesgos, que son las que tienen textos largos.
 *
 * Existe esta funcion —en vez de repetir la opcion en las 16 filas— porque una
 * tabla nueva se escribe copiando la de al lado, y asi no hay nada que olvidar.
 * Lo vigila `docxFormato.test.ts`.
 */
export function fila(children: TableCell[], opts?: { header?: boolean }): TableRow {
  return new TableRow({
    children,
    cantSplit: true,
    ...(opts?.header ? { tableHeader: true } : {}),
  })
}

/**
 * Una tabla con rejilla fija sobre el ancho util de A4.
 *
 * `porcentajes` debe sumar 100 y tener tantas entradas como columnas.
 */
export function tabla(rows: TableRow[], porcentajes: number[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: anchosDeColumna(porcentajes),
    rows,
  })
}

export function sectionHeading(text: string, numbering?: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    // Un titulo nunca se queda solo al final de una hoja, separado de su tabla.
    keepNext: true,
    children: [
      new TextRun({
        text: numbering ? `${numbering}. ${text}` : text,
        bold: true, font: FONT, size: 28, color: BLUE,
      }),
    ],
  })
}

export function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    children: [new TextRun({ text, font: FONT, size: 22, color: '333333' })],
  })
}

export function bulletItem(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: FONT, size: 22, color: '333333' })],
  })
}

export function divider(): Paragraph {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD', space: 1 } },
    children: [],
  })
}
