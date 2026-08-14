import type { AdminMetrics } from '@/stores/analyticsStore'
import type { TabId } from './adminConstants'

export function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function generateCsvForTab(tab: TabId, metrics: AdminMetrics): string {
  switch (tab) {
    case 'users': {
      let csv = 'Metrica,Valor\n'
      csv += `Total Usuarios,${metrics.totalUsers}\n`
      csv += `DAU,${metrics.activeToday}\n`
      csv += `WAU,${metrics.activeThisWeek}\n`
      csv += `MAU,${metrics.activeThisMonth}\n`
      csv += `Trial Conversion,${metrics.trialConversion}%\n`
      csv += `Churn Mensual,${metrics.monthlyChurn}%\n`
      csv += '\nPlan,Usuarios\n'
      csv += `Free,${metrics.byPlan.free}\nCommunity,${metrics.byPlan.community}\nPro,${metrics.byPlan.pro}\nMax,${metrics.byPlan.max}\n`
      csv += '\nFecha,DAU\n'
      metrics.dailyActiveUsers.forEach(d => { csv += `${d.date},${d.count}\n` })
      return csv
    }
    case 'features': {
      let csv = 'Feature,Usuarios,Porcentaje\n'
      metrics.featureUsage.forEach(f => { csv += `${f.feature},${f.usersCount},${f.percentage}%\n` })
      csv += '\nFunnel de Conversion\nPaso,Cantidad,Porcentaje\n'
      metrics.conversionFunnel.forEach(s => { csv += `${s.step},${s.count},${s.percentage}%\n` })
      return csv
    }
    case 'engagement': {
      let csv = 'Metrica,Valor\n'
      csv += `Sesiones/Semana,${metrics.avgSessionsPerWeek}\n`
      csv += `Duracion Sesion (min),${metrics.avgSessionDuration}\n`
      csv += '\nDistribucion Procesos\nRango,Usuarios\n'
      metrics.processesPerUser.forEach(p => { csv += `${p.bucket},${p.count}\n` })
      csv += '\nUso IA\nFeature,Tokens Totales,Prom/Usuario\n'
      metrics.aiUsage.forEach(a => { csv += `${a.feature},${a.totalTokens},${a.avgPerUser}\n` })
      return csv
    }
    case 'revenue': {
      let csv = 'Metrica,Valor\n'
      csv += `MRR,$${metrics.mrr}\nARPU,$${metrics.arpu}\nLTV,$${metrics.ltv}\n`
      csv += '\nMes,MRR,Nuevo MRR,Churned MRR\n'
      metrics.revenueByMonth.forEach(r => { csv += `${r.month},${r.mrr},${r.newMrr},${r.churnedMrr}\n` })
      csv += '\nAdd-ons\nNombre,Cantidad,Revenue\n'
      metrics.addOnsSold.forEach(a => { csv += `${a.name},${a.count},$${a.revenue}\n` })
      return csv
    }
    case 'achievements':
      return 'ID,Titulo,Categoria,Puntos,Tier\n'
    case 'ai_usage':
      return 'Herramienta,Modelo,Tokens,Costo USD,Fecha\n'
    case 'user_detail': {
      let csv = 'Email,Empresa,Plan,Niveles,Macroprocesos,Procesos,Subprocesos,BPMN,Procedimientos,Riesgos,Indicadores,Auditorias,Analisis Valor,Tokens IA,Gasto USD\n'
      metrics.usersWithOnboarding.forEach(u => {
        csv += [
          u.email, u.companyName, u.plan,
          u.processLevelCount ?? 0, u.macroprocessCount ?? 0,
          u.topLevelProcessCount ?? 0, u.subprocessCount ?? 0,
          u.bpmnCount ?? 0, u.procedureCount ?? 0, u.riskCount ?? 0,
          u.indicatorCount ?? 0, u.auditCount ?? 0, u.valueActivityCount ?? 0,
          u.totalTokens ?? 0, u.totalAiCostUsd ?? 0,
        ].join(',') + '\n'
      })
      return csv
    }
    default:
      return ''
  }
}
