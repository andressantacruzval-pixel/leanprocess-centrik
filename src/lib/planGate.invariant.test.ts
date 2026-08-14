/**
 * Invariante: ninguna pantalla puede crear documentación sin consultar el cupo.
 *
 * POR QUÉ EXISTE. El tope de procesos documentados lo garantiza la base
 * (`enforce_documentable_level` en las 7 tablas + `enforce_documentable_level_processes`
 * para `bpmn_xml`), así que nadie puede pasarse del cupo. Pero si una pantalla deja
 * ABRIR el editor, el usuario trabaja y **pierde el trabajo al guardar**. Eso es peor
 * que un botón gris, porque el esfuerzo ya está invertido cuando se entera.
 *
 * Pasó de verdad: `SipocSection` creaba entradas SIPOC —que cuentan como documentación—
 * desde `ProcessDetailPage`, que no lleva guardián. Se llegaba por Niveles de proceso.
 *
 * QUÉ VIGILA. Solo la CREACIÓN, que es lo único que documenta un proceso nuevo. Editar
 * o borrar algo existente no mueve el contador — el proceso ya contaba — y es la misma
 * línea que traza el trigger, que solo mira INSERT. Por eso `HeatMapPage`, que solo hace
 * `updateRisk`/`deleteRisk`, no aparece aquí.
 *
 * CÓMO SE ARREGLA CUANDO FALLA. Dos opciones, y la segunda exige pensar:
 *   1. Que la pantalla llame a `useDocumentableGuard(processId)` o consulte
 *      `usePlanLimits().puedeDocumentar(id)` para deshabilitar el botón de crear.
 *   2. Si es un componente hijo que ya cubre una pantalla guardada, añadirlo abajo
 *      **nombrando al padre**. Ojo: hay que comprobarlo, no suponerlo. Si mañana alguien
 *      lo monta desde otro sitio, la cobertura desaparece sin que nadie lo note.
 *
 * ⚠️ `ProcessDetailPage` NO puede llevar el guardián: `useDocumentableGuard` redirige
 * justo a esa página, así que se quedaría dando vueltas sobre sí misma. Lo que cuelga de
 * ella se frena en el componente.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = join(process.cwd(), 'src')

/** Carpetas donde vive la interfaz. Los stores y servicios son la fontanería: ellos
 *  escriben por encargo y no deciden nada, así que no se les pide la comprobación. */
const CARPETAS_DE_UI = ['pages', 'components']

/** Crear documentación. `update`/`delete` quedan fuera a propósito (ver cabecera). */
const CREA_DOCUMENTACION =
  /\b(add|create|upsert)(Sipoc|Risk|Indicator|Procedure|Audit|ValueActivit|Bpmn)|bpmn_xml:/

const CONSULTA_EL_CUPO = /useDocumentableGuard|usePlanLimits/

/**
 * Componentes que no comprueban porque ya lo hace la pantalla que los monta.
 * El valor es el padre que los cubre — es lo que hay que reverificar si esto falla.
 */
const CUBIERTOS_POR_SU_PADRE: Record<string, string> = {
  'features/audit/components/AuditItemModal.tsx': 'AuditTab → ProcessCharacterizationPage',
  'features/bpmn/components/BpmnModeler.tsx': 'BpmnEditorPage y FlowchartOnboardingPage',
  'features/kpi/components/IndicatorsTab.tsx': 'KpiPage',
  'features/risk/components/RiskPanel.tsx': 'ProcessCharacterizationPage',
  'pages/FlowchartChatMode.tsx': 'FlowchartOnboardingPage (único que lo monta)',
  // No lo monta nadie: está exportado en el barrel y sin usar. Si alguien lo monta,
  // hay que darle guardián — escribe `bpmn_xml` sin mirar el cupo.
  'components/workspace/AiConsultantDrawer.tsx': 'NADIE — código muerto, ver comentario',
}

function archivosDeUi(dir: string, salida: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) archivosDeUi(ruta, salida)
    else if (/\.tsx$/.test(nombre) && !/\.test\.tsx$/.test(nombre)) salida.push(ruta)
  }
  return salida
}

/**
 * Llevar a una pantalla de documentación. Son las que tienen `useDocumentableGuard`,
 * así que sin cupo REBOTAN — y rebotar es el fallo: el usuario pulsa, se carga algo y
 * se le expulsa sin explicación.
 *
 * No entra el detalle pelado (`/app/process/:id`): es justo el destino al que el
 * guardián devuelve, así que llegar ahí es correcto por definición.
 */
const LLEVA_A_DOCUMENTACION =
  /['"`]\/app\/(bpmn\/|process\/\$\{[^}]+\}\/(characterization|procedure|indicators|flowchart))/

/** Pantallas que navegan a documentación sin mirar el cupo porque ya están guardadas
 *  ellas mismas: si el usuario está dentro, es que el guardián le dejó entrar. */
const YA_GUARDADAS_ELLAS_MISMAS = [
  'features/ai-consultant/pages/AiConsultantPage.tsx',
  'features/kpi/pages/KpiPage.tsx',
  'features/procedure/pages/ProcedurePage.tsx',
  'pages/FlowchartOnboardingPage.tsx',
  'pages/ProcessCharacterizationPage.tsx',
]

describe('el cupo de documentación no se puede esquivar por la interfaz', () => {
  it('toda pantalla que LLEVA a documentación consulta el cupo', () => {
    // Los dos huecos que motivaron esta comprobación: el Dashboard enlazaba directo a
    // la caracterización, y `ProcessDetailPage` —donde aterriza toda navegación— tenía
    // sus tres botones abiertos. Ninguno escribía nada, así que el invariante de
    // escritura no los veía. Los encontró el usuario a mano.
    const sinComprobar = archivosDeUi(RAIZ)
      .filter((ruta) => {
        const rel = relative(RAIZ, ruta)
        return CARPETAS_DE_UI.some((c) => rel.split('/').includes(c))
      })
      .filter((ruta) => {
        const fuente = readFileSync(ruta, 'utf8')
        return LLEVA_A_DOCUMENTACION.test(fuente) && !CONSULTA_EL_CUPO.test(fuente)
      })
      .map((ruta) => relative(RAIZ, ruta))
      .filter((rel) => !YA_GUARDADAS_ELLAS_MISMAS.includes(rel))

    expect(sinComprobar).toEqual([])
  })

  it('toda pantalla que CREA documentación consulta el cupo o declara quién la cubre', () => {
    const sinComprobar = archivosDeUi(RAIZ)
      .filter((ruta) => {
        const rel = relative(RAIZ, ruta)
        return CARPETAS_DE_UI.some((c) => rel.split('/').includes(c))
      })
      .filter((ruta) => {
        const fuente = readFileSync(ruta, 'utf8')
        return CREA_DOCUMENTACION.test(fuente) && !CONSULTA_EL_CUPO.test(fuente)
      })
      .map((ruta) => relative(RAIZ, ruta))
      .filter((rel) => !(rel in CUBIERTOS_POR_SU_PADRE))

    expect(sinComprobar).toEqual([])
  })
})
