import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { ReactElement } from 'react'

// Monta un componente React en un contenedor fuera de pantalla, deja que el
// navegador calcule layout (dos frames + un respiro para fuentes/gráficos) y le
// pasa el nodo real a `fn` para capturarlo. Siempre desmonta y limpia. Se usa
// para exportar a imagen/PDF vistas que no están montadas en la pantalla actual
// (p. ej. el reporte de inventario desde el mapa de procesos).

export async function withOffscreenNode<T>(
  element: ReactElement,
  width: number,
  fn: (node: HTMLElement) => Promise<T>
): Promise<T> {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;background:#0b1220;z-index:-1;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(element))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
    await new Promise((r) => setTimeout(r, 80))
    return await fn(host)
  } finally {
    root.unmount()
    host.remove()
  }
}
