import { callAiProxy, type AiMessage } from '@/lib/aiClient'
import { sanitizePromptInput, sanitizeLargeContent, sanitizeStringArray } from '@/lib/aiSanitizer'

// ─── Re-exports de bpmnAi para compatibilidad con importaciones existentes ──
export {
  conductProcessInterview,
  generateBpmnFromInterview,
  refineBpmnDiagram,
  conductFreeConversation,
  generateBpmnDirect,
  generateBpmnFromFile,
  validateBpmnFile,
  fileToBase64,
} from '@/lib/bpmnAi'

async function callGemini(
  messages: { role: string; content: string }[],
  systemPrompt?: string,
  feature?: string,
  opts?: { temperature?: number; maxOutputTokens?: number; modelId?: string; responseMimeType?: string }
): Promise<{ text: string; tokensUsed: number }> {
  const text = await callAiProxy(messages as AiMessage[], { systemPrompt, feature, ...opts })
  return { text, tokensUsed: 0 }
}

// Config estándar para generadores JSON: apaga el "thinking" de Gemini 2.5
// (60-120s menos) y fija salida determinista. Sin tope de tokens para no truncar.
const JSON_FAST = { responseMimeType: 'application/json', temperature: 0.3 }

export async function generateProcessDescription(processName: string, context?: string) {
  const name = sanitizePromptInput(processName, 150)
  const ctx = context ? sanitizePromptInput(context, 500) : ''
  return callGemini(
    [{ role: 'user', content: `Genera un objetivo/descripcion profesional para el proceso "${name}". ${ctx ? `Contexto: ${ctx}` : ''} Responde solo con la descripcion, sin explicaciones adicionales.` }],
    'Eres un experto en gestion por procesos y BPM. Genera descripciones concisas y profesionales para procesos de negocio.',
    'process_objective'
  )
}

export async function generateSipoc(processName: string, processDescription?: string) {
  const name = sanitizePromptInput(processName, 150)
  const desc = processDescription ? sanitizePromptInput(processDescription, 1000) : ''
  return callGemini(
    [{ role: 'user', content: `Genera un analisis SIPOC completo para el proceso "${name}". ${desc ? `Descripcion: ${desc}` : ''} Responde en formato JSON con la estructura: { "entries": [{ "supplier": "...", "input": "...", "output": "...", "customer": "..." }] }` }],
    'Eres un experto en gestion por procesos. Genera analisis SIPOC detallados y profesionales.',
    'sipoc',
    JSON_FAST,
  )
}

export async function generateBpmnDiagram(processName: string, processDescription?: string, sipocEntries?: unknown[]) {
  const name = sanitizePromptInput(processName, 150)
  const desc = processDescription ? sanitizePromptInput(processDescription, 1000) : ''
  return callGemini(
    [{ role: 'user', content: `Genera un diagrama de flujo BPMN para el proceso "${name}". ${desc ? `Descripcion: ${desc}` : ''} ${sipocEntries ? `SIPOC: ${JSON.stringify(sipocEntries)}` : ''} Responde en formato JSON compatible con React Flow: { "nodes": [...], "edges": [...] }. Cada node debe tener: id, type (startEvent/endEvent/task/exclusiveGateway/parallelGateway), position: {x, y}, data: {label}. Cada edge: id, source, target, type (default/smoothstep).` }],
    'Eres un experto en BPMN 2.0 y modelado de procesos. Genera diagramas de flujo estructurados y profesionales.',
    'bpmn_generation',
    JSON_FAST,
  )
}

// ─── Indicators Functions ─────────────────────────────────────────────────

const INDICATORS_SYSTEM_PROMPT = `Eres un experto en gestion por procesos, mejora continua, Lean Six Sigma y cuadro de mando integral (Balanced Scorecard). Tu tarea es analizar un proceso de negocio y generar indicadores clave de desempeno (KPIs) relevantes y medibles.

Para cada indicador debes proporcionar:
1. nombre: Nombre conciso y descriptivo del indicador.
2. objetivo: Que busca medir y por que es importante.
3. formula: Formula matematica o logica para calcular el indicador.
4. fuente_datos: De donde se obtienen los datos para el calculo.
5. unidad_medida: Porcentaje, dias, cantidad, pesos, etc.
6. frecuencia: Cada cuanto se debe medir (diario, semanal, mensual, trimestral).
7. meta: Valor objetivo ideal.
8. umbral_verde_min: Numero minimo del rango verde (null si no hay limite inferior).
9. umbral_verde_max: Numero maximo del rango verde (null si no hay limite superior).
10. umbral_amarillo_min: Numero minimo del rango amarillo (null si no hay limite inferior).
11. umbral_amarillo_max: Numero maximo del rango amarillo (null si no hay limite superior).
12. umbral_rojo_min: Numero minimo del rango rojo (null si no hay limite inferior).
13. umbral_rojo_max: Numero maximo del rango rojo (null si no hay limite superior).
11. responsable_reporte: Rol o cargo que genera el reporte del indicador.
12. responsable_monitoreo: Rol o cargo que monitorea y toma acciones.

REGLAS:
- Genera EXACTAMENTE 3 indicadores: los tres mas fundamentales y criticos del proceso.
- Selecciona los KPIs que mayor impacto tengan en la gestion del proceso. Prioriza eficacia y eficiencia operacional.
- Las formulas deben ser claras y calculables.
- Los umbrales deben ser coherentes con la meta.
- Responde UNICAMENTE con un JSON valido con la estructura:
{
  "nombre_proceso": "...",
  "objetivo_proceso": "...",
  "indicadores": [...]
}
- No incluyas explicaciones fuera del JSON. No uses markdown.
- Todos los textos en espanol.`

export async function generateIndicators(processInfo: {
  name: string
  description?: string
  bpmnXml?: string
  fileContent?: string
}): Promise<{
  nombre_proceso: string
  objetivo_proceso: string
  indicadores: Array<{
    nombre: string
    objetivo: string
    formula: string
    fuente_datos: string
    unidad_medida: string
    frecuencia: string
    meta: string
    umbral_verde_min: number | null
    umbral_verde_max: number | null
    umbral_amarillo_min: number | null
    umbral_amarillo_max: number | null
    umbral_rojo_min: number | null
    umbral_rojo_max: number | null
    responsable_reporte: string
    responsable_monitoreo: string
  }>
}> {
  const safeName = sanitizePromptInput(processInfo.name, 150)
  const safeDesc = processInfo.description ? sanitizePromptInput(processInfo.description, 1000) : ''
  const safeBpmn = processInfo.bpmnXml ? sanitizeLargeContent(processInfo.bpmnXml, 80_000) : ''
  const safeFile = processInfo.fileContent ? sanitizeLargeContent(processInfo.fileContent, 80_000) : ''

  let userContent = `Analiza el siguiente proceso y genera indicadores KPI:\n\nNombre del proceso: ${safeName}`
  if (safeDesc) {
    userContent += `\nDescripcion: ${safeDesc}`
  }
  if (safeBpmn) {
    userContent += `\n\nDiagrama BPMN del proceso:\n${safeBpmn}`
  }
  if (safeFile) {
    userContent += `\n\nContenido del diagrama de flujo subido por el usuario:\n${safeFile}`
  }

  const { text } = await callGemini(
    [{ role: 'user', content: userContent }],
    INDICATORS_SYSTEM_PROMPT,
    'kpi',
    JSON_FAST,
  )

  // Strip all markdown fences and extract JSON object robustly
  let jsonText = text.replace(/```(?:json)?/g, '').trim()
  const objStart = jsonText.indexOf('{')
  const objEnd = jsonText.lastIndexOf('}')
  if (objStart !== -1 && objEnd > objStart) jsonText = jsonText.slice(objStart, objEnd + 1)
  return JSON.parse(jsonText)
}

// ─── Single Indicator Suggestion ────────────────────────────────────────

export interface AiIndicatorSuggestion {
  name: string
  description: string
  formula: string
  data_source: string
  unit: string
  frequency: string
  target_value: string
  threshold_green_min: number | null
  threshold_green_max: number | null
  threshold_yellow_min: number | null
  threshold_yellow_max: number | null
  threshold_red_min: number | null
  threshold_red_max: number | null
  owner: string
  reporter: string
}

function cleanIndicatorJson(text: string | undefined): string {
  if (!text) return '{}'
  const clean = text.replace(/```(?:json)?/g, '').trim()
  const objStart = clean.indexOf('{')
  const objEnd = clean.lastIndexOf('}')
  if (objStart === -1 || objEnd <= objStart) return '{}'
  return clean.slice(objStart, objEnd + 1)
}

export async function suggestOneIndicator(
  bpmnXml: string,
  processName: string,
  companyName?: string,
  existingIndicatorNames?: string[],
): Promise<AiIndicatorSuggestion | null> {
  const safeName = sanitizePromptInput(processName, 150)
  const safeCompany = companyName ? sanitizePromptInput(companyName, 150) : 'No especificada'
  const safeBpmn = sanitizeLargeContent(bpmnXml, 50_000)
  const safeNames = existingIndicatorNames ? sanitizeStringArray(existingIndicatorNames, 50, 150) : []

  const existingBlock = safeNames.length > 0
    ? `\nINDICADORES YA DEFINIDOS (NO repetir ni generar uno similar a estos):\n${safeNames.map(n => `- ${n}`).join('\n')}\n`
    : ''

  const prompt = `Eres un experto en gestion por procesos, Lean Six Sigma y cuadro de mando integral (Balanced Scorecard).

CONTEXTO:
- Empresa: ${safeCompany}
- Proceso: ${safeName}
- Diagrama BPMN (XML) del proceso a analizar
${existingBlock}
TAREA:
1. Analiza el diagrama BPMN del proceso.
2. Identifica EXACTAMENTE 1 indicador KPI nuevo: el mas critico y relevante aun no cubierto.
3. Define todos sus campos con precision y coherencia.

FORMATO DE RESPUESTA:
Responde UNICAMENTE un JSON con esta estructura (objeto, NO array):
{
  "name": "Nombre conciso del indicador",
  "description": "Que busca medir y por que es importante para este proceso",
  "formula": "Formula matematica o logica para calcularlo",
  "data_source": "De donde se obtienen los datos",
  "unit": "Una de: %, Unidades, Dias, Horas, Minutos, Veces, USD, Otro",
  "frequency": "Una de: Diario, Semanal, Quincenal, Mensual, Bimestral, Trimestral, Semestral, Anual",
  "target_value": "Valor objetivo (ej: >= 95%)",
  "threshold_green_min": numero minimo del rango verde o null si no hay limite inferior,
  "threshold_green_max": numero maximo del rango verde o null si no hay limite superior,
  "threshold_yellow_min": numero minimo del rango amarillo o null,
  "threshold_yellow_max": numero maximo del rango amarillo o null,
  "threshold_red_min": numero minimo del rango rojo o null,
  "threshold_red_max": numero maximo del rango rojo o null,
  "owner": "Rol o cargo responsable del reporte",
  "reporter": "Rol o cargo responsable del monitoreo"
}

REGLAS:
- Responde EXCLUSIVAMENTE en espanol.
- El campo unit DEBE ser exactamente uno de: %, Unidades, Dias, Horas, Minutos, Veces, USD, Otro
- El campo frequency DEBE ser exactamente uno de: Diario, Semanal, Quincenal, Mensual, Bimestral, Trimestral, Semestral, Anual
- Los umbrales deben ser coherentes con la meta.
- No uses markdown. Solo JSON puro.

DIAGRAMA BPMN:
${safeBpmn}`

  const rawText = await callAiProxy(
    [{ role: 'user', content: prompt }],
    {
      modelId: 'gemini-2.5-flash',
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      feature: 'kpi',
    }
  )

  try {
    const cleaned = cleanIndicatorJson(rawText)
    const item = JSON.parse(cleaned) as AiIndicatorSuggestion
    if (!item?.name) return null
    return {
      name: item.name || '',
      description: item.description || '',
      formula: item.formula || '',
      data_source: item.data_source || '',
      unit: item.unit || '%',
      frequency: item.frequency || 'Mensual',
      target_value: item.target_value || '',
      threshold_green_min: item.threshold_green_min ?? null,
      threshold_green_max: item.threshold_green_max ?? null,
      threshold_yellow_min: item.threshold_yellow_min ?? null,
      threshold_yellow_max: item.threshold_yellow_max ?? null,
      threshold_red_min: item.threshold_red_min ?? null,
      threshold_red_max: item.threshold_red_max ?? null,
      owner: item.owner || '',
      reporter: item.reporter || '',
    }
  } catch {
    console.warn('[claude] suggestOneIndicator parse failed:', rawText.slice(0, 200))
    return null
  }
}

// ─── Process Objective (contextual AI) ──────────────────────────────────

export async function generateProcessObjective(context: {
  companyName: string
  industry?: string
  companySize?: string
  macroprocessName: string
  processName?: string
  subprocessName: string
}): Promise<{ text: string; tokensUsed: number }> {
  const prompt = `Genera un objetivo/descripcion profesional para el siguiente subproceso:

Empresa: ${sanitizePromptInput(context.companyName, 150)}
${context.industry ? `Industria: ${sanitizePromptInput(context.industry, 100)}` : ''}
${context.companySize ? `Tamano: ${sanitizePromptInput(context.companySize, 50)}` : ''}
Macroproceso: ${sanitizePromptInput(context.macroprocessName, 150)}
${context.processName ? `Proceso: ${sanitizePromptInput(context.processName, 150)}` : ''}
Subproceso: ${sanitizePromptInput(context.subprocessName, 150)}

Genera un objetivo conciso (2-3 oraciones) que describa el proposito de este subproceso en el contexto de la empresa y su industria. Responde SOLO con el objetivo, sin explicaciones adicionales.`

  return callGemini(
    [{ role: 'user', content: prompt }],
    'Eres un experto en gestion por procesos BPM. Genera descripciones concisas y profesionales contextualizadas al giro de negocio de la empresa.',
    'process_objective'
  )
}

// ─── Procedure, Audit, Value Analysis ────────────────────────────────────
// Extracted to procedureAi.ts — re-exported here for backward compatibility.

export type {
  ProcedureActivity,
  ProcedureGlossaryItem,
  ProcedureRisk,
  ProcedureData,
  AuditItem,
  ValueClassificationResult,
} from './procedureAi'

export {
  analyzeDiagramForProcedure,
  generateProcedureFromContext,
  generateProcedureFromBpmn,
  generateRisksForProcedure,
  generateAuditFromBpmn,
  classifyActivitiesValue,
  improveText,
} from './procedureAi'

// ── (end of file — procedure/audit/value moved to src/lib/procedureAi.ts)
