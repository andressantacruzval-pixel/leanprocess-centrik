/**
 * El mensaje de "te quedaste sin cupo", en UN solo sitio.
 *
 * Hay SIETE puertas distintas a un proceso (dashboard, tabla de comparativa, mapa,
 * niveles, los tres botones del detalle, SIPOC y la URL a mano). Si cada una escribe
 * su propio texto, acaban diciendo cosas distintas del mismo hecho — y ya pasó: la
 * base decía una cosa y las pantallas otra.
 *
 * ⚠️ Antes se deshabilitaban los botones sin más. Un botón muerto no explica nada: el
 * cliente pulsa, no ocurre nada, y concluye que la aplicacion falla. Ahora se puede
 * pulsar y responde con el motivo.
 *
 * ⚠️ Y decir que no tampoco basta. Desde el 2026-08-08 lo que sale no es un aviso de
 * texto sino el muro con el escalon siguiente y su precio: al cliente topado hay que
 * enseñarle la puerta, no solo la pared. Eso vive en `PlanUpgradeModal`, montado una
 * sola vez en `MainLayout`.
 *
 * El valor de tener esto centralizado se cobro aqui: las OCHO llamadas siguen escritas
 * igual (`if (avisarSiSinCupo(...)) return`) y ninguna pantalla se toco.
 */

import { planName } from '@/lib/plans'
import { useUiStore } from '@/stores/uiStore'

/**
 * El texto del `title` — lo que se lee al posar el ratón, ANTES de pulsar.
 *
 * ⚠️ Ya no promete «muy pronto habilitaremos nuevos planes». Esa frase se escribió
 * cuando no había nada que vender, y desde que el muro ofrece el escalón siguiente
 * se contradecía con él: el tooltip decía «espera» y el modal decía «compra ya».
 * Ahora anticipa lo que va a pasar al pulsar, que es para lo que sirve un tooltip.
 */
export function mensajeSinCupo(
  nivel: number,
  cupo: number | null,
  motivo: 'documentar' | 'crear' = 'documentar',
): string {
  const cuantos = cupo ?? 0
  if (motivo === 'crear') {
    return (
      `Tu ${planName(nivel)} incluye ${cuantos} procesos y ya los tienes creados. ` +
      `Para añadir uno más hace falta ampliar el cupo. Pulsa para ver cómo.`
    )
  }
  return (
    `Has documentado los ${cuantos} procesos que incluye tu ${planName(nivel)}. ` +
    `Los que ya empezaste siguen abiertos; para documentar uno nuevo hace falta más cupo. ` +
    `Pulsa para ver cómo ampliarlo.`
  )
}

/**
 * Lo que se llama al pulsar una puerta cerrada. Devuelve `true` si estaba cerrada,
 * para poder escribir `if (avisarSiSinCupo(...)) return` antes de navegar.
 *
 * Se toca el store por fuera de React (`getState`) a proposito: esto lo llaman
 * manejadores de evento, no componentes, y convertirlo en hook obligaria a
 * reescribir las ocho puertas para nada.
 */
export function avisarSiSinCupo(
  sinCupo: boolean,
  nivel: number,
  cupo: number | null,
  motivo: 'documentar' | 'crear' = 'documentar',
): boolean {
  if (!sinCupo) return false
  useUiStore.getState().abrirMuroDePlan(nivel, cupo, motivo)
  return true
}
