/**
 * aiClient — wrapper del proxy de IA (Edge Function)
 *
 * Reemplaza las llamadas directas a la API de Gemini desde el cliente.
 * La GEMINI_API_KEY nunca llega al bundle — vive en Supabase secrets.
 */

import { supabase } from '@/lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// ─── Modo directo a Gemini (despliegue de prueba, sin Edge Function) ──────────
// ⚠️ Si se define VITE_GEMINI_API_KEY, la clave viaja en el bundle del cliente y
// las llamadas van directo a Gemini (la key queda EXPUESTA públicamente). Es un
// modo pensado solo para pruebas. En producción, dejar esta variable vacía para
// que todo pase por la Edge Function ai-proxy (key en el servidor).
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const DIRECT_GEMINI = !!GEMINI_API_KEY

// Mismo criterio que ai-proxy: apagar "thinking" en generación estructurada.
const BPMN_FEATURES = new Set([
  'bpmn_generation', 'bpmn_file_generation', 'bpmn_refinement', 'bpmn_interview',
])

function buildGeminiBody(messages: AiMessage[], options: AiProxyOptions): Record<string, unknown> {
  const contents = options.rawContents ?? (messages ?? []).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const opKey = options.feature ?? 'ai_consultant'
  const disableThinking = !!options.responseMimeType || BPMN_FEATURES.has(opKey)
  return {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
      ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
      ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
    ...(options.systemPrompt
      ? { systemInstruction: { parts: [{ text: options.systemPrompt }] } }
      : {}),
  }
}

function extractGeminiText(data: unknown): string {
  const parts = (data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>
  })?.candidates?.[0]?.content?.parts ?? []
  const outputPart = parts.find((p) => !p.thought) ?? parts[0]
  return outputPart?.text ?? ''
}

async function callGeminiDirect(messages: AiMessage[], options: AiProxyOptions): Promise<string> {
  const model = options.modelId ?? 'gemini-2.5-flash'
  const res = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGeminiBody(messages, options)),
    signal: options.signal,
  })
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Límite de solicitudes de IA alcanzado. Intenta de nuevo en un minuto.')
    }
    throw new Error(`Error de IA (Gemini ${res.status})`)
  }
  return extractGeminiText(await res.json())
}

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiProxyOptions {
  modelId?: string
  systemPrompt?: string
  temperature?: number
  maxOutputTokens?: number
  responseMimeType?: string
  signal?: AbortSignal
  /** Para llamadas multimodales: pasa el array contents directamente a Gemini sin mapeo. */
  rawContents?: unknown
  /** Identificador del feature que origina la llamada (bpmn, procedure, risk, kpi, audit, etc.) */
  feature?: string
  /** Empresa activa del usuario para scoping del log de uso de IA */
  companyId?: string
}

// ─── Non-streaming ────────────────────────────────────────────────────────────

/**
 * Llama al proxy y devuelve la respuesta completa como string.
 * Usa supabase.functions.invoke() que maneja automaticamente:
 *  - apikey header (requerido por el gateway con verify_jwt=true)
 *  - Authorization con el access_token actual
 *  - Refresh automatico del JWT si esta por expirar
 *  - Session persistente entre llamadas
 * Uso: claude.ts, riskAi.ts
 */
export async function callAiProxy(
  messages: AiMessage[],
  options: AiProxyOptions = {}
): Promise<string> {
  if (DIRECT_GEMINI) return callGeminiDirect(messages, options)
  const { data, error } = await supabase.functions.invoke<{ text: string; error?: string }>('ai-proxy', {
    body: {
      messages,
      rawContents: options.rawContents,
      modelId: options.modelId,
      systemPrompt: options.systemPrompt,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      responseMimeType: options.responseMimeType,
      stream: false,
      feature: options.feature,
      company_id: options.companyId,
    },
  })

  if (error) {
    // supabase.functions.invoke normaliza los errores. Extraemos codigo si
    // viene en el context.
    const ctx = (error as { context?: { status?: number } }).context
    const status = ctx?.status
    if (status === 402) {
      throw new Error('INSUFFICIENT_CREDITS')
    }
    if (status === 429) {
      throw new Error('Límite de solicitudes de IA alcanzado. Intenta de nuevo en un minuto.')
    }
    if (status === 401) {
      throw new Error('No autorizado para usar funciones de IA. Vuelve a iniciar sesión.')
    }
    throw new Error(`Error del servidor de IA: ${error.message}`)
  }

  if (!data) throw new Error('Respuesta vacía del servidor de IA')
  if (data.error) throw new Error(data.error)
  return data.text ?? ''
}

// ─── Streaming (SSE) ──────────────────────────────────────────────────────────

/**
 * Llama al proxy con streaming SSE y devuelve un AsyncGenerator de chunks.
 * Uso: conversationalAi.ts
 */
export async function* streamAiProxy(
  messages: AiMessage[],
  options: AiProxyOptions = {}
): AsyncGenerator<string, void, unknown> {
  // Modo directo: sin streaming real; devolvemos el texto completo en un chunk.
  if (DIRECT_GEMINI) {
    const text = await callGeminiDirect(messages, options)
    if (text) yield text
    return
  }
  // Obtener sesion y refrescar si el token esta cerca de expirar.
  // Sin esto, un token viejo da 401 del gateway incluso con verify_jwt=true
  // correcto — no es un bug de headers sino de JWT caducado.
  let { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('No hay sesión activa. Inicia sesión para usar funciones de IA.')
  }
  // expires_at viene en segundos UNIX. Si queda menos de 60s, forzar refresh.
  const expiresAtMs = (session.expires_at ?? 0) * 1000
  if (expiresAtMs > 0 && expiresAtMs < Date.now() + 60_000) {
    const { data: refreshData } = await supabase.auth.refreshSession()
    if (refreshData.session) session = refreshData.session
  }

  const body = JSON.stringify({
    messages,
    modelId: options.modelId,
    systemPrompt: options.systemPrompt,
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    stream: true,
    feature: options.feature,
    company_id: options.companyId,
  })

  // apikey requerido por el gateway cuando verify_jwt=true. supabase-js
  // lo agrega automaticamente via functions.invoke(), pero aqui usamos
  // fetch manual (streaming SSE) y lo inyectamos a mano.
  const makeRequest = (token: string) =>
    fetch(`${SUPABASE_URL}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body,
      signal: options.signal,
    })

  let res = await makeRequest(session.access_token)

  // Si el token local estaba expirado o desincronizado (sesion larga, multi-tab),
  // refrescar y reintentar UNA vez antes de lanzar error al usuario.
  if (res.status === 401) {
    const { data: retryRefresh } = await supabase.auth.refreshSession()
    if (retryRefresh.session) {
      res = await makeRequest(retryRefresh.session.access_token)
    }
  }

  if (!res.ok) {
    if (res.status === 402) {
      throw new Error('INSUFFICIENT_CREDITS')
    }
    if (res.status === 429) {
      throw new Error('Límite de solicitudes de IA alcanzado. Intenta de nuevo en un minuto.')
    }
    if (res.status === 401) {
      throw new Error('No autorizado para usar funciones de IA.')
    }
    throw new Error(`Error del servidor de IA: ${res.status}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (options.signal?.aborted) return
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE eventos estan separados por \n\n. NO splitear por \n simple —
      // el texto del modelo puede contener \n internos (listas, saltos de
      // parrafo) y splitear por \n los destroza: data: lines subsiguientes
      // quedan sin prefijo "data:" y se descartan, perdiendo texto.
      // El bug historico era: "qué roles" → "quéroles" porque \n intermedio
      // separaba los chunks y el .trim() quitaba el espacio.
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''

      for (const event of events) {
        // Cada evento SSE puede tener una o mas lineas prefijadas con "data: ".
        // Concatenamos su contenido preservando los \n internos.
        const dataLines: string[] = []
        for (const line of event.split('\n')) {
          if (line.startsWith('data: ')) {
            dataLines.push(line.slice(6))
          } else if (line.startsWith('data:')) {
            // Tolerante al caso sin espacio tras "data:"
            dataLines.push(line.slice(5))
          }
        }
        if (dataLines.length === 0) continue
        const payload = dataLines.join('\n')
        if (!payload || payload === '[DONE]') continue

        // Formato nuevo: JSON {"text":"..."}. Formato viejo (pre-fix):
        // texto crudo. Probamos JSON primero; si falla, asumimos el texto
        // viene crudo y lo emitimos tal cual. Esto permite redesplegar
        // cliente y edge function en orden arbitrario sin downtime.
        if (payload.startsWith('{')) {
          try {
            const parsed = JSON.parse(payload) as { text?: string }
            if (parsed.text) yield parsed.text
            continue
          } catch {
            // cae al fallback
          }
        }
        // Fallback: formato viejo, texto crudo. NO trimear — perderiamos
        // espacios intermedios entre tokens (causa del bug "quéroles").
        yield payload
      }
    }
  } finally {
    reader.releaseLock()
  }
}
