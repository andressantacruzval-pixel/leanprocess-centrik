import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseInlineToolCalls } from './conversationalAi'

describe('parseInlineToolCalls', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('regex estricto — caso happy path', () => {
    it('extrae un marcador bien formado', () => {
      const { calls, cleanedText } = parseInlineToolCalls(
        '<<ADD_TASK name="Validar">> Listo, agregada.'
      )
      expect(calls).toHaveLength(1)
      expect(calls[0].name).toBe('ADD_TASK')
      expect(calls[0].params.name).toBe('Validar')
      expect(cleanedText).toBe('Listo, agregada.')
    })

    it('extrae múltiples marcadores en cadena', () => {
      const { calls, cleanedText } = parseInlineToolCalls(
        '<<ADD_LANE name="A">><<ADD_LANE name="B">><<ADD_LANE name="C">> Los 3 roles quedaron.'
      )
      expect(calls).toHaveLength(3)
      expect(calls.map((c) => c.params.name)).toEqual(['A', 'B', 'C'])
      expect(cleanedText).toBe('Los 3 roles quedaron.')
    })

    it('acepta curly quotes', () => {
      const { calls } = parseInlineToolCalls('<<ADD_TASK name=“Validar”>>')
      expect(calls).toHaveLength(1)
      expect(calls[0].params.name).toBe('Validar')
    })

    it('tolera marcador sin espacio entre NAME y primer param', () => {
      // Caso real reportado: el modelo emite <<ADD_TASKname="X">> sin espacio.
      // Sin tolerancia, este tool call se pierde y queda como residuo en el chat.
      const { calls, cleanedText } = parseInlineToolCalls(
        '<<ADD_TASKname="Validar calidad">><<ADD_GATEWAYname="Cumple?">>'
      )
      expect(calls).toHaveLength(2)
      expect(calls[0].name).toBe('ADD_TASK')
      expect(calls[0].params.name).toBe('Validar calidad')
      expect(calls[1].name).toBe('ADD_GATEWAY')
      expect(calls[1].params.name).toBe('Cumple?')
      expect(cleanedText).toBe('')
    })
  })

  describe('regex lenient — recuperación de >> olvidados', () => {
    it('captura marcador sin cierre >>', () => {
      const { calls, cleanedText } = parseInlineToolCalls(
        '<<ADD_TASK name="Validar" texto suelto después'
      )
      expect(calls).toHaveLength(1)
      expect(calls[0].name).toBe('ADD_TASK')
      expect(cleanedText).toContain('texto suelto después')
    })
  })

  describe('sanitize agresivo — caso del bug real del Diagramador IA', () => {
    it('limpia el buffer roto que vimos en la screenshot del usuario', () => {
      // Buffer reconstruido del caso real reportado.
      const brokenBuffer = `ivos con IA">>de creativos">>ple requisitos de calidad?" label="No" target="Iterar sobre anuncio no cumple requisitos">>="Publicar creativos">>WAY name="Resultados de creativo buenos?" after="Validar resultados de creativo existente">>_TASK name="Sacar variaciones de creativo bueno">>existente">>bueno" to="Validar rendimiento de creativos publicados">>y seleccionar ganadores" after="Sacar variaciones de mejores resultados">>gustaría definir los roles que participan en este proceso?`

      const { cleanedText } = parseInlineToolCalls(brokenBuffer)

      // El texto resultante NO debe contener markup residual.
      expect(cleanedText).not.toContain('>>')
      expect(cleanedText).not.toContain('<<')
      expect(cleanedText).not.toMatch(/\b[A-Z_]{2,}\s+[a-z_]+="/)
      expect(cleanedText).not.toMatch(/\b[a-z_]+="[^"]*"/)
      // Pero debe preservar al menos la pregunta conversacional del final.
      expect(cleanedText.toLowerCase()).toContain('gustaría definir los roles')
    })

    it('preserva texto conversacional cuando no hay markup', () => {
      const text = 'Hola, soy tu consultor. ¿Como prefieres empezar?'
      const { calls, cleanedText } = parseInlineToolCalls(text)
      expect(calls).toHaveLength(0)
      expect(cleanedText).toBe(text)
    })

    it('maneja mezcla de marcadores válidos + fragmentos rotos', () => {
      const mixed = `<<ADD_TASK name="Recibir">> Agregué la tarea. label="algo" target="otra cosa">> Siguiente paso?`
      const { calls, cleanedText } = parseInlineToolCalls(mixed)
      expect(calls).toHaveLength(1)
      expect(calls[0].params.name).toBe('Recibir')
      // El fragmento roto se borra, el texto legítimo queda.
      expect(cleanedText).not.toContain('label=')
      expect(cleanedText).not.toContain('>>')
      expect(cleanedText).toContain('Agregué la tarea')
      expect(cleanedText).toContain('Siguiente paso?')
    })

    it('loggea advertencia cuando sanitiza residuos', () => {
      parseInlineToolCalls('label="No" target="X">>')
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('residual markup sanitized'),
        expect.any(String)
      )
    })

    it('no loggea cuando el texto es conversacional limpio', () => {
      parseInlineToolCalls('Hola, ¿como estás?')
      expect(console.warn).not.toHaveBeenCalled()
    })
  })
})
