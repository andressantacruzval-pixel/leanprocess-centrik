import { callAiProxy } from '@/lib/aiClient'
import { sanitizePromptInput, sanitizeLargeContent, sanitizeStringArray } from '@/lib/aiSanitizer'

// ── Identificación de aplicaciones / software con IA ───────────────────────
// Analiza las actividades del proceso (y el BPMN) y devuelve las APLICACIONES /
// SISTEMAS que se usan para ejecutarlas, con la actividad relacionada (para
// anclar el nodo). Distingue software real de artefactos de datos/documentos
// (esos son activos de información, no aplicaciones).

export interface AiAppSuggestion {
  name: string
  generic: boolean
  category: string
  vendor: string
  ownership: string
  deployment: string
  has_api: boolean
  automatable: boolean
  criticality: number
  relatedActivity: string
}

export interface AppAiContext {
  companyName: string
  industry?: string
  processName: string
  description?: string
  activities: string[]
  bpmnXml?: string
  existingAppNames?: string[]
}

const clamp = (n: unknown) => Math.max(1, Math.min(5, Math.round(Number(n) || 3)))

function cleanJson(text: string | undefined): string {
  if (!text) return '[]'
  const clean = text.replace(/```(?:json)?/gi, '').trim()
  const s = clean.indexOf('[')
  const e = clean.lastIndexOf(']')
  if (s !== -1 && e > s) return clean.slice(s, e + 1)
  return '[]'
}

export async function identifyApplicationsFromProcess(ctx: AppAiContext): Promise<AiAppSuggestion[]> {
  const empresa = sanitizePromptInput(ctx.companyName || 'la empresa', 150)
  const industria = ctx.industry ? sanitizePromptInput(ctx.industry, 100) : 'no especificada'
  const proc = sanitizePromptInput(ctx.processName, 150)
  const desc = ctx.description ? sanitizePromptInput(ctx.description, 800) : 'sin descripción'
  const acts = sanitizeStringArray(ctx.activities, 80).slice(0, 50)
  const existentes = sanitizeStringArray(ctx.existingAppNames || [], 60).join(', ') || 'ninguna'
  const bpmn = ctx.bpmnXml ? sanitizeLargeContent(ctx.bpmnXml, 40_000) : ''

  const prompt = `Eres un consultor de arquitectura de aplicaciones y automatización de procesos. Identifica las APLICACIONES / SISTEMAS de software que se usan para ejecutar las actividades de este proceso.

CONTEXTO:
- Empresa: "${empresa}" (industria: ${industria})
- Proceso: "${proc}"
- Objetivo: ${desc}
- Actividades: ${acts.map((a) => `"${a}"`).join(', ') || 'sin actividades'}
- Aplicaciones YA REGISTRADAS en el catálogo (PRIORÍZALAS): ${existentes}

REGLAS CLAVE:
- PRIORIZA EL CATÁLOGO: si una actividad usa una aplicación equivalente a una ya registrada, REUTILIZA su nombre EXACTO (tal cual aparece en la lista). Solo propón una aplicación NUEVA cuando ninguna registrada aplique.
- Propón SOLO software real: sistemas, plataformas, aplicaciones (ERP, CRM, BI, correo, portales, RPA, sistemas a medida, etc.).
- NO confundas una aplicación con un ARTEFACTO DE DATOS: un archivo de Excel, un documento, un formato o un reporte SON DATOS (activos de información), no aplicaciones. Tampoco propongas herramientas físicas.
- Si una actividad claramente usa un sistema pero su nombre NO se puede identificar, propón un marcador genérico ("Aplicación 1", "Sistema del área…") con "generic": true para que el usuario lo nombre.
- Si el nombre SÍ es identificable (p. ej. "registrar en SAP" → SAP), usa el nombre real con "generic": false.

Para cada aplicación:
- category: ERP | CRM | BI/Reportería | Ofimática | Correo/Mensajería | Gestión documental | RPA/Automatización | Base de datos | Contabilidad/Finanzas | RRHH/Nómina | Custom | Otro.
- vendor: fabricante probable (o "" si genérica).
- ownership: propia | terceros | mixta.
- deployment: on_premise | cloud_saas | cloud_iaas | hibrido.
- has_api: true si típicamente ofrece API/integración.
- automatable: true si el uso en el proceso es candidato a automatización (repetitivo, con API).
- criticality: 1 (insignificante) a 5 (crítico) para ESTE proceso.
- relatedActivity: el NOMBRE EXACTO de la actividad donde se usa; "" si ninguna aplica.

Responde ÚNICAMENTE un JSON array con esta forma exacta:
[{"name":"","generic":false,"category":"","vendor":"","ownership":"terceros","deployment":"cloud_saas","has_api":true,"automatable":false,"criticality":3,"relatedActivity":""}]

${bpmn ? `DIAGRAMA BPMN:\n${bpmn}` : ''}`

  const raw = await callAiProxy([{ role: 'user', content: prompt }], {
    modelId: 'gemini-2.5-flash', temperature: 0.3, maxOutputTokens: 4096,
    responseMimeType: 'application/json', feature: 'application_identification',
  })
  try {
    const parsed = JSON.parse(cleanJson(raw)) as Partial<AiAppSuggestion>[]
    return parsed.filter((a) => a && a.name).map((a) => ({
      name: String(a.name).trim(),
      generic: a.generic === true,
      category: String(a.category || ''),
      vendor: String(a.vendor || ''),
      ownership: String(a.ownership || 'terceros'),
      deployment: String(a.deployment || 'cloud_saas'),
      has_api: a.has_api === true,
      automatable: a.automatable === true,
      criticality: clamp(a.criticality),
      relatedActivity: String(a.relatedActivity || ''),
    }))
  } catch {
    console.warn('[applicationAi] identify parse failed', raw?.slice(0, 200))
    return []
  }
}

// ── Descripción de la aplicación (qué es y para qué se usa) ────────────────
// Lee el NOMBRE de la herramienta y el contexto del subproceso (objetivo y
// actividades) para redactar qué es la aplicación y para qué se usa en ese flujo.
export async function describeApplication(ctx: {
  name: string; companyName?: string; industry?: string
  processName?: string; processDescription?: string; activities?: string[]
}): Promise<string> {
  const name = sanitizePromptInput(ctx.name || '', 150)
  if (!name) return ''
  const empresa = ctx.companyName ? sanitizePromptInput(ctx.companyName, 120) : 'la empresa'
  const industria = ctx.industry ? sanitizePromptInput(ctx.industry, 100) : 'no especificada'
  const proc = ctx.processName ? sanitizePromptInput(ctx.processName, 150) : 'un proceso'
  const obj = ctx.processDescription ? sanitizePromptInput(ctx.processDescription, 500) : 'sin objetivo declarado'
  const acts = sanitizeStringArray(ctx.activities || [], 60).slice(0, 30)

  const prompt = `Redacta en español, en 1 o 2 frases (máx. 45 palabras), QUÉ es esta aplicación y PARA QUÉ se usa en este subproceso. Sé concreto y útil para un área de tecnología/procesos.

- Empresa: "${empresa}" (industria: ${industria})
- Aplicación / herramienta: "${name}"
- Subproceso: "${proc}" — objetivo: ${obj}
- Actividades del subproceso: ${acts.map((a) => `"${a}"`).join(', ') || 'sin actividades'}

Responde SOLO la descripción, sin comillas ni prefijos.`

  const raw = await callAiProxy([{ role: 'user', content: prompt }], {
    modelId: 'gemini-2.5-flash', temperature: 0.4, maxOutputTokens: 256, feature: 'application_describe',
  })
  return (raw || '').replace(/```/g, '').replace(/^["'\s]+|["'\s]+$/g, '').trim()
}

// ── Enriquecimiento de una aplicación (corta el tiempo de levantamiento) ────
export interface AiAppEnrichment {
  category: string; vendor: string; ownership: string; deployment: string
  has_api: boolean; automatable: boolean; auth_method: string; criticality: number
}

export async function enrichApplication(ctx: { name: string; description?: string; companyName?: string; industry?: string }): Promise<AiAppEnrichment | null> {
  const name = sanitizePromptInput(ctx.name || '', 150)
  if (!name) return null
  const desc = ctx.description ? sanitizePromptInput(ctx.description, 400) : 'sin descripción'
  const empresa = ctx.companyName ? sanitizePromptInput(ctx.companyName, 120) : 'la empresa'
  const industria = ctx.industry ? sanitizePromptInput(ctx.industry, 100) : 'no especificada'

  const prompt = `Eres un consultor de arquitectura de aplicaciones. Completa la ficha técnica de esta aplicación con lo que sepas o lo más probable.

- Empresa: "${empresa}" (industria: ${industria})
- Aplicación: "${name}"
- Descripción: ${desc}

Responde ÚNICAMENTE un JSON objeto con esta forma exacta (deployment ∈ on_premise|cloud_saas|cloud_iaas|hibrido; ownership ∈ propia|terceros|mixta; auth_method ∈ SSO|MFA|local|ninguno; criticality 1-5):
{"category":"","vendor":"","ownership":"terceros","deployment":"cloud_saas","has_api":true,"automatable":false,"auth_method":"SSO","criticality":3}`

  const raw = await callAiProxy([{ role: 'user', content: prompt }], {
    modelId: 'gemini-2.5-flash', temperature: 0.2, maxOutputTokens: 512,
    responseMimeType: 'application/json', feature: 'application_enrich',
  })
  try {
    const t = (raw || '').replace(/```(?:json)?/gi, '').trim()
    const s = t.indexOf('{'); const e = t.lastIndexOf('}')
    const obj = JSON.parse(s !== -1 && e > s ? t.slice(s, e + 1) : '{}') as Partial<AiAppEnrichment>
    return {
      category: String(obj.category || ''), vendor: String(obj.vendor || ''),
      ownership: String(obj.ownership || 'terceros'), deployment: String(obj.deployment || 'cloud_saas'),
      has_api: obj.has_api === true, automatable: obj.automatable === true,
      auth_method: String(obj.auth_method || ''), criticality: clamp(obj.criticality),
    }
  } catch {
    console.warn('[applicationAi] enrich parse failed', raw?.slice(0, 200))
    return null
  }
}
