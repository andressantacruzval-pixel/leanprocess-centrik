import pptxgen from 'pptxgenjs'
import type { Slide } from './presentationTypes'
import type { Macroprocess, Process } from '@/types/process'
import { addMapOverviewSlides } from './mapOverviewSlide'
import type { RiskItem } from '@/types/risk'
import type { StoredIndicator } from '@/stores/indicatorStore'
import type { ValueActivity } from '@/utils/valueAnalysis'
import type { ProcessHealthMap } from '@/hooks/useProcessHealth'

interface PptxExportData {
  macroprocesses: Macroprocess[]
  processes: Process[]
  risks: RiskItem[]
  indicators: StoredIndicator[]
  analyses: Record<string, ValueActivity[]>
  procedures: unknown[]
  healthMap: ProcessHealthMap
}

export async function exportPresentationToPptx(
  slides: Slide[],
  { macroprocesses, processes, risks, indicators, analyses, procedures, healthMap }: PptxExportData,
  companyName?: string,
): Promise<void> {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches (16:9)
  pptx.author = companyName || 'LeanProcess'
  pptx.title = companyName ? `${companyName} - Presentacion` : 'LeanProcess - Presentacion'

  const BG = '#070b14'

  for (const s of slides) {
    const pptSlide = pptx.addSlide()
    pptSlide.background = { color: BG }

    switch (s.type) {
      case 'title': {
        pptSlide.addText(companyName || 'LeanProcess', {
          x: 0.5, y: 2.0, w: 12.33, h: 1.2,
          fontSize: 44, fontFace: 'Arial', color: 'FFFFFF', bold: true, align: 'center',
        })
        pptSlide.addText('Gestion de Procesos', {
          x: 0.5, y: 3.3, w: 12.33, h: 0.8,
          fontSize: 22, fontFace: 'Arial', color: '9CA3AF', align: 'center',
        })
        pptSlide.addText(
          new Date().toLocaleDateString('es-EC', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          }), {
            x: 0.5, y: 4.5, w: 12.33, h: 0.6,
            fontSize: 16, fontFace: 'Arial', color: '6B7280', align: 'center',
          }
        )
        break
      }

      case 'map-overview': {
        addMapOverviewSlides(pptx, pptSlide, macroprocesses, processes)
        break
      }

      case 'macroprocess': {
        const { macro, children } = s.data as { macro: Macroprocess; children: Process[] }
        const catColors: Record<string, string> = { estrategico: '22D3EE', productivo: '34D399', apoyo: 'FBBF24' }
        const catLabels: Record<string, string> = { estrategico: 'Estrategico', productivo: 'Productivo', apoyo: 'Apoyo' }

        pptSlide.addText(`${catLabels[macro.category]} | ${macro.name}`, {
          x: 0.5, y: 0.4, w: 12.33, h: 0.8,
          fontSize: 28, fontFace: 'Arial', color: catColors[macro.category], bold: true,
        })

        if (children.length === 0) {
          pptSlide.addText('No hay subprocesos registrados.', {
            x: 0.5, y: 2.5, w: 12.33, h: 1.0,
            fontSize: 16, fontFace: 'Arial', color: '6B7280', align: 'center',
          })
        } else {
          const procList = children.map((p) =>
            p.code ? `${p.name} (${p.code})` : p.name
          ).join('\n')
          pptSlide.addText(procList, {
            x: 0.5, y: 1.5, w: 12.33, h: 5.5,
            fontSize: 14, fontFace: 'Arial', color: 'D1D5DB', valign: 'top',
            lineSpacingMultiple: 1.5,
          })
        }
        break
      }

      case 'risk-heatmap': {
        pptSlide.addText('Mapa de Calor de Riesgos', {
          x: 0.5, y: 0.4, w: 12.33, h: 0.8,
          fontSize: 32, fontFace: 'Arial', color: 'FFFFFF', bold: true,
        })

        let high = 0, medium = 0, low = 0
        for (const r of risks) {
          const prob = Math.max(1, Math.min(5, r.inherentProbability ?? 0))
          const imp = Math.max(1, Math.min(5, r.inherentImpact ?? 0))
          const score = prob * imp
          if (score >= 15) high++
          else if (score >= 5) medium++
          else low++
        }

        const riskSummary = [
          `Total de riesgos: ${risks.length}`,
          ``,
          `Alto (>=15): ${high} riesgos`,
          `Medio (5-14): ${medium} riesgos`,
          `Bajo (<5): ${low} riesgos`,
        ].join('\n')

        pptSlide.addText(riskSummary, {
          x: 0.5, y: 1.8, w: 12.33, h: 3.5,
          fontSize: 20, fontFace: 'Arial', color: 'D1D5DB', align: 'center', valign: 'middle',
          lineSpacingMultiple: 1.6,
        })

        const tableRows: pptxgen.TableRow[] = [
          [
            { text: `Alto: ${high}`, options: { fill: { color: 'DC2626' }, color: 'FFFFFF', fontSize: 14, bold: true, align: 'center' } },
            { text: `Medio: ${medium}`, options: { fill: { color: 'F59E0B' }, color: '111827', fontSize: 14, bold: true, align: 'center' } },
            { text: `Bajo: ${low}`, options: { fill: { color: '10B981' }, color: 'FFFFFF', fontSize: 14, bold: true, align: 'center' } },
          ],
        ]
        pptSlide.addTable(tableRows, {
          x: 2.5, y: 5.8, w: 8.33, h: 0.6,
          border: { type: 'none' },
        })
        break
      }

      case 'kpi-dashboard': {
        pptSlide.addText('Indicadores de Gestion', {
          x: 0.5, y: 0.4, w: 12.33, h: 0.8,
          fontSize: 32, fontFace: 'Arial', color: 'FFFFFF', bold: true,
        })

        const kpiByProcess: Record<string, { processName: string; kpis: string[] }> = {}
        for (const ind of indicators) {
          if (!kpiByProcess[ind.process_id]) {
            const proc = processes.find((p) => p.id === ind.process_id)
            kpiByProcess[ind.process_id] = { processName: proc?.name ?? 'Sin proceso', kpis: [] }
          }
          kpiByProcess[ind.process_id].kpis.push(ind.name)
        }

        const kpiText = Object.values(kpiByProcess).map((entry) =>
          `${entry.processName}: ${entry.kpis.join(', ')}`
        ).join('\n')

        pptSlide.addText(`${indicators.length} KPIs en ${Object.keys(kpiByProcess).length} procesos`, {
          x: 0.5, y: 1.3, w: 12.33, h: 0.5,
          fontSize: 14, fontFace: 'Arial', color: '6B7280',
        })

        pptSlide.addText(kpiText, {
          x: 0.5, y: 2.0, w: 12.33, h: 5.0,
          fontSize: 13, fontFace: 'Arial', color: 'D1D5DB', valign: 'top',
          lineSpacingMultiple: 1.5,
        })
        break
      }

      case 'value-analysis': {
        pptSlide.addText('Analisis de Valor', {
          x: 0.5, y: 0.4, w: 12.33, h: 0.8,
          fontSize: 32, fontFace: 'Arial', color: 'FFFFFF', bold: true,
        })

        const allActs = Object.values(analyses).flat()
        const vaCount = allActs.filter((a) => a.classification === 'VA').length
        const nvaCount = allActs.filter((a) => a.classification === 'NVA').length
        const nvaBnCount = allActs.filter((a) => a.classification === 'NVABN').length
        const classifiedTotal = vaCount + nvaCount + nvaBnCount
        const efficiency = classifiedTotal > 0 ? Math.round((vaCount / classifiedTotal) * 100) : 0

        pptSlide.addText(`${efficiency}%`, {
          x: 0.5, y: 1.8, w: 12.33, h: 1.5,
          fontSize: 60, fontFace: 'Arial', color: '34D399', bold: true, align: 'center',
        })
        pptSlide.addText('Eficiencia VA', {
          x: 0.5, y: 3.2, w: 12.33, h: 0.5,
          fontSize: 16, fontFace: 'Arial', color: '9CA3AF', align: 'center',
        })

        const vaTableRows: pptxgen.TableRow[] = [
          [
            { text: `VA: ${vaCount}`, options: { fill: { color: '059669' }, color: 'FFFFFF', fontSize: 14, bold: true, align: 'center' } },
            { text: `NVA: ${nvaCount}`, options: { fill: { color: 'DC2626' }, color: 'FFFFFF', fontSize: 14, bold: true, align: 'center' } },
            { text: `NVABN: ${nvaBnCount}`, options: { fill: { color: 'D97706' }, color: 'FFFFFF', fontSize: 14, bold: true, align: 'center' } },
          ],
        ]
        pptSlide.addTable(vaTableRows, {
          x: 2.5, y: 4.2, w: 8.33, h: 0.6,
          border: { type: 'none' },
        })

        pptSlide.addText(`${allActs.length} actividades totales`, {
          x: 0.5, y: 5.2, w: 12.33, h: 0.5,
          fontSize: 13, fontFace: 'Arial', color: '6B7280', align: 'center',
        })
        break
      }

      case 'coverage': {
        pptSlide.addText('Cobertura por Proceso', {
          x: 0.5, y: 0.4, w: 12.33, h: 0.8,
          fontSize: 32, fontFace: 'Arial', color: 'FFFFFF', bold: true,
        })

        const checkKeys = ['bpmn', 'procedure', 'kpis', 'risks', 'audit', 'valueAnalysis', 'improvements'] as const
        const checkLabelsMap: Record<string, string> = {
          bpmn: 'BPMN', procedure: 'Proced.', kpis: 'KPIs',
          risks: 'Riesgos', audit: 'Audit.', valueAnalysis: 'Valor', improvements: 'Mejoras',
        }

        const headerRow: pptxgen.TableRow = [
          { text: 'Proceso', options: { bold: true, color: '9CA3AF', fontSize: 11 } },
          ...checkKeys.map((k) => ({ text: checkLabelsMap[k], options: { bold: true, color: '9CA3AF', fontSize: 10, align: 'center' as const } })),
          { text: 'Madurez', options: { bold: true, color: '9CA3AF', fontSize: 10, align: 'center' as const } },
        ]

        const dataRows: pptxgen.TableRow[] = processes.slice(0, 15).map((p) => {
          const h = healthMap[p.id]
          return [
            { text: p.name, options: { color: 'FFFFFF', fontSize: 10 } },
            ...checkKeys.map((k) => ({
              text: h?.checks[k] ? '\u2713' : '\u2014',
              options: { color: h?.checks[k] ? '34D399' : '4B5563', fontSize: 11, align: 'center' as const },
            })),
            { text: `${h?.score ?? 0}%`, options: { color: (h?.score ?? 0) >= 80 ? '34D399' : (h?.score ?? 0) >= 50 ? 'FBBF24' : 'F87171', fontSize: 11, bold: true, align: 'center' as const } },
          ]
        })

        pptSlide.addTable([headerRow, ...dataRows], {
          x: 0.3, y: 1.5, w: 12.73, h: 5.5,
          border: { type: 'solid', pt: 0.5, color: '1F2937' },
          colW: [3.5, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2],
          rowH: 0.35,
          fontSize: 10,
          autoPage: false,
        })
        break
      }

      case 'org-stats': {
        pptSlide.addText('Estadisticas Organizacionales', {
          x: 0.5, y: 0.4, w: 12.33, h: 0.8,
          fontSize: 32, fontFace: 'Arial', color: 'FFFFFF', bold: true, align: 'center',
        })

        const orgAllActs = Object.values(analyses).flat()
        const orgVa = orgAllActs.filter((a) => a.classification === 'VA').length
        const orgClassified = orgAllActs.filter((a) => a.classification !== null).length
        const orgEfficiency = orgClassified > 0 ? Math.round((orgVa / orgClassified) * 100) : 0
        const healthScores = Object.values(healthMap)
        const avgHealth = healthScores.length > 0 ? Math.round(healthScores.reduce((sum, h) => sum + h.score, 0) / healthScores.length) : 0

        const statItems = [
          { label: 'Procesos', value: `${processes.length}`, color: '22D3EE' },
          { label: 'Riesgos', value: `${risks.length}`, color: 'F87171' },
          { label: 'KPIs', value: `${indicators.length}`, color: '34D399' },
          { label: 'Procedimientos', value: `${procedures.length}`, color: 'A78BFA' },
          { label: 'Eficiencia VA', value: `${orgEfficiency}%`, color: 'FBBF24' },
          { label: 'Madurez Promedio', value: `${avgHealth}%`, color: '22D3EE' },
        ]

        statItems.forEach((item, i) => {
          const col = i % 3
          const row = Math.floor(i / 3)
          const xPos = 0.8 + col * 4.2
          const yPos = 1.8 + row * 2.7

          pptSlide.addText(item.value, {
            x: xPos, y: yPos, w: 3.5, h: 1.2,
            fontSize: 48, fontFace: 'Arial', color: item.color, bold: true, align: 'center',
          })
          pptSlide.addText(item.label, {
            x: xPos, y: yPos + 1.2, w: 3.5, h: 0.5,
            fontSize: 16, fontFace: 'Arial', color: 'D1D5DB', align: 'center',
          })
        })
        break
      }

      case 'summary': {
        pptSlide.addText('Resumen Ejecutivo', {
          x: 0.5, y: 0.4, w: 12.33, h: 0.8,
          fontSize: 32, fontFace: 'Arial', color: 'FFFFFF', bold: true, align: 'center',
        })

        const summaryStats = [
          { label: 'Procesos', value: `${processes.length}`, color: '22D3EE' },
          { label: 'Riesgos', value: `${risks.length}`, color: 'F87171' },
          { label: 'KPIs', value: `${indicators.length}`, color: '34D399' },
          { label: 'Macroprocesos', value: `${macroprocesses.length}`, color: 'FBBF24' },
        ]

        summaryStats.forEach((item, i) => {
          const col = i % 2
          const row = Math.floor(i / 2)
          const xPos = 1.5 + col * 5.5
          const yPos = 2.0 + row * 2.5

          pptSlide.addText(item.value, {
            x: xPos, y: yPos, w: 4.5, h: 1.5,
            fontSize: 56, fontFace: 'Arial', color: item.color, bold: true, align: 'center',
          })
          pptSlide.addText(item.label, {
            x: xPos, y: yPos + 1.5, w: 4.5, h: 0.5,
            fontSize: 18, fontFace: 'Arial', color: '9CA3AF', align: 'center',
          })
        })
        break
      }
    }
  }

  await pptx.writeFile({ fileName: `${(companyName || 'LeanProcess').replace(/\s+/g, '_')} - Presentacion.pptx` })
}
