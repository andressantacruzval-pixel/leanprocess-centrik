import { useCallback, useEffect, useRef, useState } from 'react'

// Dictado por voz con la Web Speech API del navegador (SpeechRecognition).
// Transcribe EN VIVO: los fragmentos finales se entregan por `onFinal` para
// anexarlos al texto, y `interim` expone lo que se está reconociendo aún.
// Reanuda solo tras los cortes por silencio del navegador mientras el usuario
// no haya pulsado detener, así se puede dictar una entrevista larga sin perder
// el hilo y retomando sobre lo ya dictado.

// Tipos mínimos: la Web Speech API no está en el lib DOM por defecto.
interface SpeechAlt { transcript: string; confidence: number }
interface SpeechResult { isFinal: boolean; length: number; [i: number]: SpeechAlt }
interface SpeechResultList { length: number; [i: number]: SpeechResult }
interface SpeechResultEvent { resultIndex: number; results: SpeechResultList }
interface SpeechErrorEvent { error: string; message: string }
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechResultEvent) => void) | null
  onerror: ((e: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

interface Options {
  /** Idioma BCP-47. Por defecto toma el del navegador si es español, si no es-ES. */
  lang?: string
  /** Se llama con cada fragmento FINAL ya reconocido (para anexar al texto). */
  onFinal?: (text: string) => void
}

export function useSpeechDictation({ lang, onFinal }: Options = {}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recRef = useRef<SpeechRecognitionLike | null>(null)
  // Intención del usuario de seguir grabando: distingue un corte por silencio
  // (reanudar) de un stop deliberado (terminar).
  const wantOnRef = useRef(false)
  // Reintentos de reconexión desde el último progreso. El servicio de voz del
  // navegador (Google) a veces devuelve `network` de forma transitoria; se
  // reintenta un par de veces y, si no hay progreso, se corta en vez de girar
  // en un bucle de error (el síntoma: «Escuchando…» y el error a la vez).
  const retriesRef = useRef(0)
  const MAX_RETRIES = 2
  const onFinalRef = useRef(onFinal)
  useEffect(() => { onFinalRef.current = onFinal }, [onFinal])

  // Termina el reconocimiento y deja la UI coherente (sin «Escuchando…» colgado).
  const finish = useCallback((msg?: string) => {
    wantOnRef.current = false
    retriesRef.current = 0
    try { recRef.current?.abort() } catch { /* no-op */ }
    if (msg) setError(msg)
    setListening(false)
    setInterim('')
  }, [])

  const resolvedLang = lang
    || (typeof navigator !== 'undefined' && navigator.language?.startsWith('es') ? navigator.language : 'es-ES')

  const supported = !!getCtor()

  const build = useCallback((): SpeechRecognitionLike | null => {
    const Ctor = getCtor()
    if (!Ctor) return null
    const rec = new Ctor()
    rec.lang = resolvedLang
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      let interimStr = ''
      let finalStr = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const txt = res[0]?.transcript ?? ''
        if (res.isFinal) finalStr += txt
        else interimStr += txt
      }
      // Hubo progreso real: reinicia el contador de reintentos.
      if (finalStr.trim() || interimStr.trim()) retriesRef.current = 0
      if (finalStr.trim()) {
        onFinalRef.current?.(finalStr.trim())
        setInterim('')
      } else {
        setInterim(interimStr)
      }
    }

    rec.onerror = (e) => {
      // Traza el código real para soporte (el mensaje al usuario es amigable).
      console.warn('[useSpeechDictation] error:', e.error)
      // Silencio o abortos son normales en modo continuo: los ignora.
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        finish('No se pudo acceder al micrófono. Autoriza el permiso en el navegador (icono del candado junto a la URL) y vuelve a intentar.')
      } else if (e.error === 'audio-capture') {
        finish('No se detectó micrófono. Conecta uno y vuelve a intentar.')
      } else if (e.error === 'language-not-supported') {
        finish('El idioma de dictado no está disponible en este navegador. Escribe el texto manualmente.')
      } else if (e.error === 'network') {
        // Transitorio: deja que onend reintente hasta el tope; si no, corta con aviso.
        if (retriesRef.current >= MAX_RETRIES) {
          finish('El reconocimiento de voz del navegador no está disponible ahora (sin conexión al servicio). Usa Chrome o Edge con internet, o escribe el texto.')
        }
      } else if (retriesRef.current >= MAX_RETRIES) {
        finish('No se pudo dictar por voz. Escribe el texto o inténtalo más tarde.')
      }
    }

    rec.onend = () => {
      // El navegador corta tras un silencio; reanuda si el usuario sigue grabando,
      // pero solo hasta MAX_RETRIES sin progreso para no girar en un bucle de error.
      if (wantOnRef.current && retriesRef.current < MAX_RETRIES) {
        retriesRef.current += 1
        try { rec.start() } catch { /* ya arrancando */ }
      } else if (wantOnRef.current) {
        finish('El reconocimiento de voz se detuvo. Vuelve a pulsar el micrófono para reintentar.')
      } else {
        setListening(false)
        setInterim('')
      }
    }
    return rec
  }, [resolvedLang, finish])

  const start = useCallback(() => {
    if (!supported) {
      setError('Tu navegador no soporta dictado por voz. Prueba con Chrome o Edge de escritorio.')
      return
    }
    // La Web Speech API exige contexto seguro (HTTPS o localhost).
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError('El dictado por voz requiere HTTPS. Abre la app en su dirección segura.')
      return
    }
    setError(null)
    retriesRef.current = 0
    wantOnRef.current = true
    if (!recRef.current) recRef.current = build()
    try {
      recRef.current?.start()
      setListening(true)
    } catch {
      // start() lanza si ya estaba activo: no es un error real.
    }
  }, [supported, build])

  const stop = useCallback(() => {
    wantOnRef.current = false
    retriesRef.current = 0
    try { recRef.current?.stop() } catch { /* no-op */ }
    setListening(false)
    setInterim('')
  }, [])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  // Corta el reconocimiento si el componente se desmonta a media grabación.
  useEffect(() => () => {
    wantOnRef.current = false
    try { recRef.current?.abort() } catch { /* no-op */ }
    recRef.current = null
  }, [])

  return { supported, listening, interim, error, start, stop, toggle }
}
