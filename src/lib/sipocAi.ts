// ─── Asistente conversacional de SIPOC ─────────────────────────────────────
// El modelo entrevista al usuario con POCAS preguntas lógicas (2-5), entiende la
// empresa/macroproceso/proceso/subprocesos hermanos y el diagrama, y va emitiendo
// pares SIPOC (proveedor→entrada, salida→cliente) que la UI añade automáticamente
// a la tabla mientras se conversa. Devuelve SIEMPRE JSON estricto.

import { callAiProxy, type AiMessage } from '@/lib/aiClient'
import { sanitizePromptInput, sanitizeStringArray } from '@/lib/aiSanitizer'

export interface SipocPairIn {
  supplier: string
  input: string
}
export interface SipocPairOut {
  output: string
  customer: string
}

export interface SipocAiContext {
  companyName: string
  industry?: string
  macroName?: string
  parentName?: string
  processName: string
  description?: string
  siblings: string[]
  activities: string[]
  existing: { inputs: SipocPairIn[]; outputs: SipocPairOut[] }
}

export interface SipocTurn {
  /** Texto breve para el usuario: una pregunta a la vez, o el cierre. */
  reply: string
  /** Respuestas de un clic (2-4) cuando la pregunta las admite. */
  quickReplies?: string[]
  /** Pares SIPOC NUEVOS que la UI debe añadir a la tabla. */
  add?: { inputs?: SipocPairIn[]; outputs?: SipocPairOut[] }
  /** true cuando el SIPOC ya está razonablemente completo. */
  done?: boolean
}

function buildSystemPrompt(ctx: SipocAiContext): string {
  const empresa = sanitizePromptInput(ctx.companyName || 'la empresa', 150)
  const industria = ctx.industry ? sanitizePromptInput(ctx.industry, 100) : 'no especificada'
  const macro = ctx.macroName ? sanitizePromptInput(ctx.macroName, 150) : '—'
  const padre = ctx.parentName ? sanitizePromptInput(ctx.parentName, 150) : '—'
  const proc = sanitizePromptInput(ctx.processName, 150)
  const desc = ctx.description ? sanitizePromptInput(ctx.description, 800) : 'sin descripción'
  const hermanos = sanitizeStringArray(ctx.siblings, 40).slice(0, 30).join(', ') || 'ninguno registrado'
  const acts = sanitizeStringArray(ctx.activities, 60).slice(0, 40).join(', ') || 'sin diagrama todavía'
  const yaIn = ctx.existing.inputs.map((e) => `${e.supplier} → ${e.input}`).join(' | ') || 'ninguna'
  const yaOut = ctx.existing.outputs.map((e) => `${e.output} → ${e.customer}`).join(' | ') || 'ninguna'

  return `Eres un consultor senior de gestión por procesos que ayuda a construir el SIPOC de un proceso de forma CONVERSACIONAL, guiando con preguntas simples.

CONTEXTO (fuente de verdad):
- Empresa: "${empresa}" (industria: ${industria})
- Macroproceso: ${macro}
- Proceso padre: ${padre}
- Proceso/subproceso actual: "${proc}"
- Objetivo/descripción: ${desc}
- Otros subprocesos de la empresa (posibles proveedores o clientes internos): ${hermanos}
- Actividades del diagrama de flujo: ${acts}
- SIPOC ya registrado — Entradas: ${yaIn}. Salidas: ${yaOut}.

TU MÉTODO (imprescindible para una buena UX):
1. Haz entre 2 y 5 preguntas en total, UNA a la vez, cortas y lógicas. Nada de cuestionarios largos.
2. Empieza por lo que dispara el proceso (entrada inicial y su proveedor) y termina por lo que entrega (salida final y su cliente).
3. Aprovecha el CONTEXTO: si por la lógica del negocio este proceso recibe algo de otro subproceso de la lista, o entrega algo a otro, SUGIÉRELO explícitamente en "reply" y proponlo como proveedor/cliente interno.
4. Tras CADA respuesta del usuario, infiere y emite en "add" los pares SIPOC NUEVOS que ya puedas dar por buenos (no repitas los ya registrados ni los que ya propusiste).
5. Ofrece "quickReplies" (2-4 opciones de un clic) cuando la pregunta admita respuestas breves.
6. Cuando el SIPOC esté razonablemente completo (o tras ~5 preguntas), pon "done": true con un cierre de una línea.

REGLAS:
- Proveedor = quién/qué entrega la entrada. Entrada = insumo/información que llega. Salida = resultado que produce el proceso. Cliente = quién recibe la salida (interno o externo).
- Sé concreto y realista para ESTA empresa e industria. No inventes datos si el usuario no los ha dado y no se deducen del contexto; en ese caso pregunta.
- Español, tono cercano y profesional.

RESPONDE ÚNICAMENTE con un JSON válido, sin markdown, con esta forma exacta:
{"reply":"...","quickReplies":["...","..."],"add":{"inputs":[{"supplier":"...","input":"..."}],"outputs":[{"output":"...","customer":"..."}]},"done":false}
Omite "quickReplies" si no aplican. "add" puede traer inputs, outputs, ambos o venir vacío.`
}

function parseTurn(raw: string): SipocTurn {
  let t = raw.replace(/```(?:json)?/gi, '').trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start !== -1 && end > start) t = t.slice(start, end + 1)
  const parsed = JSON.parse(t) as SipocTurn
  return {
    reply: typeof parsed.reply === 'string' ? parsed.reply : '',
    quickReplies: Array.isArray(parsed.quickReplies) ? parsed.quickReplies.filter((q) => typeof q === 'string').slice(0, 4) : undefined,
    add: {
      inputs: Array.isArray(parsed.add?.inputs) ? parsed.add!.inputs!.filter((p) => p && p.supplier && p.input) : [],
      outputs: Array.isArray(parsed.add?.outputs) ? parsed.add!.outputs!.filter((p) => p && p.output && p.customer) : [],
    },
    done: parsed.done === true,
  }
}

export async function interviewSipoc(
  ctx: SipocAiContext,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<SipocTurn> {
  // La conversación DEBE empezar por un turno de usuario. Si el primer mensaje es
  // del asistente (su primera pregunta), anteponemos un arranque de usuario.
  const primed = history.length && history[0].role === 'assistant'
    ? [{ role: 'user' as const, content: 'Construyamos el SIPOC de este proceso.' }, ...history]
    : history
  const messages: AiMessage[] = primed.length
    ? primed.map((m) => ({ role: m.role, content: m.content }))
    : [{ role: 'user', content: 'Ayúdame a construir el SIPOC de este proceso. Empieza con tu primera pregunta.' }]
  const text = await callAiProxy(messages, {
    systemPrompt: buildSystemPrompt(ctx),
    feature: 'sipoc',
    temperature: 0.4,
    responseMimeType: 'application/json',
  })
  return parseTurn(text)
}
