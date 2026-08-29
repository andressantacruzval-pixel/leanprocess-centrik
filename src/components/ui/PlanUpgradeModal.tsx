import { X, ArrowRight, MessageCircle } from 'lucide-react'
import { useUiStore } from '@/stores/uiStore'
import { liteHubUrl } from '@/features/auth/lite'
import { SOPORTE_WHATSAPP } from '@/lib/soporte'
import { planCap, planName, planPrice, planTokens, hasNextLevel } from '@/lib/plans'

/**
 * El momento en que alguien topa el cupo.
 *
 * ─── Por qué está escrito como está ───────────────────────────────────────────
 * Esto no es un aviso de error: es el único momento en que el producto pide dinero,
 * y el cliente llega a él CON GANAS DE SEGUIR — acaba de intentar documentar algo.
 * Es la mejor intención que va a tener nunca. Un mensaje que empieza por «no
 * puedes» la desperdicia.
 *
 * De ahí las decisiones, todas deliberadas:
 *
 * 1. EL TÍTULO PROMETE, NO PROHÍBE. «Sube de plan y sigue documentando», no «Has
 *    alcanzado el límite». Lo segundo describe el problema; lo primero, la salida.
 *    El límite se menciona una vez, en pequeño, como contexto.
 *
 * 2. EL HÉROE ES EL SALTO, con SUS números: «20 → 30». No una lista de
 *    características —que sería igual para todos— sino lo que cambia en esta
 *    cuenta. Es lo único de esta pantalla que no se puede copiar de otro producto.
 *
 * 3. UNA SOLA ACCIÓN PRINCIPAL. Nada de tres tarjetas para comparar: comparar es
 *    trabajo, y aquí el cliente no quiere elegir un plan, quiere seguir con lo suyo.
 *    Se le ofrece EL SIGUIENTE escalón. Los tres siguen estando en el Hub para quien
 *    quiera mirar.
 *
 * 4. EL PRECIO SE DICE ENTERO Y PRONTO. Esconderlo hasta el checkout es lo que
 *    convierte una compra en un arrepentimiento.
 *
 * 5. LO QUE NO CAMBIA SE DICE TAMBIÉN. El miedo real de quien ya paga una comunidad
 *    es que esto la sustituya o la encarezca. Una línea lo desactiva.
 *
 * ⚠️ Lo que NO se promete: que se pueda bajar cuando quiera. Se puede, pero solo si
 * cabe en el cupo de destino (`plan_downgrade_excess`), así que quien suba a 30 y
 * documente 30 NO puede bajar sin borrar. Decir «cancela cuando quieras» aquí sería
 * mentir en la frase donde más caro sale.
 */
export function PlanUpgradeModal() {
  const { abierto, nivel, cupo, motivo } = useUiStore((s) => s.muro)
  const cerrar = useUiStore((s) => s.cerrarMuroDePlan)

  if (!abierto) return null

  const hayMas = hasNextLevel(nivel)
  const siguiente = nivel + 1
  const cuantos = cupo ?? planCap(nivel)

  return (
    /* `z-[100]`, como el resto de modales. Estuvo en `z-50`, igual que la cabecera:
       ganaba solo por ir después en el DOM, que es un empate esperando a romperse
       el día que alguien reordene `MainLayout`. */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/45 p-4 animate-modal-fondo"
      onClick={cerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="muro-titulo"
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white border border-gray-200 rounded-lg w-full max-w-[420px] max-h-[85vh] overflow-y-auto shadow-2xl animate-modal-lamina"
      >
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="absolute top-2 right-2 z-10 p-2.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="px-7 pt-7 pb-6">
          <h2 id="muro-titulo" className="text-gray-900 font-semibold text-[19px] leading-snug tracking-[-0.01em] pr-8">
            {!hayMas
              ? 'Hablemos de tu caso'
              : motivo === 'crear'
                ? 'Sube de plan y sigue creando procesos'
                : 'Sube de plan y sigue documentando'}
          </h2>
          {/* El contexto cambia según CONTRA QUÉ se chocó. Decirle «has documentado
              20 de 20» a quien intentaba crear el 21 le manda a buscar un problema
              que no tiene. */}
          <p className="text-gray-500 text-[12.5px] mt-2 leading-relaxed">
            {!hayMas
              ? `Estás en ${planName(nivel)}, el escalón más alto. Por encima de ${cuantos} procesos lo vemos uno a uno.`
              : motivo === 'crear'
                ? `Tu ${planName(nivel)} incluye ${cuantos} procesos y ya los tienes creados.`
                : `Llevas ${cuantos} de ${cuantos} procesos documentados. Los que ya empezaste siguen abiertos.`}
          </p>
        </div>

        {hayMas ? (
          <>
            <div className="mx-7 rounded-lg border border-primary-200 bg-primary-50 overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3.5">
                <span className="text-gray-900 font-semibold text-[15px]">
                  {planName(siguiente)}
                </span>
                <span className="text-gray-900 font-semibold text-[17px] tabular-nums">
                  ${planPrice(siguiente)}
                  <span className="text-gray-400 font-normal text-[12px]"> /mes</span>
                </span>
              </div>

              {/* El salto, con SUS números. Es el argumento entero. */}
              <div className="border-t border-primary-200 px-5 py-4 space-y-3">
                <Salto
                  que="Procesos documentados"
                  antes={planCap(nivel)}
                  despues={planCap(siguiente)}
                />
                <Salto
                  que="Tokens de IA al mes"
                  antes={planTokens(nivel)}
                  despues={planTokens(siguiente)}
                />
              </div>
            </div>

            <div className="px-7 pt-5 pb-7">
              {/* Directo a la pantalla de pago. `/hub/subir` abre la sesión de Stripe
                  y redirige — el cliente ya decidió aquí, no hay que hacerle elegir
                  otra vez en una tienda. App no llama a Stripe: sigue habiendo una
                  sola aplicación hablándole. */}
              <a
                href={`${liteHubUrl}/subir?nivel=${siguiente}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={cerrar}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary-500 hover:bg-primary-500 text-white text-[14px] font-semibold transition-colors"
              >
                Subir a {planName(siguiente)}
                <ArrowRight size={16} strokeWidth={2.4} />
              </a>

              <a
                href={`${liteHubUrl}?plan=abierto`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={cerrar}
                className="w-full mt-2 flex items-center justify-center py-2 text-gray-500 hover:text-gray-700 text-[12.5px] transition-colors"
              >
                Ver los tres planes
              </a>

              <button
                type="button"
                onClick={cerrar}
                className="w-full mt-1.5 py-2.5 rounded-lg text-gray-400 hover:text-gray-600 text-[13px] transition-colors"
              >
                Ahora no
              </button>

              {/* El miedo de quien ya paga una comunidad es que esto la sustituya. */}
              <p className="text-gray-400 text-[11px] text-center mt-1 leading-relaxed">
                Se cobra aparte. Tu membresía de la comunidad no cambia.
              </p>
            </div>
          </>
        ) : (
          <div className="px-7 pb-7">
            <p className="text-gray-500 text-[12.5px] leading-relaxed mb-5">
              Para volúmenes mayores, o si sois varias personas de la misma empresa,
              lo montamos a medida.
            </p>
            <a
              href={SOPORTE_WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              onClick={cerrar}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-800 text-[13.5px] font-medium transition-colors"
            >
              <MessageCircle size={15} className="text-gray-500" />
              Escribir a soporte
            </a>
            <button
              type="button"
              onClick={cerrar}
              className="w-full mt-1.5 py-2.5 rounded-lg text-gray-400 hover:text-gray-600 text-[13px] transition-colors"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * «20 → 30». El número nuevo es el que manda: el viejo va apagado y tachado por
 * contraste, no por decoración — hace de punto de partida para que el salto se lea
 * como una ganancia y no como una cifra suelta.
 */
function Salto({ que, antes, despues }: { que: string; antes: number; despues: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-500 text-[12.5px]">{que}</span>
      <span className="flex items-baseline gap-2 shrink-0 tabular-nums">
        <span className="text-gray-400 text-[13px]">{antes.toLocaleString()}</span>
        <span className="text-gray-400 text-[11px]">→</span>
        <span className="text-primary-700 text-[16px] font-semibold">
          {despues.toLocaleString()}
        </span>
      </span>
    </div>
  )
}
