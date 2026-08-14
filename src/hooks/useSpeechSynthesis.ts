/**
 * useSpeechSynthesis
 * ------------------
 * Wrapper sobre la Web Speech API (SpeechSynthesis) para que la IA
 * *hable* al usuario en voz alta. Cero latencia, cero API key, y
 * funciona en Chrome/Edge con voces neuronales de Google.
 *
 * Responsabilidades:
 *  - Enumerar voces disponibles y escoger la mejor en espanol
 *  - Cola de utterances (hablar frase por frase)
 *  - Interrumpir (cancel) — util cuando el usuario empieza a hablar
 *  - Exponer estado `speaking` para feedback visual
 *
 * Nota Chrome: speechSynthesis requiere una interaccion del usuario
 * en la pagina antes de reproducir audio. El componente padre debe
 * hacer TTS recien despues de que el user haya interactuado (click
 * en un quick reply, boton de voz, enviar mensaje, etc.).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseSpeechSynthesisArgs {
  /** Idioma preferido BCP-47. Default 'es-ES'. */
  lang?: string
  /** Velocidad (0.1 - 10). 1.0 = normal. Default 1.05. */
  rate?: number
  /** Tono (0 - 2). Default 1.0. */
  pitch?: number
  /** Volumen (0 - 1). Default 1.0. */
  volume?: number
}

export interface SpeechSynthesisApi {
  supported: boolean
  speaking: boolean
  voices: SpeechSynthesisVoice[]
  /** Agrega una frase a la cola de reproduccion. */
  speak: (text: string) => void
  /** Cancela todo lo que esta en la cola y lo que se esta diciendo. */
  cancel: () => void
}

/** Limpia texto para que el TTS no lea asteriscos, markdown, etc. */
function cleanForSpeech(text: string): string {
  return text
    .replace(/<<[^>]*>>/g, '') // tool markers
    .replace(/[*_`~#>]/g, '') // markdown
    .replace(/\s+/g, ' ')
    .trim()
}

export function useSpeechSynthesis(
  args: UseSpeechSynthesisArgs = {}
): SpeechSynthesisApi {
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)
  const argsRef = useRef(args)
  useEffect(() => { argsRef.current = args }, [args])

  // Cargar voces (en Chrome llegan async)
  useEffect(() => {
    if (!supported) return
    const synth = window.speechSynthesis
    const load = () => setVoices(synth.getVoices())
    load()
    synth.addEventListener('voiceschanged', load)
    return () => synth.removeEventListener('voiceschanged', load)
  }, [supported])

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null
    const lang = argsRef.current.lang ?? 'es-ES'
    const spanish = voices.filter((v) => v.lang.toLowerCase().startsWith('es'))
    if (spanish.length === 0) return null
    // Prioridad: Google (suele sonar mejor) > coincidencia exacta > primera es-*
    const google = spanish.find((v) => /google/i.test(v.name))
    if (google) return google
    const exact = spanish.find((v) => v.lang.toLowerCase() === lang.toLowerCase())
    if (exact) return exact
    return spanish[0]
  }, [voices])

  const speak = useCallback(
    (text: string) => {
      if (!supported) return
      const clean = cleanForSpeech(text)
      if (!clean) return

      const synth = window.speechSynthesis
      const utter = new SpeechSynthesisUtterance(clean)
      const voice = pickVoice()
      if (voice) {
        utter.voice = voice
        utter.lang = voice.lang
      } else {
        utter.lang = argsRef.current.lang ?? 'es-ES'
      }
      utter.rate = argsRef.current.rate ?? 1.05
      utter.pitch = argsRef.current.pitch ?? 1.0
      utter.volume = argsRef.current.volume ?? 1.0

      utter.onstart = () => setSpeaking(true)
      utter.onend = () => {
        // Solo bajar el flag cuando la cola realmente este vacia
        if (!synth.speaking && !synth.pending) setSpeaking(false)
      }
      utter.onerror = () => {
        if (!synth.speaking && !synth.pending) setSpeaking(false)
      }

      synth.speak(utter)
    },
    [supported, pickVoice]
  )

  const cancel = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel()
    }
  }, [supported])

  return { supported, speaking, voices, speak, cancel }
}
