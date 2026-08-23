import { useEffect, useRef, useState } from 'react'

// Revela `text` progresivamente para que la respuesta se sienta "escrita" en
// vivo, sin importar cómo llegue el stream (a trozos o de golpe). Cuando el
// texto deja de crecer y `active` es false, completa lo que reste.
//
// Escala la velocidad al tamaño pendiente: respuestas largas no se hacen
// eternas y las cortas se ven fluidas. Respeta prefers-reduced-motion.

export function useTypewriter(text: string, active: boolean): string {
  const [shown, setShown] = useState(text.length && !active ? text.length : 0)
  const shownRef = useRef(shown)
  shownRef.current = shown
  const rafRef = useRef(0)

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setShown(text.length); return }

    // Si el texto se acortó o cambió de raíz (nueva respuesta), reinicia.
    if (shownRef.current > text.length) setShown(text.length)

    const tick = () => {
      const target = text.length
      const cur = shownRef.current
      if (cur >= target) { rafRef.current = 0; return }
      // Avanza ~2% del pendiente por frame, mínimo 2 caracteres.
      const step = Math.max(2, Math.ceil((target - cur) * 0.06))
      setShown(Math.min(target, cur + step))
      rafRef.current = requestAnimationFrame(tick)
    }

    if (shownRef.current < text.length && !rafRef.current) {
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 } }
  }, [text, active])

  // Al finalizar el stream, garantiza el texto completo.
  useEffect(() => {
    if (!active && shownRef.current < text.length) {
      const id = requestAnimationFrame(function finish() {
        const cur = shownRef.current
        if (cur >= text.length) return
        setShown(Math.min(text.length, cur + Math.max(3, Math.ceil((text.length - cur) * 0.12))))
        requestAnimationFrame(finish)
      })
      return () => cancelAnimationFrame(id)
    }
  }, [active, text.length])

  return text.slice(0, shown)
}
