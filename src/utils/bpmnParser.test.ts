import { describe, it, expect } from 'vitest'
import { countBpmnContentNodes } from './bpmnParser'
import { BLANK_BPMN } from '@/pages/processCharacterizationConstants'

// Diagrama poblado mínimo: un carril con una tarea entre inicio y fin.
const POPULATED = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1">
  <bpmn2:process id="Process_1">
    <bpmn2:startEvent id="StartEvent_1" name="Inicio" />
    <bpmn2:task id="Task_1" name="Hacer algo" />
    <bpmn2:exclusiveGateway id="Gateway_1" name="¿Ok?" />
    <bpmn2:endEvent id="EndEvent_1" name="Fin" />
  </bpmn2:process>
</bpmn2:definitions>`

// Igual que BLANK_BPMN pero re-serializado por bpmn-js: otro orden de atributos y
// espaciado. NO es byte-idéntico a BLANK_BPMN → burlaba la comparación exacta.
const REFORMATTED_BLANK = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_0abc">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:laneSet id="LaneSet_1"><bpmn2:lane id="Lane_1" name="Rol 1"><bpmn2:flowNodeRef>StartEvent_1</bpmn2:flowNodeRef></bpmn2:lane></bpmn2:laneSet>
    <bpmn2:startEvent id="StartEvent_1" name="Inicio" />
  </bpmn2:process>
</bpmn2:definitions>`

describe('countBpmnContentNodes — salvaguarda anti-borrado', () => {
  it('el lienzo en blanco (solo inicio + carril) tiene 0 nodos de contenido', () => {
    expect(countBpmnContentNodes(BLANK_BPMN)).toBe(0)
  })

  it('un blanco RE-SERIALIZADO por bpmn-js también da 0 (no byte-idéntico a BLANK_BPMN)', () => {
    expect(REFORMATTED_BLANK).not.toBe(BLANK_BPMN)
    expect(countBpmnContentNodes(REFORMATTED_BLANK)).toBe(0)
  })

  it('un diagrama con una tarea y una compuerta cuenta 2', () => {
    expect(countBpmnContentNodes(POPULATED)).toBe(2)
  })

  it('XML vacío o ilegible se trata como vacío (0) — nunca pisa a uno lleno', () => {
    expect(countBpmnContentNodes('')).toBe(0)
    expect(countBpmnContentNodes('<<< no es xml')).toBe(0)
  })
})
