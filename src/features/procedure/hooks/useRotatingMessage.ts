import { useState, useEffect } from 'react'

export const LOADING_MESSAGES = [
  'Analizando contexto del proceso...',
  'Generando actividades detalladas...',
  'Estructurando documentacion ISO...',
  'Definiendo puntos de decision...',
  'Preparando procedimiento final...',
]

export function useRotatingMessage(active: boolean): string {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % LOADING_MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [active])

  // Si no hay actividad activa, mostrar siempre el primer mensaje (no
  // necesitamos resetear el índice — el render derivado lo evita).
  return active ? LOADING_MESSAGES[index] : LOADING_MESSAGES[0]
}
