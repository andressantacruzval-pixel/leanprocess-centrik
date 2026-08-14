import { describe, it, expect } from 'vitest'
import { fixBpmnWaypoints } from './bpmnLayoutFix'

// Pool de 400px de ancho con una tarea en x=900: la IA dibujó el contenedor
// demasiado chico. Tras el fix, pool y lanes deben envolver todos los nodos.
const XML_POOL_CHICO = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Defs_1">
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="Pool_1" name="Proceso" processRef="Process_1"/>
  </bpmn:collaboration>
  <bpmn:process id="Process_1">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_1" name="Operador">
        <bpmn:flowNodeRef>Task_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_2</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_2" name="Supervisor">
        <bpmn:flowNodeRef>Task_3</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:task id="Task_1" name="A"/>
    <bpmn:task id="Task_2" name="B"/>
    <bpmn:task id="Task_3" name="C"/>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Task_1" targetRef="Task_2"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_2" targetRef="Task_3"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Collab_1">
      <bpmndi:BPMNShape id="Pool_1_di" bpmnElement="Pool_1" isHorizontal="true">
        <dc:Bounds x="100" y="80" width="400" height="250"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1" isHorizontal="true">
        <dc:Bounds x="130" y="80" width="370" height="125"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_2_di" bpmnElement="Lane_2" isHorizontal="true">
        <dc:Bounds x="130" y="205" width="370" height="125"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="200" y="100" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2">
        <dc:Bounds x="900" y="100" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_3_di" bpmnElement="Task_3">
        <dc:Bounds x="900" y="230" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="300" y="140"/>
        <di:waypoint x="900" y="140"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="950" y="180"/>
        <di:waypoint x="950" y="230"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

function getBounds(xml: string, bpmnElement: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const shape = Array.from(doc.querySelectorAll('*')).find(
    (e) => e.localName === 'BPMNShape' && e.getAttribute('bpmnElement') === bpmnElement,
  )
  const b = Array.from(shape!.children).find((c) => c.localName === 'Bounds')!
  return {
    x: +b.getAttribute('x')!,
    y: +b.getAttribute('y')!,
    w: +b.getAttribute('width')!,
    h: +b.getAttribute('height')!,
  }
}

describe('fixBpmnWaypoints — redimensionado de pool/lanes', () => {
  it('agranda el pool para envolver los elementos que quedaban fuera', () => {
    const out = fixBpmnWaypoints(XML_POOL_CHICO)
    const pool = getBounds(out, 'Pool_1')
    const task2 = getBounds(out, 'Task_2')
    const task3 = getBounds(out, 'Task_3')

    // Task_2 y Task_3 (x=900) deben quedar dentro del pool
    expect(pool.x + pool.w).toBeGreaterThanOrEqual(task2.x + task2.w)
    expect(pool.y + pool.h).toBeGreaterThanOrEqual(task3.y + task3.h)
    expect(pool.x).toBeLessThanOrEqual(200)
    expect(pool.y).toBeLessThanOrEqual(100)
  })

  it('las lanes tilean el pool sin huecos y cada una envuelve a sus miembros', () => {
    const out = fixBpmnWaypoints(XML_POOL_CHICO)
    const lane1 = getBounds(out, 'Lane_1')
    const lane2 = getBounds(out, 'Lane_2')
    const task3 = getBounds(out, 'Task_3')

    // Contiguas verticalmente
    expect(lane2.y).toBe(lane1.y + lane1.h)
    // Task_3 (miembro de Lane_2) dentro de su lane
    expect(task3.y).toBeGreaterThanOrEqual(lane2.y)
    expect(task3.y + task3.h).toBeLessThanOrEqual(lane2.y + lane2.h)
    // Mismo ancho ambas lanes
    expect(lane1.w).toBe(lane2.w)
  })

  it('devuelve el XML intacto si no hay pool/lanes', () => {
    const simple = '<?xml version="1.0"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"/>'
    expect(fixBpmnWaypoints(simple)).toBe(simple)
  })
})

// Gateway en lane inferior con un "Sí" (avance ↑) y un "No" (retorno ↑).
// Antes ambos se ruteaban por un corredor global izquierdo compartido y se
// encimaban; ahora deben ser rutas locales que entran por abajo del destino.
const XML_FLUJOS_ASCENDENTES = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Defs_2">
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="Pool_1" name="Proceso" processRef="Process_1"/>
  </bpmn:collaboration>
  <bpmn:process id="Process_1">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_1" name="Operador">
        <bpmn:flowNodeRef>Task_A</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_2" name="Supervisor">
        <bpmn:flowNodeRef>GW_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:task id="Task_A" name="Hacer"/>
    <bpmn:task id="Task_B" name="Siguiente"/>
    <bpmn:exclusiveGateway id="GW_1" name="¿OK?"/>
    <bpmn:sequenceFlow id="Flow_si" name="Sí" sourceRef="GW_1" targetRef="Task_B"/>
    <bpmn:sequenceFlow id="Flow_no" name="No" sourceRef="GW_1" targetRef="Task_A"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Collab_1">
      <bpmndi:BPMNShape id="Pool_1_di" bpmnElement="Pool_1" isHorizontal="true">
        <dc:Bounds x="100" y="80" width="900" height="330"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1" isHorizontal="true">
        <dc:Bounds x="130" y="80" width="870" height="160"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_2_di" bpmnElement="Lane_2" isHorizontal="true">
        <dc:Bounds x="130" y="240" width="870" height="170"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_A_di" bpmnElement="Task_A">
        <dc:Bounds x="300" y="120" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_B_di" bpmnElement="Task_B">
        <dc:Bounds x="700" y="120" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="GW_1_di" bpmnElement="GW_1" isMarkerVisible="true">
        <dc:Bounds x="500" y="300" width="50" height="50"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_si_di" bpmnElement="Flow_si">
        <di:waypoint x="550" y="325"/>
        <di:waypoint x="750" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_no_di" bpmnElement="Flow_no">
        <di:waypoint x="500" y="325"/>
        <di:waypoint x="350" y="200"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

function getWaypoints(xml: string, flowId: string): Array<{ x: number; y: number }> {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const edge = Array.from(doc.querySelectorAll('*')).find(
    (e) => e.localName === 'BPMNEdge' && e.getAttribute('bpmnElement') === flowId,
  )
  return Array.from(edge!.children)
    .filter((c) => c.localName === 'waypoint')
    .map((c) => ({ x: +c.getAttribute('x')!, y: +c.getAttribute('y')! }))
}

describe('fixBpmnWaypoints — flujos ascendentes locales (sin corredor global)', () => {
  it('rutea los flujos ↑ localmente, sin salirse del rango X origen-destino', () => {
    const out = fixBpmnWaypoints(XML_FLUJOS_ASCENDENTES)
    const si = getWaypoints(out, 'Flow_si')
    const no = getWaypoints(out, 'Flow_no')

    // GW_1 cx=525, Task_B cx=750, Task_A cx=350
    for (const wp of si) {
      expect(wp.x).toBeGreaterThanOrEqual(525 - 30)
      expect(wp.x).toBeLessThanOrEqual(750 + 30)
    }
    for (const wp of no) {
      expect(wp.x).toBeGreaterThanOrEqual(350 - 30)
      expect(wp.x).toBeLessThanOrEqual(525 + 30)
    }
  })

  it('entra por abajo del destino con offset ±20 del centro (no pisa el stem propio)', () => {
    const out = fixBpmnWaypoints(XML_FLUJOS_ASCENDENTES)
    const si = getWaypoints(out, 'Flow_si')
    const no = getWaypoints(out, 'Flow_no')

    const siLast = si[si.length - 1]
    const noLast = no[no.length - 1]
    // Ambos entran por el borde inferior del destino (y=200)
    expect(siLast.y).toBe(200)
    expect(noLast.y).toBe(200)
    // "Sí" (origen a la izq. del destino) entra en cx-20; "No" (retorno) en cx+20
    expect(siLast.x).toBe(750 - 20)
    expect(noLast.x).toBe(350 + 20)
  })
})

// La IA a veces declara un elemento en el flowNodeRef del lane equivocado
// aunque lo dibuje en la franja correcta. Aquí GW_1 (dibujado abajo, y=300)
// está declarado en el lane de ARRIBA: la frontera no debe arrastrarse.
const XML_GATEWAY_MAL_DECLARADO = XML_FLUJOS_ASCENDENTES
  .replace(
    `<bpmn:flowNodeRef>Task_B</bpmn:flowNodeRef>
      </bpmn:lane>`,
    `<bpmn:flowNodeRef>Task_B</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>GW_1</bpmn:flowNodeRef>
      </bpmn:lane>`,
  )
  .replace(
    `<bpmn:lane id="Lane_2" name="Supervisor">
        <bpmn:flowNodeRef>GW_1</bpmn:flowNodeRef>
      </bpmn:lane>`,
    `<bpmn:lane id="Lane_2" name="Supervisor"/>`,
  )

describe('fixBpmnWaypoints — declaración de lane errónea (la geometría manda)', () => {
  it('un elemento mal declarado no arrastra la frontera del carril', () => {
    const out = fixBpmnWaypoints(XML_GATEWAY_MAL_DECLARADO)
    const lane1 = getBounds(out, 'Lane_1')
    const lane2 = getBounds(out, 'Lane_2')

    // Frontera entre las dos filas reales (tareas y=120-200, gateway y=300-350)
    const boundary = lane1.y + lane1.h
    expect(boundary).toBeGreaterThan(200)
    expect(boundary).toBeLessThan(300)
    // El lane inferior envuelve al gateway y no es una tira vacía
    expect(lane2.y + lane2.h).toBeGreaterThanOrEqual(350)
    expect(lane2.h).toBeGreaterThanOrEqual(100)
  })
})
