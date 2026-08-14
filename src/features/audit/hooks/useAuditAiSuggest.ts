import { useState, useCallback } from 'react'
import { toast } from '@/stores/toastStore'
import { suggestOneAuditItem } from '@/lib/auditAi'
import type { AuditItem } from '@/lib/procedureAi'
import type { TokenBudgetResult } from '@/hooks/useTokenBudget'
import { parseBpmnXml, bpmnToTextSummary } from '@/utils/bpmnParser'

interface UseAuditAiSuggestOptions {
  bpmnXml?: string
  processName: string
  companyName?: string
  existingItems: AuditItem[]
  auditBudget: TokenBudgetResult
  onSuggested: (item: AuditItem) => void
}

export function useAuditAiSuggest({
  bpmnXml,
  processName,
  companyName,
  existingItems,
  auditBudget,
  onSuggested,
}: UseAuditAiSuggestOptions) {
  const [isAiSuggesting, setIsAiSuggesting] = useState(false)

  const handleAiSuggestOne = useCallback(async () => {
    if (!bpmnXml) return
    setIsAiSuggesting(true)
    await auditBudget.run(async () => {
      const summary = bpmnToTextSummary(parseBpmnXml(bpmnXml))
      const suggestion = await suggestOneAuditItem(processName, summary, companyName, existingItems)
      if (suggestion) {
        onSuggested(suggestion)
      } else {
        toast.error('No se pudo generar la sugerencia. Intenta de nuevo.')
      }
    })
    setIsAiSuggesting(false)
  }, [bpmnXml, processName, companyName, existingItems, auditBudget, onSuggested])

  return { handleAiSuggestOne, isAiSuggesting }
}
