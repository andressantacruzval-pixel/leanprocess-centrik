import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * El fallo clasico de una tabla paginada es «exporte y me faltan filas porque
 * estaba en la primera pagina». Aqui no puede pasar, y esto lo sostiene:
 *
 *  · La tabla pinta `visibles` (una tanda de 100).
 *  · La exportacion lee `filteredProcesses` (el conjunto filtrado ENTERO).
 *
 * Son dos variables distintas a proposito. El dia que alguien las una para
 * «simplificar», el export empieza a mentir sin dar ningun error — y el que lo
 * descubre es el cliente, contando filas en un Excel.
 */

const src = readFileSync(
  join(__dirname, 'pages/ReportsPage.tsx'),
  'utf8'
)

describe('el «ver mas» no puede recortar la exportacion', () => {
  it('la exportacion parte del conjunto filtrado completo', () => {
    const handleExport = src.slice(
      src.indexOf('const handleExport'),
      src.indexOf('const hasFilters')
    )
    expect(handleExport).toContain('processes: filteredProcesses')
    expect(handleExport).not.toContain('visibles')
  })

  it('las tablas pintan `visibles`, no la lista entera', () => {
    // Cinco pestañas paginadas: riesgos, kpis, valor, auditoria y mejoras.
    // (El «Inventario» es un reporte propio con tabla + gráficos + filtros, en
    // features/inventory, no una tabla paginada de esta página.)
    expect((src.match(/\{visibles\.map\(/g) ?? []).length).toBe(5)
  })

  it('las cinco pestañas de tabla ofrecen «ver mas»', () => {
    expect((src.match(/<VerMasRow /g) ?? []).length).toBe(5)
  })
})
