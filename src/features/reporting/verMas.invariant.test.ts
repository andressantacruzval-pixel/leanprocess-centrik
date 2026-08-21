import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * El fallo clasico de una tabla paginada es «exporte y me faltan filas porque
 * estaba en la primera pagina». Aqui no puede pasar, y esto lo sostiene:
 *
 *  · La vista pinta `visibles` (una tanda de 100) — ahora dentro de `DataTable`,
 *    que TODOS los reportes usan.
 *  · La exportacion lee `filteredProcesses` (el conjunto filtrado ENTERO).
 *
 * Son dos caminos distintos a proposito. El dia que alguien los una para
 * «simplificar», el export empieza a mentir sin dar ningun error — y el que lo
 * descubre es el cliente, contando filas en un Excel.
 */

const page = readFileSync(join(__dirname, 'pages/ReportsPage.tsx'), 'utf8')
const dataTable = readFileSync(join(__dirname, 'components/DataTable.tsx'), 'utf8')

// Los cinco reportes paginados viven ahora en archivos propios (cada uno con su
// tablero de gráficos) y delegan la tabla —y su paginación— en `DataTable`. El
// Inventario es su propio reporte en features/inventory.
const REPORTES = ['RisksReport', 'KpisReport', 'ValueReport', 'AuditReport', 'ImprovementsReport']
const fuentes = REPORTES.map((r) => readFileSync(join(__dirname, `reports/${r}.tsx`), 'utf8'))

describe('el «ver mas» no puede recortar la exportacion', () => {
  it('la exportacion parte del conjunto filtrado completo', () => {
    const handleExport = page.slice(page.indexOf('const handleExport'), page.indexOf('const hasFilters'))
    expect(handleExport).toContain('processes: filteredProcesses')
    expect(handleExport).not.toContain('visibles')
  })

  it('la paginación (una tanda) vive centralizada en DataTable', () => {
    // DataTable pinta solo `visibles` y ofrece «ver más» sobre el conjunto ENTERO
    // que recibe (`processed`), sin recortar los datos que llegan al export.
    expect((dataTable.match(/visibles\.map\(/g) ?? []).length).toBe(1)
    expect(dataTable).toContain('Ver {Math.min(ocultas, FILAS_POR_TANDA)} más')
  })

  it('los cinco reportes delegan la tabla en DataTable', () => {
    fuentes.forEach((src, i) => {
      expect((src.match(/<DataTable /g) ?? []).length, REPORTES[i]).toBe(1)
    })
  })
})
