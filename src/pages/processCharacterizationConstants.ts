import { FileText, Book, BarChart3, ShieldAlert, ClipboardCheck, Activity, Lightbulb, Database } from 'lucide-react'
import type { Process } from '@/types'

// ─── Blank BPMN (Bizagi-compatible A4 Landscape: 1122 x 792) ─────────────

export const BLANK_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn"
  exporter="Lean Process"
  exporterVersion="1.0">
  <bpmn2:collaboration id="Collaboration_1">
    <bpmn2:participant id="Participant_1" name="Proceso" processRef="Process_1" />
  </bpmn2:collaboration>
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:laneSet id="LaneSet_1">
      <bpmn2:lane id="Lane_1" name="Rol 1">
        <bpmn2:flowNodeRef>StartEvent_1</bpmn2:flowNodeRef>
      </bpmn2:lane>
    </bpmn2:laneSet>
    <bpmn2:startEvent id="StartEvent_1" name="Inicio" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="0" y="0" width="1122" height="250" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1" isHorizontal="true">
        <dc:Bounds x="30" y="0" width="1092" height="250" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="82" y="107" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="85" y="150" width="30" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`

// ─── Right panel tab types ────────────────────────────────────────────────

export type RightPanelTab = 'info' | 'procedimiento' | 'indicadores' | 'riesgos' | 'auditoria' | 'analisis' | 'mejoras' | 'activos' | null

export const TOOLBAR_TABS: {
  key: RightPanelTab
  label: string
  icon: React.ElementType
  requires?: 'bpmn'
  requiresMessage?: string
}[] = [
  { key: 'info',         label: 'Info',          icon: FileText },
  { key: 'procedimiento', label: 'Procedimiento', icon: Book,          requires: 'bpmn', requiresMessage: 'Necesitas un flujograma BPMN para generar el procedimiento' },
  { key: 'indicadores',  label: 'KPI',            icon: BarChart3 },
  { key: 'riesgos',      label: 'Riesgos',        icon: ShieldAlert,   requires: 'bpmn', requiresMessage: 'Necesitas un flujograma BPMN para identificar riesgos' },
  { key: 'auditoria',    label: 'Auditoria',      icon: ClipboardCheck, requires: 'bpmn', requiresMessage: 'Necesitas un flujograma BPMN para crear un programa de auditoria' },
  { key: 'analisis',     label: 'Valor',          icon: Activity,      requires: 'bpmn', requiresMessage: 'Necesitas un flujograma BPMN para hacer el analisis de valor' },
  { key: 'mejoras',      label: 'Mejoras',        icon: Lightbulb },
  { key: 'activos',      label: 'Activos',        icon: Database },
]

export const TOGGLE_FIELDS: { key: keyof Process; label: string }[] = [
  { key: 'provided_by_third_party', label: 'Provisto por tercero' },
  { key: 'is_critical',             label: 'Proceso critico' },
  { key: 'involves_cash_movement',  label: 'Mov. Efectivo' },
  { key: 'has_contingency_plan',    label: 'Plan contingencia' },
  { key: 'has_tax_operations',      label: 'Op. Tributarias' },
  { key: 'affects_accounting',      label: 'Afecta contabilidad' },
  { key: 'handles_personal_data',   label: 'Datos personales' },
]
