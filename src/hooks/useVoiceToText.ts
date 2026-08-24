import { useCallback, useEffect, useRef, useState } from 'react'
import { transcribeAudio } from '@/lib/transcribeAi'

// Voz→texto FIABLE en cualquier navegador: graba el micrófono con MediaRecorder y
// transcribe por el ai-proxy (Gemini). No depende del servicio de voz de Google
// del navegador (que fallaba con `network`). Flujo simple: pulsar → hablar →
// pulsar de nuevo → el texto aparece. Devuelve la transcripción por `onText`.

interface Options {
  onText?: (text: string) => void
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const c of candidates) {
    try { if (MediaRecorder.isTypeSupported(c)) return c } catch { /* ignore */ }
  }
  return ''
}

export function useVoiceToText({ onText }: Options = {}) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const onTextRef = useRef(onText)
  useEffect(() => { onTextRef.current = onText }, [onText])

  const supported = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined'

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const start = useCallback(async () => {
    if (!supported) { setError('Tu navegador no permite grabar audio. Prueba con otro navegador.'); return }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError('El dictado por voz requiere HTTPS. Abre la app en su dirección segura.'); return
    }
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickMime()
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stopStream()
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        chunksRef.current = []
        if (!blob.size) { setTranscribing(false); return }
        setTranscribing(true)
        try {
          const b64 = await blobToBase64(blob)
          const text = await transcribeAudio(b64, blob.type)
          if (text) onTextRef.current?.(text)
          else setError('No se detectó voz en la grabación. Intenta de nuevo, más cerca del micrófono.')
        } catch (err) {
          const noCredits = err instanceof Error && err.message.includes('INSUFFICIENT_CREDITS')
          setError(noCredits ? 'Sin tokens suficientes para transcribir.' : 'No se pudo transcribir el audio. Inténtalo de nuevo.')
        } finally {
          setTranscribing(false)
        }
      }
      rec.start()
      recRef.current = rec
      setRecording(true)
    } catch {
      stopStream()
      setError('No se pudo acceder al micrófono. Autoriza el permiso en el navegador (icono junto a la URL) y vuelve a intentar.')
    }
  }, [supported])

  const stop = useCallback(() => {
    setRecording(false)
    try {
      if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
    } catch { /* no-op */ }
  }, [])

  const toggle = useCallback(() => { if (recording) stop(); else void start() }, [recording, start, stop])

  useEffect(() => () => {
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop() } catch { /* no-op */ }
    stopStream()
  }, [])

  return { supported, recording, transcribing, error, start, stop, toggle }
}
