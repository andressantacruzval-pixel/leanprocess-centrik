/**
 * billingStore — STUB
 *
 * El sistema de créditos migró a profiles.credits (HUB LeanProcess Lite).
 * El descuento real ocurre en el Edge Function ai-proxy via consume_credits().
 * Este store se mantiene como stub para no romper importaciones existentes.
 */
import { create } from 'zustand'

export interface TokenWallet {
  userId: string
  monthlyAllocation: number
  used: number
  bonusBalance: number
  renewalDate: string
  planId: string
}

export interface TokenPackage {
  id: string
  name: string
  tokens: number
  priceUsd: number
  stripePriceId?: string
  active: boolean
}

export interface OperationCost {
  key: string
  tokens: number
  tier: 'simple' | 'media' | 'alta'
  description?: string
}

export interface TokenTransaction {
  id: string
  type: 'consume' | 'grant' | 'purchase' | 'renewal' | 'refund'
  tokens: number
  operationKey?: string
  priceUsd?: number
  note?: string
  createdAt: string
}

interface BillingState {
  wallet: TokenWallet | null
  packages: TokenPackage[]
  operationCosts: Record<string, OperationCost>
  recentTransactions: TokenTransaction[]
  addonPrices: Record<string, number>

  loadWallet: (userId: string) => Promise<void>
  loadPackages: () => Promise<void>
  loadOperationCosts: () => Promise<void>
  loadAddonPrices: () => Promise<void>
  consumeTokens: (operationKey: string, companyId?: string) => Promise<{ success: boolean; error?: string }>
  grantTokens: (userId: string, tokens: number, note?: string) => Promise<void>
  getAvailableTokens: () => number
  getCost: (operationKey: string) => number
  canAfford: (operationKey: string) => boolean
  getAddonPrice: (key: string) => number
}

// Espeja OPERATION_COSTS del Edge Function ai-proxy — mantener sincronizado
const STATIC_OPERATION_COSTS: Record<string, number> = {
  // Claves canónicas (igual que el Edge Function)
  bpmn_generation:       15,
  bpmn_interview:        20,
  procedure_generation:  15,
  risk_identification:   10,
  audit_generation:      10,
  kpi_generation:        10,
  value_classification:   5,
  ai_consultant:         10, // Copiloto: 10 tokens por interacción
  text_improvement:       2,
  // Aliases usados por componentes de la app
  process_objective:      5,
  procedure_from_bpmn:   15,
  procedure_from_context:15,
  risks_from_bpmn:       10,
  audit_recommendations: 10,
  indicators:            10,
  // Features con badge visible (economía de tokens)
  improvement_opportunities: 15, // Oportunidades de mejora
  activity_detail:            5, // Detallar una actividad del procedimiento con IA
  sipoc:                      5, // Asistente SIPOC: 5 por cada intercambio
  inventory:                 20, // Inventario de procesos con IA: por macroproceso
}

export const useBillingStore = create<BillingState>()(() => ({
  wallet: null,
  packages: [],
  operationCosts: {},
  recentTransactions: [],
  addonPrices: {},

  loadWallet: async () => {},
  loadPackages: async () => {},
  loadOperationCosts: async () => {},
  loadAddonPrices: async () => {},
  consumeTokens: async () => ({ success: true }),
  grantTokens: async () => {},
  getAvailableTokens: () => 9999,
  getCost: (operationKey: string) => STATIC_OPERATION_COSTS[operationKey] ?? 0,
  canAfford: () => true,
  getAddonPrice: () => 0,
}))
