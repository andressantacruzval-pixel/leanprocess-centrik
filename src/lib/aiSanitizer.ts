/**
 * aiSanitizer — sanitización de inputs antes de interpolar en prompts de IA.
 *
 * Protege contra prompt injection: un usuario podría escribir instrucciones
 * en campos de texto (processName, companyName, etc.) para manipular el LLM.
 */

import { z } from 'zod'

// ─── Sanitizadores de texto ───────────────────────────────────────────────────

/**
 * Sanitiza texto de usuario antes de interpolarlo en un prompt.
 * - Elimina caracteres de control (Unicode 0x00-0x1F, 0x7F-0x9F)
 * - Elimina < > (HTML/XML injection)
 * - Trim y trunca al máximo de caracteres
 */
export function sanitizePromptInput(input: string, maxLen = 200): string {
  return input
    // eslint-disable-next-line no-control-regex -- strip de chars de control para sanitización
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen)
}

/**
 * Sanitiza contenido largo (XML, flowchart, file content).
 * No elimina < > porque el XML los necesita.
 * Solo elimina caracteres de control peligrosos y trunca.
 */
export function sanitizeLargeContent(input: string, maxLen = 80_000): string {
  return input
    // eslint-disable-next-line no-control-regex -- strip de chars de control para sanitización
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .slice(0, maxLen)
}

/**
 * Sanitiza un array de strings (ej: títulos de riesgos existentes).
 */
export function sanitizeStringArray(items: string[], maxItems = 100, maxLen = 200): string[] {
  return items
    .slice(0, maxItems)
    .map(item => sanitizePromptInput(item, maxLen))
}

// ─── Schemas Zod para inputs de IA ───────────────────────────────────────────

/** Valida inputs del usuario antes de llamar a funciones de IA de procesos. */
export const ProcessAiInputSchema = z.object({
  processName: z.string().min(1).max(150),
  companyName: z.string().max(150).optional(),
  industry: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  macroprocessName: z.string().max(150).optional(),
  subprocessName: z.string().max(150).optional(),
})

export type ProcessAiInput = z.infer<typeof ProcessAiInputSchema>
