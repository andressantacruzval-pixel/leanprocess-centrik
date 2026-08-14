/**
 * conversationalAi
 * ----------------
 * Wrapper de streaming ultra-bajo latencia para conversaciones con IA.
 *
 * Diseno:
 *  - Por defecto usa `gemini-2.5-flash-lite` (el modelo mas rapido de
 *    la familia Gemini, TTFT ~250ms, ~250 tok/s) — notoriamente mas
 *    rapido que `gemini-2.5-flash`.
 *  - El API publico es un async generator: `for await` sobre chunks
 *    de texto. El UI actualiza la burbuja de chat token a token.
 *  - `FAST_MODEL` esta centralizado aqui. Cambiarlo por 'gemini-2.5-flash-lite',
 *    'gemini-2.0-flash', etc. afecta todo el sistema conversacional.
 *  - Cuando se quiera habilitar Groq (Llama 3.3 70B en ~275 tok/s gratis),
 *    solo hay que agregar un provider que respete la misma interfaz
 *    `StreamingProvider` y no tocar ni UI ni hooks.
 *
 * Protocolo de "tool calls":
 *  Los prompts instruyen al modelo a emitir marcadores inline:
 *     <<ACCION param="valor" param2="valor2">>
 *  El cliente parsea los marcadores mientras el stream llega y los
 *  dispatchea al store correspondiente. Esto evita function calling
 *  nativo (que agrega latencia) y es trivial de extender.
 */

import { streamAiProxy } from '@/lib/aiClient'

/** Modelo rapido por defecto. Cambiar aqui cambia todo el chat. */
export const FAST_MODEL = 'gemini-2.5-flash-lite'

/**
 * Modelo normal para tareas que requieren mas calidad/contexto.
 * Actualizado a gemini-3-flash-preview (2026-04-17) para el Diagramador IA —
 * la version previa (gemini-2.5-flash) colapsaba decisiones a flujo lineal y
 * emitia marcadores con typos de sintaxis en narrativas largas.
 * Si el modelo no esta disponible, revertir a 'gemini-2.5-flash'.
 */
export const QUALITY_MODEL = 'gemini-3-flash-preview'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamOptions {
  systemPrompt?: string
  temperature?: number
  model?: string
  /** Signal para cancelar el stream (ej: usuario aborta). */
  signal?: AbortSignal
  /** Feature key para logging en ai_usage_log (ej: 'process_map_onboarding'). */
  feature?: string
  /** Empresa activa para scoping del log. */
  companyId?: string
}

/**
 * Interfaz minima que debe cumplir cualquier proveedor de streaming.
 * Permite enchufar Groq, Cerebras, OpenAI o Anthropic despues con
 * cero cambios en UI.
 */
export interface StreamingProvider {
  stream: (messages: ChatMessage[], options: StreamOptions) => AsyncGenerator<string, void, unknown>
}

// ─── Gemini provider ──────────────────────────────────────────────────────

async function* streamGemini(
  messages: ChatMessage[],
  options: StreamOptions
): AsyncGenerator<string, void, unknown> {
  yield* streamAiProxy(messages, {
    modelId: options.model ?? FAST_MODEL,
    systemPrompt: options.systemPrompt,
    temperature: options.temperature ?? 0.6,
    signal: options.signal,
    feature: options.feature,
    companyId: options.companyId,
  })
}

export const geminiProvider: StreamingProvider = { stream: streamGemini }

/**
 * Provider activo — centralizado para poder intercambiar proveedor
 * de inferencia sin tocar hooks/UI.
 */
export const activeProvider: StreamingProvider = geminiProvider

/**
 * API publica: stream una conversacion y emite tokens uno a uno.
 */
export async function* streamChat(
  messages: ChatMessage[],
  options: StreamOptions = {}
): AsyncGenerator<string, void, unknown> {
  yield* activeProvider.stream(messages, options)
}

// ─── Tool call parsing ────────────────────────────────────────────────────

/**
 * Un "tool call" emitido por el modelo mediante marcador inline.
 * Formato:  <<ACTION param1="valor" param2="valor">>
 */
export interface InlineToolCall {
  name: string
  params: Record<string, string>
  /** Posicion en el texto crudo donde apareció. */
  raw: string
}

// Forma estricta: <<NAME param="val" ...>>
// Aceptamos comillas rectas " y curly quotes “ ” ' ' para tolerar modelos que
// usan comillas tipograficas. Tambien aceptamos ≥≥ / «« / >> como cierre.
// Nota: usamos \s* (no \s+) entre NAME y primer param para tolerar el bug comun
// del modelo donde emite <<ADD_TASKname="X">> sin espacio. Sin esta tolerancia
// el tool call se pierde y termina como residuo visible en el chat.
const TOOL_CALL_REGEX = /<<([A-Z_][A-Z0-9_]*)((?:\s*[a-z_][a-z0-9_]*=["“”'‘’][^"“”'‘’]*["“”'‘’])*)\s*>>/g
// Forma lenient: <<NAME param="val"... (sin >> — se recupera del error de sintaxis
// del modelo capturando hasta el ultimo parametro con valor cerrado). Requiere al
// menos UN parametro para evitar falsos positivos sobre un "<<" suelto.
const LENIENT_TOOL_CALL_REGEX =
  /<<([A-Z_][A-Z0-9_]*)((?:\s*[a-z_][a-z0-9_]*=["“”'‘’][^"“”'‘’]*["“”'‘’])+)(?!\s*>>)/g
const PARAM_REGEX = /([a-z_][a-z0-9_]*)=["“”'‘’]([^"“”'‘’]*)["“”'‘’]/g

// ── Sanitize agresivo (tercera pasada) ──────────────────────────────────
// Cuando el modelo emite marcadores malformados (cierres raros, prefijos truncados,
// enumeraciones con "<<" anidados, valores con ">>" internos), los regex estrictos
// y lenient no los capturan y el usuario termina viendo fragmentos XML en el chat.
// Esta tercera pasada borra cualquier rastro de markup residual:
//  - Cadenas de atributos sueltos seguidas por ">>": label="No" target="..." >>
//  - Prefijos de nombre truncados: WAY name="...", _TASK name="..." (quedan tras
//    que el regex consuma parcialmente "<<GATEWAY" o "<<ADD_TASK").
//  - "<<" y ">>" residuales sin contexto válido.
// Trade-off: puede limpiar texto conversacional legitimo que use ">>" literal,
// pero ese caso es rarisimo en conversaciones de negocio en español y el costo
// de mostrar markup crudo al usuario es MUCHO peor.
const ORPHAN_ATTR_CHAIN_REGEX = /(?:\s*[a-z_][a-z0-9_]*=["“”'‘’][^"“”'‘’]*["“”'‘’]){1,}\s*>>/g
const TRUNCATED_PREFIX_REGEX = /\b[A-Z][A-Z0-9_]*\s+[a-z_][a-z0-9_]*=["“”'‘’][^"“”'‘’]*["“”'‘’](?:\s*>>)?/g
// STRAY_OPEN limitado a 200 chars máximo para no tragar texto conversacional
// legitimo durante streaming (chunks parciales pueden dejar "<<ADD_TASK" sin
// cerrar al final del chunk, y si dejamos el regex voraz comería todo el texto
// del siguiente chunk hasta el próximo "<").
const STRAY_OPEN_REGEX = /<<[A-Z_][A-Z0-9_]*(?:\s[^<>]{0,200})?/g
const STRAY_CLOSE_REGEX = />>/g
const FRAGMENT_VALUE_REGEX = /["“”'‘’][^"“”'‘’]{1,100}["“”'‘’]\s*>>/g

/**
 * Busca tool calls nuevos en un buffer acumulado. Devuelve los matches
 * y el rango que ya fue consumido, para que el caller pueda:
 *  1. dispatchar los tool calls
 *  2. remover los marcadores del texto visible al usuario
 *
 * Hace dos pasadas:
 *  - Estricta: matches <<NAME ...>> bien formados.
 *  - Lenient: recupera <<NAME param="val"... cuando el modelo olvida el >>,
 *    evitando que el marcador crudo se muestre en el chat.
 */
export function parseInlineToolCalls(buffer: string): {
  calls: InlineToolCall[]
  cleanedText: string
} {
  const calls: InlineToolCall[] = []
  const seenRaw = new Set<string>()

  const extractParams = (paramsRaw: string): Record<string, string> => {
    const params: Record<string, string> = {}
    if (!paramsRaw) return params
    PARAM_REGEX.lastIndex = 0
    let p: RegExpExecArray | null
    while ((p = PARAM_REGEX.exec(paramsRaw)) !== null) {
      params[p[1]] = p[2]
    }
    return params
  }

  // ── Pasada 1: estricta ──
  TOOL_CALL_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOOL_CALL_REGEX.exec(buffer)) !== null) {
    const [raw, name, paramsRaw] = match
    calls.push({ name, params: extractParams(paramsRaw), raw })
    seenRaw.add(raw)
  }

  // Quitar los marcadores estrictos del texto visible
  let cleanedText = buffer.replace(TOOL_CALL_REGEX, '')

  // ── Pasada 2: lenient (recuperacion de >> olvidados) ──
  // Solo aplicamos si el texto todavia contiene "<<" — asi evitamos costos
  // innecesarios en la mayoria de los casos.
  if (cleanedText.includes('<<')) {
    LENIENT_TOOL_CALL_REGEX.lastIndex = 0
    let lm: RegExpExecArray | null
    while ((lm = LENIENT_TOOL_CALL_REGEX.exec(cleanedText)) !== null) {
      const [raw, name, paramsRaw] = lm
      if (seenRaw.has(raw)) continue
      calls.push({ name, params: extractParams(paramsRaw), raw })
      seenRaw.add(raw)
    }
    // Limpiar lo que el lenient capturo
    cleanedText = cleanedText.replace(LENIENT_TOOL_CALL_REGEX, '')
  }

  // ── Pasada 3: sanitize agresivo ──
  // Si aún queda markup residual después de strict + lenient, significa que el
  // modelo emitio fragmentos malformados. Los borramos para que el usuario NUNCA
  // vea XML crudo en el chat, aunque esto signifique perder algún tool call del
  // turno. Es mejor un shape menos que texto basura que destroza la UX.
  const hasResidual =
    cleanedText.includes('>>') ||
    cleanedText.includes('<<') ||
    /\b[A-Z][A-Z0-9_]+\s+[a-z_]+=["“”'‘’]/.test(cleanedText)

  if (hasResidual) {
    cleanedText = cleanedText.replace(ORPHAN_ATTR_CHAIN_REGEX, ' ')
    cleanedText = cleanedText.replace(TRUNCATED_PREFIX_REGEX, ' ')
    cleanedText = cleanedText.replace(FRAGMENT_VALUE_REGEX, ' ')
    cleanedText = cleanedText.replace(STRAY_OPEN_REGEX, ' ')
    cleanedText = cleanedText.replace(STRAY_CLOSE_REGEX, ' ')

    // Log para monitorear en producción. Si aparece seguido, indica que el
    // modelo necesita mejor prompt o que toca migrar a function calling nativo.
    // Solo en browser y solo cuando quedó algo raro — no spamea console normal.
    if (typeof window !== 'undefined') {
      console.warn(
        '[parseInlineToolCalls] residual markup sanitized. Raw buffer sample:',
        buffer.slice(0, 400)
      )
    }
  }

  cleanedText = cleanedText.replace(/\s{2,}/g, ' ').trim()
  return { calls, cleanedText }
}
