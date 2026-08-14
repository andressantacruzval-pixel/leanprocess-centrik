/**
 * useSpeechRecognition
 * --------------------
 * Wrapper minimalista sobre la Web Speech API (SpeechRecognition).
 * Permite al usuario "hablar" con la IA sin integraciones externas:
 *  - latencia local (sin round-trip a servidor)
 *  - sin API key
 *  - funciona en Chrome/Edge (webkit prefix) y navegadores Chromium
 *
 * El hook expone transcripcion interim (mientras hablas) y final
 * (cuando callas). Dispara callbacks para que el UI decida que hacer
 * (ej: rellenar la textarea en vivo y auto-enviar al terminar).
 *
 * Upgrade path futuro: si se quiere voz bidireccional tipo Jarvis
 * real (TTS + turn-taking + interrupciones), se cambia este hook por
 * uno basado en Gemini Live API sin tocar la UI.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// SpeechRecognition no está en la lib TS por defecto — declaración mínima
// con solo las propiedades/métodos que usamos.
interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [index: number]: SpeechRecognitionResultLike }
}
interface SpeechRecognitionErrorEventLike {
  error: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onspeechstart: (() => void) | null
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort?(): void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface UseSpeechRecognitionArgs {
  /** Idioma BCP-47 (ej: 'es-ES', 'es-MX', 'en-US'). Default 'es-ES'. */
  lang?: string
  /** Si true, no se detiene tras el primer silencio. Default true cuando hay silenceMs. */
  continuous?: boolean
  /**
   * Milisegundos de silencio (sin nuevos resultados) antes de considerar
   * que el usuario termino de hablar y auto-commitear via onFinal.
   * Default 1800ms — tolera micro-pausas sin cortar al usuario.
   * Solo aplica cuando continuous=true.
   */
  silenceMs?: number
  /** Llamado con el texto final cuando se termina la escucha. */
  onFinal?: (text: string) => void
  /** Llamado con el texto interim mientras el usuario habla. */
  onInterim?: (text: string) => void
}

export interface SpeechRecognitionApi {
  supported: boolean
  listening: boolean
  transcript: string
  error: string | null
  start: () => void
  stop: () => void
  toggle: () => void
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function useSpeechRecognition(
  args: UseSpeechRecognitionArgs = {}
): SpeechRecognitionApi {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalRef = useRef('')
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Flag: true cuando el usuario/silence timer pidieron cerrar y queremos
  // que onend dispare el onFinal. False en chrome-end espontaneos
  // (ej: quedo callado 10s sin haber dicho nada) para no spamear.
  const intentionalStopRef = useRef(false)

  // Mantener args actualizados sin invalidar callbacks ni perder closures.
  const argsRef = useRef(args)
  useEffect(() => { argsRef.current = args }, [args])

  const supported = !!getSpeechRecognitionCtor()

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor || recognitionRef.current) return

    const silenceMs = argsRef.current.silenceMs ?? 1800
    // Si hay silenceMs, forzamos continuous=true para que Chrome no corte
    // en la primera micro-pausa — nosotros decidimos cuando cerrar.
    const useContinuous =
      argsRef.current.continuous ?? (silenceMs > 0 ? true : false)

    const rec: SpeechRecognitionLike = new Ctor()
    rec.lang = argsRef.current.lang ?? 'es-ES'
    rec.continuous = useContinuous
    rec.interimResults = true

    finalRef.current = ''
    intentionalStopRef.current = false
    clearSilenceTimer()
    setTranscript('')
    setError(null)

    const scheduleAutoStop = () => {
      if (silenceMs <= 0) return
      clearSilenceTimer()
      silenceTimerRef.current = setTimeout(() => {
        // El usuario lleva N ms sin hablar → cerrar y commitear
        if (recognitionRef.current && finalRef.current.trim()) {
          intentionalStopRef.current = true
          try {
            recognitionRef.current.stop()
          } catch {
            // noop
          }
        }
      }, silenceMs)
    }

    rec.onresult = (ev: SpeechRecognitionEventLike) => {
      let interim = ''
      let final = finalRef.current
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]
        if (res.isFinal) final += res[0].transcript
        else interim += res[0].transcript
      }
      finalRef.current = final
      const combined = (final + interim).trim()
      setTranscript(combined)
      argsRef.current.onInterim?.(combined)
      // Cada resultado (interim o final) reinicia el reloj de silencio
      scheduleAutoStop()
    }

    rec.onspeechstart = () => {
      // Usuario empezo a hablar — cancelar cualquier timer pendiente
      clearSilenceTimer()
    }

    rec.onerror = (ev: SpeechRecognitionErrorEventLike) => {
      // 'no-speech' es normal cuando el usuario no dice nada — no es un error real
      const code = typeof ev?.error === 'string' ? ev.error : 'unknown'
      if (code !== 'no-speech' && code !== 'aborted') {
        setError(code)
      }
      clearSilenceTimer()
      setListening(false)
      recognitionRef.current = null
    }

    rec.onend = () => {
      clearSilenceTimer()
      setListening(false)
      const finalText = finalRef.current.trim()
      recognitionRef.current = null
      // Solo commiteamos si fue un stop intencional con contenido real
      if (intentionalStopRef.current && finalText) {
        argsRef.current.onFinal?.(finalText)
      }
      intentionalStopRef.current = false
    }

    try {
      rec.start()
      recognitionRef.current = rec
      setListening(true)
    } catch (err) {
      setError((err as Error).message)
      recognitionRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    intentionalStopRef.current = true
    clearSilenceTimer()
    recognitionRef.current?.stop?.()
  }, [])

  const toggle = useCallback(() => {
    if (recognitionRef.current) stop()
    else start()
  }, [start, stop])

  useEffect(() => {
    return () => {
      clearSilenceTimer()
      recognitionRef.current?.abort?.()
      recognitionRef.current = null
    }
  }, [])

  return { supported, listening, transcript, error, start, stop, toggle }
}
