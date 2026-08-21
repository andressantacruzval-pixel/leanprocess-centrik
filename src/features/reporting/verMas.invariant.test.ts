import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * El fallo clasico de una tabla paginada es «exporte y me faltan filas porque
 * estaba en la primera pagina». Aqui no puede pasar, y esto lo sostiene:
 *
 *  · Cada reporte pinta `visibles` (una tanda de 100).
 *  · La exportacion lee `filteredProcesses` (el conjunto filtrado ENTERO).
 *
 * Son dos caminos distintos a proposito. El dia que alguien los una para
 * «simplificar», el export empieza a mentir sin dar ningun error — y el que lo
 * descubre es el cliente, contando filas en un Excel.
 */

const page = readFileSync(join(__dirname, 'pages/ReportsPage.tsx'), 'utf8')

// Los cinco reportes paginados viven ahora en archivos propios (cada uno con su
// tablero de gráficos). El Inventario es su propio reporte en features/inventory.
const REPORTES = ['RisksReport', 'KpisReport', 'ValueReport', 'AuditReport', 'ImprovementsReport']
const fuentes = REPORTES.map((r) => readFileSync(join(__dirname, `reports/${r}.tsx`), 'utf8'))

describe('el «ver mas» no puede recortar la exportacion', () => {
  it('la exportacion parte del conjunto filtrado completo', () => {
    const handleExport = page.slice(page.indexOf('const handleExport'), page.indexOf('const hasFilters'))
    expect(handleExport).toContain('processes: filteredProcesses')
    expect(handleExport).not.toContain('visibles')
  })

  it('los cinco reportes pintan `visibles`, no la lista entera', () => {
    fuentes.forEach((src, i) => {
      expect((src.match(/\{visibles\.map\(/g) ?? []).length, REPORTES[i]).toBe(1)
    })
  })

  it('los cinco reportes ofrecen «ver mas»', () => {
    fuentes.forEach((src, i) => {
      expect((src.match(/<VerMasRow /g) ?? []).length, REPORTES[i]).toBe(1)
    })
  })
})
