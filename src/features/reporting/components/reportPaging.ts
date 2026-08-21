import { useState } from 'react'

/**
 * Tope de RENDERIZADO por tanda, no de datos. Evita pintar cientos de filas de
 * golpe; la exportación sigue leyendo el conjunto filtrado ENTERO.
 */
export const FILAS_POR_TANDA = 100

export function useVerMas<T>(rows: T[]) {
  const [tandas, setTandas] = useState(1)
  const tope = tandas * FILAS_POR_TANDA
  return {
    visibles: rows.length > tope ? rows.slice(0, tope) : rows,
    ocultas: Math.max(0, rows.length - tope),
    verMas: () => setTandas((t) => t + 1),
  }
}
