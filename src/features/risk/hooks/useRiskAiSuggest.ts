import { useState, useCallback } from 'react'
import { toast } from '@/stores/toastStore'
import { suggestOneRisk } from '@/lib/riskAi'
import type { RiskItem } from '@/types/risk'
import type { TokenBudgetResult } from '@/hooks/useTokenBudget'

interface UseRiskAiSuggestOptions {
  bpmnXml?: string
  processName: string
  companyName?: string
  selectedRiskId: string | null
  risks: RiskItem[]
  riskBudget: TokenBudgetResult
  updateRisk: (id: string, updates: Partial<RiskItem>) => void
  addControl: (riskId: string, description?: string, bpmnElementId?: string) => void
}

export function useRiskAiSuggest({
  bpmnXml,
  processName,
  companyName,
  selectedRiskId,
  risks,
  riskBudget,
  updateRisk,
  addControl,
}: UseRiskAiSuggestOptions) {
  const [isAiSuggesting, setIsAiSuggesting] = useState(false)

  const handleAiSuggestOne = useCallback(async () => {
    if (!bpmnXml || !selectedRiskId) return
    setIsAiSuggesting(true)
    await riskBudget.run(async () => {
      const existingTitles = risks.map(r => r.title)
      const suggestion = await suggestOneRisk(bpmnXml, processName, companyName, existingTitles)
      if (suggestion) {
        updateRisk(selectedRiskId, {
          title: suggestion.title,
          description: suggestion.description,
          category: suggestion.category,
          processStep: suggestion.processStep,
          inherentProbability: suggestion.inherentProbability,
          inherentImpact: suggestion.inherentImpact,
        })
        for (const ctrl of suggestion.extractedControls) {
          addControl(selectedRiskId, ctrl.description, ctrl.bpmnElementId)
        }
      } else {
        toast.error('No se pudo generar la sugerencia. Intenta de nuevo.')
      }
    })
    setIsAiSuggesting(false)
  }, [bpmnXml, processName, companyName, selectedRiskId, risks, riskBudget, updateRisk, addControl])

  return { handleAiSuggestOne, isAiSuggesting }
}
