import { callAiProxy, type AiMessage } from '@/lib/aiClient'
import { sanitizeLargeContent } from '@/lib/aiSanitizer'
import type { CargoProfile } from '@/features/cargos/cargoProfile'

// Genera el perfil/manual de cargo a partir del contexto factual (actividades
// reales del cargo en los flujogramas, procesos, tiempo VA/NVA). Sigue el mismo
// patrón que la generación de procedimientos: JSON tipado + limpieza robusta.

function cleanJson(text: string | undefined): string {
  if (!text) return '{}'
  const clean = text.replace(/```(?:json)?/g, '').trim()
  const start = clean.indexOf('{')
  if (start === -1) return '{}'
  const end = clean.lastIndexOf('}')
  if (end <= start) return '{}'
  return clean.slice(start, end + 1)
}

const SYSTEM = `Eres un consultor senior de Gestión del Talento y BPM, experto en descriptivos de puesto bajo ISO 9001:2015 (competencia por educación, formación, habilidades y experiencia). Redactas perfiles de cargo profesionales, concretos y accionables, SIEMPRE en español.`

const asArr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => (x as string).trim()) : []
const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export async function generateCargoProfile(cargo: string, context: string): Promise<CargoProfile> {
  const safe = sanitizeLargeContent(context)
  const prompt = `Con base EXCLUSIVAMENTE en las actividades reales que este cargo ejecuta en los flujogramas de la empresa, redacta su descriptivo de puesto. Infiere los conocimientos técnicos, la tecnología/herramientas y la formación a partir de esas actividades (no inventes funciones que no se desprendan de ellas).

DATOS DEL CARGO:
${safe}

Devuelve SOLO JSON válido (sin markdown) con esta estructura EXACTA:
{
  "reportaA": "cargo o nivel al que probablemente reporta (infiere del contexto)",
  "objetivo": "misión del puesto en 1-2 oraciones: para qué existe el cargo",
  "responsabilidades": ["8-12 funciones principales, en infinitivo, agrupando las actividades reales"],
  "requisitos": {
    "educacion": "formación académica mínima recomendada",
    "experiencia": "años y tipo de experiencia recomendada",
    "conocimientos": ["conocimientos técnicos necesarios, inferidos de las actividades"],
    "tecnologia": ["herramientas/sistemas/software que probablemente usa"],
    "competencias": ["6-8 competencias/habilidades clave, duras y blandas"]
  },
  "relacionesInternas": ["áreas/cargos internos con los que interactúa"],
  "relacionesExternas": ["actores externos con los que interactúa, si aplica"],
  "indicadores": ["3-6 indicadores con los que se mediría el desempeño del cargo"]
}

Todo en español profesional. Sé específico y realista para el sector de la empresa.`

  const text = await callAiProxy([{ role: 'user', content: prompt }] as AiMessage[], {
    systemPrompt: SYSTEM,
    feature: 'cargo_profile',
    responseMimeType: 'application/json',
  })

  const raw = JSON.parse(cleanJson(text)) as Record<string, unknown>
  const req = (raw.requisitos ?? {}) as Record<string, unknown>
  return {
    cargo,
    reportaA: asStr(raw.reportaA),
    objetivo: asStr(raw.objetivo),
    responsabilidades: asArr(raw.responsabilidades),
    requisitos: {
      educacion: asStr(req.educacion),
      experiencia: asStr(req.experiencia),
      conocimientos: asArr(req.conocimientos),
      tecnologia: asArr(req.tecnologia),
      competencias: asArr(req.competencias),
    },
    relacionesInternas: asArr(raw.relacionesInternas),
    relacionesExternas: asArr(raw.relacionesExternas),
    indicadores: asArr(raw.indicadores),
    generatedAt: new Date().toISOString(),
  }
}
