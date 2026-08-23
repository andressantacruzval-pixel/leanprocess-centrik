import { callAiProxy } from '@/lib/aiClient'
import { sanitizePromptInput, sanitizeLargeContent, sanitizeStringArray } from '@/lib/aiSanitizer'
import { parseBpmnXml } from '@/utils/bpmnParser'
import type { RiskCategory } from '@/types/risk'

// ── Response shape from AI ────────────────────────────────────────────

export interface AiControlSuggestion {
  description: string
  bpmnElementId?: string
}

export interface AiRiskIdentification {
  title: string
  processStep: string
  description: string
  category: RiskCategory
  inherentProbability: number
  inherentImpact: number
  extractedControls: AiControlSuggestion[]
}

// ── Extract JSON from AI response (robust against intro text + fences) ──

function cleanJson(text: string | undefined): string {
  if (!text) return '[]'
  // Strip all markdown code fences (``` json, ```, etc.) regardless of position
  const clean = text.replace(/```(?:json)?/g, '').trim()
  // Find the first [ or { to skip any introductory text the model may have added
  const arrayStart = clean.indexOf('[')
  const objStart = clean.indexOf('{')
  const start = arrayStart !== -1 && (objStart === -1 || arrayStart < objStart)
    ? arrayStart
    : objStart
  if (start === -1) return '[]'
  // Find the matching closing bracket from the end
  const isArray = clean[start] === '['
  const end = isArray ? clean.lastIndexOf(']') : clean.lastIndexOf('}')
  if (end <= start) return '[]'
  return clean.slice(start, end + 1)
}

// Comparación insensible a acentos, mayúsculas y espacios extra
function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Un control es SIEMPRE una actividad (nodo tipo tarea) del flujograma, NUNCA una
// decisión/compuerta (rombo). Antes la lista de candidatos incluía las decisiones,
// así que la IA proponía preguntas Si/No como controles. Aquí se ofrece a la IA
// solo actividades y se construye el índice solo con ellas: cualquier nombre que no
// sea una actividad real no resuelve y se descarta (guardarraíl determinista).
export function buildControlContext(bpmnXml: string): { index: Map<string, string>; block: string } {
  const parsed = parseBpmnXml(bpmnXml)
  const activities = parsed.activities.filter((a) => a.name && a.name !== 'Tarea sin nombre')
  const index = new Map<string, string>()
  for (const a of activities) index.set(normalizeStr(a.name), a.id)
  const block = activities.length > 0
    ? `\nACTIVIDADES DEL PROCESO (los controles SOLO pueden ser una de estas actividades tipo tarea; NUNCA una decisión/compuerta/rombo):\n` +
      activities.map((a) => `- "${a.name}"`).join('\n') + '\n'
    : ''
  return { index, block }
}

// ── Identify risks from BPMN XML ──────────────────────────────────────

export async function identifyRisksFromBpmn(
  bpmnXml: string,
  processName: string,
  companyName?: string,
  existingRiskTitles?: string[],
): Promise<AiRiskIdentification[]> {
  const safeName = sanitizePromptInput(processName, 150)
  const safeCompany = companyName ? sanitizePromptInput(companyName, 150) : 'No especificada'
  const safeBpmn = sanitizeLargeContent(bpmnXml, 50_000)
  const safeTitles = existingRiskTitles ? sanitizeStringArray(existingRiskTitles, 50, 150) : []

  // Parsear el BPMN original (no safeBpmn) para no perder actividades por truncación.
  // Los controles SOLO pueden ser actividades (tareas), nunca decisiones.
  const { index: elementIndex, block: activitiesBlock } = buildControlContext(bpmnXml)

  const existingBlock = safeTitles.length > 0
    ? `\nRIESGOS YA IDENTIFICADOS (NO repetir ni generar riesgos similares a estos):\n${safeTitles.map((t) => `- ${t}`).join('\n')}\n`
    : ''

  const prompt = `Eres un Oficial Senior de Riesgos con experiencia en Lean Six Sigma y gestion de procesos.

CONTEXTO:
- Empresa: ${safeCompany}
- Proceso: ${safeName}
- Diagrama BPMN (XML) del proceso a analizar
${existingBlock}${activitiesBlock}
TAREA:
1. Analiza cada actividad y flujo del diagrama BPMN proporcionado.
2. Identifica EXACTAMENTE 3 riesgos: los tres mas criticos y fundamentales del proceso. NO generes mas de 3.
3. Para cada riesgo, redacta la declaracion como UN SOLO PARRAFO con la taxonomia: causa(s) → evento → efecto(s).
   - Puede haber multiples causas y/o multiples efectos.
   - Formato: "Por [causa1] o [causa2] se podria [evento de riesgo], lo que generaria [efecto1], [efecto2] y [efecto3]."
   - Ejemplo: "Por un error humano o la falla en la plataforma CORE se podria generar una transaccion erronea, lo que generaria impacto financiero, regulatorio y reputacional."
4. Clasifica cada riesgo en una categoria.
5. Asigna probabilidad (1-5) e impacto (1-5) inherente.
6. Para cada riesgo identifica entre 1 y 3 ACTIVIDADES de la lista "ACTIVIDADES DEL PROCESO" que sirvan como controles de mitigacion (validaciones, aprobaciones, verificaciones, revisiones, conciliaciones, arqueos). Usa el nombre EXACTO como aparece en la lista. Un control SIEMPRE es una actividad tipo tarea; NUNCA es una pregunta ni un nodo de decision/compuerta/rombo (p. ej. "¿Segmento objetivo?" NO es un control). Si ninguna actividad de la lista aplica como control para ese riesgo, deja el array vacio. NO inventes controles que no esten en la lista.

FORMATO DE RESPUESTA:
Responde UNICAMENTE un JSON array con esta estructura:
[
  {
    "title": "Nombre corto del riesgo",
    "processStep": "Nombre de la actividad BPMN asociada",
    "description": "Por [causa(s)] se podria [evento], lo que generaria [efecto(s)].",
    "category": "Operacional" | "Seguridad Info" | "Cumplimiento" | "Fisico",
    "inherentProbability": 1-5,
    "inherentImpact": 1-5,
    "extractedControls": ["Nombre exacto de actividad 1", "Nombre exacto de actividad 2"]
  }
]

REGLAS:
- Responde EXCLUSIVAMENTE en espanol.
- La declaracion (description) SIEMPRE debe ser un parrafo continuo con la taxonomia causa(s) → evento → efecto(s). NO separes en campos individuales.
- extractedControls debe contener entre 0 y 3 nombres EXACTOS de la lista de ACTIVIDADES. NUNCA decisiones, compuertas ni preguntas. Si ninguna actividad aplica como control, deja el array vacio.
- No inventes actividades del proceso que no esten en el XML.
- Probabilidad: 1=Raro, 2=Improbable, 3=Posible, 4=Probable, 5=Frecuente
- Impacto: 1=Insignificante, 2=Menor, 3=Moderado, 4=Mayor, 5=Catastrofico
- El array final DEBE tener EXACTAMENTE 3 elementos. Ni mas, ni menos.

DIAGRAMA BPMN:
${safeBpmn}`

  const rawText = await callAiProxy(
    [{ role: 'user', content: prompt }],
    {
      modelId: 'gemini-2.5-flash',
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      feature: 'risk',
    }
  )
  const cleaned = cleanJson(rawText)

  try {
    const parsed = JSON.parse(cleaned) as AiRiskIdentification[]
    // Enforce max 3 risks regardless of what the model returns
    return parsed.slice(0, 3).map((r) => {
      const rawControls = Array.isArray(r.extractedControls) ? r.extractedControls : []
      const resolvedControls: AiControlSuggestion[] = rawControls
        .map((item: unknown): AiControlSuggestion | null => {
          const name = typeof item === 'string' ? item.trim() : ''
          if (!name) return null
          const bpmnElementId = elementIndex.get(normalizeStr(name))
          // Descartar controles que no correspondan a un elemento real del BPMN
          if (!bpmnElementId) return null
          return { description: name, bpmnElementId }
        })
        .filter((c): c is AiControlSuggestion => c !== null)

      return {
        title: r.title || 'Riesgo sin titulo',
        processStep: r.processStep || '',
        description: r.description || '',
        category: (['Operacional', 'Seguridad Info', 'Cumplimiento', 'Fisico'].includes(r.category)
          ? r.category
          : 'Operacional') as RiskCategory,
        inherentProbability: Math.max(1, Math.min(5, Math.round(r.inherentProbability || 3))),
        inherentImpact: Math.max(1, Math.min(5, Math.round(r.inherentImpact || 3))),
        extractedControls: resolvedControls,
      }
    })
  } catch {
    console.error('[riskAi] Failed to parse AI response:', rawText.slice(0, 200))
    return []
  }
}

// ── Suggest a single new risk (additive, no deletion) ─────────────────

export async function suggestOneRisk(
  bpmnXml: string,
  processName: string,
  companyName?: string,
  existingRiskTitles?: string[],
): Promise<AiRiskIdentification | null> {
  const safeName = sanitizePromptInput(processName, 150)
  const safeCompany = companyName ? sanitizePromptInput(companyName, 150) : 'No especificada'
  const safeBpmn = sanitizeLargeContent(bpmnXml, 50_000)
  const safeTitles = existingRiskTitles ? sanitizeStringArray(existingRiskTitles, 50, 150) : []

  // Los controles SOLO pueden ser actividades (tareas), nunca decisiones.
  const { index: elementIndex, block: activitiesBlock } = buildControlContext(bpmnXml)

  const existingBlock = safeTitles.length > 0
    ? `\nRIESGOS YA IDENTIFICADOS (NO repetir ni generar uno similar a estos):\n${safeTitles.map(t => `- ${t}`).join('\n')}\n`
    : ''

  const prompt = `Eres un Oficial Senior de Riesgos con experiencia en Lean Six Sigma y gestion de procesos.

CONTEXTO:
- Empresa: ${safeCompany}
- Proceso: ${safeName}
- Diagrama BPMN (XML) del proceso a analizar
${existingBlock}${activitiesBlock}
TAREA:
1. Analiza el diagrama BPMN y los riesgos ya identificados.
2. Identifica EXACTAMENTE 1 riesgo nuevo: el mas critico aun no cubierto. NO generes el mismo riesgo ni uno similar a los ya existentes.
3. Redacta la declaracion como UN SOLO PARRAFO con la taxonomia: causa(s) → evento → efecto(s).
   - Formato: "Por [causa1] o [causa2] se podria [evento de riesgo], lo que generaria [efecto1], [efecto2] y [efecto3]."
4. Clasifica el riesgo en una categoria.
5. Asigna probabilidad (1-5) e impacto (1-5) inherente.
6. Identifica entre 0 y 3 ACTIVIDADES de la lista "ACTIVIDADES DEL PROCESO" que sirvan como controles. Usa el nombre EXACTO. Un control SIEMPRE es una actividad tipo tarea; NUNCA una pregunta ni un nodo de decision/compuerta/rombo. Si ninguna actividad aplica, deja el array vacio.

FORMATO DE RESPUESTA:
Responde UNICAMENTE un JSON con esta estructura (objeto, NO array):
{
  "title": "Nombre corto del riesgo",
  "processStep": "Nombre de la actividad BPMN asociada",
  "description": "Por [causa(s)] se podria [evento], lo que generaria [efecto(s)].",
  "category": "Operacional" | "Seguridad Info" | "Cumplimiento" | "Fisico",
  "inherentProbability": 1-5,
  "inherentImpact": 1-5,
  "extractedControls": ["Nombre exacto de actividad 1"]
}

REGLAS:
- Responde EXCLUSIVAMENTE en espanol.
- La declaracion SIEMPRE debe ser un parrafo continuo con la taxonomia causa(s) → evento → efecto(s).
- extractedControls: entre 0 y 3 nombres EXACTOS de la lista de ACTIVIDADES. NUNCA decisiones, compuertas ni preguntas. Si ninguna actividad aplica, array vacio.
- Probabilidad: 1=Raro, 2=Improbable, 3=Posible, 4=Probable, 5=Frecuente
- Impacto: 1=Insignificante, 2=Menor, 3=Moderado, 4=Mayor, 5=Catastrofico

DIAGRAMA BPMN:
${safeBpmn}`

  const rawText = await callAiProxy(
    [{ role: 'user', content: prompt }],
    {
      modelId: 'gemini-2.5-flash',
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      feature: 'risk',
    }
  )

  try {
    const cleaned = cleanJson(rawText)
    const raw = JSON.parse(cleaned)
    // La IA puede devolver {} o [{}] — manejar ambos casos
    const item = Array.isArray(raw) ? raw[0] : raw
    if (!item?.title) return null

    const rawControls: unknown[] = Array.isArray(item.extractedControls)
      ? (item.extractedControls as unknown[])
      : []
    const resolvedControls: AiControlSuggestion[] = rawControls
      .map((c): AiControlSuggestion | null => {
        const name = typeof c === 'string' ? c.trim() : ''
        if (!name) return null
        const bpmnElementId = elementIndex.get(normalizeStr(name))
        if (!bpmnElementId) return null
        return { description: name, bpmnElementId }
      })
      .filter((c): c is AiControlSuggestion => c !== null)

    return {
      title: item.title || 'Riesgo sin titulo',
      processStep: item.processStep || '',
      description: item.description || '',
      category: (['Operacional', 'Seguridad Info', 'Cumplimiento', 'Fisico'].includes(item.category)
        ? item.category : 'Operacional') as RiskCategory,
      inherentProbability: Math.max(1, Math.min(5, Math.round(item.inherentProbability || 3))),
      inherentImpact: Math.max(1, Math.min(5, Math.round(item.inherentImpact || 3))),
      extractedControls: resolvedControls,
    }
  } catch {
    console.error('[riskAi] suggestOneRisk parse failed:', rawText.slice(0, 200))
    return null
  }
}
