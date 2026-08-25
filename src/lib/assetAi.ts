import { callAiProxy } from '@/lib/aiClient'
import { sanitizePromptInput, sanitizeLargeContent, sanitizeStringArray } from '@/lib/aiSanitizer'

// ── Identificación de activos de información con IA (ISO/IEC 27001) ─────────
// Analiza el proceso (BPMN + SIPOC + procedimiento) y devuelve los activos de
// información que fluyen o se almacenan, ya clasificados por C·I·D y con la
// actividad del diagrama donde son más relevantes (para anclar allí el nodo de
// «Almacén de datos»). El usuario solo revisa y ajusta.

export interface AiAssetSuggestion {
  name: string
  description: string
  asset_type: string
  format: string
  owner: string
  custodian: string
  location: string
  confidentiality: number
  integrity: number
  availability: number
  has_personal_data: boolean
  personal_data_category: string
  retention_period: string
  disposal_method: string
  operation: string
  relatedActivity: string
}

export interface AssetAiContext {
  companyName: string
  industry?: string
  processName: string
  description?: string
  bpmnXml?: string
  activities: string[]
  sipoc?: { supplier_name: string; input_description: string; output_description: string; customer_name: string }[]
  existingAssetNames?: string[]
}

// ── Sugerencia de columnas/campos de un activo ─────────────────────────────
export interface AiColumnSuggestion { name: string; description: string; operation: string }
const OPS = ['capta', 'crea', 'usa', 'almacena', 'transforma', 'transfiere', 'elimina']

export async function suggestAssetColumns(ctx: {
  assetName: string; assetType?: string; description?: string
  companyName?: string; industry?: string
  existingFields: string[]; currentColumns: string[]
}): Promise<AiColumnSuggestion[]> {
  const name = sanitizePromptInput(ctx.assetName || 'el activo', 150)
  const tipo = ctx.assetType ? sanitizePromptInput(ctx.assetType, 60) : 'no especificado'
  const desc = ctx.description ? sanitizePromptInput(ctx.description, 500) : 'sin descripción'
  const empresa = ctx.companyName ? sanitizePromptInput(ctx.companyName, 120) : 'la empresa'
  const industria = ctx.industry ? sanitizePromptInput(ctx.industry, 100) : 'no especificada'
  const existentes = sanitizeStringArray(ctx.existingFields || [], 60).slice(0, 80).join(', ') || 'ninguno'
  const actuales = sanitizeStringArray(ctx.currentColumns || [], 60).join(', ') || 'ninguna'

  const prompt = `Eres un consultor de gobierno de datos y ISO/IEC 27001. Propón las COLUMNAS/CAMPOS lógicos que debería contener este activo de información.

CONTEXTO:
- Empresa: "${empresa}" (industria: ${industria})
- Activo: "${name}" (tipo: ${tipo})
- Descripción: ${desc}
- Campos del CATÁLOGO ya existentes (REUTILÍZALOS textualmente cuando apliquen): ${existentes}
- Columnas que el activo YA tiene (NO las repitas): ${actuales}

REGLAS:
- Prioriza y reutiliza EXACTAMENTE los nombres del catálogo existente cuando correspondan.
- Propón entre 4 y 12 campos concretos y realistas para ESTE activo (no genéricos).
- Para cada campo indica el TRATAMIENTO del dato en este proceso ("operation"), uno de: capta | crea | usa | almacena | transforma | transfiere | elimina (mapeo de flujo de valor; usa "capta" cuando el dato se obtiene de un tercero/cliente y "crea" cuando lo genera el proceso).
- Español. Responde ÚNICAMENTE un JSON array: [{"name":"","description":"","operation":"crea"}]`

  const raw = await callAiProxy([{ role: 'user', content: prompt }], {
    modelId: 'gemini-2.5-flash', temperature: 0.3, maxOutputTokens: 2048,
    responseMimeType: 'application/json', feature: 'asset_columns',
  })
  try {
    const parsed = JSON.parse(cleanJson(raw)) as Partial<AiColumnSuggestion>[]
    const seen = new Set((ctx.currentColumns || []).map((c) => c.toLowerCase().trim()))
    return parsed.filter((c) => c && c.name).map((c) => {
      const op = String((c as { operation?: string }).operation || '').toLowerCase()
      return { name: String(c.name).trim(), description: String(c.description || ''), operation: OPS.includes(op) ? op : 'usa' }
    }).filter((c) => { const k = c.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
  } catch {
    console.warn('[assetAi] columns parse failed', raw?.slice(0, 200))
    return []
  }
}

function cleanJson(text: string | undefined): string {
  if (!text) return '[]'
  const clean = text.replace(/```(?:json)?/gi, '').trim()
  const s = clean.indexOf('[')
  const e = clean.lastIndexOf(']')
  if (s !== -1 && e > s) return clean.slice(s, e + 1)
  return '[]'
}

const clamp = (n: unknown) => Math.max(1, Math.min(5, Math.round(Number(n) || 3)))

export async function identifyAssetsFromProcess(ctx: AssetAiContext): Promise<AiAssetSuggestion[]> {
  const empresa = sanitizePromptInput(ctx.companyName || 'la empresa', 150)
  const industria = ctx.industry ? sanitizePromptInput(ctx.industry, 100) : 'no especificada'
  const proc = sanitizePromptInput(ctx.processName, 150)
  const desc = ctx.description ? sanitizePromptInput(ctx.description, 800) : 'sin descripción'
  const acts = sanitizeStringArray(ctx.activities, 60).slice(0, 40)
  const sipoc = (ctx.sipoc || []).slice(0, 20)
    .map((s) => `${s.supplier_name || '-'} → ${s.input_description || '-'} → ${s.output_description || '-'} → ${s.customer_name || '-'}`)
    .join(' | ') || 'sin SIPOC'
  const existentes = sanitizeStringArray(ctx.existingAssetNames || [], 60).join(', ') || 'ninguno'
  const bpmn = ctx.bpmnXml ? sanitizeLargeContent(ctx.bpmnXml, 40_000) : ''

  const prompt = `Eres un consultor senior de Seguridad de la Información (ISO/IEC 27001, 27002 y 27005). Identifica los ACTIVOS DE INFORMACIÓN que se crean, usan, almacenan, transforman, transfieren o eliminan en este proceso.

CONTEXTO:
- Empresa: "${empresa}" (industria: ${industria})
- Proceso: "${proc}"
- Objetivo: ${desc}
- Actividades del diagrama: ${acts.map((a) => `"${a}"`).join(', ') || 'sin diagrama'}
- SIPOC (proveedor → entrada → salida → cliente): ${sipoc}
- Activos ya registrados (NO los repitas): ${existentes}

TAREA:
1. Identifica entre 3 y 8 activos de información REALES y concretos del proceso (bases de datos, documentos, registros, reportes, contratos, credenciales, configuraciones, conocimiento clave, etc.). Nada genérico.
2. Para cada activo:
   - Clasifícalo por tipo: Información, Software, Hardware, Red, Servicio, Personas, Físico o Intangible.
   - Formato: Digital, Físico o Verbal.
   - Estima propietario y custodio por rol/cargo (según el proceso), y su ubicación/repositorio probable.
   - Valora Confidencialidad, Integridad y Disponibilidad de 1 (insignificante) a 5 (catastrófico), realistas para ESTA empresa e industria.
   - Indica si contiene datos personales y de qué categoría.
   - Sugiere periodo de retención y método de disposición coherentes con buenas prácticas.
   - Operación principal en el proceso: una de crea | usa | almacena | transforma | transfiere | elimina.
   - relatedActivity: el NOMBRE EXACTO (de la lista de actividades) de la actividad donde ese activo es más relevante; si ninguna aplica, cadena vacía.

REGLAS:
- Español. Realista y específico. No inventes activos que el proceso no maneje.
- Responde ÚNICAMENTE un JSON array con objetos con esta forma exacta:
[{"name":"","description":"","asset_type":"","format":"","owner":"","custodian":"","location":"","confidentiality":1,"integrity":1,"availability":1,"has_personal_data":false,"personal_data_category":"","retention_period":"","disposal_method":"","operation":"usa","relatedActivity":""}]

${bpmn ? `DIAGRAMA BPMN:\n${bpmn}` : ''}`

  const raw = await callAiProxy([{ role: 'user', content: prompt }], {
    modelId: 'gemini-2.5-flash',
    temperature: 0.3,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    feature: 'asset_identification',
  })

  try {
    const parsed = JSON.parse(cleanJson(raw)) as Partial<AiAssetSuggestion>[]
    return parsed.filter((a) => a && a.name).map((a) => ({
      name: String(a.name).trim(),
      description: String(a.description || ''),
      asset_type: String(a.asset_type || ''),
      format: String(a.format || ''),
      owner: String(a.owner || ''),
      custodian: String(a.custodian || ''),
      location: String(a.location || ''),
      confidentiality: clamp(a.confidentiality),
      integrity: clamp(a.integrity),
      availability: clamp(a.availability),
      has_personal_data: a.has_personal_data === true,
      personal_data_category: String(a.personal_data_category || ''),
      retention_period: String(a.retention_period || ''),
      disposal_method: String(a.disposal_method || ''),
      operation: String(a.operation || ''),
      relatedActivity: String(a.relatedActivity || ''),
    }))
  } catch {
    console.warn('[assetAi] parse failed', raw?.slice(0, 200))
    return []
  }
}
