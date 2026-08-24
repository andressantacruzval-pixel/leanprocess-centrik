/**
 * ai-proxy — Supabase Edge Function
 *
 * Proxy seguro entre el cliente y la API de Gemini.
 * - Verifica JWT del usuario antes de cada llamada
 * - Rate limiting: máx 20 llamadas/minuto por usuario
 * - Soporta modo streaming (SSE) y no-streaming
 * - Registra tokens reales (input + output) y coste USD estimado en ai_usage_log
 * - La GEMINI_API_KEY nunca sale del servidor
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

// Precios USD por 1M tokens (sincronizados con tabla ai_model_prices)
const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash':      { input: 0.075,  output: 0.300 },
  'gemini-2.5-flash-lite': { input: 0.040,  output: 0.150 },
}

const OPERATION_COSTS: Record<string, number> = {
  // Claves canónicas
  bpmn_generation:          15,
  bpmn_interview:           20,
  procedure_generation:     15,
  risk_identification:      10,
  audit_generation:         10,
  kpi_generation:           10,
  value_classification:      5,
  ai_consultant:            10,
  text_improvement:          2,
  // Aliases usados por componentes de la app
  process_objective:         5,
  procedure_from_bpmn:      15,
  procedure_from_context:   15,
  risks_from_bpmn:          10,
  audit_recommendations:    10,
  indicators:               10,
  // Mini-IAs internas (sub-llamadas dentro de features mayores)
  kpi:                      10,
  procedure:                15,
  procedure_risks:          10,
  risk:                     10,
  audit:                    10,
  bpmn_preprocess:           5,
  improve_text:              2,
  sipoc:                     5,
  bpmn_file_generation:     15,
  bpmn_refinement:          10,
  process_description:       5,
  // Features con badge de tokens visible en la UI
  improvement_opportunities:15,
  activity_detail:           5,
  inventory:                20,
  transcription:             0,
  asset_identification:     15,
  // Sesiones conversacionales (por turno)
  flowchart_interview_turn:  3,
  advisor_chat_turn:         3,
  process_map_onboarding:    3,
}

// El dominio de App es `app.leanprocess.app`. Va PRIMERO porque `getCorsHeaders` usa el elemento [0]
// como respaldo cuando el origen no está en la lista: con `leanprocess.app` al frente —que hoy sirve
// LITE, no App— el preflight respondía un origen que no coincidía y el navegador cortaba la petición
// antes de enviarla. Síntoma: en los logs solo aparecen OPTIONS y ningún POST, y las herramientas de
// IA dejan de responder sin más pista. Al añadir un dominio a App, añadirlo también aquí.
const ALLOWED_ORIGINS = [
  'https://app.leanprocess.app',
  'https://leanprocess.app',
  'https://leanprocessapp.vercel.app',
  'https://lean-process-2.vercel.app',
  // Despliegue de prueba en GitHub Pages
  'https://andressantacruzval-pixel.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
]

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

interface IncomingMessage {
  role: string
  content: string
}

interface RequestBody {
  messages?: IncomingMessage[]
  /** Para llamadas multimodales: array contents listo para enviar a Gemini directamente. */
  rawContents?: unknown
  modelId?: string
  systemPrompt?: string
  temperature?: number
  maxOutputTokens?: number
  responseMimeType?: string
  stream?: boolean
  /** Identificador del feature que origina la llamada (bpmn, procedure, risk, kpi, audit, etc.) */
  feature?: string
  /** Empresa activa del usuario para scoping del log */
  company_id?: string
  /** Clave de operación para descontar créditos del HUB */
  operation_key?: string
}

interface LogCtx {
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  userId: string
  companyId: string | null
  feature: string | undefined
  promptSummary: string
}

function calcCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICES[model] ?? { input: 0, output: 0 }
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'))

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verificar Authorization header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  const token = authHeader.replace('Bearer ', '')

  // Inicializar cliente Supabase con service_role para operaciones de DB
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verificar JWT del usuario
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Rate limiting: contar llamadas del usuario en la última ventana de tiempo
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count } = await supabase
    .from('ai_rate_limit_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', windowStart)

  if ((count ?? 0) >= RATE_LIMIT) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Intenta de nuevo en un minuto.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Registrar la llamada para rate limiting (best effort)
  supabase.from('ai_rate_limit_log').insert({ user_id: user.id }).then(() => {})

  // Parsear cuerpo de la solicitud
  const {
    messages, rawContents, modelId, systemPrompt, temperature,
    maxOutputTokens, responseMimeType, stream, feature, company_id, operation_key,
  } = await req.json() as RequestBody

  // Descontar créditos del HUB antes de llamar a Gemini
  const opKey = operation_key ?? feature ?? 'ai_consultant'
  const creditCost = OPERATION_COSTS[opKey] ?? 3
  const { data: newBalance } = await supabase.rpc('consume_credits', {
    p_user_id: user.id,
    p_cost: creditCost,
    p_tool_name: `LeanProcess App - ${opKey}`,
    p_metadata: { operation_key: opKey, company_id: company_id ?? null },
  })
  if (newBalance === -1) {
    return new Response(
      JSON.stringify({ error: 'Créditos insuficientes', code: 'INSUFFICIENT_CREDITS' }),
      { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const model = modelId ?? 'gemini-2.5-flash'
  const promptSummary = messages?.[0]?.content?.slice(0, 200) ?? ''

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'AI service not configured' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Construir body para Gemini REST API
  // rawContents permite llamadas multimodales (imágenes) pasando el array contents directamente
  const contents = rawContents ?? (messages ?? []).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  // La generación de BPMN produce XML estructurado y determinista (temp baja).
  // El "thinking" de Gemini 2.5 Flash no aporta calidad aquí y añade 60-120s de
  // latencia: un proceso grande (varios carriles + decisiones) tardaba tanto que
  // el usuario abandonaba antes de recibir respuesta. Lo desactivamos igual que
  // ya se hace para las calls JSON estructuradas.
  // ponytail: thinkingBudget 0 = off. Si la calidad del diagrama cae, subir a ~1024.
  const BPMN_FEATURES = new Set([
    'bpmn_generation', 'bpmn_file_generation', 'bpmn_refinement', 'bpmn_interview',
  ])
  const disableThinking = !!responseMimeType || BPMN_FEATURES.has(opKey)

  const geminiBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: temperature ?? 0.7,
      ...(maxOutputTokens ? { maxOutputTokens } : {}),
      ...(responseMimeType ? { responseMimeType } : {}),
      ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
    ...(systemPrompt
      ? { systemInstruction: { parts: [{ text: systemPrompt }] } }
      : {}),
  }

  const logCtx: LogCtx = {
    supabase,
    userId: user.id,
    companyId: company_id ?? null,
    feature,
    promptSummary,
  }

  if (stream) {
    return handleStreaming(geminiBody, model, apiKey, corsHeaders, logCtx)
  }
  return handleNonStreaming(geminiBody, model, apiKey, corsHeaders, logCtx)
})

// ─── Non-streaming ───────────────────────────────────────────────────────────

async function handleNonStreaming(
  geminiBody: Record<string, unknown>,
  model: string,
  apiKey: string,
  corsHeaders: Record<string, string>,
  logCtx: LogCtx,
): Promise<Response> {
  const geminiUrl = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`

  const geminiRes = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiBody),
  })

  if (!geminiRes.ok) {
    const errText = await geminiRes.text()
    return new Response(
      JSON.stringify({ error: `Gemini error: ${geminiRes.status}`, detail: errText }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const data = await geminiRes.json()

  // Capturar tokens reales desde usageMetadata de Gemini
  const inputTokens: number = data?.usageMetadata?.promptTokenCount ?? 0
  const outputTokens: number = data?.usageMetadata?.candidatesTokenCount ?? 0
  const estimatedCostUsd = calcCostUsd(model, inputTokens, outputTokens)

  // Log de uso con datos reales (best effort — no bloquea si falla)
  logCtx.supabase.from('ai_usage_log').insert({
    user_id: logCtx.userId,
    company_id: logCtx.companyId,
    feature: logCtx.feature ?? 'unknown',
    model_used: model,
    tokens_used: inputTokens + outputTokens,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: estimatedCostUsd,
    prompt_summary: logCtx.promptSummary,
    source: 'leanprocess_app',
  }).then(() => {})

  // Gemini 2.5 Flash devuelve parts de "thinking" (thought: true) antes de la respuesta real.
  // Buscamos el primer part que no sea thinking para obtener el output efectivo.
  const parts: Array<{ text?: string; thought?: boolean }> =
    data?.candidates?.[0]?.content?.parts ?? []
  const outputPart = parts.find(p => !p.thought) ?? parts[0]
  const text: string = outputPart?.text ?? ''

  return Response.json({ text }, { headers: corsHeaders })
}

// ─── Streaming (SSE) ────────────────────────────────────────────────────────

async function handleStreaming(
  geminiBody: Record<string, unknown>,
  model: string,
  apiKey: string,
  corsHeaders: Record<string, string>,
  logCtx: LogCtx,
): Promise<Response> {
  const geminiUrl =
    `${GEMINI_BASE_URL}/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`

  const geminiRes = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiBody),
  })

  if (!geminiRes.ok) {
    const errText = await geminiRes.text()
    return new Response(
      JSON.stringify({ error: `Gemini error: ${geminiRes.status}`, detail: errText }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const enc = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      const reader = geminiRes.body!.getReader()
      const dec = new TextDecoder()
      let buffer = ''

      // Capturar usageMetadata del último chunk de Gemini
      let capturedInputTokens = 0
      let capturedOutputTokens = 0

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += dec.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr) continue

            try {
              const event = JSON.parse(jsonStr)

              // usageMetadata aparece en el último chunk del stream
              if (event?.usageMetadata) {
                capturedInputTokens = event.usageMetadata.promptTokenCount ?? 0
                capturedOutputTokens = event.usageMetadata.candidatesTokenCount ?? 0
              }

              const text: string =
                event?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
              // Encodeamos como JSON para preservar saltos de linea, espacios
              // iniciales y finales, emojis y cualquier caracter que el modelo
              // emita. El cliente parsea el JSON y extrae .text. Sin esto, un
              // chunk con \n interno rompia el protocolo SSE: data: lines
              // posteriores quedaban sin prefijo y se descartaban, causando
              // texto cortado y palabras pegadas (ej: "quéroles" en vez de
              // "qué roles").
              if (text) {
                const payload = JSON.stringify({ text })
                controller.enqueue(enc.encode(`data: ${payload}\n\n`))
              }
            } catch {
              // ignorar eventos malformados
            }
          }
        }
      } finally {
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
        reader.releaseLock()

        // Log de uso con tokens reales capturados del stream (best effort)
        const estimatedCostUsd = calcCostUsd(model, capturedInputTokens, capturedOutputTokens)
        logCtx.supabase.from('ai_usage_log').insert({
          user_id: logCtx.userId,
          company_id: logCtx.companyId,
          feature: logCtx.feature ?? 'unknown',
          model_used: model,
          tokens_used: capturedInputTokens + capturedOutputTokens,
          input_tokens: capturedInputTokens,
          output_tokens: capturedOutputTokens,
          estimated_cost_usd: estimatedCostUsd,
          prompt_summary: logCtx.promptSummary,
          source: 'leanprocess_app',
        }).then(() => {})
      }
    },
  })

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
