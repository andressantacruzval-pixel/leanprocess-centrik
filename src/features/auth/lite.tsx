import { useEffect } from 'react'
import { PageSpinner } from '@/components/ui/PageSpinner'

/**
 * La puerta de entrada del ecosistema es Lite: aquí no se inicia sesión ni se
 * registra nadie. Quien llega sin sesión se manda allí, y vuelve a App por el
 * handoff del Hub (ticket de un solo uso → /hub-entry), sin teclear nada.
 *
 * ⚠️ Consecuencia de eso: en local NO hay forma de entrar a App. El navegador se
 * va a Lite de producción, y el Hub de producción devuelve a la App de
 * producción — nunca a tu localhost. Por eso, si App corre en local, Lite se
 * asume en local también.
 *
 * En producción el hostname jamás es `localhost`, así que esta rama no existe
 * allí. `VITE_LITE_URL` sigue mandando por encima de las dos, para apuntar a un
 * preview concreto.
 *
 * DESARROLLO LOCAL: si corres en localhost y NO fijas `VITE_LITE_URL`, no hay
 * Hub externo que valga, así que la propia App hace de puerta: login/registro
 * van a las rutas locales `/login` y `/register` (ver `LocalLoginPage`). En
 * cuanto defines `VITE_LITE_URL` (p. ej. para un preview real de Lite), esa
 * URL manda y este atajo local se desactiva.
 */
export const EN_LOCAL =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)

/** Hay un Lite externo declarado explícitamente. */
const LITE_OVERRIDE = import.meta.env.VITE_LITE_URL as string | undefined

/** En local sin override, la autenticación la resuelve la propia App. */
export const LOCAL_AUTH = EN_LOCAL && !LITE_OVERRIDE

const LITE_URL =
  LITE_OVERRIDE ?? (EN_LOCAL ? 'http://localhost:3000' : 'https://www.leanprocess.app')

export const liteLoginUrl = LOCAL_AUTH ? '/login' : `${LITE_URL}/login`
export const liteSignupUrl = LOCAL_AUTH ? '/register' : `${LITE_URL}/login?view=signup`
/** El Hub es dueño del plan, los tokens y la facturación: App enlaza, no duplica. */
export const liteHubUrl = `${LITE_URL}/hub`

export function RedirectToLite({ to = liteLoginUrl }: { to?: string }) {
  useEffect(() => {
    window.location.replace(to)
  }, [to])

  return <PageSpinner />
}
