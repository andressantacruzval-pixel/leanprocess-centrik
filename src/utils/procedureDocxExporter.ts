import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, Footer,
} from 'docx'
import { saveAs } from 'file-saver'
import type { ProcedureData } from '@/lib/claude'
import type { RiskItem } from '@/types/risk'
import type { AuditItem } from '@/lib/procedureAi'
import { BLUE, FONT, A4_ANCHO, A4_ALTO, MARGEN_LATERAL, MARGEN_VERTICAL } from './docxPrimitives'
import {
  buildTitlePage,
  buildSipocEntradas,
  buildSipocSalidas,
  buildActividadesTable,
  buildGlosarioTable,
  buildRiesgosTable,
  buildRiesgosFromStoreTable,
  buildAuditTable,
  buildObjectivosEspecificos,
} from './docxSections'
import { sectionHeading, bodyParagraph, divider } from './docxPrimitives'

// ── Main export function ────────────────────────────────────────────────────

/**
 * Arma el documento. Separado del guardado para poder comprobar el XML que sale
 * de verdad: `saveAs` necesita navegador, asi que con todo junto no habia forma de
 * afirmar nada sobre el fichero que recibe el cliente. Ver `docxFormato.test.ts`.
 */
export function buildProcedureDocument(
  data: ProcedureData,
  metadata: { companyName: string; processName: string },
  storeData?: { processRisks?: RiskItem[]; auditItems?: AuditItem[] }
): Document {
  return new Document({
    creator: metadata.companyName,
    title: data.titulo,
    description: `Procedimiento: ${data.titulo} - ${data.codigo}`,
    styles: {
      default: {
        document: { run: { font: FONT, size: 22 } },
        heading1: {
          run: { font: FONT, size: 28, bold: true, color: BLUE },
          paragraph: { spacing: { before: 400, after: 200 } },
        },
        heading2: {
          run: { font: FONT, size: 24, bold: true, color: '374151' },
          paragraph: { spacing: { before: 300, after: 150 } },
        },
      },
    },
    sections: [
      {
        properties: {
          // A4 explicito. Sin `size`, `docx` cae a US Letter (216×279mm) y el
          // documento salia en Carta: margenes desiguales al imprimir y una franja
          // en blanco al pie. Ver las constantes en docxPrimitives.
          page: {
            size: { width: A4_ANCHO, height: A4_ALTO },
            margin: {
              top: MARGEN_VERTICAL, bottom: MARGEN_VERTICAL,
              right: MARGEN_LATERAL, left: MARGEN_LATERAL,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${data.codigo} | ${data.titulo} | v${data.version}`,
                    font: FONT, size: 16, color: '999999',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...buildTitlePage(data, metadata),

          sectionHeading('Introduccion', '1'),
          bodyParagraph(data.introduccion),
          divider(),

          sectionHeading('Objetivo General', '2'),
          bodyParagraph(data.objetivoGeneral),
          ...buildObjectivosEspecificos(data.objetivosEspecificos),
          divider(),

          sectionHeading('Alcance', '3'),
          bodyParagraph(data.alcance),
          divider(),

          sectionHeading('SIPOC', '4'),
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: 'Entradas (Proveedores)', bold: true, font: FONT, size: 24, color: '374151' })],
          }),
          buildSipocEntradas(data.sipocEntradas),
          new Paragraph({ spacing: { before: 300, after: 100 }, children: [] }),
          new Paragraph({
            spacing: { before: 100, after: 100 },
            children: [new TextRun({ text: 'Salidas (Clientes)', bold: true, font: FONT, size: 24, color: '374151' })],
          }),
          buildSipocSalidas(data.sipocSalidas),
          divider(),

          sectionHeading('Descripcion de Actividades', '5'),
          buildActividadesTable(data.actividades),
          divider(),

          sectionHeading('Glosario', '6'),
          buildGlosarioTable(data.glosario),
          divider(),

          sectionHeading('Riesgos y Controles', '7'),
          storeData?.processRisks?.length
            ? buildRiesgosFromStoreTable(storeData.processRisks)
            : buildRiesgosTable(data.riesgos),

          ...(storeData?.auditItems?.length
            ? [
                divider(),
                sectionHeading('Programa de Auditoria', '8'),
                buildAuditTable(storeData.auditItems),
              ]
            : []),
        ],
      },
    ],
  })
}

export async function exportProcedureToDocx(
  data: ProcedureData,
  metadata: { companyName: string; processName: string },
  storeData?: { processRisks?: RiskItem[]; auditItems?: AuditItem[] }
): Promise<void> {
  const blob = await Packer.toBlob(buildProcedureDocument(data, metadata, storeData))
  saveAs(blob, `${metadata.processName}_procedimiento.docx`)
}

export type { ProcedureData }
