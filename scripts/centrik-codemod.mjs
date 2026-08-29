/**
 * Codemod: traslada el diseño dark-first de Lean Process al sistema Centrik.
 *
 * Trabaja sobre los literales de cadena de los .tsx, tratando cada uno como una
 * lista de clases. NO es un buscar-y-reemplazar plano: varias reglas necesitan
 * saber qué OTRAS clases acompañan al token en el mismo literal. El caso que lo
 * obliga es `text-white`: sobre un panel navy significa «texto principal» y en
 * claro pasa a gris 900, pero sobre un botón verde significa «texto sobre color»
 * y ahí debe seguir siendo blanco. Un reemplazo global rompe uno de los dos.
 *
 * Orden de las fases (importa):
 *   1. Degradados     — se colapsan a un color sólido y dejan un `bg-*` nuevo…
 *   2. Tokens simples — …que la fase de superficies convierte a claro…
 *   3. Contextuales   — …para que aquí ya se vea el fondo REAL del elemento.
 *
 * Uso:  node scripts/centrik-codemod.mjs [--dry] [ruta...]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import ts from 'typescript'
import { execSync } from 'node:child_process'

const DRY = process.argv.includes('--dry')

/* ── Superficies navy heredadas ──────────────────────────────────────── */
const SUPERFICIES = {
  // Lienzo de página
  '#070b14': 'surface-ground', '#0b1020': 'surface-ground',
  '#0a0f19': 'surface-ground', '#0b111c': 'surface-ground',
  // Secciones hundidas
  '#0a1018': 'surface-section', '#16223a': 'surface-section',
  // Paneles y tarjetas
  '#0a0f1a': 'white', '#0d1420': 'white', '#0d1117': 'white', '#0d1424': 'white',
  '#0d1320': 'white', '#0b1220': 'white', '#0f1629': 'white', '#0c1322': 'white',
  '#0c1220': 'white', '#0c172b': 'white', '#111827': 'white', '#111a28': 'white',
  '#0f1117': 'white', '#071c27': 'white', '#17122b': 'white', '#1f2937': 'white',
}

/* Hexadecimales de ACCIÓN: eran botones de color, no superficies. El morado y
   el azul se pasan al verde de familia — el kit prohíbe una segunda paleta
   dominante — y el rojo se queda porque ahí el color SIGNIFICA destructivo. */
const ACCIONES = {
  '#059669': 'primary-600', '#2563eb': 'primary-500',
  '#7c3aed': 'primary-500', '#0d9488': 'primary-500',
  '#dc2626': 'red-500',
}

/* Texto oscuro puesto a propósito SOBRE un acento brillante. En Centrik ese
   mismo sitio lleva blanco, así que se resuelve con el resto de contextuales. */
const TEXTO_SOBRE_ACENTO = new Set(['#0a0f1a', '#06121c', '#070b14', '#0b1020', '#2a1a02'])

/* ── Escalas de blanco translúcido → grises fríos ────────────────────── */
const alfa = (v) => (v.startsWith('[') ? parseFloat(v.slice(1, -1)) * 100 : parseInt(v, 10))
const escala = (pares) => (v) => {
  const n = alfa(v)
  for (const [umbral, clase] of pares) if (n >= umbral) return clase
  return pares[pares.length - 1][1]
}
const TEXTO_BLANCO   = escala([[80, 'gray-800'], [65, 'gray-700'], [55, 'gray-600'], [40, 'gray-500'], [25, 'gray-400'], [0, 'gray-300']])
const FONDO_BLANCO   = escala([[15, 'gray-200'], [8, 'gray-100'], [0, 'gray-50']])
const BORDE_BLANCO   = escala([[20, 'gray-300'], [10, 'gray-200'], [0, 'gray-100']])

/* ── Familias de color ───────────────────────────────────────────────── */
// Todo lo que era acento de marca (cian, azul degradado, morado, teal…) pasa a
// `primary`. El azul suelto, el ámbar y el rojo conservan su papel semántico.
const A_MARCA = new Set(['cyan', 'sky', 'teal', 'purple', 'violet', 'indigo', 'fuchsia'])
const SEMANTICAS = { blue: 'blue', emerald: 'emerald', green: 'emerald', amber: 'amber', yellow: 'amber', orange: 'amber', red: 'red', rose: 'red' }

/* Tonos claros del tema oscuro (300/400) → tonos legibles sobre blanco. */
const TEXTO_TONO = { 50: 700, 100: 700, 200: 700, 300: 700, 400: 600, 500: 600, 600: 600, 700: 700, 800: 800, 900: 900 }
/* Fondos translúcidos → tintes sólidos 50/100. */
const FONDO_TINTE = (a) => (a >= 20 ? 100 : 50)
const BORDE_TINTE = (a) => (a >= 30 ? 300 : 200)

/* ── Utilidades de tokenizado ────────────────────────────────────────── */
/** Parte por ':' solo a nivel 0 — `bg-[url(a:b)]` y `data-[x]:` no deben romperse. */
function partirVariantes(token) {
  const trozos = []
  let act = '', prof = 0
  for (const ch of token) {
    if (ch === '[' || ch === '(') prof++
    else if (ch === ']' || ch === ')') prof--
    if (ch === ':' && prof === 0) { trozos.push(act); act = '' } else act += ch
  }
  trozos.push(act)
  const base = trozos.pop()
  return { variantes: trozos, base }
}
const unir = (variantes, base) => [...variantes, base].join(':')

/** Separa el `/opacidad` final. El '/' solo se ignora cuando cae DENTRO de un
 *  valor arbitrario (`bg-[url(a/b)]`); si los corchetes ENVUELVEN la opacidad
 *  —`bg-white/[0.03]`, 328 usos en la app— sí hay que separarlo. */
function partirAlfa(base) {
  const i = base.lastIndexOf('/')
  if (i === -1) return { raiz: base, op: null }
  const ab = base.indexOf('['), ce = base.indexOf(']')
  if (ab !== -1 && ab < i && ce > i) return { raiz: base, op: null }
  return { raiz: base.slice(0, i), op: base.slice(i + 1) }
}

/* ═══════════════════════════════════════════════════════════════════════
   FASE 1 — Degradados
   El kit los prohíbe («no uses degradados»). Cada uno se colapsa al color
   sólido que representaba: los de marca al verde, los navy a blanco.
   ═══════════════════════════════════════════════════════════════════════ */
const ES_PARADA = (b) => /^(from|via|to)-/.test(b)

function colapsarDegradados(tokens) {
  if (!tokens.some((t) => /^(bg-gradient-to-|bg-linear-to-)/.test(partirVariantes(t).base))) return tokens

  const paradas = tokens.filter((t) => ES_PARADA(partirVariantes(t).base))
  const texto = paradas.map((t) => t).join(' ')
  const hexNavy = /\[#(0[0-9a-f]{5}|1[0-9a-f]{5})\]/i.test(texto)
  const oscuro = /-(gray|slate|zinc|neutral|stone)-(8|9)\d0\b/.test(texto) || hexNavy
  const calido = /-(amber|yellow|orange)-/.test(texto)
  const rojo = /-(red|rose)-/.test(texto)

  let solido
  if (oscuro && !/-(cyan|blue|sky|teal|purple|violet|indigo|emerald|green)-/.test(texto)) solido = 'bg-white'
  else if (rojo) solido = 'bg-red-500'
  else if (calido) solido = 'bg-amber-500'
  else solido = 'bg-primary-500'

  // Título con degradado recortado sobre el texto → un verde plano.
  const esTextoDegradado = tokens.includes('bg-clip-text') && tokens.includes('text-transparent')

  const teniaHover = paradas.some((t) => partirVariantes(t).variantes.includes('hover'))
  const salida = []
  for (const t of tokens) {
    const { base } = partirVariantes(t)
    if (/^(bg-gradient-to-|bg-linear-to-)/.test(base) || ES_PARADA(base)) continue
    if (esTextoDegradado && (base === 'bg-clip-text' || base === 'text-transparent')) continue
    salida.push(t)
  }
  if (esTextoDegradado) {
    salida.push(solido === 'bg-white' ? 'text-gray-900' : `text-${solido.slice(3)}`)
  } else {
    salida.push(solido)
    if (teniaHover && solido === 'bg-primary-500') salida.push('hover:bg-primary-600')
  }
  return salida
}

/* ═══════════════════════════════════════════════════════════════════════
   FASE 2 — Tokens sueltos
   ═══════════════════════════════════════════════════════════════════════ */
function mapearBase(base) {
  const { raiz, op } = partirAlfa(base)
  const m = /^([a-z-]+?)-(.+)$/.exec(raiz)
  if (!m) return base
  const prop = m[1]
  let valor = m[2]

  // `border-t-cyan-400` / `divide-y-white/10`: el lado va entre la propiedad y
  // el color, así que hay que apartarlo antes de leer la escala.
  let lado = ''
  if (prop === 'border' || prop === 'divide') {
    const L = /^(t|b|l|r|x|y|s|e|tl|tr|bl|br)-(.+)$/.exec(valor)
    if (L) { lado = `-${L[1]}`; valor = L[2] }
  }
  const propLado = prop + lado

  /* — Hexadecimales arbitrarios — */
  const hex = /^\[(#[0-9a-fA-F]{3,8})\]$/.exec(valor)
  if (hex) {
    const h = hex[1].toLowerCase()
    if (prop === 'bg') {
      if (SUPERFICIES[h]) return `bg-${SUPERFICIES[h]}`
      if (ACCIONES[h]) return `bg-${ACCIONES[h]}`
    }
    if (prop === 'ring' && SUPERFICIES[h]) return 'ring-gray-200'
    if (prop === 'border' && SUPERFICIES[h]) return `${propLado}-gray-200`
    return base
  }

  /* — Blanco translúcido: el andamiaje del tema oscuro — */
  if (valor === 'white' || raiz === `${prop}-white`) {
    if (op === null) {
      if (prop === 'border' || prop === 'divide') return `${propLado}-gray-300`
      return base // `bg-white` y `text-white` se resuelven en la fase 3
    }
    if (prop === 'text') return `text-${TEXTO_BLANCO(op)}`
    if (prop === 'bg') return `bg-${FONDO_BLANCO(op)}`
    if (prop === 'border') return `${propLado}-${BORDE_BLANCO(op)}`
    if (prop === 'divide') return `${propLado}-gray-100`
    if (prop === 'placeholder') return 'placeholder-gray-400'
    if (prop === 'ring') return alfa(op) >= 60 ? 'ring-gray-400' : 'ring-gray-300'
    if (prop === 'from' || prop === 'to' || prop === 'via') return `${prop}-gray-50`
  }

  /* — Velos de modal: negro puro → navy suave del kit — */
  if (valor === 'black' && prop === 'bg') return 'bg-gray-900/45'
  if (valor === 'black') return base

  /* — Escalas de color con tono — */
  const c = /^(cyan|sky|teal|purple|violet|indigo|fuchsia|blue|emerald|green|amber|yellow|orange|red|rose|pink|slate|gray|zinc|neutral)-(\d{2,3})$/.exec(valor)
  if (!c) return base
  const familia = c[1]
  const tono = parseInt(c[2], 10)

  /* Grises muy oscuros: eran paneles del tema oscuro. */
  if (['gray', 'slate', 'zinc', 'neutral', 'stone'].includes(familia)) {
    if (tono >= 800 && op === null) {
      if (prop === 'bg') return 'bg-white'
      if (prop === 'text') return 'text-gray-900'
      if (prop === 'border') return 'border-gray-200'
    }
    if (prop === 'text' && tono <= 200) return 'text-gray-900'
    if (prop === 'text' && tono <= 400 && familia === 'slate') return 'text-gray-500'
    return base // el resto del gris ya vive en claro
  }

  const destino = A_MARCA.has(familia) ? 'primary' : (SEMANTICAS[familia] ?? familia)
  const translucido = op !== null

  if (prop === 'shadow') return null // los glows de color se eliminan
  if (prop === 'text' || prop === 'fill' || prop === 'stroke' || prop === 'decoration') {
    return `${prop}-${destino}-${TEXTO_TONO[tono] ?? tono}`
  }
  if (prop === 'bg') {
    if (translucido) return `bg-${destino}-${FONDO_TINTE(alfa(op))}`
    if (tono <= 100) return `bg-${destino}-${tono}` // ya es un tinte claro
    return `bg-${destino}-${tono >= 600 ? 600 : 500}`
  }
  if (prop === 'border' || prop === 'divide' || prop === 'outline') {
    if (translucido) return `${propLado}-${destino}-${BORDE_TINTE(alfa(op))}`
    return `${propLado}-${destino}-500`
  }
  if (prop === 'ring') return `ring-${destino}-500`
  if (prop === 'accent' || prop === 'caret') return `${prop}-${destino}-500`
  if (prop === 'from' || prop === 'to' || prop === 'via') return `${prop}-${destino}-${translucido ? 100 : 500}`
  return base
}

/* — Forma y profundidad — */
const RADIOS = { '3xl': 'xl', '2xl': 'lg', xl: 'lg' }
function mapearForma(base) {
  // El kit prohíbe radios de 16-32 px: 2xl y 3xl se aplastan a 8 y 12 px.
  const r = /^rounded(-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?-(3xl|2xl|xl)$/.exec(base)
  if (r) return `rounded${r[1] ?? ''}-${RADIOS[r[2]]}`
  if (base === 'rounded') return 'rounded-md' // bare = 4px en Tailwind; Centrik pide 6
  // Sin cristal esmerilado (§2: «no glassmorphism»).
  if (/^backdrop-blur(-|$)/.test(base)) return null
  // Sombras arbitrarias: siempre eran glows de neón.
  if (/^shadow-\[/.test(base)) return null
  if (/^shadow-black\//.test(base)) return null
  return base
}

/* ═══════════════════════════════════════════════════════════════════════
   FASE 3 — Contextuales: `text-white` y el texto oscuro sobre acento
   ═══════════════════════════════════════════════════════════════════════ */
const FONDO_SOLIDO = /^bg-(primary|blue|emerald|green|amber|orange|yellow|red|rose|purple|violet|indigo|teal|cyan|sky|pink|fuchsia)-(4|5|6|7|8|9)00$/

function resolverContextuales(tokens, contexto = []) {
  const limpio = (t) => t.replace(/^!/, '')
  const sobreAcento = [...tokens, ...contexto].some((t) => {
    const { variantes, base } = partirVariantes(limpio(t))
    return variantes.length === 0 && FONDO_SOLIDO.test(limpio(base))
  })
  return tokens.map((t) => {
    const { variantes, base } = partirVariantes(t)
    const hex = /^text-\[(#[0-9a-fA-F]{6})\]$/.exec(base)
    const esBlanco = base === 'text-white'
    const esOscuroSobreAcento = hex && TEXTO_SOBRE_ACENTO.has(hex[1].toLowerCase())
    if (!esBlanco && !esOscuroSobreAcento) return t
    if (sobreAcento) return unir(variantes, 'text-white')
    return unir(variantes, esBlanco ? 'text-gray-900' : 'text-gray-900')
  })
}

/* ═══════════════════════════════════════════════════════════════════════
   Motor
   ═══════════════════════════════════════════════════════════════════════ */
// Un literal se trata como lista de clases solo si contiene algo que sabemos
// mapear. Así una frase en español nunca entra por accidente.
const DISPARADOR = /(^|\s)!?(?:[a-z-]+:)*!?(bg|text|border|ring|divide|placeholder|from|to|via|shadow|fill|stroke|accent|outline|decoration|caret|rounded|backdrop)-/

/** Fases 1 y 2: todo lo que no depende de las clases hermanas. */
function mapearTokens(entrada) {
  let tokens = colapsarDegradados(entrada)

  tokens = tokens.map((t) => {
    const externo = t.startsWith('!') ? '!' : ''
    const { variantes, base: crudo } = partirVariantes(externo ? t.slice(1) : t)
    const interno = crudo.startsWith('!') ? '!' : ''
    const base = interno ? crudo.slice(1) : crudo
    const bang = externo
    let nueva = mapearForma(base)
    if (nueva === null) return null
    nueva = mapearBase(nueva)
    if (nueva === null) return null
    return bang + unir(variantes, interno + nueva)
  }).filter(Boolean)

  return tokens
}

function transformarLista(texto, contexto = []) {
  const sangria = /^\s*/.exec(texto)[0]
  const cola = /\s*$/.exec(texto)[0]
  const bruto = texto.trim()
  if (!bruto) return texto

  let tokens = resolverContextuales(mapearTokens(bruto.split(/\s+/)), contexto)

  // Un mismo mapeo puede colapsar dos clases en una (p. ej. cyan-300 y cyan-400
  // acaban ambas en primary-600). Se deduplica conservando el orden.
  const vistos = new Set()
  tokens = tokens.filter((t) => (vistos.has(t) ? false : vistos.add(t)))

  return sangria + reflujo(tokens, texto) + cola
}

/** Un `className` repartido en varias líneas vuelve a repartirse: unir 20 clases
 *  en un renglón de 400 caracteres deja el archivo ilegible, y este cambio ya
 *  toca 200 pantallas. Se respeta la sangría que tenía la continuación. */
function reflujo(tokens, original) {
  const salto = original.indexOf('\n')
  if (salto === -1) return tokens.join(' ')
  const sangriaCont = (/\n([ \t]*)/.exec(original) ?? [, '  '])[1]
  const lineas = []
  let act = ''
  for (const t of tokens) {
    if (act && (act + ' ' + t).length > 96) { lineas.push(act); act = t } else act = act ? act + ' ' + t : t
  }
  if (act) lineas.push(act)
  return lineas.join('\n' + sangriaCont)
}

/* ═══════════════════════════════════════════════════════════════════════
   Lectura del código — con el analizador de TypeScript
   ───────────────────────────────────────────────────────────────────────
   Aquí hubo antes un lector escrito a mano, y se equivocó dos veces de la
   peor manera posible: en silencio. Primero tomó por plantilla la comilla
   invertida que vivía dentro de una expresión regular; después leyó el '/'
   de un `</span>` como el principio de otra regex. En ambos casos siguió
   «leyendo» código creyendo que era texto y lo reescribió: se perdieron
   palabras de la interfaz y se juntaron sentencias en una sola línea.

   Distinguir una división de una regex, o un cierre de etiqueta JSX de un
   comentario, es precisamente el trabajo de un analizador de verdad. El
   proyecto ya trae TypeScript, así que se usa: se piden los nodos de tipo
   cadena y solo se reescribe lo que hay DENTRO de ellos. El texto JSX, los
   comentarios y las regex quedan fuera de alcance por construcción, no por
   una heurística que haya que ir remendando.
   ═══════════════════════════════════════════════════════════════════════ */

const ES_CADENA = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
])

/** Tramo de código fuente ocupado por el CONTENIDO de la cadena, sin comillas
 *  ni delimitadores de interpolación. */
function tramoDeContenido(nodo) {
  const ini = nodo.getStart()
  const fin = nodo.getEnd()
  switch (nodo.kind) {
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      return [ini + 1, fin - 1]           //  "…"   '…'   `…`
    case ts.SyntaxKind.TemplateHead:
    case ts.SyntaxKind.TemplateMiddle:
      return [ini + 1, fin - 2]           //  `…${   }…${
    default:
      return [ini + 1, fin - 1]           //  }…`
  }
}

/** Las clases hermanas solo importan dentro de un mismo `className`, así que
 *  los literales se agrupan por el atributo JSX —o la plantilla— que los
 *  contiene. Es lo que permite saber que un `text-white` de un ternario está
 *  sobre el fondo verde que se declaró en el tramo estático. */
function ancestroDeGrupo(nodo) {
  for (let n = nodo.parent; n; n = n.parent) {
    if (ts.isJsxAttribute(n)) return n
    if (ts.isTemplateExpression(n)) return n
    if (ts.isPropertyAssignment(n) || ts.isVariableDeclaration(n)) return n
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isStatement(n)) return null
  }
  return null
}

function transformarFuente(ruta, texto) {
  const fuente = ts.createSourceFile(
    ruta, texto, ts.ScriptTarget.Latest, true,
    ruta.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  const grupos = new Map()
  const recorrer = (nodo) => {
    if (ES_CADENA.has(nodo.kind)) {
      const clave = ancestroDeGrupo(nodo) ?? nodo
      const lista = grupos.get(clave)
      if (lista) lista.push(nodo); else grupos.set(clave, [nodo])
    }
    nodo.forEachChild(recorrer)
  }
  fuente.forEachChild(recorrer)

  /** @type {{ini:number, fin:number, txt:string}[]} */
  const parches = []
  for (const nodos of grupos.values()) {
    const tramos = nodos.map((n) => {
      const [ini, fin] = tramoDeContenido(n)
      return { ini, fin, txt: texto.slice(ini, fin) }
    })
    const todo = tramos.map((t) => t.txt).join(' ')
    if (!DISPARADOR.test(todo)) continue

    const contexto = mapearTokens(todo.split(/\s+/).filter(Boolean))
    for (const t of tramos) {
      if (!DISPARADOR.test(t.txt)) continue
      const nuevo = transformarLista(t.txt, contexto)
      if (nuevo !== t.txt) parches.push({ ini: t.ini, fin: t.fin, txt: nuevo })
    }
  }

  if (!parches.length) return texto
  parches.sort((a, b) => b.ini - a.ini)          // de atrás hacia delante
  let salida = texto
  for (const p of parches) salida = salida.slice(0, p.ini) + p.txt + salida.slice(p.fin)
  return salida
}

/* ═══════════════════════════════════════════════════════════════════════
   Red de seguridad
   ───────────────────────────────────────────────────────────────────────
   Aunque el análisis ya sea correcto, se comprueba: se vuelve a analizar el
   resultado y se exige que la lista de posiciones de cadena y el número de
   nodos coincidan, y que fuera de las cadenas no haya cambiado ni un byte.
   Un archivo que no lo cumpla no se escribe.
   ═══════════════════════════════════════════════════════════════════════ */
function fueraDeCadenas(ruta, texto) {
  const fuente = ts.createSourceFile(
    ruta, texto, ts.ScriptTarget.Latest, true,
    ruta.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const tramos = []
  const recorrer = (n) => {
    if (ES_CADENA.has(n.kind)) tramos.push(tramoDeContenido(n))
    n.forEachChild(recorrer)
  }
  fuente.forEachChild(recorrer)
  tramos.sort((a, b) => a[0] - b[0])
  let salida = ''
  let cursor = 0
  for (const [ini, fin] of tramos) {
    if (ini < cursor) continue
    salida += texto.slice(cursor, ini) + ''
    cursor = fin
  }
  return salida + texto.slice(cursor)
}

/** Un archivo con errores de sintaxis nunca debe salir de aquí. */
function tieneErrores(ruta, texto) {
  const fuente = ts.createSourceFile(
    ruta, texto, ts.ScriptTarget.Latest, true,
    ruta.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  return fuente.parseDiagnostics?.length > 0
}

/* ── Ejecución ───────────────────────────────────────────────────────── */
const rutas = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const archivos = rutas.length
  ? rutas
  : execSync('git ls-files -- "src/*.tsx" "src/**/*.tsx" "src/*.ts" "src/**/*.ts"', { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean)
      .filter((f) => !/\.(test|spec)\.tsx?$/.test(f))

let cambiados = 0
const rechazados = []
for (const f of archivos) {
  const antes = readFileSync(f, 'utf8')
  if (tieneErrores(f, antes)) { rechazados.push([f, 'ya venía con errores de sintaxis']); continue }
  const despues = transformarFuente(f, antes)
  if (antes === despues) continue
  if (tieneErrores(f, despues)) { rechazados.push([f, 'el resultado no analiza']); continue }
  if (fueraDeCadenas(f, antes) !== fueraDeCadenas(f, despues)) {
    rechazados.push([f, 'cambió algo fuera de las cadenas'])
    continue
  }
  cambiados++
  if (!DRY) writeFileSync(f, despues)
}
console.log(`${DRY ? '[simulación] ' : ''}${cambiados} de ${archivos.length} archivos modificados`)
if (rechazados.length) {
  console.error(`\n${rechazados.length} archivo(s) NO se tocaron. Revisar a mano:`)
  for (const [f, motivo] of rechazados) console.error(`  · ${f} — ${motivo}`)
  process.exitCode = 1
}
