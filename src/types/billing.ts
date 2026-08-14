/**
 * Billing / subscription domain types
 * -----------------------------------
 * Lean Process es B2C: cada usuario administra su propio portafolio de
 * empresas. El cobro se compone de una suscripcion base + add-ons por
 * empresa adicional y por miembro adicional dentro de cada empresa.
 *
 * Este modulo define los tipos base que luego puede consumir cualquier
 * pasarela de pago (Stripe, Paddle, etc). La forma de los objetos esta
 * pensada para mapear 1:1 con webhooks estandares.
 */

export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'paused'

export type BillingInterval = 'monthly' | 'yearly'

export type PaymentProvider = 'stripe' | 'paddle' | 'manual' | 'none'

/**
 * Tipos de add-on soportados. Cualquier cobro extra fuera del plan base
 * se modela como un add-on reutilizable para que agregar nuevos
 * (ej: "onboarding premium", "mas tokens IA") no requiera refactorizar.
 */
export type AddOnType =
  | 'extra_company'      // +1 empresa (1 onboarding adicional)
  | 'extra_member'       // +1 miembro en una empresa especifica
  | 'extra_ai_tokens'    // pack de tokens IA
  | 'priority_support'   // soporte prioritario

export interface AddOn {
  id: string
  user_id: string
  type: AddOnType
  /** Si el addon esta ligado a una empresa especifica (ej: extra_member). */
  company_id?: string | null
  quantity: number
  unit_price: number
  currency: string
  interval: BillingInterval
  status: 'active' | 'canceled' | 'pending_payment'
  provider: PaymentProvider
  /** Referencia al objeto del proveedor de pagos (ej: stripe subscription item id). */
  provider_ref?: string | null
  created_at: string
  updated_at: string
  canceled_at?: string | null
}

export interface Subscription {
  id: string
  user_id: string
  plan_id: string
  status: SubscriptionStatus
  interval: BillingInterval
  /** Precio del plan base, sin add-ons, en la moneda de referencia. */
  base_price: number
  currency: string
  provider: PaymentProvider
  provider_ref?: string | null
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  trial_ends_at?: string | null
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  user_id: string
  subscription_id: string
  number: string
  amount_total: number
  currency: string
  status: 'draft' | 'paid' | 'open' | 'void' | 'failed'
  period_start: string
  period_end: string
  provider: PaymentProvider
  provider_ref?: string | null
  pdf_url?: string | null
  created_at: string
}

/**
 * Resultado estandar cuando el UI intenta crear un recurso que puede
 * requerir un cobro adicional (empresa o miembro extra).
 * El componente que lo consume decide si abrir un modal de pago, redirigir
 * a Stripe Checkout, etc.
 */
export interface BillingGate {
  allowed: boolean
  /** true cuando se requiere procesar un cobro antes de crear el recurso. */
  requires_payment: boolean
  /** Monto que se agregaria al ciclo de facturacion. */
  addon_amount: number
  /** Moneda del cobro. */
  currency: string
  addon_type: AddOnType
  /** Razon legible para mostrar al usuario en caso de que allowed=false. */
  reason?: string
}
