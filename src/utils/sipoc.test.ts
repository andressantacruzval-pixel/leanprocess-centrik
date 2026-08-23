import { describe, it, expect } from 'vitest'
import { mergeLegacySipoc } from './sipoc'

describe('mergeLegacySipoc — 4 columnas desde las dos listas de la IA', () => {
  it('empareja por índice proveedor/entrada con salida/cliente', () => {
    const rows = mergeLegacySipoc(
      [{ proveedor: 'Leads', entrada: 'CRM' }],
      [{ salida: 'Lead calificado', cliente: 'Ventas' }]
    )
    expect(rows).toEqual([
      { supplier_name: 'Leads', input_description: 'CRM', output_description: 'Lead calificado', customer_name: 'Ventas' },
    ])
  })

  it('rellena con blanco cuando las listas tienen largos distintos', () => {
    const rows = mergeLegacySipoc(
      [{ proveedor: 'A', entrada: 'a' }, { proveedor: 'B', entrada: 'b' }, { proveedor: 'C', entrada: 'c' }],
      [{ salida: 'S', cliente: 'Cli' }]
    )
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ supplier_name: 'A', output_description: 'S', customer_name: 'Cli' })
    expect(rows[1]).toMatchObject({ supplier_name: 'B', output_description: '', customer_name: '' })
    expect(rows[2]).toMatchObject({ supplier_name: 'C', output_description: '', customer_name: '' })
  })

  it('listas vacías o ausentes → sin filas', () => {
    expect(mergeLegacySipoc()).toEqual([])
    expect(mergeLegacySipoc([], [])).toEqual([])
  })
})
