import { useState, useCallback } from 'react'
import { toast } from '@/stores/toastStore'
import { suggestOneIndicator } from '@/lib/claude'
import type { StoredIndicator } from '@/stores/indicatorStore'
import type { TokenBudgetResult } from '@/hooks/useTokenBudget'

interface UseIndicatorAiSuggestOptions {
  bpmnXml?: string
  processName: string
  companyName?: string
  selectedIndicatorId: string | null
  indicators: StoredIndicator[]
  indicatorBudget: TokenBudgetResult
  updateIndicator: (id: string, updates: Partial<StoredIndicator>) => void
}

export function useIndicatorAiSuggest({
  bpmnXml,
  processName,
  companyName,
  selectedIndicatorId,
  indicators,
  indicatorBudget,
  updateIndicator,
}: UseIndicatorAiSuggestOptions) {
  const [isAiSuggesting, setIsAiSuggesting] = useState(false)

  const handleAiSuggestOne = useCallback(async () => {
    if (!bpmnXml || !selectedIndicatorId) return
    setIsAiSuggesting(true)
    try {
      await indicatorBudget.run(async () => {
        const existingNames = indicators.map(i => i.name)
        const suggestion = await suggestOneIndicator(bpmnXml, processName, companyName, existingNames)
        if (suggestion) {
          updateIndicator(selectedIndicatorId, suggestion)
        } else {
          toast.error('No se pudo interpretar la respuesta de la IA. Intenta de nuevo.')
        }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al generar el indicador.'
      console.warn('[useIndicatorAiSuggest] error en generación IA:', msg)
      toast.error(msg)
    } finally {
      setIsAiSuggesting(false)
    }
  }, [bpmnXml, processName, companyName, selectedIndicatorId, indicators, indicatorBudget, updateIndicator])

  return { handleAiSuggestOne, isAiSuggesting }
}
