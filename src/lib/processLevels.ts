/**
 * processLevels
 * -------------
 * Unica definicion de "nivel mas bajo" del proyecto.
 *
 * La empresa declara en el onboarding cuantos niveles tiene su jerarquia
 * (`companies.process_level_count`, 1/2/3). El macroproceso es el nivel 1 y vive
 * en su propia tabla, asi que dentro de `processes` solo hay dos profundidades:
 *
 *   depth 1 = proceso sin padre        (nivel 2 en una estructura de 3)
 *   depth 2 = proceso con padre        (nivel 3, el subproceso)
 *
 * En una estructura de 1 o 2 niveles el nivel mas bajo es depth 1; en una de 3
 * es depth 2.
 *
 * CRITICO — "nivel mas bajo" NO es lo mismo que "no tiene hijos". Un proceso de
 * nivel 2 sin subprocesos es una rama a medio construir, no una hoja. Confundir
 * ambas cosas es lo que permitio documentar 998 registros en el nivel intermedio
 * de una empresa que habia declarado 3 niveles. La documentacion (BPMN,
 * procedimiento, riesgos, KPIs, auditoria, analisis de valor, SIPOC) se produce
 * solo en el nivel mas bajo declarado.
 */

/** Profundidad dentro de `processes` que corresponde al nivel mas bajo declarado. */
export function lowestProcessDepth(processLevelCount: number | null | undefined): 1 | 2 {
  return (processLevelCount ?? 3) <= 2 ? 1 : 2
}

/** Profundidad de un proceso: 1 si cuelga del macroproceso, 2 si cuelga de otro proceso. */
export function processDepth(process: { parent_process_id?: string | null }): 1 | 2 {
  return process.parent_process_id ? 2 : 1
}

/**
 * Si este proceso admite documentacion. True solo cuando su profundidad coincide
 * con el nivel mas bajo que la empresa declaro.
 */
export function isDocumentable(
  process: { parent_process_id?: string | null },
  processLevelCount: number | null | undefined
): boolean {
  return processDepth(process) === lowestProcessDepth(processLevelCount)
}
