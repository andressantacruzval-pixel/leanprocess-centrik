// ── Tour step definition ──────────────────────────────────────────────────

export interface TourStep {
  /** CSS selector for the target element to spotlight */
  target: string
  /** Title shown in the tooltip */
  title: string
  /** Detailed instruction for the user */
  content: string
  /** Route to navigate to before showing this step */
  route?: string
  /** Which side to show the tooltip */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** If true, clicking the target element advances the tour */
  clickToAdvance?: boolean
  /** Milestone to mark complete when this step is reached */
  completeMilestone?: string
}

// ── Tour definitions per milestone ───────────────────────────────────────
// Each tour walks the user through the FULL flow step by step.

export const TOURS: Record<string, TourStep[]> = {
  company: [
    {
      target: '[data-tour="perfil"]',
      title: 'Configuracion de Empresa',
      content: 'Empecemos por definir tu empresa. Esta en tu perfil, aqui arriba a la derecha, en Configuracion.',
      route: '/app',
      placement: 'bottom',
    },
    {
      target: 'input[name="name"], input[placeholder*="empresa" i], input[placeholder*="nombre" i]',
      title: 'Nombre de la Empresa',
      content: 'Escribe el nombre de tu empresa. Luego completa la industria y los demas campos obligatorios.',
      route: '/app/settings',
      placement: 'bottom',
    },
    {
      target: 'button[type="submit"], button:has(.lucide-save), button:has(.lucide-check)',
      title: 'Guardar Empresa',
      content: 'Cuando termines de llenar los datos, haz clic en Guardar. El hito se completara automaticamente cuando la empresa tenga nombre e industria configurados.',
      route: '/app/settings',
      placement: 'bottom',
      completeMilestone: 'company',
    },
  ],

  'org-structure': [
    {
      target: 'a[href="/app/org-structure"]',
      title: 'Estructura Organizacional',
      content: 'Ahora vamos a crear tu organigrama. Haz clic en Estructura Organizacional.',
      route: '/app',
      placement: 'right',
      clickToAdvance: true,
    },
    {
      target: 'button[class*="from-cyan-600"], button:has(.lucide-plus)',
      title: 'Agregar Unidad Raiz',
      content: 'Haz clic en "Agregar raiz" para crear tu primera unidad organizacional (ej: Gerencia General, Direccion Ejecutiva).',
      route: '/app/org-structure',
      placement: 'bottom',
    },
    {
      target: '[class*="org-tree"], [class*="tree-node"], [class*="OrgTree"], [class*="orgchart"]',
      title: 'Construye tu Organigrama',
      content: 'Agrega al menos 2-3 unidades organizacionales (departamentos, areas). Usa el boton "+" en cada unidad para crear subniveles. El hito se confirma cuando tengas unidades creadas.',
      route: '/app/org-structure',
      placement: 'bottom',
      completeMilestone: 'org-structure',
    },
  ],

  'process-map': [
    {
      target: 'a[href="/app/process-map"]',
      title: 'Mapa de Procesos',
      content: 'Vamos al Mapa de Procesos. Aqui crearas macroprocesos organizados por categoria (Estrategico, Productivo, Apoyo).',
      route: '/app',
      placement: 'right',
      clickToAdvance: true,
    },
    {
      target: 'button[class*="border-dashed"]',
      title: 'Crear Macroproceso',
      content: 'Haz clic en "Agregar" en cualquier banda para crear tu primer macroproceso. Dale un nombre descriptivo (ej: Gestion Comercial, Produccion).',
      route: '/app/process-map',
      placement: 'bottom',
    },
    {
      target: '[class*="ProcessBand"] [class*="cursor-pointer"], [class*="rounded-xl"][class*="border"][class*="shadow"]',
      title: 'Entrar al Macroproceso',
      content: 'Ahora haz clic en el macroproceso que creaste para entrar y agregar procesos/subprocesos dentro de el.',
      route: '/app/process-map',
      placement: 'bottom',
    },
    {
      target: 'button[class*="border-dashed"], button:has(.lucide-plus)',
      title: 'Agregar Subprocesos',
      content: 'Crea al menos un proceso o subproceso dentro del macroproceso. El hito se completa cuando tengas al menos un macroproceso Y un proceso creados.',
      placement: 'bottom',
      completeMilestone: 'process-map',
    },
  ],

  bpmn: [
    {
      target: 'a[href="/app/process-map"]',
      title: 'Paso 1: Ir al Mapa de Procesos',
      content: 'Para crear un flujograma BPMN, primero ve al Mapa de Procesos.',
      route: '/app',
      placement: 'right',
      clickToAdvance: true,
    },
    {
      target: '[class*="ProcessBand"] [class*="cursor-pointer"], [class*="rounded-xl"][class*="border"][class*="shadow"]',
      title: 'Paso 2: Selecciona un Macroproceso',
      content: 'Haz clic en uno de tus macroprocesos para ver los procesos que contiene.',
      route: '/app/process-map',
      placement: 'bottom',
    },
    {
      target: '[class*="SubprocessCard"], [class*="DrillCard"], [class*="process-card"]',
      title: 'Paso 3: Abre un Subproceso',
      content: 'Haz doble clic en un subproceso (o clic en "Caracterizar") para abrir el diagramador BPMN.',
      placement: 'bottom',
    },
    {
      target: 'canvas, [class*="bpmn"], [class*="reactflow"], [class*="flowchart"], [class*="react-flow"]',
      title: 'Paso 4: Crea tu Flujograma',
      content: 'Usa el lienzo para diagramar tu proceso. Puedes usar el boton de IA (estrella morada) para generar un flujograma automaticamente. El hito se completa cuando guardes un flujograma BPMN.',
      placement: 'bottom',
      completeMilestone: 'bpmn',
    },
  ],

  procedure: [
    {
      target: 'a[href="/app/process-map"]',
      title: 'Paso 1: Ir al Mapa de Procesos',
      content: 'Para documentar un procedimiento, necesitas un subproceso con flujograma BPMN. Ve al Mapa de Procesos.',
      route: '/app',
      placement: 'right',
      clickToAdvance: true,
    },
    {
      target: '[class*="ProcessBand"] [class*="cursor-pointer"], [class*="rounded-xl"][class*="border"][class*="shadow"]',
      title: 'Paso 2: Entra a un Macroproceso',
      content: 'Selecciona un macroproceso que ya tenga subprocesos creados.',
      route: '/app/process-map',
      placement: 'bottom',
    },
    {
      target: '[class*="SubprocessCard"], [class*="DrillCard"], [class*="process-card"]',
      title: 'Paso 3: Abre un Subproceso',
      content: 'Haz doble clic en un subproceso que YA tenga un flujograma BPMN creado.',
      placement: 'bottom',
    },
    {
      target: 'button[title="Procedimiento"]',
      title: 'Paso 4: Pestaña Procedimiento',
      content: 'Haz clic en "Procedimiento" en la barra superior. Necesitas tener un flujograma BPMN listo.',
      placement: 'bottom',
    },
    {
      target: 'button[class*="from-purple"], button:has(.lucide-sparkles), button:has(.lucide-wand)',
      title: 'Paso 5: Genera con IA',
      content: 'Haz clic en el boton de IA para generar el procedimiento automaticamente desde tu flujograma. El hito se completa cuando tengas al menos un procedimiento generado.',
      placement: 'bottom',
      completeMilestone: 'procedure',
    },
  ],

  kpi: [
    {
      target: 'a[href="/app/process-map"]',
      title: 'Paso 1: Ir al Mapa de Procesos',
      content: 'Para definir indicadores KPI, necesitas un subproceso. Ve al Mapa de Procesos.',
      route: '/app',
      placement: 'right',
      clickToAdvance: true,
    },
    {
      target: '[class*="ProcessBand"] [class*="cursor-pointer"], [class*="rounded-xl"][class*="border"][class*="shadow"]',
      title: 'Paso 2: Entra a un Macroproceso',
      content: 'Selecciona un macroproceso con subprocesos.',
      route: '/app/process-map',
      placement: 'bottom',
    },
    {
      target: '[class*="SubprocessCard"], [class*="DrillCard"], [class*="process-card"]',
      title: 'Paso 3: Abre un Subproceso',
      content: 'Haz doble clic en un subproceso para abrir su caracterizacion.',
      placement: 'bottom',
    },
    {
      target: 'button[title="KPI"]',
      title: 'Paso 4: Pestaña KPI',
      content: 'Haz clic en "KPI" para abrir el panel de indicadores de gestion.',
      placement: 'bottom',
    },
    {
      target: 'button[class*="from-purple"], button:has(.lucide-sparkles), button[class*="from-cyan"], button:has(.lucide-plus)',
      title: 'Paso 5: Crear o Generar KPIs',
      content: 'Puedes crear KPIs manualmente o generarlos con IA. El hito se completa cuando tengas al menos un indicador definido.',
      placement: 'bottom',
      completeMilestone: 'kpi',
    },
  ],

  risk: [
    {
      target: 'a[href="/app/process-map"]',
      title: 'Paso 1: Ir al Mapa de Procesos',
      content: 'Para identificar riesgos necesitas un subproceso con flujograma BPMN. Ve al Mapa de Procesos.',
      route: '/app',
      placement: 'right',
      clickToAdvance: true,
    },
    {
      target: '[class*="ProcessBand"] [class*="cursor-pointer"], [class*="rounded-xl"][class*="border"][class*="shadow"]',
      title: 'Paso 2: Entra a un Macroproceso',
      content: 'Selecciona un macroproceso con subprocesos.',
      route: '/app/process-map',
      placement: 'bottom',
    },
    {
      target: '[class*="SubprocessCard"], [class*="DrillCard"], [class*="process-card"]',
      title: 'Paso 3: Abre un Subproceso',
      content: 'Haz doble clic en un subproceso que tenga un flujograma BPMN listo.',
      placement: 'bottom',
    },
    {
      target: 'button[title="Riesgos"]',
      title: 'Paso 4: Pestaña Riesgos',
      content: 'Haz clic en "Riesgos". Necesitas tener un flujograma BPMN para poder identificar riesgos.',
      placement: 'bottom',
    },
    {
      target: 'button[class*="from-purple"], button:has(.lucide-sparkles), button:has(.lucide-wand)',
      title: 'Paso 5: Genera Riesgos con IA',
      content: 'Usa el boton de IA (estrella morada) para identificar riesgos automaticamente desde tu flujograma. El hito se completa cuando tengas al menos un riesgo identificado.',
      placement: 'bottom',
      completeMilestone: 'risk',
    },
  ],

  audit: [
    {
      target: 'a[href="/app/process-map"]',
      title: 'Paso 1: Ir al Mapa de Procesos',
      content: 'Para crear un programa de auditoria necesitas un subproceso con flujograma. Ve al Mapa de Procesos.',
      route: '/app',
      placement: 'right',
      clickToAdvance: true,
    },
    {
      target: '[class*="ProcessBand"] [class*="cursor-pointer"], [class*="rounded-xl"][class*="border"][class*="shadow"]',
      title: 'Paso 2: Entra a un Macroproceso',
      content: 'Selecciona un macroproceso con subprocesos.',
      route: '/app/process-map',
      placement: 'bottom',
    },
    {
      target: '[class*="SubprocessCard"], [class*="DrillCard"], [class*="process-card"]',
      title: 'Paso 3: Abre un Subproceso',
      content: 'Haz doble clic en un subproceso que tenga flujograma y riesgos identificados.',
      placement: 'bottom',
    },
    {
      target: 'button[title="Auditoria"]',
      title: 'Paso 4: Pestaña Auditoria',
      content: 'Haz clic en "Auditoria" para abrir el modulo de programa de auditoria.',
      placement: 'bottom',
    },
    {
      target: 'button[class*="from-purple"], button:has(.lucide-sparkles), button:has(.lucide-wand)',
      title: 'Paso 5: Genera con IA',
      content: 'Genera un programa de auditoria automaticamente con IA basado en tu flujograma y riesgos. El hito se completa cuando tengas al menos un item de auditoria creado.',
      placement: 'bottom',
      completeMilestone: 'audit',
    },
  ],

  'value-analysis': [
    {
      target: 'a[href="/app/process-map"]',
      title: 'Paso 1: Ir al Mapa de Procesos',
      content: 'Para hacer el analisis de valor necesitas un subproceso con flujograma BPMN. Ve al Mapa de Procesos.',
      route: '/app',
      placement: 'right',
      clickToAdvance: true,
    },
    {
      target: '[class*="ProcessBand"] [class*="cursor-pointer"], [class*="rounded-xl"][class*="border"][class*="shadow"]',
      title: 'Paso 2: Entra a un Macroproceso',
      content: 'Selecciona un macroproceso con subprocesos.',
      route: '/app/process-map',
      placement: 'bottom',
    },
    {
      target: '[class*="SubprocessCard"], [class*="DrillCard"], [class*="process-card"]',
      title: 'Paso 3: Abre un Subproceso',
      content: 'Haz doble clic en un subproceso que tenga un flujograma BPMN listo.',
      placement: 'bottom',
    },
    {
      target: 'button[title="Valor"]',
      title: 'Paso 4: Pestaña Valor',
      content: 'Haz clic en "Valor" para abrir el analisis de valor agregado. Necesitas un flujograma BPMN.',
      placement: 'bottom',
    },
    {
      target: 'button[class*="from-purple"], button:has(.lucide-sparkles), button:has(.lucide-wand)',
      title: 'Paso 5: Clasifica con IA',
      content: 'Usa IA para clasificar cada actividad como VA (Valor Agregado), NVA (Sin Valor) o NVABN (Necesario). El hito se completa cuando al menos una actividad este clasificada.',
      placement: 'bottom',
      completeMilestone: 'value-analysis',
    },
  ],

  report: [
    {
      target: 'a[href="/app/reports"]',
      title: 'Paso 1: Ir a Reportes',
      content: 'Vamos a exportar tu primer reporte. Haz clic en Reportes.',
      route: '/app',
      placement: 'right',
      clickToAdvance: true,
    },
    {
      target: 'button[class*="bg-emerald"], button:has(.lucide-download), button:has(.lucide-file-spreadsheet)',
      title: 'Paso 2: Exportar Reporte',
      content: 'Haz clic en el boton de exportar para descargar tu reporte en Excel o PDF. El hito se completa cuando realices tu primera exportacion.',
      route: '/app/reports',
      placement: 'left',
      completeMilestone: 'report',
    },
  ],
}
