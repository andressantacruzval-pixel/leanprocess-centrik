/**
 * plans
 * -----
 * Unica fuente de la escalera de planes. Igual que `processLevels.ts`: la regla
 * vive en un solo sitio y nadie la reimplementa.
 *
 * Un plan es UN numero, `N`, derivado de `profiles.plan_level` (0..3). Ese numero
 * gobierna dos cosas distintas:
 *
 *   1. cuantos procesos se pueden CREAR en el nivel mas bajo declarado
 *   2. cuantos procesos se pueden DOCUMENTAR (distintos)
 *
 * La unidad es el subproceso. Documentar uno lo desbloquea entero: caracterizacion,
 * flujograma, procedimiento, KPIs, riesgos, auditoria, analisis de valor y SIPOC
 * cuentan como UNO, no como ocho.
 *
 *   nivel 0 (base, incluido en la comunidad)  20 procesos  1.000 tokens   +$0
 *   nivel 1                                   30 procesos  2.000 tokens  +$20
 *   nivel 2                                   40 procesos  3.000 tokens  +$40
 *   nivel 3                                   50 procesos  4.000 tokens  +$60
 *
 * Por encima de 50 no hay plan: es Enterprise, otro producto.
 *
 * Decision: docs/Decisiones/2026-07-30 Los procesos y los tokens suben juntos.
 */

export const PLAN_BASE_CAP = 20
export const PLAN_CAP_STEP = 10
export const PLAN_TOKEN_STEP = 1000
export const PLAN_PRICE_STEP = 20
export const PLAN_MAX_LEVEL = 3

/** Acota el nivel al rango valido. Un dato corrupto degrada al plan base, no revienta. */
export function clampLevel(level: number | null | undefined): number {
  const n = Math.trunc(level ?? 0)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(n, PLAN_MAX_LEVEL)
}

/** Procesos que el plan permite: crear en el nivel mas bajo Y documentar. 20/30/40/50. */
export function planCap(level: number | null | undefined): number {
  return PLAN_BASE_CAP + clampLevel(level) * PLAN_CAP_STEP
}

/** Tokens de IA que el plan repone cada mes. 1.000/2.000/3.000/4.000. */
export function planTokens(level: number | null | undefined): number {
  return PLAN_TOKEN_STEP * (clampLevel(level) + 1)
}

/** Precio mensual ADICIONAL sobre la comunidad. El nivel base no cuesta extra. */
export function planPrice(level: number | null | undefined): number {
  return PLAN_PRICE_STEP * clampLevel(level)
}

/** Si queda algun escalon por encima. Al llegar al ultimo, la salida es Enterprise. */
export function hasNextLevel(level: number | null | undefined): boolean {
  return clampLevel(level) < PLAN_MAX_LEVEL
}

/**
 * Como se llama cada escalon de cara al cliente.
 *
 * ⚠️ El nombre sale del NIVEL, nunca de `profiles.plan_type`. Son cosas distintas
 * y confundirlas ya produjo un fallo: `plan_type` es la MEMBRESIA (todo el que
 * viene de la comunidad vale 'community', haya comprado o no) y `plan_level` es la
 * ESCALERA. El muro llamaba "Community" a quien acababa de pagar el Plus.
 *
 * Mismo texto en tres sitios: aqui, en `plan_name()` (SQL, para el mensaje del
 * trigger) y en el nombre del producto de Stripe, que es lo que el cliente lee en
 * el recibo. Si se cambia uno, cambiar los tres.
 *
 * ⚠️ El nombre YA LLEVA la palabra "Plan", asi que los textos que lo usan NO deben
 * anteponerla: seria "tu plan Plan Plus". Ver el muro de `ProcessDrilldown` y el
 * mensaje de `enforce_plan_cap_processes`.
 */
const PLAN_NAMES = ['Plan Community', 'Plan Plus', 'Plan Pro', 'Plan Max'] as const

export function planName(level: number | null | undefined): string {
  return PLAN_NAMES[clampLevel(level)]
}
