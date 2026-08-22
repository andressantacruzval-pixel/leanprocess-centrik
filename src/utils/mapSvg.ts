// Construcción del Mapa de Procesos Nivel 0 como SVG puro (vectorial), sin captura
// de pantalla: se dimensiona al CONTENIDO, así nunca sale cortado por más
// macroprocesos a los lados. Franjas Estratégicos / Productivos (cadena de valor
// con chevrons) / Apoyo, barras de cliente y encabezado/pie configurables. La
// paleta y la composición vienen de `MapBrand` (persistida en mapExportStore).

export interface MapData { org: string; E: string[]; P: string[]; A: string[] }
export interface MapBrand {
  cEst: string; cPro: string; cApo: string; accent: string
  theme: 'dark' | 'light'
  showHeader: boolean; showFooter: boolean; showClient: boolean; showNums: boolean
}
export interface MapMeta { scope?: string; version?: string; date?: string; author?: string; country?: string }

// ── color utils ────────────────────────────────────────────────────────────
function hex2rgb(h: string): [number, number, number] {
  let s = String(h || '#000').replace('#', '')
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  return [parseInt(s.slice(0, 2), 16) || 0, parseInt(s.slice(2, 4), 16) || 0, parseInt(s.slice(4, 6), 16) || 0]
}
function rgb2hex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}
function lum(h: string): number {
  const c = hex2rgb(h).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function ink(h: string): string { return lum(h) > 0.45 ? '#0A1410' : '#FFFFFF' }
function mix(h: string, t: string, a: number): string {
  const A = hex2rgb(h), B = hex2rgb(t)
  return rgb2hex(A[0] + (B[0] - A[0]) * a, A[1] + (B[1] - A[1]) * a, A[2] + (B[2] - A[2]) * a)
}
function readable(h: string, bgIsLight: boolean): string {
  if (bgIsLight) return lum(h) > 0.55 ? mix(h, '#000000', 0.32) : h
  return lum(h) < 0.16 ? mix(h, '#FFFFFF', 0.35) : h
}
interface Tokens { light: boolean; bg: string; box: string; text: string; sub: string; bandOp: number; line: string; head: string }
function themeTokens(theme: 'dark' | 'light'): Tokens {
  return theme === 'light'
    ? { light: true, bg: '#FFFFFF', box: '#FFFFFF', text: '#15211B', sub: '#5F7566', bandOp: 0.10, line: '#DCE5DF', head: '#0F1A14' }
    : { light: false, bg: '#07120C', box: '#0F2318', text: '#EAF6EC', sub: '#8FA894', bandOp: 0.07, line: 'rgba(231,244,233,0.14)', head: '#F4FBF5' }
}

const FONT = 'Segoe UI,Roboto,Helvetica,Arial,sans-serif'
function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
function wrapWords(t: string, maxChars: number, maxLines: number): string[] {
  const words = String(t || '').split(/\s+/).filter(Boolean)
  const lines: string[] = []; let cur = ''
  words.forEach((w) => { const test = (cur ? cur + ' ' : '') + w; if (test.length > maxChars && cur) { lines.push(cur); cur = w } else cur = test })
  if (cur) lines.push(cur)
  if (lines.length > maxLines) { const k = lines.slice(0, maxLines); k[maxLines - 1] = k[maxLines - 1].slice(0, Math.max(3, maxChars - 1)) + '…'; return k }
  return lines
}
function tspans(lines: string[], cx: number, cy: number, lh: number): string {
  const y0 = cy - ((lines.length - 1) * lh) / 2
  return lines.map((l, i) => `<tspan x="${cx}" y="${y0 + i * lh}">${esc(l)}</tspan>`).join('')
}
function chevPath(x: number, y: number, w: number, h: number, notch: number, first: boolean): string {
  let d = `M${x} ${y} L${x + w - notch} ${y} L${x + w} ${y + h / 2} L${x + w - notch} ${y + h} L${x} ${y + h}`
  if (!first) d += ` L${x + notch} ${y + h / 2}`
  return d + ' Z'
}

export function buildMapSvg(d: MapData, b: MapBrand, meta: MapMeta): { svg: string; w: number; h: number } {
  const T = themeTokens(b.theme)
  const cE = readable(b.cEst, T.light), cP = readable(b.cPro, T.light), cA = readable(b.cApo, T.light), cC = readable(b.accent, T.light)
  const M = 44, useCB = b.showClient, CB = useCB ? 92 : 0, GX = useCB ? 18 : 0
  const TITLE = 32, BOXH = 90, GAPB = 14, BPAD = 16, BGAP = 22, CHEVH = 118
  const contentW = Math.max(1180, d.P.length * 238)
  const contentX = M + (useCB ? CB + GX : 0)
  const totalW = contentX + contentW + (useCB ? GX + CB : 0) + M
  const HH = b.showHeader ? 104 : 0, FH = b.showFooter ? 60 : 0

  const rowsOf = (n: number) => { const maxPer = Math.max(3, Math.floor(contentW / 236)); const per = Math.min(n, maxPer) || 1; return { per, rows: Math.ceil(n / per) } }
  const rE = rowsOf(d.E.length), rA = rowsOf(d.A.length)
  const hBand = (r: number) => TITLE + BPAD + r * BOXH + (r - 1) * GAPB + BPAD
  const hE = hBand(rE.rows), hP = TITLE + BPAD + CHEVH + BPAD, hA = hBand(rA.rows)
  const yE = M + (HH ? HH + 14 : 0), yP = yE + hE + BGAP, yA = yP + hP + BGAP
  const totalH = yA + hA + (FH ? FH + 14 : 0) + M

  let s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" preserveAspectRatio="xMidYMid meet" font-family="${FONT}">`
  s += `<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${cC}"/></marker></defs>`
  s += `<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="${T.bg}"/>`

  if (HH) {
    const org = d.org || 'Organización'
    s += `<text x="${M}" y="${M + 34}" font-size="27" font-weight="800" fill="${T.head}">${esc(org)}</text>`
    const sub = 'MAPA DE PROCESOS NIVEL 0' + (meta.scope ? '  ·  ' + meta.scope.toUpperCase() : '')
    s += `<text x="${M}" y="${M + 62}" font-size="13" font-weight="700" letter-spacing="2.4" fill="${T.light ? (lum(cP) > 0.34 ? mix(cP, '#000000', 0.38) : cP) : cP}">${esc(sub)}</text>`
    const right: string[] = []; if (meta.version) right.push('v' + meta.version); if (meta.date) right.push(meta.date)
    if (right.length) s += `<text x="${totalW - M}" y="${M + 34}" text-anchor="end" font-size="13" font-weight="600" fill="${T.sub}">${esc(right.join('  ·  '))}</text>`
    s += `<line x1="${M}" y1="${M + HH - 16}" x2="${totalW - M}" y2="${M + HH - 16}" stroke="${T.line}" stroke-width="1.5"/>`
  }

  if (useCB) {
    const barTop = yE, barH = (yA + hA) - yE
    const cbar = (x: number, label: string, sub: string) => {
      let g = `<rect x="${x}" y="${barTop}" width="${CB}" height="${barH}" rx="14" fill="${cC}" fill-opacity="${T.light ? 0.13 : 0.10}" stroke="${cC}" stroke-opacity="0.55" stroke-width="2"/>`
      g += `<text transform="translate(${x + CB / 2},${barTop + barH / 2}) rotate(-90)" text-anchor="middle" font-size="21" font-weight="800" fill="${cC}">`
      g += `<tspan x="0" dy="-8">${esc(label)}</tspan><tspan x="0" dy="26" font-size="14" font-weight="600" fill="${mix(cC, T.light ? '#000000' : '#FFFFFF', 0.35)}">${esc(sub)}</tspan></text>`
      return g
    }
    s += cbar(M, 'CLIENTE', 'Necesidades y requisitos')
    s += cbar(contentX + contentW + GX, 'CLIENTE', 'Satisfacción')
    const ay = yP + hP / 2
    s += `<path d="M${M + CB + 2} ${ay} L${contentX - 4} ${ay}" stroke="${cC}" stroke-width="3" marker-end="url(#ar)"/>`
    s += `<path d="M${contentX + contentW + 4} ${ay} L${contentX + contentW + GX - 2} ${ay}" stroke="${cC}" stroke-width="3" marker-end="url(#ar)"/>`
  }

  const tcol = (c: string) => T.light ? (lum(c) > 0.34 ? mix(c, '#000000', 0.38) : c) : c
  const band = (y: number, h: number, color: string, title: string, sub: string) => {
    let g = `<rect x="${contentX - 10}" y="${y}" width="${contentW + 20}" height="${h}" rx="16" fill="${color}" fill-opacity="${T.bandOp}" stroke="${color}" stroke-opacity="0.34" stroke-width="1.5"/>`
    g += `<text x="${contentX + 4}" y="${y + 22}" font-size="14" font-weight="800" fill="${tcol(color)}" letter-spacing="2">${esc(title)}<tspan dx="20" font-size="12.5" font-weight="500" letter-spacing="0" fill="${T.sub}">${esc(sub)}</tspan></text>`
    return g
  }
  const boxes = (items: string[], y: number, color: string, rowinfo: { per: number; rows: number }) => {
    const fill = T.light ? mix(color, '#FFFFFF', 0.93) : T.box
    let g = ''; const per = rowinfo.per; let idx = 0, row = 0
    const bw = (contentW - (per - 1) * GAPB) / per
    while (idx < items.length) {
      const slice = items.slice(idx, idx + per); const cnt = slice.length
      const rowW = cnt * bw + (cnt - 1) * GAPB
      const x0 = contentX + (contentW - rowW) / 2
      const by = y + TITLE + BPAD + row * (BOXH + GAPB)
      slice.forEach((t, i) => {
        const bx = x0 + i * (bw + GAPB)
        g += `<rect x="${bx}" y="${by}" width="${bw}" height="${BOXH}" rx="12" fill="${fill}" stroke="${color}" stroke-width="2"/>`
        g += `<rect x="${bx}" y="${by}" width="${bw}" height="5" rx="2.5" fill="${color}"/>`
        const mc = Math.max(12, Math.floor(bw / 7.2))
        g += `<text text-anchor="middle" font-size="13.5" font-weight="600" fill="${T.text}">${tspans(wrapWords(t, mc, 3), bx + bw / 2, by + BOXH / 2 + 4, 16)}</text>`
      })
      idx += per; row++
    }
    return g
  }

  s += band(yE, hE, cE, 'ESTRATÉGICOS', 'Dirigen, deciden y evalúan')
  s += boxes(d.E, yE, cE, rE)

  s += band(yP, hP, cP, 'PRODUCTIVOS', 'Cadena de valor · en secuencia de operación →')
  {
    const n = Math.max(1, d.P.length), gap = 6, notch = 20
    const cw = (contentW - (n - 1) * gap) / n
    const cy0 = yP + TITLE + BPAD
    const chevFill = T.light ? mix(cP, '#FFFFFF', 0.90) : '#12331B'
    d.P.forEach((t, i) => {
      const cx = contentX + i * (cw + gap), first = i === 0
      s += `<path d="${chevPath(cx, cy0, cw, CHEVH, notch, first)}" fill="${chevFill}" stroke="${cP}" stroke-width="2.5"/>`
      let dy = 0
      if (b.showNums) {
        const nx = cx + (first ? 20 : notch + 16), ny = cy0 + 22
        s += `<circle cx="${nx}" cy="${ny}" r="13" fill="${cP}"/>`
        s += `<text x="${nx}" y="${ny + 5}" text-anchor="middle" font-size="14" font-weight="900" fill="${ink(cP)}">${i + 1}</text>`
        dy = 16
      }
      const tw = cw - notch - 24; const mc = Math.max(12, Math.floor(tw / 7))
      s += `<text text-anchor="middle" font-size="14" font-weight="700" fill="${T.text}">${tspans(wrapWords(t, mc, 3), cx + cw / 2 + (first ? 0 : notch / 2), cy0 + CHEVH / 2 + dy, 17)}</text>`
    })
  }

  s += band(yA, hA, cA, 'APOYO', 'Proveen recursos · su cliente es interno')
  s += boxes(d.A, yA, cA, rA)

  if (FH) {
    const fy = yA + hA + 14
    s += `<line x1="${M}" y1="${fy}" x2="${totalW - M}" y2="${fy}" stroke="${T.line}" stroke-width="1.5"/>`
    const L: string[] = []; if (meta.author) L.push('Elaborado por ' + meta.author); if (meta.country) L.push(meta.country)
    s += `<text x="${M}" y="${fy + 28}" font-size="12.5" font-weight="600" fill="${T.sub}">${esc(L.join('  ·  ') || 'LeanProcess')}</text>`
    const R: string[] = []; if (meta.version) R.push('Versión ' + meta.version); if (meta.date) R.push(meta.date); R.push('LeanProcess')
    s += `<text x="${totalW - M}" y="${fy + 28}" text-anchor="end" font-size="12.5" font-weight="600" fill="${T.sub}">${esc(R.join('  ·  '))}</text>`
  }

  s += `</svg>`
  return { svg: s, w: totalW, h: totalH }
}

// ── rasterización / descargas ───────────────────────────────────────────────
export function themeBg(theme: 'dark' | 'light'): string { return theme === 'light' ? '#FFFFFF' : '#07120C' }

function svgToImage(svgStr: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); res(img) }
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo rasterizar el mapa.')) }
    img.src = url
  })
}

export async function svgToPngCanvas(svg: string, w: number, h: number, theme: 'dark' | 'light'): Promise<HTMLCanvasElement> {
  const img = await svgToImage(svg)
  const sc = Math.min(3, Math.max(1.6, 2600 / w))
  const cv = document.createElement('canvas')
  cv.width = Math.round(w * sc); cv.height = Math.round(h * sc)
  const x = cv.getContext('2d')!
  x.fillStyle = themeBg(theme); x.fillRect(0, 0, cv.width, cv.height)
  x.drawImage(img, 0, 0, cv.width, cv.height)
  return cv
}
