import { callAiProxy } from '@/lib/aiClient'
import { sanitizePromptInput } from '@/lib/aiSanitizer'
import { PROCESS_STRUCTURING_PROMPT } from '@/lib/prompts/processStructuringPrompt'
import { FAST_MODEL } from '@/lib/conversationalAi'

/** Detecta texto dictado por voz o sin estructura.
 *  Activa si hay palabras duplicadas consecutivas (señal de dictado) o texto largo sin puntuación. */
export function looksUnstructured(text: string): boolean {
  const hasDuplicates = /\b(\w{3,})\s+\1\b/i.test(text)
  const longWithoutPunctuation = text.trim().split(/\s+/).length > 40 && !/[.,;:!?]/.test(text)
  return hasDuplicates || longWithoutPunctuation
}

/** Pre-procesa texto libre/dictado: extrae actores, actividades, decisiones y loops
 *  en formato estructurado listo para BIZAGI_PROMPT_MAESTRO.
 *  Usa modelo rápido (lite). Fallback silencioso: devuelve texto original si falla. */
export async function preprocessProcessText(rawText: string): Promise<string> {
  const safeText = sanitizePromptInput(rawText, 5000)
  return callAiProxy(
    [{ role: 'user', content: `Estructura esta descripción de proceso:\n\n${safeText}` }],
    {
      systemPrompt: PROCESS_STRUCTURING_PROMPT,
      temperature: 0.3,
      modelId: FAST_MODEL,
      feature: 'bpmn_preprocess',
    }
  ).catch(() => rawText)
}
