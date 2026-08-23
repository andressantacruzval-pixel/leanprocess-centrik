import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Document, Packer } from 'docx'
import JSZip from 'jszip'
import {
  A4_ANCHO, A4_ALTO, ANCHO_UTIL, MARGEN_LATERAL, MARGEN_VERTICAL,
  anchosDeColumna, sectionHeading, textCell, fila, tabla,
} from './docxPrimitives'
import { buildProcedureDocument } from './procedureDocxExporter'
import type { ProcedureData } from '@/lib/claude'

/**
 * El formato del procedimiento exportado, comprobado sobre el XML que se genera de
 * verdad — no sobre el codigo que deberia generarlo.
 *
 * Se pidio: A4, que las tablas no se corten entre paginas y que se vean bien.
 * Las tres cosas son atributos de OOXML que o estan o no estan, asi que se pueden
 * afirmar; lo que NO cubre esto es si el resultado es bonito, que solo se ve
 * abriendo el archivo.
 */

/**
 * El .docx es un zip. `Packer.toString` devuelve el zip entero, asi que hay que
 * abrirlo para leer el XML de verdad — que es el objetivo: comprobar el fichero
 * que recibe el cliente, no el codigo que lo escribe.
 */
async function xmlDe(doc: Document): Promise<string> {
  const buffer = await Packer.toBuffer(doc)
  const zip = await JSZip.loadAsync(buffer)
  return zip.file('word/document.xml')!.async('string')
}

const docConTabla = () =>
  new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_ANCHO, height: A4_ALTO },
            margin: {
              top: MARGEN_VERTICAL, bottom: MARGEN_VERTICAL,
              right: MARGEN_LATERAL, left: MARGEN_LATERAL,
            },
          },
        },
        children: [
          sectionHeading('Actividades', '5'),
          tabla(
            [
              fila([textCell('Cabecera')], { header: true }),
              fila([textCell('Una fila con texto largo que podria partirse')]),
            ],
            [100]
          ),
        ],
      },
    ],
  })

describe('formato del procedimiento exportado', () => {
  it('la pagina es A4, no US Letter', async () => {
    const xml = await xmlDe(docConTabla())
    // A4 = 210×297mm en twips. El defecto de `docx` es Letter: 12240×15840.
    expect(xml).toContain('w:w="11906"')
    expect(xml).toContain('w:h="16838"')
    expect(xml).not.toContain('w:w="12240"')
  })

  it('las filas no se parten entre paginas', async () => {
    const xml = await xmlDe(docConTabla())
    expect(xml).toContain('<w:cantSplit')
  })

  it('la cabecera de la tabla se repite en cada pagina', async () => {
    const xml = await xmlDe(docConTabla())
    expect(xml).toContain('<w:tblHeader')
  })

  it('la tabla lleva rejilla fija, para que Word no reparta a su gusto', async () => {
    const xml = await xmlDe(docConTabla())
    expect(xml).toContain('w:type="fixed"')
    expect(xml).toContain('<w:tblGrid')
  })

  it('un titulo no se queda solo al final de una pagina', async () => {
    const xml = await xmlDe(docConTabla())
    expect(xml).toContain('<w:keepNext')
  })
})

describe('anchosDeColumna', () => {
  it('reparte el ancho util de A4, no el ancho de la hoja', () => {
    expect(ANCHO_UTIL).toBe(A4_ANCHO - MARGEN_LATERAL * 2)
    expect(anchosDeColumna([50, 50])).toEqual([4873, 4873])
  })

  it('las columnas suman el ancho util (±1 por redondeo)', () => {
    for (const pcts of [[50, 50], [8, 20, 15, 37, 20], [30, 70], [20, 30, 15, 35], [20, 25, 25, 15, 15]]) {
      const suma = anchosDeColumna(pcts).reduce((a, b) => a + b, 0)
      expect(Math.abs(suma - ANCHO_UTIL)).toBeLessThanOrEqual(1)
    }
  })
})

describe('las tablas no pueden saltarse los helpers', () => {
  // `fila` y `tabla` son las que ponen cantSplit y la rejilla. Construir una tabla
  // a mano se ve identico en el editor y se rompe al imprimir, que es cuando ya
  // esta en manos del cliente.
  it('docxSections no construye Table ni TableRow a pelo', () => {
    const src = readFileSync(join(__dirname, 'docxSections.ts'), 'utf8')
    expect(src).not.toContain('new TableRow(')
    expect(src).not.toContain('new Table(')
  })
})

// ── El documento REAL, no uno de laboratorio ────────────────────────────────

const PROCEDIMIENTO = {
  titulo: 'Exportacion de Cafe', codigo: 'PRO-VENTAS-001', version: '1.4',
  fecha: '2026-08-11', introduccion: 'Intro', objetivoGeneral: 'Objetivo',
  objetivosEspecificos: ['Uno', 'Dos'], alcance: 'Alcance',
  sipocEntradas: [{ proveedor: 'Proveedor', entrada: 'Entrada' }],
  sipocSalidas: [{ salida: 'Salida', cliente: 'Cliente' }],
  actividades: [{ nombre: 'Definir Incoterms', ejecutor: 'Exportador', descripcion: 'x'.repeat(400), decisiones: '', esDecision: false }],
  glosario: [{ termino: 'FOB', definicion: 'Free on board' }],
  riesgos: [{ actividad: 'Definir', riesgo: 'Retraso', control: 'Revision' }],
} as unknown as ProcedureData

describe('el procedimiento que descarga el cliente', () => {
  it('sale en A4 y con las filas sin partir', async () => {
    const xml = await xmlDe(buildProcedureDocument(PROCEDIMIENTO, { companyName: 'Terrafresca', processName: 'Exportacion' }))
    expect(xml).toContain('w:w="11906"')
    expect(xml).toContain('w:h="16838"')
    expect(xml).toContain('<w:cantSplit')
    expect(xml).toContain('w:type="fixed"')
    expect(xml).toContain('<w:tblHeader')
  })

  it('ninguna tabla se queda sin rejilla de columnas', async () => {
    const xml = await xmlDe(buildProcedureDocument(PROCEDIMIENTO, { companyName: 'Terrafresca', processName: 'Exportacion' }))
    const tablas = (xml.match(/<w:tbl>/g) ?? []).length
    const rejillas = (xml.match(/<w:tblGrid>/g) ?? []).length
    expect(tablas).toBeGreaterThan(0)
    expect(rejillas).toBe(tablas)
  })
})

// ── Paridad con la herramienta: SIPOC 4 col, actividades en texto, KPIs, objetivo ─

describe('el procedimiento exporta lo mismo que la herramienta', () => {
  const storeData = {
    processRisks: [],
    auditItems: [],
    objetivoGeneral: 'Objetivo tomado de la caracterizacion',
    indicators: [
      { id: 'k1', process_id: 'p', name: 'Tiempo de ciclo', formula: 'fin - inicio', unit: 'dias', frequency: 'Mensual', target_value: '5', owner: 'Jefe de Planta' },
    ] as never,
    sipocEntries: [
      { supplier_name: 'Bodega', input_description: 'Materia prima', output_description: 'Lote empacado', customer_name: 'Distribuidor' },
    ],
  }

  it('el SIPOC sale en UNA tabla de 4 columnas (proveedor-entrada-salida-cliente)', async () => {
    const xml = await xmlDe(buildProcedureDocument(PROCEDIMIENTO, { companyName: 'T', processName: 'X' }, storeData))
    // Cabeceras en plural, como la herramienta.
    for (const h of ['Proveedores', 'Entradas', 'Salidas', 'Clientes']) expect(xml).toContain(h)
    for (const v of ['Bodega', 'Materia prima', 'Lote empacado', 'Distribuidor']) expect(xml).toContain(v)
    // Colores de cabecera exactos: rojo, gris-800, teal, azul.
    for (const fill of ['DC2626', '1F2937', '0D9488', '2563EB']) expect(xml).toContain(`w:fill="${fill}"`)
    // Una sola rejilla de 4 columnas en la tabla del SIPOC (no dos tablas).
    const sipocTbl = (xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? []).find((t) => t.includes('Proveedores'))
    expect(sipocTbl).toBeTruthy()
    expect((sipocTbl!.match(/<w:gridCol/g) ?? []).length).toBe(4)
    // Sin catálogo NO debe salir el desglose legacy en dos tablas.
    expect(xml).not.toContain('Entradas (Proveedores)')
    expect(xml).not.toContain('Salidas (Clientes)')
  })

  it('las actividades NO van en tabla: su descripcion es texto de párrafo', async () => {
    const xml = await xmlDe(buildProcedureDocument(PROCEDIMIENTO, { companyName: 'T', processName: 'X' }, storeData))
    // La actividad y su responsable aparecen como texto.
    expect(xml).toContain('Definir Incoterms')
    expect(xml).toContain('Responsable:')
    // Con catálogo SIPOC: tablas = SIPOC(1)+Glosario(1)+KPI(1)+Riesgos(1)+Auditoria(1)=5.
    // Si las actividades siguieran en tabla, serían 6.
    const tablas = (xml.match(/<w:tbl>/g) ?? []).length
    expect(tablas).toBe(5)
  })

  it('incluye la seccion de Indicadores (KPI) con los datos del store', async () => {
    const xml = await xmlDe(buildProcedureDocument(PROCEDIMIENTO, { companyName: 'T', processName: 'X' }, storeData))
    expect(xml).toContain('Indicadores (KPI)')
    expect(xml).toContain('Tiempo de ciclo')
    expect(xml).toContain('fin - inicio')
  })

  it('el objetivo general es el de la caracterizacion, no el del jsonb', async () => {
    const xml = await xmlDe(buildProcedureDocument(PROCEDIMIENTO, { companyName: 'T', processName: 'X' }, storeData))
    expect(xml).toContain('Objetivo tomado de la caracterizacion')
    expect(xml).not.toContain('>Objetivo<') // el objetivoGeneral del jsonb fixture era 'Objetivo'
  })
})
