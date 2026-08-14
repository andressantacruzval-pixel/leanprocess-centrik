import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * La version del proceso tiene UN solo escritor: «Aprobar y publicar».
 *
 * Esto existe por dos fallos reales, ambos silenciosos:
 *
 *  1. `bumpMinorVersion` se llamaba en `handleSave` sin comparar nada, duplicado
 *     en las DOS pantallas de caracterizacion. Guardar subia la version aunque no
 *     hubiera cambios: en produccion un proceso llego a la 1.37.
 *
 *  2. Al quitar ese bump, `version` se quedo dentro de `formData`. Como
 *     `handleSave` hace `updateProcess({ ...formData })` y `formData` se siembra
 *     UNA vez al montar, publicar y luego guardar **devolvia la version al valor
 *     viejo**. No daba error: el numero simplemente retrocedia.
 *
 * Las dos veces el defecto fue el mismo: dos copias del mismo `handleSave`. Por eso
 * la comprobacion es sobre el codigo fuente y no sobre el render.
 */

const raiz = join(__dirname, '..')
const leer = (rel: string) => readFileSync(join(raiz, rel), 'utf8')

const PANTALLAS_DE_CARACTERIZACION = [
  'pages/ProcessCharacterizationPage.tsx',
  'features/process/pages/ProcessDetailPage.tsx',
]

describe('la version del proceso solo la mueve publicar', () => {
  it.each(PANTALLAS_DE_CARACTERIZACION)(
    '%s no siembra `version` en formData (handleSave la reescribiria vieja)',
    (rel) => {
      const src = leer(rel)
      const inicializador = src.slice(
        src.indexOf('useState<Partial<Process>>'),
        src.indexOf('const handleSave')
      )
      expect(inicializador).not.toMatch(/^\s*version:/m)
    }
  )

  // Se comprueban la llamada y el import, no la palabra: los comentarios de esas
  // pantallas nombran `bumpMinorVersion` a proposito, para explicar por que ya no esta.
  it.each(PANTALLAS_DE_CARACTERIZACION)('%s no bumpea la version al guardar', (rel) => {
    const src = leer(rel)
    expect(src).not.toContain('bumpMinorVersion(')
    expect(src).not.toMatch(/^import .*bumpMinorVersion/m)
  })

  it('usePublishProcess es el unico que escribe la version', () => {
    expect(leer('hooks/usePublishProcess.ts')).toContain('version: bumpMinorVersion(')
  })
})
