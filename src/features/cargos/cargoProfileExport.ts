import { toCanvas } from 'html-to-image'
import jsPDF from 'jspdf'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from 'docx'
import { saveAs } from 'file-saver'
import type { CargoProfile } from './cargoProfile'

// Exporta el perfil de cargo. PDF = captura fiel de las 2 páginas A4 (html-to-image
// → jsPDF, mismo enfoque que el resto de exports visuales). DOCX = documento
// editable construido con docx.

export async function exportCargoProfilePdf(container: HTMLElement, fileName: string) {
  const pages = Array.from(container.querySelectorAll<HTMLElement>('.cargo-page'))
  if (!pages.length) return
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight()
  for (let i = 0; i < pages.length; i++) {
    const canvas = await toCanvas(pages[i], { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true })
    if (i > 0) pdf.addPage()
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, W, H)
  }
  pdf.save(fileName)
}

// ─── DOCX ───────────────────────────────────────────────────────────────────

const h = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 80 } })
const p = (text: string) => new Paragraph({ children: [new TextRun(text || '—')], spacing: { after: 80 } })
const bullets = (items: string[]) => (items.length ? items : ['—']).map((t) => new Paragraph({ text: t, bullet: { level: 0 } }))
const kv = (k: string, v: string) => new Paragraph({ children: [new TextRun({ text: `${k}: `, bold: true }), new TextRun(v || '—')], spacing: { after: 60 } })

export async function exportCargoProfileDocx(profile: CargoProfile, companyName: string, fileName: string) {
  const r = profile.requisitos
  const doc = new Document({
    creator: companyName || 'LeanProcess',
    title: `Manual de Cargo — ${profile.cargo}`,
    sections: [{
      children: [
        new Paragraph({ text: 'MANUAL DE CARGO', alignment: AlignmentType.CENTER, spacing: { after: 40 } }),
        new Paragraph({ text: profile.cargo, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 200 } }),

        h('Objetivo de la posición'), p(profile.objetivo),
        kv('Reporta a', profile.reportaA),

        h('Responsabilidades principales'), ...bullets(profile.responsabilidades),

        h('Perfil requerido'),
        kv('Educación', r.educacion),
        kv('Experiencia', r.experiencia),
        new Paragraph({ children: [new TextRun({ text: 'Conocimientos técnicos', bold: true })], spacing: { before: 80 } }),
        ...bullets(r.conocimientos),
        new Paragraph({ children: [new TextRun({ text: 'Tecnología y herramientas', bold: true })], spacing: { before: 80 } }),
        ...bullets(r.tecnologia),
        new Paragraph({ children: [new TextRun({ text: 'Competencias clave', bold: true })], spacing: { before: 80 } }),
        ...bullets(r.competencias),

        h('Relaciones internas'), ...bullets(profile.relacionesInternas),
        h('Relaciones externas'), ...bullets(profile.relacionesExternas),
        h('Indicadores de desempeño'), ...bullets(profile.indicadores),
      ],
    }],
  })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, fileName)
}
