import { describe, it, expect } from 'vitest'
import { buildControlContext } from './riskAi'

// BPMN mínimo con UNA actividad (tarea) y UNA decisión (compuerta con nombre de
// pregunta). Los controles solo pueden salir de actividades: la decisión NO debe
// entrar como candidata a control.
const BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Def_1">
  <bpmn2:process id="Process_1">
    <bpmn2:task id="Task_1" name="Validar datos del cliente" />
    <bpmn2:exclusiveGateway id="Gw_1" name="¿Segmento objetivo?" />
  </bpmn2:process>
</bpmn2:definitions>`

describe('buildControlContext — los controles solo son actividades', () => {
  it('incluye la actividad como candidata a control', () => {
    const { index } = buildControlContext(BPMN)
    expect(index.has('validar datos del cliente')).toBe(true)
    expect(index.get('validar datos del cliente')).toBe('Task_1')
  })

  it('EXCLUYE la decisión/compuerta (no puede ser control)', () => {
    const { index, block } = buildControlContext(BPMN)
    expect(index.has('¿segmento objetivo?')).toBe(false)
    expect(index.has('segmento objetivo?')).toBe(false)
    // La decisión tampoco se ofrece a la IA en la lista de candidatos.
    expect(block).not.toContain('Segmento objetivo')
    expect(block).toContain('Validar datos del cliente')
  })
})
