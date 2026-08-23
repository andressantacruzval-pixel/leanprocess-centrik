// ─── Copiloto — parsing de widgets desde el texto del modelo ───────────────
// Reutiliza el parser de marcadores inline del sistema de chat existente.

import { parseInlineToolCalls } from '@/lib/conversationalAi'
import type { CopilotWidget } from '@/stores/copilotStore'

export const KNOWN_WIDGETS = new Set(['CITE', 'RISK', 'RISKS', 'PROCESS', 'CHART', 'HEATMAP'])

/**
 * Limpieza ligera para el texto EN VIVO durante el streaming: quita marcadores
 * completos y cualquier apertura parcial al final del buffer, sin el coste del
 * parser completo (que además loguea en residuos parciales).
 */
export function stripForDisplay(buffer: string): string {
  return buffer
    .replace(/```json[\s\S]*?```/gi, '') // bloque de spec de widget cercado, completo
    .replace(/```json[\s\S]*$/i, '')     // bloque cercado parcial (aún llegando)
    .replace(/\{\s*"widget"[\s\S]*$/i, '') // objeto {"widget"...} suelto (completo o parcial)
    .replace(/```\s*$/i, '')             // cierre de código suelto
    .replace(/<<[^<>]*>>/g, '')
    .replace(/<<[^<>]*$/g, '')
    .replace(/[ \t]{2,}/g, ' ')
}

/** Extracción final: texto limpio + widgets conocidos, en orden de aparición. */
export function extractWidgets(buffer: string): { text: string; widgets: CopilotWidget[] } {
  const { calls, cleanedText } = parseInlineToolCalls(buffer)
  const widgets: CopilotWidget[] = calls
    .filter((c) => KNOWN_WIDGETS.has(c.name))
    .map((c) => ({ name: c.name, params: c.params }))
  return { text: cleanedText, widgets }
}
