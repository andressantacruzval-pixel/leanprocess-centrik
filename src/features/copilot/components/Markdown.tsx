import { Fragment } from 'react'

// Renderizador Markdown mínimo y SEGURO (sin dependencias, sin dangerouslySetHTML).
// Soporta: encabezados (#, ##, ###), listas con viñetas y numeradas, tablas
// GitHub (| a | b |), citas (>), **negrita**, *cursiva* y `código`.
// Suficiente para respuestas tipo informe sin traer una librería al bundle.

type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'p'; text: string }

function splitCells(line: string): string[] {
  return line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
}
const isTableSep = (l: string) => /^\|?[\s:-]*-[\s:|-]*\|?$/.test(l) && l.includes('-')

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r/g, '').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) { blocks.push({ kind: 'h', level: h[1].length, text: h[2] }); i++; continue }

    // Tabla: cabecera + separador + filas
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const headers = splitCells(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitCells(lines[i])); i++
      }
      blocks.push({ kind: 'table', headers, rows }); continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++ }
      blocks.push({ kind: 'ul', items }); continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++ }
      blocks.push({ kind: 'ol', items }); continue
    }
    if (/^\s*>\s?/.test(line)) { blocks.push({ kind: 'quote', text: line.replace(/^\s*>\s?/, '') }); i++; continue }

    // Párrafo (junta líneas contiguas)
    const buf: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\s*[-*]\s|\s*\d+[.)]\s|\s*>\s)/.test(lines[i]) && !lines[i].includes('|')) {
      buf.push(lines[i]); i++
    }
    blocks.push({ kind: 'p', text: buf.join(' ') })
  }
  return blocks
}

// Inline: **negrita**, *cursiva*, `código`.
function Inline({ text }: { text: string }) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean)
  return (
    <>
      {tokens.map((t, i) => {
        if (t.startsWith('**') && t.endsWith('**')) return <strong key={i} className="font-semibold text-white">{t.slice(2, -2)}</strong>
        if (t.startsWith('`') && t.endsWith('`')) return <code key={i} className="px-1 py-0.5 rounded bg-white/10 text-cyan-200 text-[0.85em]">{t.slice(1, -1)}</code>
        if (t.startsWith('*') && t.endsWith('*')) return <em key={i} className="italic text-white/90">{t.slice(1, -1)}</em>
        return <Fragment key={i}>{t}</Fragment>
      })}
    </>
  )
}

export function Markdown({ text }: { text: string }) {
  if (!text) return null
  const blocks = parseBlocks(text)
  return (
    <div className="text-[13.5px] text-white/85 leading-relaxed space-y-2">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h': {
            const cls = b.level === 1 ? 'text-[15px] font-bold text-white' : b.level === 2 ? 'text-[14px] font-semibold text-white' : 'text-[13px] font-semibold text-white/90'
            return <p key={i} className={`${cls} mt-1`}><Inline text={b.text} /></p>
          }
          case 'ul': return <ul key={i} className="list-disc pl-5 space-y-0.5">{b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}</ul>
          case 'ol': return <ol key={i} className="list-decimal pl-5 space-y-0.5">{b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}</ol>
          case 'quote': return <blockquote key={i} className="border-l-2 border-cyan-500/40 pl-3 text-white/60 italic"><Inline text={b.text} /></blockquote>
          case 'table': return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr>{b.headers.map((h, j) => <th key={j} className="text-left font-semibold text-white/70 border-b border-white/15 px-2 py-1.5"><Inline text={h} /></th>)}</tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j} className="border-b border-white/5">{r.map((c, k) => <td key={k} className="px-2 py-1.5 text-white/70 align-top"><Inline text={c} /></td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
          default: return <p key={i}><Inline text={b.text} /></p>
        }
      })}
    </div>
  )
}
