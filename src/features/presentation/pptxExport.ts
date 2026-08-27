import pptxgen from 'pptxgenjs'
import type { Slide } from './presentationTypes'
import type { Macroprocess, Process } from '@/types/process'
import { addMapOverviewSlides } from './mapOverviewSlide'
import type { RiskItem } from '@/types/risk'
import type { StoredIndicator } from '@/stores/indicatorStore'
import type { ValueActivity } from '@/utils/valueAnalysis'
import type { AuditItem } from '@/lib/procedureAi'
import {
  type ImprovementOpportunity, priorityScore, priorityLabel,
  IMPROVEMENT_TYPE_LABELS, IMPROVEMENT_TYPE_OPTIONS,
} from '@/types/improvement'
import type { ProcessHealthMap } from '@/hooks/useProcessHealth'
import { type InformationAsset, assetLabel } from '@/types/asset'
import { type Application, techRisk, DEPLOYMENT_OPTIONS } from '@/types/application'

interface PptxExportData {
  macroprocesses: Macroprocess[]
  processes: Process[]
  risks: RiskItem[]
  indicators: StoredIndicator[]
  analyses: Record<string, ValueActivity[]>
  audits: Record<string, AuditItem[]>
  improvements: ImprovementOpportunity[]
  procedures: unknown[]
  healthMap: ProcessHealthMap
  assets: InformationAsset[]
  applications: Application[]
}

const deployLabelPptx = (v: string) => DEPLOYMENT_OPTIONS.find((o) => o.value === v)?.label ?? 'Sin definir'
const APP_RISK_HEX_PPTX: Record<string, string> = { bajo: '10B981', medio: 'F59E0B', alto: 'F97316', critico: 'DC2626' }

export async function exportPresentationToPptx(
  slides: Slide[],
  { macroprocesses, processes, risks, indicators, analyses, audits, improvements, procedures, healthMap, assets, applications }: PptxExportData,
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

      case 'audit-program': {
        pptSlide.addText('Programa de Auditoria', {
          x: 0.5, y: 0.4, w: 12.33, h: 0.8,
          fontSize: 32, fontFace: 'Arial', color: 'FFFFFF', bold: true, align: 'center',
        })
        const auditRows = Object.entries(audits).flatMap(([pid, items]) =>
          items.map((it) => ({ ...it, process: processes.find((p) => p.id === pid)?.name ?? '-' })))
        const aHead: pptxgen.TableRow = ['Proceso', 'Que auditar', 'Criterio', 'Frecuencia', 'Responsable'].map((t) => ({
          text: t, options: { bold: true, color: '9CA3AF', fontSize: 11, align: 'center' as const },
        }))
        const aData: pptxgen.TableRow[] = auditRows.slice(0, 14).map((r) => [
          { text: r.process, options: { color: 'FFFFFF', fontSize: 10 } },
          { text: r.queAuditar || r.actividad || '-', options: { color: 'D1D5DB', fontSize: 10 } },
          { text: r.criterio || '-', options: { color: 'D1D5DB', fontSize: 10 } },
          { text: r.frecuencia || '-', options: { color: '22D3EE', fontSize: 10, align: 'center' as const } },
          { text: r.responsable || '-', options: { color: 'D1D5DB', fontSize: 10 } },
        ])
        pptSlide.addTable([aHead, ...aData], {
          x: 0.3, y: 1.5, w: 12.73, h: 5.5, border: { type: 'solid', pt: 0.5, color: '1F2937' },
          colW: [2.6, 3.5, 3.4, 1.5, 1.73], rowH: 0.35, fontSize: 10, autoPage: false,
        })
        break
      }

      case 'improvements': {
        pptSlide.addText('Oportunidades de Mejora', {
          x: 0.5, y: 0.4, w: 12.33, h: 0.8,
          fontSize: 32, fontFace: 'Arial', color: 'FFFFFF', bold: true, align: 'center',
        })
        // Resumen por tipo (izquierda) + tabla de prioritarias (derecha)
        const byType = IMPROVEMENT_TYPE_OPTIONS
          .map((t) => ({ t, n: improvements.filter((o) => o.type === t).length }))
          .filter((x) => x.n > 0)
        byType.forEach((x, i) => {
          pptSlide.addText(`${IMPROVEMENT_TYPE_LABELS[x.t]}: ${x.n}`, {
            x: 0.5, y: 1.6 + i * 0.55, w: 3.6, h: 0.45, fontSize: 13, color: 'D1D5DB', fontFace: 'Arial',
          })
        })
        const iHead: pptxgen.TableRow = ['Oportunidad', 'Tipo', 'Prioridad', 'Estado', 'Avance'].map((t) => ({
          text: t, options: { bold: true, color: '9CA3AF', fontSize: 11, align: 'center' as const },
        }))
        const top = [...improvements].sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 12)
        const iData: pptxgen.TableRow[] = top.map((o) => [
          { text: o.name, options: { color: 'FFFFFF', fontSize: 10 } },
          { text: IMPROVEMENT_TYPE_LABELS[o.type], options: { color: 'D1D5DB', fontSize: 10 } },
          { text: `${priorityScore(o)}/15 ${priorityLabel(priorityScore(o)).label}`, options: { color: 'FBBF24', fontSize: 10, align: 'center' as const } },
          { text: o.status, options: { color: 'D1D5DB', fontSize: 10, align: 'center' as const } },
          { text: `${o.progressPct}%`, options: { color: '34D399', fontSize: 10, align: 'center' as const } },
        ])
        pptSlide.addTable([iHead, ...iData], {
          x: 4.3, y: 1.5, w: 8.73, h: 5.5, border: { type: 'solid', pt: 0.5, color: '1F2937' },
          colW: [3.2, 2.0, 1.83, 1.0, 0.7], rowH: 0.35, fontSize: 10, autoPage: false,
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

      case 'assets-overview': {
        pptSlide.addText('Activos de Informacion', {
          x: 0.5, y: 0.4, w: 12.33, h: 0.8,
          fontSize: 32, fontFace: 'Arial', color: 'FFFFFF', bold: true,
        })
        const conDP = assets.filter((a) => a.has_personal_data).length
        const critAlta = assets.filter((a) => (a.criticality ?? 0) >= 4).length
        const conProceso = assets.filter((a) => a.process_id).length
        pptSlide.addText(`${assets.length} activos · ${conDP} con datos personales · ${critAlta} de criticidad alta · ${conProceso} asignados a proceso`, {
          x: 0.5, y: 1.3, w: 12.33, h: 0.5, fontSize: 14, fontFace: 'Arial', color: '6B7280',
        })
        const aHead: pptxgen.TableRow = ['Activo', 'Tipo', 'Confidencialidad', 'Criticidad', 'Datos personales'].map((t) => ({
          text: t, options: { bold: true, color: '9CA3AF', fontSize: 11, align: 'center' as const },
        }))
        const topAssets = [...assets].sort((a, b) => (b.criticality ?? 0) - (a.criticality ?? 0)).slice(0, 14)
        const aData: pptxgen.TableRow[] = topAssets.map((a) => [
          { text: a.name, options: { color: 'FFFFFF', fontSize: 10 } },
          { text: a.asset_type || '-', options: { color: 'D1D5DB', fontSize: 10 } },
          { text: assetLabel(a.confidentiality) || '-', options: { color: 'D1D5DB', fontSize: 10, align: 'center' as const } },
          { text: a.criticality ? `${a.criticality}` : '-', options: { color: '22D3EE', fontSize: 10, align: 'center' as const } },
          { text: a.has_personal_data ? 'Si' : 'No', options: { color: a.has_personal_data ? 'F87171' : '6B7280', fontSize: 10, align: 'center' as const } },
        ])
        pptSlide.addTable([aHead, ...aData], {
          x: 0.3, y: 2.0, w: 12.73, h: 5.0, border: { type: 'solid', pt: 0.5, color: '1F2937' },
          colW: [4.0, 2.8, 2.4, 1.73, 1.8], rowH: 0.34, fontSize: 10, autoPage: false,
        })
        break
      }

      case 'applications-overview': {
        pptSlide.addText('Aplicaciones y Software', {
          x: 0.5, y: 0.4, w: 12.33, h: 0.8,
          fontSize: 32, fontFace: 'Arial', color: 'FFFFFF', bold: true,
        })
        const conApi = applications.filter((a) => a.has_api).length
        const cloud = applications.filter((a) => a.deployment?.startsWith('cloud')).length
        const withRisk = applications.map((a) => ({ app: a, risk: techRisk(a) }))
        const riesgoAlto = withRisk.filter((x) => x.risk.level === 'alto' || x.risk.level === 'critico').length
        pptSlide.addText(`${applications.length} aplicaciones · ${conApi} con API · ${cloud} en la nube · ${riesgoAlto} de riesgo tecnologico alto/critico`, {
          x: 0.5, y: 1.3, w: 12.33, h: 0.5, fontSize: 14, fontFace: 'Arial', color: '6B7280',
        })
        const pHead: pptxgen.TableRow = ['Aplicacion', 'Categoria', 'Proveedor', 'Despliegue', 'API', 'Riesgo'].map((t) => ({
          text: t, options: { bold: true, color: '9CA3AF', fontSize: 11, align: 'center' as const },
        }))
        const riskOrder: Record<string, number> = { critico: 4, alto: 3, medio: 2, bajo: 1 }
        const topApps = [...withRisk].sort((a, b) => (riskOrder[b.risk.level] ?? 0) - (riskOrder[a.risk.level] ?? 0)).slice(0, 14)
        const pData: pptxgen.TableRow[] = topApps.map(({ app, risk }) => [
          { text: app.name, options: { color: 'FFFFFF', fontSize: 10 } },
          { text: app.category || '-', options: { color: 'D1D5DB', fontSize: 10 } },
          { text: app.vendor || '-', options: { color: 'D1D5DB', fontSize: 10 } },
          { text: deployLabelPptx(app.deployment), options: { color: 'D1D5DB', fontSize: 10, align: 'center' as const } },
          { text: app.has_api ? 'Si' : 'No', options: { color: app.has_api ? '34D399' : '6B7280', fontSize: 10, align: 'center' as const } },
          { text: risk.label, options: { fill: { color: APP_RISK_HEX_PPTX[risk.level] ?? '6B7280' }, color: 'FFFFFF', fontSize: 10, bold: true, align: 'center' as const } },
        ])
        pptSlide.addTable([pHead, ...pData], {
          x: 0.3, y: 2.0, w: 12.73, h: 5.0, border: { type: 'solid', pt: 0.5, color: '1F2937' },
          colW: [3.2, 2.4, 2.4, 2.0, 1.0, 1.73], rowH: 0.34, fontSize: 10, autoPage: false,
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
