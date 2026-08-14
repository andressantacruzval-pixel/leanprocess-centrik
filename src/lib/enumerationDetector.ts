/**
 * enumerationDetector
 * -------------------
 * Analiza el mensaje del usuario para extraer cuantos items
 * enumera (roles, tareas, decisiones, etc.). Se usa para:
 *
 *  1. Inyectar una pista explicita en el system prompt antes del
 *     turno del modelo ("debes emitir N marcadores") — pre-turn hint.
 *  2. Verificar POST-turno si el modelo emitio ese mismo N de
 *     marcadores. Si no, disparar una correccion silenciosa.
 *
 * La deteccion es heuristica (no LLM) y deliberadamente tolerante:
 *  - Numerales escritos: "tres roles", "cuatro tareas"
 *  - Numerales digitales: "3 roles", "4 tareas"
 *  - Enumeraciones explicitas: "A, B y C", "A y B"
 *  - Articulos repetidos en voz sin comas: "el A el B el C"
 *
 * Cuando se detecta tanto un numeral como una enumeracion, el numeral
 * tiene prioridad (es lo que el usuario conscientemente dijo).
 */

const NUMBER_WORDS: Record<string, number> = {
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  dieciséis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
}

// Sustantivos plurales que indican que el usuario esta listando multiples
// elementos del dominio del flujograma. Incluye sinonimos comunes de voz.
const PLURAL_NOUNS = [
  'roles',
  'lanes',
  'carriles',
  'piscinas',
  'responsables',
  'areas',
  'departamentos',
  'equipos',
  'actores',
  'tareas',
  'actividades',
  'pasos',
  'acciones',
  'decisiones',
  'compuertas',
  'gateways',
  'validaciones',
  'fines',
  'finales',
  'salidas',
]

export interface EnumerationAnalysis {
  /** Numero de items detectado. 0 si no hay enumeracion clara. */
  count: number
  /** Como se detecto: util para debugging y para decidir confianza. */
  source: 'numeral-plural' | 'article-repetition' | 'comma-list' | 'none'
  /** Sustantivo plural que disparo la deteccion (si aplica). */
  noun?: string
  /** Frase original del usuario que gatillo la deteccion. */
  hint?: string
}

const NO_MATCH: EnumerationAnalysis = { count: 0, source: 'none' }

/**
 * Normaliza el texto para analisis: minusculas + colapso de espacios.
 * NO quita acentos para poder matchear sustantivos del dominio.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Detecta "tres roles", "4 tareas", "cinco decisiones", etc.
 * El patron es: <numeral> (opcional "nuevos/as") <sustantivo plural>
 */
function detectNumeralPlural(text: string): EnumerationAnalysis | null {
  const words = Object.keys(NUMBER_WORDS).join('|')
  const nouns = PLURAL_NOUNS.join('|')
  const regex = new RegExp(
    `\\b(${words}|\\d{1,2})\\s+(?:nuevos?|nuevas?|mas\\s+)?(${nouns})\\b`,
    'i'
  )
  const m = text.match(regex)
  if (!m) return null

  const numToken = m[1].toLowerCase()
  const count = NUMBER_WORDS[numToken] ?? parseInt(numToken, 10)
  if (!Number.isFinite(count) || count < 2 || count > 20) return null

  return {
    count,
    source: 'numeral-plural',
    noun: m[2].toLowerCase(),
    hint: m[0],
  }
}

/**
 * Detecta enumeraciones tipo "el A el B el C" (voz sin comas) o
 * "la A la B la C". Requiere al menos 3 repeticiones para evitar
 * falsos positivos sobre frases normales.
 */
function detectArticleRepetition(text: string): EnumerationAnalysis | null {
  // Captura secuencias de 3+ "el/la X" consecutivos (permite 1-4 palabras por item)
  const regex =
    /\b(el|la)\s+([a-zñáéíóú]+(?:\s+(?:de\s+)?[a-zñáéíóú]+){0,3})(?:\s+\b(?:el|la)\s+[a-zñáéíóú]+(?:\s+(?:de\s+)?[a-zñáéíóú]+){0,3}){2,}/i
  const m = text.match(regex)
  if (!m) return null

  // Contar cuantos articulos hay en el match
  const articles = m[0].match(/\b(el|la)\s+/gi) || []
  const count = articles.length
  if (count < 3 || count > 15) return null

  return {
    count,
    source: 'article-repetition',
    hint: m[0],
  }
}

/**
 * Detecta enumeraciones clasicas "A, B y C" o "A, B, C y D".
 * Requiere (2+ comas) OR (1+ coma + " y " al final) para evitar
 * falsos positivos sobre frases con UNA coma incidental como
 * "hola, cuentame del proceso".
 */
function detectCommaList(text: string): EnumerationAnalysis | null {
  // Patron 1: "X, Y, Z" con 2+ comas (3+ items minimo)
  const multiComma =
    /\b([\wñáéíóú]+(?:\s+[\wñáéíóú]+){0,4})\s*,\s*([\wñáéíóú]+(?:\s+[\wñáéíóú]+){0,4})\s*,\s*([\wñáéíóú]+(?:\s+[\wñáéíóú]+){0,4})(?:\s*,\s*[\wñáéíóú]+(?:\s+[\wñáéíóú]+){0,4})*(?:\s+y\s+[\wñáéíóú]+(?:\s+[\wñáéíóú]+){0,4})?/i
  // Patron 2: "X, Y y Z" — 1 coma + " y " (oxford style)
  const commaY =
    /\b([\wñáéíóú]+(?:\s+[\wñáéíóú]+){0,4})\s*,\s*([\wñáéíóú]+(?:\s+[\wñáéíóú]+){0,4})\s+y\s+([\wñáéíóú]+(?:\s+[\wñáéíóú]+){0,4})/i

  const m = text.match(multiComma) || text.match(commaY)
  if (!m) return null

  const parts = m[0]
    .split(/\s*,\s*|\s+y\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length < 3 || parts.length > 20) return null

  return {
    count: parts.length,
    source: 'comma-list',
    hint: m[0],
  }
}

/**
 * Detecta listas SIN separadores: "los roles analista gerente supervisor director".
 * Disparador: plural domain noun ("roles", "tareas", etc.) seguido de 3+ palabras
 * que parecen sustantivos propios (cada una 3+ letras, sin verbos comunes).
 */
const COMMON_SKIP_WORDS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'y',
  'o',
  'que',
  'para',
  'con',
  'sin',
  'por',
  'se',
  'un',
  'una',
  'al',
  'en',
  'a',
  'e',
  'u',
])
function detectListAfterPluralNoun(text: string): EnumerationAnalysis | null {
  const nouns = PLURAL_NOUNS.join('|')
  // Captura "los/las? NOUN <rest of sentence>"
  const regex = new RegExp(
    `\\b(?:los\\s+|las\\s+)?(${nouns})\\s+(.+?)(?:[.!?]|$)`,
    'i'
  )
  const m = text.match(regex)
  if (!m) return null

  const rest = m[2]
  // Partimos por espacios y separamos en raw tokens.
  const rawTokens = rest
    .split(/\s+/)
    .map((t) => t.replace(/[.,;:!?]/g, ''))
    .filter(Boolean)

  // REGLA DE SEGURIDAD: si hay CUALQUIER conector multi-word ("de", "del",
  // "con", "para"), significa que los items son multi-palabra y el conteo
  // por tokens falla. Bail out — dejemos que el modelo lo maneje.
  const hasConnector = rawTokens.some((t) =>
    ['de', 'del', 'con', 'para', 'por', 'en'].includes(t.toLowerCase())
  )
  if (hasConnector) return null

  // REGLA: si hay algun articulo ("el", "la") en el medio, es un patron
  // de articulos repetidos y ya lo debe haber capturado el otro detector.
  const hasArticles = rawTokens.some((t) =>
    ['el', 'la'].includes(t.toLowerCase())
  )
  if (hasArticles) return null

  // REGLA: solo tokens semanticos (3+ letras, sin stopwords).
  const tokens = rawTokens.filter(
    (t) => t.length >= 3 && !COMMON_SKIP_WORDS.has(t.toLowerCase())
  )

  // Requerimos 3-10 tokens CONTIGUOS de single-word.
  if (tokens.length < 3 || tokens.length > 10) return null

  return {
    count: tokens.length,
    source: 'comma-list',
    noun: m[1].toLowerCase(),
    hint: m[0].trim(),
  }
}

/**
 * API publica: analiza el mensaje del usuario y devuelve la
 * estimacion mas confiable del numero de items enumerados.
 *
 * Prioridad:
 *  1. Numeral + sustantivo plural ("tres roles") — mas confiable porque
 *     el usuario dijo el numero explicitamente.
 *  2. Articulos repetidos ("el X el Y el Z") — comun en entrada por voz.
 *  3. Lista con comas ("A, B y C") — patron clasico escrito.
 */
export function analyzeEnumeration(userText: string): EnumerationAnalysis {
  const text = normalize(userText)

  const numeral = detectNumeralPlural(text)
  if (numeral) return numeral

  const articles = detectArticleRepetition(text)
  if (articles) return articles

  const commas = detectCommaList(text)
  if (commas) return commas

  const listAfterNoun = detectListAfterPluralNoun(text)
  if (listAfterNoun) return listAfterNoun

  return NO_MATCH
}

/**
 * Construye un bloque de hint para inyectar en el system prompt del
 * siguiente turno. El modelo lee esto ANTES de responder y sabe
 * exactamente cuantos marcadores debe emitir.
 */
export function buildEnumerationHint(
  analysis: EnumerationAnalysis
): string {
  if (analysis.count < 2) return ''

  const nounHint = analysis.noun ? ` (${analysis.noun})` : ''
  return `\n\n[DETECCION AUTOMATICA DEL SISTEMA — CRITICO]
El analizador detecto que el usuario menciono ${analysis.count} items${nounHint} en su ultima frase ("${analysis.hint}").
Por lo tanto debes emitir EXACTAMENTE ${analysis.count} marcadores en tu proxima respuesta.
Si emites menos, el sistema lo detectara y te pedira corregir automaticamente.
Si emites mas, estaras inventando items que el usuario no pidio.
Cuenta tus marcadores ANTES de enviar la respuesta.`
}
