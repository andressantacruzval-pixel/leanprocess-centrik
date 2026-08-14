/**
 * stripe.ts — Interfaz cliente para pagos via Supabase Edge Functions.
 * En v0.2.0 las Edge Functions retornan URLs simuladas (modo scaffold).
 * En produccion, configurar STRIPE_SECRET_KEY en Supabase Secrets.
 */

import { supabase } from '@/lib/supabase'

export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

export const stripeService = {
  async createCheckoutSessionForPackage(userId: string, packageId: string): Promise<{ url: string }> {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { type: 'token_package', userId, packageId },
    })
    if (error) throw new Error(error.message)
    return data as { url: string }
  },

  async createCheckoutSessionForPlan(
    userId: string,
    planId: string,
    interval: 'monthly' | 'yearly'
  ): Promise<{ url: string }> {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { type: 'subscription', userId, planId, interval },
    })
    if (error) throw new Error(error.message)
    return data as { url: string }
  },

  async createPortalSession(userId: string): Promise<{ url: string }> {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { type: 'portal', userId },
    })
    if (error) throw new Error(error.message)
    return data as { url: string }
  },
}

// Backward-compat stubs for existing callers
export async function createCheckoutSession(planId: string, interval: 'monthly' | 'yearly') {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData?.session?.user?.id ?? ''
  return stripeService.createCheckoutSessionForPlan(userId, planId, interval)
}

export async function createPortalSession() {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData?.session?.user?.id ?? ''
  return stripeService.createPortalSession(userId)
}
