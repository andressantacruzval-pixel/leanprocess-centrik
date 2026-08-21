import { callAiProxy, type AiMessage } from '@/lib/aiClient'
import type { InvArea, InvMacro, InvProyecto } from './types'
import { buildAutoPrompt } from './inventoryPrompt'

// Motor embebido: genera el inventario de UN macroproceso llamando a la IA de la
// app (Edge Function ai-proxy / Gemini). Devuelve el texto JSON crudo, que el
// store fusiona con inventoryStore.mergeText. Pensado para usarse en bucle,
// macroproceso por macroproceso, con las tarjetas generándose automáticamente.

export async function generateMacro(
  proyecto: InvProyecto,
  macros: InvMacro[],
  areas: InvArea[],
  macroIndex: number,
  companyId?: string,
): Promise<string> {
  const prompt = buildAutoPrompt(proyecto, macros, areas, macroIndex)
  const messages: AiMessage[] = [{ role: 'user', content: prompt }]
  return callAiProxy(messages, {
    systemPrompt: 'Eres un arquitecto de procesos. Devuelves EXCLUSIVAMENTE JSON válido, sin texto adicional, sin markdown, sin explicaciones.',
    feature: 'inventory',
    companyId,
    temperature: 0.3,
    responseMimeType: 'application/json',
    maxOutputTokens: 4096,
  })
}
