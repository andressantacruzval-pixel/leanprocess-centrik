import { callAiProxy, type AiMessage } from '@/lib/aiClient'
import { sanitizePromptInput, sanitizeLargeContent } from '@/lib/aiSanitizer'
import { preprocessProcessText, looksUnstructured } from '@/lib/bpmnPreprocess'
import { fixBpmnWaypoints, injectMissingBpmnEdges } from '@/lib/bpmnLayoutFix'
import {
  BIZAGI_PROMPT_MAESTRO,
  REFINEMENT_PROMPT,
  CONSULTANT_SYSTEM_PROMPT,
  CONVERSATION_FREE_PROMPT,
  SUPPORTED_MIME_TYPES,
  PHASE_1_SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/prompts/bpmnPrompts'
import { IS_PHASE_1 } from '@/lib/phaseFlags'

export type { SupportedMimeType } from '@/lib/prompts/bpmnPrompts'
export { SUPPORTED_MIME_TYPES, MAX_FILE_SIZE_BYTES }

// Temperatura baja para diagramas consistentes y sin alucinaciones geométricas
const BPMN_TEMPERATURE = 0.15

function extractXmlFromResponse(text: string): string {
  let xml = text.replace(/```(?:xml)?/g, '').trim()
  const xmlStart = xml.search(/<\?xml|<bpmn:definitions|<definitions/)
  if (xmlStart > 0) xml = xml.slice(xmlStart)
  return xml
}

// ── Tab 2: Entrevista guiada (flujo existente, sin cambios) ────────────────

export async function conductProcessInterview(
  conversationHistory: Array<{ role: string; text: string }>,
  userMessage: string
): Promise<string> {
  const messages = conversationHistory.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.text,
  }))
  messages.push({ role: 'user', content: sanitizePromptInput(userMessage, 2000) })
  return callAiProxy(messages, { systemPrompt: CONSULTANT_SYSTEM_PROMPT, feature: 'flowchart_interview_turn' })
}

// ── Tab 1: Conversación libre ───────────────────────────────────────────────

export async function conductFreeConversation(
  conversationHistory: Array<{ role: string; text: string }>,
  userMessage: string
): Promise<string> {
  const messages = conversationHistory.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.text,
  }))
  messages.push({ role: 'user', content: sanitizePromptInput(userMessage, 2000) })
  return callAiProxy(messages, { systemPrompt: CONVERSATION_FREE_PROMPT, feature: 'advisor_chat_turn' })
}

// ── Generación BPMN desde resumen de entrevista (Tab 1 y Tab 2) ────────────

export async function generateBpmnFromInterview(
  summary: string,
  _fullConversation?: string
): Promise<{ xml: string }> {
  const safeSummary = sanitizePromptInput(summary, 5000)
  const text = await callAiProxy(
    [{ role: 'user', content: `Genera el diagrama BPMN 2.0 XML para el siguiente proceso:\n\n${safeSummary}` }],
    { systemPrompt: BIZAGI_PROMPT_MAESTRO, temperature: BPMN_TEMPERATURE, feature: 'bpmn_generation' }
  )
  return { xml: injectMissingBpmnEdges(fixBpmnWaypoints(extractXmlFromResponse(text))) }
}

// ── Tab 3: Entrada directa (texto libre) ──────────────────────────────────

export async function generateBpmnDirect(
  description: string,
  options: { skipPreprocess?: boolean } = {}
): Promise<{ xml: string }> {
  const safeDesc = sanitizePromptInput(description, 5000)
  const needsPreprocess = !options.skipPreprocess && looksUnstructured(safeDesc)
  const inputText = needsPreprocess ? await preprocessProcessText(safeDesc) : safeDesc
  const userInstruction = needsPreprocess
    ? `Genera el diagrama BPMN 2.0 XML completo para el siguiente proceso (descripción ya estructurada):\n\n${inputText}`
    : `Analiza la siguiente descripción de proceso y genera el diagrama BPMN 2.0 XML completo:\n\n${inputText}`
  const text = await callAiProxy(
    [{ role: 'user', content: userInstruction }],
    { systemPrompt: BIZAGI_PROMPT_MAESTRO, temperature: BPMN_TEMPERATURE, feature: 'bpmn_generation' }
  )
  return { xml: injectMissingBpmnEdges(fixBpmnWaypoints(extractXmlFromResponse(text))) }
}

// ── Tab 4: Carga de archivo (multimodal via rawContents) ───────────────────

export async function generateBpmnFromFile(
  fileBase64: string,
  mimeType: string,
  description?: string
): Promise<{ xml: string }> {
  const userPrompt = description
    ? `Analiza este archivo e identifica el proceso de negocio. Contexto adicional: ${sanitizePromptInput(description, 500)}. Genera el XML BPMN 2.0 completo.`
    : 'Analiza este archivo e identifica el proceso de negocio descrito. Genera el XML BPMN 2.0 completo.'

  const rawContents = [
    {
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: fileBase64 } },
        { text: userPrompt },
      ],
    },
  ]

  const text = await callAiProxy([] as AiMessage[], {
    rawContents,
    systemPrompt: BIZAGI_PROMPT_MAESTRO,
    temperature: BPMN_TEMPERATURE,
    feature: 'bpmn_file_generation',
  })
  return { xml: injectMissingBpmnEdges(fixBpmnWaypoints(extractXmlFromResponse(text))) }
}

// ── Refinamiento de diagrama existente ────────────────────────────────────

export async function refineBpmnDiagram(currentXml: string, instruction: string): Promise<{ xml: string }> {
  const safeXml = sanitizeLargeContent(currentXml, 100_000)
  const safeInstruction = sanitizePromptInput(instruction, 1000)
  const text = await callAiProxy(
    [{
      role: 'user',
      content: `DIAGRAMA BPMN ACTUAL:\n${safeXml}\n\nINSTRUCCIÓN DE MODIFICACIÓN:\n${safeInstruction}\n\nAplica la modificación y devuelve el XML completo actualizado.`,
    }],
    { systemPrompt: REFINEMENT_PROMPT, temperature: BPMN_TEMPERATURE, feature: 'bpmn_refinement' }
  )
  return { xml: injectMissingBpmnEdges(fixBpmnWaypoints(extractXmlFromResponse(text))) }
}

// ── Validación de archivo antes de enviar ─────────────────────────────────

export function validateBpmnFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = IS_PHASE_1
    ? (PHASE_1_SUPPORTED_MIME_TYPES as readonly string[])
    : (SUPPORTED_MIME_TYPES as readonly string[])
  if (!allowedTypes.includes(file.type)) {
    const hint = IS_PHASE_1
      ? 'Usa imagen (JPG, PNG, WebP), PDF o Word.'
      : 'Usa: PDF, imágenes (JPG, PNG, GIF, WebP), audio (MP3, WAV, M4A) o video (MP4, WebM).'
    return { valid: false, error: `Tipo de archivo no soportado. ${hint}` }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `El archivo es demasiado grande (máximo 10 MB).` }
  }
  return { valid: true }
}

// ── Conversión de File a base64 ────────────────────────────────────────────

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Quitar el prefijo "data:mime/type;base64," que FileReader agrega
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsDataURL(file)
  })
}
