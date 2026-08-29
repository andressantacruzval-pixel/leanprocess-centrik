'use client';

import React, { useState, useCallback } from 'react';
import {
  Circle,
  Square,
  Diamond,
  FileText,
  Users,
  Layers,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Settings,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import type { BpmnElement, BpmnModelerInstance } from '@/types/bpmn';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface BpmnPaletteProps {
  modeler: BpmnModelerInstance | null;
}

interface PaletteElement {
  id: string;
  label: string;
  bpmnType: string;
  /** Extra options forwarded to elementFactory.createShape */
  shapeOptions?: Record<string, unknown>;
  /** If true, use createParticipantShape() instead */
  isParticipant?: boolean;
  /** If true, this is a lane insertion (special handling) */
  isLane?: boolean;
  /** Render function for the mini icon shown in the grid */
  icon: React.ReactNode;
}

interface PaletteCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  elements: PaletteElement[];
}

/* -------------------------------------------------------------------------- */
/*  Mini shape icons (small SVG / Lucide combos for each element)              */
/* -------------------------------------------------------------------------- */

const MiniStartEvent = () => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="8" fill="none" stroke="#22c55e" strokeWidth="2" />
  </svg>
);

const MiniEndEvent = () => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="8" fill="none" stroke="#ef4444" strokeWidth="3" />
  </svg>
);

const MiniIntermediateEvent = () => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="8" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
    <circle cx="10" cy="10" r="6" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
  </svg>
);

const MiniTimerEvent = () => (
  <Clock size={18} className="text-blue-600" />
);

// Nota: los trazos usan currentColor, no un color fijo, para que hereden el gris
// del contenedor. Con el lienzo blanco de Centrik un blanco fijo seria invisible.
const MiniTask = () => (
  <svg width="22" height="16" viewBox="0 0 22 16" className="text-gray-500">
    <rect x="1" y="1" width="20" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const MiniUserTask = () => (
  <User size={16} className="text-primary-600" />
);

const MiniServiceTask = () => (
  <Settings size={16} className="text-primary-600" />
);

const MiniExclusiveGateway = () => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    <polygon points="10,1 19,10 10,19 1,10" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
    <text x="10" y="14" textAnchor="middle" fontSize="10" fill="#f59e0b" fontWeight="bold">X</text>
  </svg>
);

const MiniParallelGateway = () => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    <polygon points="10,1 19,10 10,19 1,10" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
    <text x="10" y="14" textAnchor="middle" fontSize="11" fill="#f59e0b" fontWeight="bold">+</text>
  </svg>
);

const MiniInclusiveGateway = () => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    <polygon points="10,1 19,10 10,19 1,10" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
    <circle cx="10" cy="10" r="4" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
  </svg>
);

const MiniDataObject = () => (
  <FileText size={16} className="text-gray-500" />
);

const MiniDataStore = () => (
  <svg width="20" height="18" viewBox="0 0 20 18" className="text-gray-500">
    <ellipse cx="10" cy="4" rx="8" ry="3" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <line x1="2" y1="4" x2="2" y2="14" stroke="currentColor" strokeWidth="1.3" />
    <line x1="18" y1="4" x2="18" y2="14" stroke="currentColor" strokeWidth="1.3" />
    <ellipse cx="10" cy="14" rx="8" ry="3" fill="none" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

const MiniComputer = () => (
  <svg width="22" height="18" viewBox="0 0 22 18">
    <rect x="1" y="1" width="14" height="10" rx="1.5" fill="none" stroke="#38bdf8" strokeWidth="1.3" />
    <rect x="3" y="3" width="10" height="6" rx="0.5" fill="#0ea5e9" />
    <rect x="6.5" y="11" width="3" height="2" fill="#38bdf8" />
    <rect x="4" y="13" width="8" height="1.5" rx="0.7" fill="#38bdf8" />
    <rect x="16" y="1" width="5" height="13" rx="1" fill="none" stroke="#38bdf8" strokeWidth="1.3" />
    <line x1="17.2" y1="3.5" x2="19.8" y2="3.5" stroke="#38bdf8" strokeWidth="1" />
    <line x1="17.2" y1="5.5" x2="19.8" y2="5.5" stroke="#38bdf8" strokeWidth="1" />
    <circle cx="18.5" cy="10.5" r="1" fill="#38bdf8" />
  </svg>
);

const MiniLane = () => (
  <svg width="24" height="14" viewBox="0 0 24 14" className="text-gray-500">
    <rect x="1" y="1" width="22" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <line x1="1" y1="7" x2="23" y2="7" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 2" />
  </svg>
);

const MiniSubProcess = () => (
  <svg width="22" height="16" viewBox="0 0 22 16" className="text-gray-500">
    <rect x="1" y="1" width="20" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <rect x="8" y="11" width="6" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
    <line x1="11" y1="12" x2="11" y2="14" stroke="currentColor" strokeWidth="0.8" />
    <line x1="9.5" y1="13" x2="12.5" y2="13" stroke="currentColor" strokeWidth="0.8" />
  </svg>
);

const MiniControlNode = () => (
  <svg width="22" height="16" viewBox="0 0 22 16">
    <rect x="1" y="1" width="20" height="14" rx="7" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
    <circle cx="11" cy="8" r="3" fill="none" stroke="#22d3ee" strokeWidth="1" />
  </svg>
);

const MiniRiskNode = () => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    <polygon points="10,2 18,16 2,16" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinejoin="round" />
    <text x="10" y="14" textAnchor="middle" fontSize="9" fill="#f87171" fontWeight="bold">!</text>
  </svg>
);

/* -------------------------------------------------------------------------- */
/*  Category definitions                                                       */
/* -------------------------------------------------------------------------- */

const CATEGORIES: PaletteCategory[] = [
  {
    id: 'events',
    label: 'Eventos',
    icon: <Circle size={14} />,
    elements: [
      {
        id: 'start-event',
        label: 'Inicio',
        bpmnType: 'bpmn:StartEvent',
        icon: <MiniStartEvent />,
      },
      {
        id: 'end-event',
        label: 'Fin',
        bpmnType: 'bpmn:EndEvent',
        icon: <MiniEndEvent />,
      },
      {
        id: 'intermediate-event',
        label: 'Intermedio',
        bpmnType: 'bpmn:IntermediateCatchEvent',
        icon: <MiniIntermediateEvent />,
      },
      {
        id: 'timer-event',
        label: 'Temporizador',
        bpmnType: 'bpmn:IntermediateCatchEvent',
        shapeOptions: {
          eventDefinitionType: 'bpmn:TimerEventDefinition',
        },
        icon: <MiniTimerEvent />,
      },
    ],
  },
  {
    id: 'activities',
    label: 'Actividad',
    icon: <Square size={14} />,
    elements: [
      {
        id: 'task',
        label: 'Tarea',
        bpmnType: 'bpmn:Task',
        icon: <MiniTask />,
      },
      {
        id: 'user-task',
        label: 'Tarea de Usuario',
        bpmnType: 'bpmn:UserTask',
        icon: <MiniUserTask />,
      },
      {
        id: 'service-task',
        label: 'Tarea de Servicio',
        bpmnType: 'bpmn:ServiceTask',
        icon: <MiniServiceTask />,
      },
    ],
  },
  {
    id: 'gateways',
    label: 'Compuertas',
    icon: <Diamond size={14} />,
    elements: [
      {
        id: 'exclusive-gateway',
        label: 'Exclusiva',
        bpmnType: 'bpmn:ExclusiveGateway',
        icon: <MiniExclusiveGateway />,
      },
      {
        id: 'parallel-gateway',
        label: 'Paralela',
        bpmnType: 'bpmn:ParallelGateway',
        icon: <MiniParallelGateway />,
      },
      {
        id: 'inclusive-gateway',
        label: 'Inclusiva',
        bpmnType: 'bpmn:InclusiveGateway',
        icon: <MiniInclusiveGateway />,
      },
    ],
  },
  {
    id: 'data',
    label: 'Datos',
    icon: <FileText size={14} />,
    elements: [
      {
        id: 'data-object',
        label: 'Objeto de Datos',
        bpmnType: 'bpmn:DataObjectReference',
        icon: <MiniDataObject />,
      },
      {
        id: 'data-store',
        label: 'Almacen de Datos',
        bpmnType: 'bpmn:DataStoreReference',
        icon: <MiniDataStore />,
      },
      {
        id: 'application',
        label: 'Aplicacion',
        bpmnType: 'bpmn:DataStoreReference',
        shapeOptions: { _isApp: true, width: 46, height: 44 },
        icon: <MiniComputer />,
      },
    ],
  },
  {
    id: 'participants',
    label: 'Carriles',
    icon: <Users size={14} />,
    elements: [
      {
        id: 'lane',
        label: 'Lane',
        bpmnType: 'bpmn:Lane',
        isLane: true,
        icon: <MiniLane />,
      },
    ],
  },
  {
    id: 'subprocesses',
    label: 'Subprocesos',
    icon: <Layers size={14} />,
    elements: [
      {
        id: 'subprocess',
        label: 'Subproceso',
        bpmnType: 'bpmn:SubProcess',
        shapeOptions: { isExpanded: true },
        icon: <MiniSubProcess />,
      },
    ],
  },
  {
    id: 'risk-management',
    label: 'Riesgos',
    icon: <ShieldAlert size={14} />,
    elements: [
      {
        id: 'control-node',
        label: 'Control',
        bpmnType: 'bpmn:Task',
        shapeOptions: { _isControl: true },
        icon: <MiniControlNode />,
      },
      {
        id: 'risk-node',
        label: 'Riesgo',
        bpmnType: 'bpmn:TextAnnotation',
        shapeOptions: { _isRisk: true },
        icon: <MiniRiskNode />,
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function BpmnPalette({ modeler }: BpmnPaletteProps) {
  // All categories expanded by default
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    () => Object.fromEntries(CATEGORIES.map((c) => [c.id, true]))
  );

  const toggleCategory = useCallback((categoryId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  }, []);

  /** Add a lane to the existing pool participant */
  const addLaneToPool = useCallback(() => {
    if (!modeler) return;

    try {
      const elementRegistry = modeler.get('elementRegistry');
      const modeling = modeler.get('modeling');

      // Find the participant (pool)
      const participant = elementRegistry.filter((el: BpmnElement) => el.type === 'bpmn:Participant')[0];
      if (!participant) {
        console.warn('[BpmnPalette] No pool found to add lane');
        return;
      }

      // Add a lane to the pool - bpmn-js will auto-expand the pool height
      modeling.addLane(participant, 'bottom');
    } catch (err) {
      console.warn('[BpmnPalette] Could not add lane:', err);
    }
  }, [modeler]);

  /** Start a bpmn-js create drag on mousedown */
  const handleElementMouseDown = useCallback(
    (event: React.MouseEvent, element: PaletteElement) => {
      if (!modeler) return;

      event.preventDefault();
      event.stopPropagation();

      // Lane: click to add (not drag)
      if (element.isLane) {
        addLaneToPool();
        return;
      }

      try {
        const create = modeler.get('create');
        const elementFactory = modeler.get('elementFactory');

        let shape: BpmnElement;

        if (element.isParticipant) {
          shape = elementFactory.createParticipantShape();
        } else {
          const { _isControl, _isRisk, _isApp, ...cleanOptions } = (element.shapeOptions ?? {}) as Record<string, unknown>;
          shape = elementFactory.createShape({
            type: element.bpmnType,
            ...cleanOptions,
          });

          // Set default name prefix for risk management nodes
          if (_isControl && shape.businessObject) {
            shape.businessObject.name = '[Control] ';
          } else if (_isRisk && shape.businessObject) {
            shape.businessObject.name = '[Riesgo] ';
          } else if (_isApp && shape.businessObject) {
            // Marca de aplicación (atributo moddle) → se dibuja como computadora y
            // lo detecta el panel de Aplicaciones. Persiste aunque se renombre.
            (shape.businessObject as unknown as { isApplication?: boolean }).isApplication = true;
          }
        }

        // Convert the React synthetic event to the native event for bpmn-js
        create.start(event.nativeEvent || event, shape);
      } catch (err) {
        console.warn('[BpmnPalette] Could not start element creation:', err);
      }
    },
    [modeler, addLaneToPool]
  );

  /* ---------------------------------------------------------------------- */
  /*  Loading / disabled state                                               */
  /* ---------------------------------------------------------------------- */
  if (!modeler) {
    return (
      <div
        className="
          hidden lg:flex flex-col items-center justify-center gap-3 w-[200px] shrink-0 h-full bg-white
          border-r border-gray-100 text-gray-400 text-xs select-none
        "
      >
        <Loader2 size={24} className="animate-spin text-primary-600" />
        <span>Cargando paleta...</span>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                  */
  /* ---------------------------------------------------------------------- */
  return (
    <div
      className="
        hidden lg:flex flex-col w-[180px] xl:w-[200px] shrink-0 h-full bg-white border-r border-gray-100
        text-gray-700 text-xs select-none overflow-y-auto overflow-x-hidden scrollbar-thin
        scrollbar-thumb-gray-300 scrollbar-track-transparent
      "
    >
      {/* Title */}
      <div className="px-3 py-2.5 text-[10px] uppercase tracking-widest text-primary-600 font-semibold border-b border-gray-100">
        Elementos BPMN
      </div>

      {/* Categories */}
      {CATEGORIES.map((category) => {
        const isOpen = expanded[category.id] ?? true;

        return (
          <div key={category.id} className="border-b border-gray-100">
            {/* Category header */}
            <button
              type="button"
              onClick={() => toggleCategory(category.id)}
              className="
                flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] font-medium text-gray-600
                hover:text-gray-800 hover:bg-gray-50 transition-colors duration-150
              "
            >
              <span className="text-primary-600">{category.icon}</span>
              <span className="flex-1">{category.label}</span>
              {isOpen ? (
                <ChevronDown size={12} className="text-gray-400" />
              ) : (
                <ChevronRight size={12} className="text-gray-400" />
              )}
            </button>

            {/* Elements grid */}
            {isOpen && (
              <div className="grid grid-cols-2 gap-1 px-2 pb-2">
                {category.elements.map((element) => (
                  <div
                    key={element.id}
                    onMouseDown={(e) => handleElementMouseDown(e, element)}
                    title={element.isLane ? `${element.label} (click para agregar)` : element.label}
                    className={`
                      flex flex-col items-center justify-center gap-1 rounded-md py-2 px-1 border border-transparent
                      hover:bg-gray-50 hover:border-primary-200 transition-all duration-150
                      ${element.isLane
                        ? 'cursor-pointer active:bg-emerald-50 active:border-emerald-200'
                        : 'cursor-grab active:cursor-grabbing active:bg-primary-50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-center h-5">
                      {element.icon}
                    </div>
                    <span className="text-[9px] text-gray-500 text-center leading-tight truncate w-full">
                      {element.isLane ? `+ ${element.label}` : element.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Bottom spacer */}
      <div className="flex-1" />
    </div>
  );
}
