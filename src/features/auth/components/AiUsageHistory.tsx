import { useState, useEffect } from 'react'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const PAGE_SIZE = 20

const FEATURE_LABELS: Record<string, string> = {
  // Canónicas
  bpmn_generation:          'Generar BPMN',
  bpmn_interview:           'Entrevista BPMN',
  procedure_generation:     'Generar procedimiento',
  risk_identification:      'Identificar riesgos',
  audit_generation:         'Generar auditoría',
  kpi_generation:           'Generar indicadores',
  value_classification:     'Clasificar actividades VA/NVA',
  ai_consultant:            'Consultor IA',
  text_improvement:         'Mejorar texto',
  // Aliases de componentes
  process_objective:        'Objetivo del proceso',
  procedure_from_bpmn:      'Procedimiento desde BPMN',
  procedure_from_context:   'Procedimiento desde contexto',
  risks_from_bpmn:          'Riesgos desde BPMN',
  audit_recommendations:    'Recomendaciones de auditoría',
  indicators:               'Generar indicadores',
  // Mini-IAs internas
  kpi:                      'Sugerir indicador (IA)',
  procedure:                'Analizar diagrama para procedimiento',
  procedure_risks:          'Riesgos del procedimiento',
  risk:                     'Identificar riesgos',
  audit:                    'Sugerir ítem de auditoría',
  bpmn_preprocess:          'Preprocesar texto de proceso',
  improve_text:             'Mejorar texto',
  sipoc:                    'Generar SIPOC',
  bpmn_file_generation:     'BPMN desde archivo',
  bpmn_refinement:          'Refinar BPMN',
  process_description:      'Descripción del proceso',
  // Sesiones conversacionales
  flowchart_interview_turn: 'Diagramador IA (turno)',
  advisor_chat_turn:        'Asesor de proceso (turno)',
  process_map_onboarding:   'Onboarding mapa de procesos',
  unknown:                  'Operación de IA',
}

const OPERATION_COSTS: Record<string, number> = {
  // Canónicas
  bpmn_generation:          15,
  bpmn_interview:           20,
  procedure_generation:     15,
  risk_identification:      10,
  audit_generation:         10,
  kpi_generation:           10,
  value_classification:      5,
  ai_consultant:             3,
  text_improvement:          2,
  // Aliases de componentes
  process_objective:         5,
  procedure_from_bpmn:      15,
  procedure_from_context:   15,
  risks_from_bpmn:          10,
  audit_recommendations:    10,
  indicators:               10,
  // Mini-IAs internas
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
  // Sesiones conversacionales (por turno)
  flowchart_interview_turn:  3,
  advisor_chat_turn:         3,
  process_map_onboarding:    3,
  unknown:                   3,
}
const DEFAULT_CREDIT_COST = 3

interface UsageRow {
  id: string
  feature: string
  created_at: string
}

export function AiUsageHistory() {
  const user = useAuthStore((s) => s.user)
  const [rows, setRows] = useState<UsageRow[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [totalCredits, setTotalCredits] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    void loadPage(0)
    void loadTotal()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const loadTotal = async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('ai_usage_log')
      .select('feature')
      .eq('user_id', user.id)
    if (data) {
      const sum = data.reduce((acc, r) => acc + (OPERATION_COSTS[r.feature] ?? DEFAULT_CREDIT_COST), 0)
      setTotalCredits(sum)
    }
  }

  const loadPage = async (p: number) => {
    if (!user?.id) return
    setLoading(true)
    try {
      const offset = p * PAGE_SIZE
      const { data } = await supabase
        .from('ai_usage_log')
        .select('id, feature, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE)

      const items = (data ?? []) as UsageRow[]
      setRows(items.slice(0, PAGE_SIZE))
      setHasMore(items.length > PAGE_SIZE)
      setPage(p)
    } finally {
      setLoading(false)
    }
  }

  const getLabel = (feature: string): string =>
    FEATURE_LABELS[feature] ?? feature.replace(/_/g, ' ')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Uso de IA</h2>
        <p className="text-xs text-gray-500 mt-0.5">Historial de créditos consumidos por herramienta</p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-500 uppercase mb-0.5">Créditos usados (total histórico)</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{totalCredits.toLocaleString()}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-primary-600" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 text-[10px] uppercase">
                  <th className="text-left py-2 pr-4">Herramienta</th>
                  <th className="text-right py-2 pr-4">Créditos</th>
                  <th className="text-right py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 text-gray-600 hover:bg-gray-50">
                    <td className="py-2 pr-4">{getLabel(r.feature)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-red-600">
                      -{OPERATION_COSTS[r.feature] ?? DEFAULT_CREDIT_COST}
                    </td>
                    <td className="py-2 text-right text-gray-500">
                      {new Date(r.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-300">
                      Aún no has usado herramientas de IA
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {(page > 0 || hasMore) && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => loadPage(page - 1)}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={12} /> Anterior
              </button>
              <span className="text-xs text-gray-400">Pág. {page + 1}</span>
              <button
                onClick={() => loadPage(page + 1)}
                disabled={!hasMore}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente <ChevronRight size={12} />
              </button>
            </div>
          )}

          <p className="text-[10px] text-gray-300">Solo se muestran operaciones de IA registradas.</p>
        </>
      )}
    </div>
  )
}
