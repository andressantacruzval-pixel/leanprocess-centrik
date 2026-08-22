import { callAiProxy, type AiMessage } from '@/lib/aiClient'
import { sanitizePromptInput } from '@/lib/aiSanitizer'

// ── Local helpers ─────────────────────────────────────────────────────────

function cleanJson(text: string | undefined): string {
  if (!text) return '{}'
  // Strip all markdown code fences regardless of position
  const clean = text.replace(/```(?:json)?/g, '').trim()
  // Find first { or [ to skip any introductory text the model may have added
  const arrayStart = clean.indexOf('[')
  const objStart = clean.indexOf('{')
  const start = objStart !== -1 && (arrayStart === -1 || objStart < arrayStart)
    ? objStart
    : arrayStart
  if (start === -1) return '{}'
  const isArray = clean[start] === '['
  const end = isArray ? clean.lastIndexOf(']') : clean.lastIndexOf('}')
  if (end <= start) return '{}'
  return clean.slice(start, end + 1)
}

// Estructura veloz + de calidad: pasar responseMimeType:'application/json' apaga
// el "thinking" de Gemini 2.5 (que añade 60-120s) y endurece el parseo del JSON;
// temperatura baja = salida determinista; maxOutputTokens acota la cola de latencia.
async function callGemini(
  messages: { role: string; content: string }[],
  systemPrompt?: string,
  feature?: string,
  opts?: { temperature?: number; maxOutputTokens?: number; responseMimeType?: string }
): Promise<{ text: string; tokensUsed: number }> {
  const text = await callAiProxy(messages as AiMessage[], { systemPrompt, feature, ...opts })
  return { text, tokensUsed: 0 }
}

// Config estándar para generadores que devuelven JSON (rápido + robusto). El
// responseMimeType apaga el "thinking" y endurece el parseo; sin tope de tokens
// para no truncar salidas largas (procedimientos, clasificación de valor).
const JSON_FAST = { responseMimeType: 'application/json', temperature: 0.3 }

// ── Procedure types ───────────────────────────────────────────────────────

export interface ProcedureActivity {
  nombre: string
  ejecutor: string
  descripcion: string
  decisiones: string
  esDecision: boolean
}

export interface ProcedureGlossaryItem {
  termino: string
  definicion: string
}

export interface ProcedureRisk {
  actividad: string
  riesgo: string
  control: string
}

export interface ProcedureData {
  titulo: string
  codigo: string
  version: string
  fecha: string
  introduccion: string
  objetivoGeneral: string
  objetivosEspecificos: string[]
  alcance: string
  sipocEntradas: { proveedor: string; entrada: string }[]
  sipocSalidas: { salida: string; cliente: string }[]
  actividades: ProcedureActivity[]
  glosario: ProcedureGlossaryItem[]
  riesgos: ProcedureRisk[]
}

// ── Procedure functions ───────────────────────────────────────────────────

export async function analyzeDiagramForProcedure(base64Images: string[]): Promise<Partial<ProcedureData>> {
  const imageParts = base64Images.map(img => ({
    inlineData: {
      mimeType: 'image/jpeg' as const,
      data: img,
    },
  }))

  const rawContents = {
    parts: [
      {
        text: `Eres un Ingeniero de Procesos Senior que convierte un documento digital en un JSON estructurado.

IMPORTANTE: Responde SIEMPRE en español profesional. Todo el contenido generado debe estar en español.

CONTEXTO DE ENTRADA: Recibes ${base64Images.length} imágenes que representan páginas secuenciales de un diagrama de flujo/proceso.

TAREA: Leer TODAS las páginas de la primera a la última.
1. Extraer la Caracterización del Proceso (SIPOC).
2. Distinguir estrictamente entre ACTIVIDADES (Rectángulos) y DECISIONES (Rombos/Compuertas).

REGLAS OBLIGATORIAS DE EXTRACCIÓN:

1. **ANÁLISIS SIPOC**:
   - Analizar los eventos de inicio para identificar **Proveedores** y **Entradas**.
   - Analizar los eventos de fin y documentos generados para identificar **Salidas** y **Clientes**.
   - Completar 'sipocEntradas' y 'sipocSalidas'.

2. **ACTIVIDADES (Rectángulos)**:
   - Crear un objeto por cada actividad.
   - **DESCRIPCIÓN**: Escribir un párrafo DETALLADO describiendo los pasos, entradas y matices. Comenzar con el verbo de acción.
   - Establecer 'esDecision' en FALSE.

3. **DECISIONES (Rombos/Compuertas)**:
   - Crear un objeto por cada nodo de decisión.
   - **DESCRIPCIÓN**: Escribir la pregunta que se está evaluando.
   - **LÓGICA**: En el campo 'decisiones', especificar el flujo explícitamente. Ejemplo: "SÍ: Ir a [Nombre de la Siguiente Actividad]. NO: Ir a [Nombre de la Actividad Alternativa]".
   - Establecer 'esDecision' en TRUE.

4. **ALCANCE Y GLOSARIO**: Extraer estas secciones si existen en el diagrama.

Retornar ÚNICAMENTE JSON válido con los campos: titulo, introduccion, objetivoGeneral, objetivosEspecificos (array de strings), alcance, sipocEntradas (array de {proveedor, entrada}), sipocSalidas (array de {salida, cliente}), glosario (array de {termino, definicion}), actividades (array de {nombre, ejecutor, descripcion, esDecision (boolean), decisiones}).
Todo el texto en español.`,
      },
      ...imageParts,
    ],
  }

  const responseText = await callAiProxy([], {
    modelId: 'gemini-2.5-flash',
    temperature: 0.1,
    responseMimeType: 'application/json',
    rawContents,
    feature: 'procedure',
  })

  const cleaned = cleanJson(responseText)
  return JSON.parse(cleaned)
}

export async function generateProcedureFromContext(context: {
  companyName: string
  industry?: string
  macroprocessName: string
  processName?: string
  subprocessName: string
  description?: string
  sipocEntries?: { supplier_name: string; input_description: string; output_description: string; customer_name: string }[]
}): Promise<Partial<ProcedureData>> {
  const sipocText = context.sipocEntries?.map(e =>
    `Proveedor: ${e.supplier_name}, Entrada: ${e.input_description}, Salida: ${e.output_description}, Cliente: ${e.customer_name}`
  ).join('\n') || 'No disponible'

  const prompt = `Genera un procedimiento operativo estandar (SOP) completo para el siguiente subproceso:

Empresa: ${sanitizePromptInput(context.companyName, 150)}
${context.industry ? `Industria: ${sanitizePromptInput(context.industry, 100)}` : ''}
Macroproceso: ${sanitizePromptInput(context.macroprocessName, 150)}
${context.processName ? `Proceso: ${sanitizePromptInput(context.processName, 150)}` : ''}
Subproceso: ${sanitizePromptInput(context.subprocessName, 150)}
${context.description ? `Descripcion/Objetivo: ${sanitizePromptInput(context.description, 1000)}` : ''}

SIPOC del proceso:
${sipocText}

Genera el procedimiento con la siguiente estructura JSON:
{
  "titulo": "Procedimiento de [nombre]",
  "introduccion": "Parrafo introductorio profesional",
  "objetivoGeneral": "Objetivo general del procedimiento",
  "objetivosEspecificos": ["objetivo 1", "objetivo 2", ...],
  "alcance": "Alcance del procedimiento",
  "sipocEntradas": [{"proveedor": "...", "entrada": "..."}],
  "sipocSalidas": [{"salida": "...", "cliente": "..."}],
  "glosario": [{"termino": "...", "definicion": "..."}],
  "actividades": [
    {
      "nombre": "Nombre de la actividad",
      "ejecutor": "Rol responsable",
      "descripcion": "Descripcion detallada de la actividad paso a paso",
      "esDecision": false,
      "decisiones": ""
    }
  ]
}

Para las actividades:
- Incluye entre 8 y 15 actividades detalladas
- Incluye al menos 2 puntos de decision (esDecision: true) con logica en "decisiones"
- Las descripciones deben ser detalladas (minimo 2 oraciones cada una)
- Todo en espanol profesional

Responde SOLO con JSON valido, sin markdown ni explicaciones.`

  const { text } = await callGemini(
    [{ role: 'user', content: prompt }],
    'Eres un consultor senior de BPM e ISO 9001. Generas documentacion de procesos profesional y detallada.',
    'procedure_from_context',
    JSON_FAST,
  )

  return JSON.parse(cleanJson(text))
}

export async function generateProcedureFromBpmn(parsedBpmn: {
  activities: { name: string; laneName?: string; type: string }[]
  decisions: { name: string; laneName?: string; branches: { label: string }[] }[]
  lanes: { name: string }[]
  orderedSteps: { name?: string; laneName?: string; type?: string; branches?: { label: string }[] }[]
}, context: {
  companyName: string
  industry?: string
  macroprocessName: string
  processName?: string
  subprocessName: string
  description?: string
}): Promise<Partial<ProcedureData>> {
  let bpmnDescription = 'PROCESO EXTRAIDO DEL DIAGRAMA BPMN:\n\n'

  if (parsedBpmn.lanes.length > 0) {
    bpmnDescription += `ROLES/AREAS IDENTIFICADOS: ${parsedBpmn.lanes.map(l => l.name).join(', ')}\n\n`
  }

  bpmnDescription += 'SECUENCIA DE ACTIVIDADES Y DECISIONES:\n'
  parsedBpmn.orderedSteps.forEach((step, i) => {
    if (step.type === 'task' || step.type === 'userTask' || step.type === 'serviceTask') {
      bpmnDescription += `${i + 1}. ACTIVIDAD [${step.laneName || 'Sin rol'}]: ${step.name}\n`
    } else if (step.branches && step.branches.length > 0) {
      bpmnDescription += `${i + 1}. DECISION: ${step.name || 'Compuerta'} → Caminos: ${step.branches.map(b => b.label).join(', ')}\n`
    }
  })

  const prompt = `Genera un procedimiento operativo estandar (SOP) COMPLETO basado en el siguiente diagrama de flujo BPMN:

Empresa: ${context.companyName}
${context.industry ? `Industria: ${context.industry}` : ''}
Macroproceso: ${context.macroprocessName}
${context.processName ? `Proceso: ${context.processName}` : ''}
Subproceso: ${context.subprocessName}
${context.description ? `Descripcion/Objetivo: ${context.description}` : ''}

${bpmnDescription}

REGLAS CRITICAS:
1. USA EXACTAMENTE las actividades y roles del diagrama BPMN. No inventes actividades nuevas.
2. Enriquece las descripciones con detalles profesionales pero respeta la secuencia del diagrama.
3. Para cada punto de decision, especifica claramente la logica (SI/NO, Aprobado/Rechazado, etc.)
4. CRITICO - EJECUTOR: El "ejecutor" de cada actividad DEBE SER el nombre del lane/rol que aparece entre corchetes [NombreLane] junto a esa actividad en la secuencia de arriba. NO uses un rol generico ni repitas el mismo rol para todas las actividades. Cada actividad tiene su lane asignado y DEBES respetarlo exactamente.

Genera el procedimiento con la siguiente estructura JSON:
{
  "titulo": "Procedimiento de [nombre]",
  "introduccion": "Parrafo introductorio profesional",
  "objetivoGeneral": "Objetivo general del procedimiento",
  "objetivosEspecificos": ["objetivo 1", "objetivo 2", ...],
  "alcance": "Alcance del procedimiento",
  "sipocEntradas": [{"proveedor": "...", "entrada": "..."}],
  "sipocSalidas": [{"salida": "...", "cliente": "..."}],
  "glosario": [{"termino": "...", "definicion": "..."}],
  "actividades": [
    {
      "nombre": "Nombre exacto de la actividad del BPMN",
      "ejecutor": "Nombre EXACTO del lane/rol entre corchetes de esa actividad",
      "descripcion": "Descripcion detallada paso a paso",
      "esDecision": false,
      "decisiones": ""
    }
  ]
}

Responde SOLO con JSON valido, sin markdown ni explicaciones.`

  const { text } = await callGemini(
    [{ role: 'user', content: prompt }],
    'Eres un consultor senior de BPM e ISO 9001. Generas documentacion de procesos profesional basada en diagramas de flujo BPMN.',
    'procedure_from_bpmn',
    JSON_FAST,
  )

  const result = JSON.parse(cleanJson(text))

  // Post-process: enforce correct ejecutor from parsed BPMN lane data
  if (result.actividades && parsedBpmn.orderedSteps.length > 0) {
    const activityLaneMap = new Map<string, string>()
    for (const step of parsedBpmn.orderedSteps) {
      if (step.name && step.laneName) {
        activityLaneMap.set(step.name.toLowerCase().trim(), step.laneName)
      }
    }
    for (const act of result.actividades) {
      if (!act.nombre) continue
      const exactMatch = activityLaneMap.get(act.nombre.toLowerCase().trim())
      if (exactMatch) { act.ejecutor = exactMatch; continue }
      for (const [bpmnName, laneName] of activityLaneMap) {
        if (act.nombre.toLowerCase().includes(bpmnName) || bpmnName.includes(act.nombre.toLowerCase().trim())) {
          act.ejecutor = laneName
          break
        }
      }
    }
  }

  return result
}

export async function generateRisksForProcedure(activities: { nombre: string }[]): Promise<ProcedureRisk[]> {
  const { text } = await callGemini(
    [{ role: 'user', content: `Analiza estas actividades de proceso: ${JSON.stringify(activities.map(a => a.nombre))}. Identifica 5 riesgos operativos y sus controles especificos. Responde SOLO con JSON array: [{"actividad": "...", "riesgo": "...", "control": "..."}]` }],
    'Eres un experto en gestion de riesgos operativos y controles internos.',
    'procedure_risks',
    JSON_FAST,
  )
  return JSON.parse(cleanJson(text))
}

// ── Audit ─────────────────────────────────────────────────────────────────

export interface AuditItem {
  actividad: string
  queAuditar: string
  criterio: string
  evidencia: string
  frecuencia: string
  responsable: string
}

export async function generateAuditFromBpmn(
  bpmnSummary: string,
  processName: string,
  companyName?: string,
  existingRisks?: { title: string; processStep: string; controls: { description: string }[] }[],
): Promise<AuditItem[]> {
  const risksBlock = existingRisks && existingRisks.length > 0
    ? `\nRIESGOS Y CONTROLES EXISTENTES:\n${existingRisks.map((r) => `- [${r.processStep}] ${r.title} → Controles: ${r.controls.map(c => c.description).join(', ') || 'Ninguno'}`).join('\n')}\n`
    : ''

  const { text } = await callGemini(
    [{ role: 'user', content: `Analiza el siguiente proceso y genera un programa de auditoria interna.


Empresa: ${companyName || 'No especificada'}
Proceso: ${processName}

${bpmnSummary}
${risksBlock}
TAREA:
1. Para cada actividad critica del proceso, define QUE auditar.
2. Considera los riesgos y controles existentes para priorizar.
3. Define criterios de auditoria, evidencia a solicitar, frecuencia y responsable.

Responde UNICAMENTE un JSON array:
[
  {
    "actividad": "Nombre de la actividad del proceso",
    "queAuditar": "Aspecto especifico a auditar",
    "criterio": "Criterio o norma de referencia",
    "evidencia": "Evidencia a solicitar",
    "frecuencia": "Trimestral / Semestral / Anual",
    "responsable": "Rol que debe ejecutar la auditoria"
  }
]

REGLAS:
- Responde EXCLUSIVAMENTE en espanol.
- Entre 5 y 10 puntos de auditoria.
- Sé especifico y practico, no generico.
- Basa las recomendaciones en las actividades REALES del diagrama.` }],
    'Eres un auditor interno senior certificado CIA/CISA con experiencia en ISO 19011 y gestion de procesos.',
    'audit_recommendations',
    JSON_FAST,
  )

  try {
    return JSON.parse(cleanJson(text))
  } catch {
    console.error('[audit] Failed to parse AI response:', text.slice(0, 200))
    return []
  }
}

// ── Value Analysis ────────────────────────────────────────────────────────

export interface ValueClassificationResult {
  id: string
  classification: 'VA' | 'NVA' | 'NVABN'
  justification: string
}

export async function classifyActivitiesValue(
  activitiesSummary: { id: string; name: string; laneName?: string }[],
  processName: string,
  companyName?: string
): Promise<ValueClassificationResult[]> {
  const activitiesText = activitiesSummary.map((a, i) =>
    `${i + 1}. [${a.id}] "${a.name}" (Responsable: ${a.laneName || 'N/A'})`
  ).join('\n')

  const { text } = await callGemini(
    [{ role: 'user', content: `Clasifica cada actividad del proceso "${processName}"${companyName ? ` de la empresa "${companyName}"` : ''} segun Lean Management.

ACTIVIDADES:
${activitiesText}

REGLAS DE CLASIFICACION:
- VA (Valor Agregado): Actividades que transforman el producto/servicio y por las que el cliente pagaria. Ejemplo: fabricar, ensamblar, aprobar credito, atender consulta.
- NVA (Sin Valor Agregado): Desperdicio puro que puede eliminarse. Ejemplo: esperas, reprocesos, transporte innecesario, almacenamiento excesivo, duplicacion de datos.
- NVABN (Sin Valor pero Necesario): No agrega valor al cliente pero es requerido por regulacion, control interno o limitacion tecnologica. Ejemplo: auditorias regulatorias, respaldos, firmas de cumplimiento, verificaciones legales.

IMPORTANTE:
- Analiza CADA actividad en el contexto del proceso completo.
- Considera el sector/industria si se menciona la empresa.
- Actividades de control/verificacion suelen ser NVABN.
- Actividades de espera/revision/aprobacion multiple suelen ser NVA o NVABN.
- Sé estricto: solo VA si realmente transforma valor para el cliente.

Responde en JSON array:
[{ "id": "<activity_id>", "classification": "VA"|"NVA"|"NVABN", "justification": "<breve razon en español>" }]

Solo JSON, sin markdown.` }],
    'Eres un consultor Lean Six Sigma Black Belt especializado en analisis de valor y eliminacion de desperdicios.',
    'value_classification',
    { ...JSON_FAST, temperature: 0.2 },
  )

  try {
    return JSON.parse(cleanJson(text))
  } catch {
    console.error('[valueAnalysis] Failed to parse AI response:', text.slice(0, 200))
    return []
  }
}

// ── Improvement opportunities ─────────────────────────────────────────────

export interface AiImprovementOpportunity {
  name: string
  description: string
  /** 1/3/5 — 5 = muy bueno (bajo costo). */
  costScore: number
  /** 1/3/5 — 5 = muy bueno (baja complejidad). */
  complexityScore: number
  /** 1/3/5 — 5 = muy bueno (corto tiempo). */
  timeScore: number
}

/**
 * Identifica oportunidades de mejora del proceso a partir del análisis de
 * riesgos y del mapeo de flujo de valor. Cada oportunidad trae tres variables
 * cualitativas puntuadas 1/3/5 (5 = muy bueno / conveniente).
 */
export async function generateImprovementOpportunities(input: {
  processName: string
  companyName?: string
  bpmnSummary?: string
  risks: { title: string; level: string; processStep?: string }[]
  valueActivities: { name: string; classification: string | null }[]
}): Promise<AiImprovementOpportunity[]> {
  const risksBlock = input.risks.length > 0
    ? input.risks.map((r) => `- [${r.level}] ${r.title}${r.processStep ? ` (paso: ${r.processStep})` : ''}`).join('\n')
    : '(Sin riesgos identificados)'

  const valueBlock = input.valueActivities.length > 0
    ? input.valueActivities.map((a) => `- ${a.name} → ${a.classification ?? 'sin clasificar'}`).join('\n')
    : '(Sin análisis de valor)'

  const { text } = await callGemini(
    [{ role: 'user', content: `Analiza el proceso "${sanitizePromptInput(input.processName)}"${input.companyName ? ` de la empresa "${sanitizePromptInput(input.companyName)}"` : ''} e identifica oportunidades de mejora concretas y accionables.

${input.bpmnSummary ? `RESUMEN DEL FLUJOGRAMA:\n${input.bpmnSummary}\n` : ''}
RIESGOS IDENTIFICADOS:
${risksBlock}

MAPEO DE FLUJO DE VALOR (VA = valor agregado, NVA = desperdicio, NVABN = necesario sin valor):
${valueBlock}

TAREA:
1. Prioriza eliminar/reducir las actividades NVA (desperdicio) y mitigar los riesgos de nivel alto/extremo.
2. Propón entre 4 y 8 oportunidades de mejora ESPECÍFICAS para este proceso (no genéricas).
3. Para cada una, evalúa TRES variables con una escala 1/3/5 donde 5 es LO MEJOR (más conveniente) y 1 lo peor:
   - costScore: 5 = costo de implementación BAJO, 3 = medio, 1 = alto.
   - complexityScore: 5 = complejidad de implementación BAJA, 3 = media, 1 = alta.
   - timeScore: 5 = tiempo de implementación CORTO, 3 = medio, 1 = largo.

Responde ÚNICAMENTE un JSON array:
[
  {
    "name": "Título breve de la oportunidad",
    "description": "Descripción desarrollada (2-4 frases): qué hacer, cómo y qué problema/riesgo/desperdicio ataca.",
    "costScore": 1|3|5,
    "complexityScore": 1|3|5,
    "timeScore": 1|3|5
  }
]

REGLAS:
- Responde EXCLUSIVAMENTE en español.
- Usa SOLO los valores 1, 3 o 5 en los tres puntajes.
- Basa cada oportunidad en los riesgos y/o el mapeo de valor reales de arriba.
- La descripción debe estar bien redactada y ser útil para un plan de acción.` }],
    'Eres un consultor senior de mejora continua (Lean Six Sigma Black Belt) especializado en optimización de procesos y planes de acción.',
    'improvement_opportunities',
    { ...JSON_FAST, temperature: 0.4 },
  )

  try {
    const parsed = JSON.parse(cleanJson(text)) as AiImprovementOpportunity[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    console.error('[improvement] Failed to parse AI response:', text.slice(0, 200))
    return []
  }
}

// ── Text improvement ──────────────────────────────────────────────────────

export async function improveText(sectionContext: string, currentText: string): Promise<string> {
  const { text } = await callGemini(
    [{ role: 'user', content: `Reescribe el siguiente texto borrador en un parrafo PROFESIONAL y DETALLADO.

CONTEXTO: Esta es la seccion "${sectionContext}" de un Procedimiento Operativo Estandar.

TEXTO: "${currentText}"

REGLAS:
1. Expande notas breves en oraciones completas.
2. Manten un tono formal e imperativo.
3. IDIOMA: Responde SIEMPRE en español profesional, independientemente del idioma del texto de entrada.
4. Output: un solo parrafo rico y profesional.
Responde SOLO con el texto mejorado.` }],
    'Eres un redactor tecnico para documentacion ISO 9001.',
    'improve_text',
    { temperature: 0.5, maxOutputTokens: 2048 },
  )
  return text
}
