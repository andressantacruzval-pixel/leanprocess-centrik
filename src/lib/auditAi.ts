import { callAiProxy } from '@/lib/aiClient'
import { sanitizePromptInput, sanitizeStringArray } from '@/lib/aiSanitizer'
import type { AuditItem } from '@/lib/procedureAi'

function cleanJson(text: string | undefined): string {
  if (!text) return '{}'
  const clean = text.replace(/```(?:json)?/g, '').trim()
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

export async function suggestOneAuditItem(
  processName: string,
  bpmnSummary: string,
  companyName?: string,
  existingItems?: AuditItem[],
): Promise<AuditItem | null> {
  const safeName = sanitizePromptInput(processName, 150)
  const safeCompany = companyName ? sanitizePromptInput(companyName, 150) : 'No especificada'
  const safeSummary = sanitizePromptInput(bpmnSummary, 8_000)

  const existingBlock = existingItems && existingItems.length > 0
    ? `\nPUNTOS DE AUDITORÍA YA DEFINIDOS (NO repetir ni generar uno similar):\n${
        sanitizeStringArray(existingItems.map(i => i.queAuditar), 50, 200)
          .map(q => `- ${q}`)
          .join('\n')
      }\n`
    : ''

  const prompt = `Eres un auditor interno senior certificado CIA/CISA con experiencia en ISO 19011 y gestión de procesos.

CONTEXTO:
- Empresa: ${safeCompany}
- Proceso: ${safeName}
${existingBlock}
RESUMEN DEL PROCESO:
${safeSummary}

TAREA:
1. Analiza el resumen del proceso y los puntos de auditoría ya definidos.
2. Identifica EXACTAMENTE 1 punto de auditoría nuevo: el más importante aún no cubierto.
3. Sé específico y práctico, no genérico. Basa la recomendación en las actividades reales del proceso.

FORMATO DE RESPUESTA:
Responde ÚNICAMENTE un JSON con esta estructura (objeto, NO array):
{
  "actividad": "Nombre de la actividad del proceso",
  "queAuditar": "Aspecto específico a auditar",
  "criterio": "Criterio o norma de referencia (ej: ISO 9001, política interna, etc.)",
  "evidencia": "Tipo de evidencia a solicitar",
  "frecuencia": "Trimestral" | "Semestral" | "Anual" | "Mensual",
  "responsable": "Rol que debe ejecutar la auditoría"
}

REGLAS:
- Responde EXCLUSIVAMENTE en español.
- El punto de auditoría debe ser diferente a los ya definidos.
- Frecuencia debe ser exactamente uno de: Mensual, Trimestral, Semestral, Anual.`

  const rawText = await callAiProxy(
    [{ role: 'user', content: prompt }],
    {
      modelId: 'gemini-2.5-flash',
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      feature: 'audit',
    }
  )

  try {
    const cleaned = cleanJson(rawText)
    const raw = JSON.parse(cleaned)
    const item = Array.isArray(raw) ? raw[0] : raw
    if (!item?.queAuditar || !item?.criterio) return null

    const VALID_FRECUENCIAS = ['Mensual', 'Trimestral', 'Semestral', 'Anual']
    return {
      actividad: item.actividad || '',
      queAuditar: item.queAuditar,
      criterio: item.criterio,
      evidencia: item.evidencia || '',
      frecuencia: VALID_FRECUENCIAS.includes(item.frecuencia) ? item.frecuencia : 'Trimestral',
      responsable: item.responsable || '',
    }
  } catch {
    console.warn('[auditAi] suggestOneAuditItem parse failed:', rawText.slice(0, 200))
    return null
  }
}
