import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, Footer,
} from 'docx'
import { saveAs } from 'file-saver'
import type { ProcedureData } from '@/lib/claude'
import type { RiskItem } from '@/types/risk'
import type { AuditItem } from '@/lib/procedureAi'
import type { StoredIndicator } from '@/stores/indicatorStore'
import { BLUE, FONT, A4_ANCHO, A4_ALTO, MARGEN_LATERAL, MARGEN_VERTICAL } from './docxPrimitives'
import {
  buildTitlePage,
  buildSipocRelacional,
  buildActividadesTexto,
  buildGlosarioTable,
  buildIndicadoresTable,
  buildRiesgosTable,
  buildRiesgosFromStoreTable,
  buildAuditTable,
  buildObjectivosEspecificos,
  type SipocEntryRow,
} from './docxSections'
import { mergeLegacySipoc } from './sipoc'
import { sectionHeading, bodyParagraph, divider } from './docxPrimitives'

// Los datos que la HERRAMIENTA muestra en pantalla, para exportar exactamente lo
// mismo: riesgos y auditoría del store, indicadores del store, SIPOC relacional
// del catálogo, y el objetivo general que es el de la caracterización.
export interface ProcedureStoreData {
  processRisks?: RiskItem[]
  auditItems?: AuditItem[]
  indicators?: StoredIndicator[]
  sipocEntries?: SipocEntryRow[]
  objetivoGeneral?: string
}

// ── Main export function ────────────────────────────────────────────────────

/**
 * Arma el documento. Separado del guardado para poder comprobar el XML que sale
 * de verdad: `saveAs` necesita navegador, asi que con todo junto no habia forma de
 * afirmar nada sobre el fichero que recibe el cliente. Ver `docxFormato.test.ts`.
 */
export function buildProcedureDocument(
  data: ProcedureData,
  metadata: { companyName: string; processName: string },
  storeData?: ProcedureStoreData
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

          // El objetivo general es el de la CARACTERIZACION (process.description):
          // integrado bidireccionalmente. Solo cae al del jsonb si aquel está vacío.
          sectionHeading('Objetivo', '2'),
          bodyParagraph(storeData?.objetivoGeneral?.trim() || data.objetivoGeneral),
          ...buildObjectivosEspecificos(data.objetivosEspecificos),
          divider(),

          sectionHeading('Alcance', '3'),
          bodyParagraph(data.alcance),
          divider(),

          // SIPOC SIEMPRE en UNA tabla de 4 columnas relacional. Si hay catálogo se
          // usa; si no, se fusionan las dos listas legacy de la IA en 4 columnas.
          // Nunca el desglose antiguo en dos apartados.
          sectionHeading('SIPOC', '4'),
          buildSipocRelacional(
            storeData?.sipocEntries?.length
              ? storeData.sipocEntries
              : mergeLegacySipoc(data.sipocEntradas, data.sipocSalidas)
          ),
          divider(),

          sectionHeading('Glosario', '5'),
          buildGlosarioTable(data.glosario),
          divider(),

          // Actividades en TEXTO (no tabla), igual que la ficha en pantalla.
          sectionHeading('Descripcion de Actividades', '6'),
          ...buildActividadesTexto(data.actividades),
          divider(),

          sectionHeading('Indicadores (KPI)', '7'),
          buildIndicadoresTable(storeData?.indicators ?? []),
          divider(),

          sectionHeading('Riesgos y Controles', '8'),
          storeData?.processRisks?.length
            ? buildRiesgosFromStoreTable(storeData.processRisks)
            : buildRiesgosTable(data.riesgos),
          divider(),

          sectionHeading('Programa de Auditoria', '9'),
          buildAuditTable(storeData?.auditItems ?? []),
        ],
      },
    ],
  })
}

export async function exportProcedureToDocx(
  data: ProcedureData,
  metadata: { companyName: string; processName: string },
  storeData?: ProcedureStoreData
): Promise<void> {
  const blob = await Packer.toBlob(buildProcedureDocument(data, metadata, storeData))
  saveAs(blob, `${metadata.processName}_procedimiento.docx`)
}

export type { ProcedureData }
