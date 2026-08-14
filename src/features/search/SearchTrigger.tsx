import { Search, Command } from 'lucide-react'

export function SearchTrigger() {
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  function handleOpenSearch() {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: !isMac,
        metaKey: isMac,
        bubbles: true,
      }),
    )
  }

  /*
   * Se lee como un CAMPO de búsqueda, no como un botón: ancho completo de su hueco
   * (el contenedor decide cuánto, ver `Header`), texto alineado a la izquierda y el
   * atajo empujado al extremo derecho. Antes era una pastilla ajustada al contenido,
   * y en una pantalla ancha quedaba diminuta en mitad de un hueco enorme.
   */
  return (
    <button
      onClick={handleOpenSearch}
      className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-colors group text-left"
      title="Buscar (Ctrl+K)"
    >
      <Search size={16} className="text-white/35 group-hover:text-white/60 shrink-0" />
      <span className="text-[13px] text-white/35 group-hover:text-white/60 truncate">
        Buscar procesos, riesgos, indicadores...
      </span>
      <kbd className="hidden sm:flex ml-auto shrink-0 items-center gap-0.5 text-[10px] text-white/25 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 font-mono">
        {isMac ? <Command size={10} /> : 'Ctrl'}
        <span>K</span>
      </kbd>
    </button>
  )
}
