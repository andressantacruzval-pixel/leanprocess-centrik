/**
 * Pricing: unica fuente de verdad para los precios del producto.
 * -----------------------------------------------------------------
 * Cambiar un precio aqui lo cambia en toda la app (modales de pago,
 * settings, landing, facturas). Nunca hardcodear montos en componentes.
 *
 * El modelo B2C actual:
 *
 *  - Plan BASE (mensual): incluye 1 empresa + 1 owner.
 *  - Add-on EXTRA_COMPANY: $29.99/mes por cada empresa adicional. Cada
 *    empresa adicional abre un nuevo onboarding independiente.
 *  - Add-on EXTRA_MEMBER: $9.99/mes por cada miembro adicional DENTRO de
 *    una empresa. El owner siempre esta incluido.
 *
 * Este archivo expone ademas helpers (`evaluateCreateCompany`,
 * `evaluateInviteMember`, `estimateMonthlyTotal`) para que stores y UIs
 * compartan la misma logica de validacion.
 */

import type {
  AddOn,
  AddOnType,
  BillingGate,
  BillingInterval,
  Subscription,
} from '@/types/billing'

// ─── Constantes de precio ─────────────────────────────────────────────────

export const CURRENCY = 'USD'

/** Plan base (MVP: un solo plan). Se modelara como tabla en el futuro. */
export const BASE_PLAN = {
  id: 'plan_base_monthly',
  name: 'base',
  display_name: 'Lean Process',
  description: 'Incluye 1 empresa con onboarding y todas las funciones.',
  price_monthly: 19.99,
  price_yearly: 199.0,
  /** Miembros incluidos de serie por cada empresa (el owner siempre entra). */
  included_members_per_company: 1,
  /** Cantidad de empresas incluidas en el plan base. */
  included_companies: 1,
  currency: CURRENCY,
} as const

// La escalera de planes ya NO vive aqui: esta en `@/lib/plans`, derivada de
// `profiles.plan_level` (20/30/40/50 procesos, 1.000/2.000/3.000/4.000 tokens).
//
// Se retiraron `PLANS`, `PlanId`, `getPlanLimits` y `COMMUNITY_MAX_SUBPROCESSES`:
// describian otra escalera (free/community/pro/max con otros precios y otros
// topes), no la consumia nadie fuera de este archivo, y `PLANS.max` prometia
// "empresas ilimitadas" — justo lo que prohibe la decision del 2026-07-30.
// Ademas 'max' ni siquiera es un valor valido de `profiles.plan_type`, cuyo CHECK
// solo admite free | community | pro.

/** Precios de add-ons. Cambiar aqui propaga a toda la app. */
export const ADDON_PRICES: Record<AddOnType, number> = {
  extra_company: 29.99,
  extra_member: 9.99,
  extra_ai_tokens: 9.99,
  priority_support: 19.99,
}

export const ADDON_LABELS: Record<AddOnType, string> = {
  extra_company: 'Empresa adicional',
  extra_member: 'Miembro adicional',
  extra_ai_tokens: 'Tokens IA extra',
  priority_support: 'Soporte prioritario',
}

export const ADDON_DESCRIPTIONS: Record<AddOnType, string> = {
  extra_company:
    'Crea otra empresa con onboarding completo. Ideal para consultores o para quienes administran multiples negocios.',
  extra_member:
    'Invita a un miembro adicional dentro de una empresa para colaborar en procesos, indicadores y procedimientos.',
  extra_ai_tokens: 'Paquete adicional de tokens para el asistente IA.',
  priority_support: 'Atencion prioritaria via chat y correo.',
}

// ─── Helpers de formato ───────────────────────────────────────────────────

export function formatMoney(amount: number, currency = CURRENCY): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function getAddonPrice(type: AddOnType, interval: BillingInterval = 'monthly'): number {
  const monthly = ADDON_PRICES[type]
  return interval === 'yearly' ? Math.round(monthly * 12 * 0.85 * 100) / 100 : monthly
}

// ─── Evaluacion de billing gates ──────────────────────────────────────────

export interface CreateCompanyContext {
  currentCompanyCount: number
  hasActiveSubscription: boolean
}

/**
 * Decide si el usuario puede crear una nueva empresa ahora mismo.
 * - La primera empresa esta incluida en el plan base.
 * - A partir de la segunda, se requiere un cobro de extra_company.
 */
export function evaluateCreateCompany(ctx: CreateCompanyContext): BillingGate {
  if (!ctx.hasActiveSubscription) {
    return {
      allowed: false,
      requires_payment: true,
      addon_amount: BASE_PLAN.price_monthly,
      currency: CURRENCY,
      addon_type: 'extra_company',
      reason: 'Necesitas una suscripcion activa para crear tu primera empresa.',
    }
  }

  if (ctx.currentCompanyCount < BASE_PLAN.included_companies) {
    return {
      allowed: true,
      requires_payment: false,
      addon_amount: 0,
      currency: CURRENCY,
      addon_type: 'extra_company',
    }
  }

  return {
    allowed: true,
    requires_payment: true,
    addon_amount: ADDON_PRICES.extra_company,
    currency: CURRENCY,
    addon_type: 'extra_company',
  }
}

export interface InviteMemberContext {
  currentMemberCount: number // incluye al owner
  hasActiveSubscription: boolean
}

/**
 * Decide si invitar a otro miembro requiere cobro extra.
 * El owner esta incluido (1 miembro). A partir del 2do = extra_member.
 */
export function evaluateInviteMember(ctx: InviteMemberContext): BillingGate {
  if (!ctx.hasActiveSubscription) {
    return {
      allowed: false,
      requires_payment: true,
      addon_amount: 0,
      currency: CURRENCY,
      addon_type: 'extra_member',
      reason: 'Necesitas una suscripcion activa para invitar miembros.',
    }
  }

  if (ctx.currentMemberCount < BASE_PLAN.included_members_per_company) {
    return {
      allowed: true,
      requires_payment: false,
      addon_amount: 0,
      currency: CURRENCY,
      addon_type: 'extra_member',
    }
  }

  return {
    allowed: true,
    requires_payment: true,
    addon_amount: ADDON_PRICES.extra_member,
    currency: CURRENCY,
    addon_type: 'extra_member',
  }
}

// ─── Calculo de totales ───────────────────────────────────────────────────

export interface MonthlyTotalBreakdown {
  base: number
  extra_companies: { count: number; total: number }
  extra_members: { count: number; total: number }
  other_addons: { count: number; total: number }
  grand_total: number
  currency: string
}

export function estimateMonthlyTotal(
  subscription: Subscription | null,
  addOns: AddOn[]
): MonthlyTotalBreakdown {
  const base = subscription?.status === 'active' ? subscription.base_price : 0

  const active = addOns.filter((a) => a.status === 'active')

  const extraCompanies = active.filter((a) => a.type === 'extra_company')
  const extraMembers = active.filter((a) => a.type === 'extra_member')
  const other = active.filter(
    (a) => a.type !== 'extra_company' && a.type !== 'extra_member'
  )

  const sum = (items: AddOn[]) =>
    items.reduce((acc, a) => acc + a.unit_price * a.quantity, 0)

  const breakdown: MonthlyTotalBreakdown = {
    base,
    extra_companies: {
      count: extraCompanies.reduce((n, a) => n + a.quantity, 0),
      total: sum(extraCompanies),
    },
    extra_members: {
      count: extraMembers.reduce((n, a) => n + a.quantity, 0),
      total: sum(extraMembers),
    },
    other_addons: {
      count: other.reduce((n, a) => n + a.quantity, 0),
      total: sum(other),
    },
    grand_total: 0,
    currency: subscription?.currency ?? CURRENCY,
  }

  breakdown.grand_total =
    breakdown.base +
    breakdown.extra_companies.total +
    breakdown.extra_members.total +
    breakdown.other_addons.total

  return breakdown
}
