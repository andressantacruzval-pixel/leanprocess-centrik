// SIPOC relacional de 4 columnas (proveedor→entrada / salida→cliente). Es la
// forma canónica: la misma que pinta la herramienta y la que se exporta a Word.

export interface SipocRelationalRow {
  supplier_name: string
  input_description: string
  output_description: string
  customer_name: string
}

/**
 * Une las dos listas legacy generadas por la IA —entradas {proveedor, entrada} y
 * salidas {salida, cliente}, independientes y de largos distintos— en filas de 4
 * columnas, emparejándolas por índice y rellenando con blanco el lado más corto.
 * Así el procedimiento generado sin catálogo SIPOC también sale en UNA tabla de 4
 * columnas, no en dos apartados separados.
 */
export function mergeLegacySipoc(
  entradas: { proveedor: string; entrada: string }[] = [],
  salidas: { salida: string; cliente: string }[] = []
): SipocRelationalRow[] {
  const total = Math.max(entradas.length, salidas.length)
  const rows: SipocRelationalRow[] = []
  for (let i = 0; i < total; i++) {
    rows.push({
      supplier_name: entradas[i]?.proveedor ?? '',
      input_description: entradas[i]?.entrada ?? '',
      output_description: salidas[i]?.salida ?? '',
      customer_name: salidas[i]?.cliente ?? '',
    })
  }
  return rows
}
