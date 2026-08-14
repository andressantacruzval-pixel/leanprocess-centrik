// create-checkout-session — Edge Function para crear sesiones de pago Stripe.
// v0.2.0: modo simulado. Conectar SDK de Stripe en produccion.
// Deploy: supabase functions deploy create-checkout-session --project-ref bpqqtcpbjjlfcaiuselu

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('[create-checkout-session] Request:', JSON.stringify(body))

    // TODO en produccion: inicializar Stripe SDK con STRIPE_SECRET_KEY
    // const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
    // const session = await stripe.checkout.sessions.create({ ... })
    // return new Response(JSON.stringify({ url: session.url }), ...)

    // Simulacion v0.2.0 — retorna URL de billing con parametro de confirmacion
    const simulatedUrl = `/app/billing?payment=simulated&type=${body.type ?? 'unknown'}`

    return new Response(
      JSON.stringify({ url: simulatedUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
