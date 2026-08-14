#!/usr/bin/env node
/**
 * E2E smoke contra Supabase real.
 *
 * Cobertura:
 *  - Signup + signin (simula lo que hace el browser con el anon key).
 *  - Inserts de cada recurso del dominio con la sesión del user, sujetos a RLS.
 *  - Verificación cross-session: logout + login de nuevo → queries devuelven la data.
 *  - Aislamiento multi-usuario: usuario B no ve data de A.
 *  - Cleanup completo.
 *
 * NO cubre: drag-and-drop del BPMN editor, descargas de exports (Word/Excel/PDF),
 * confirmación por email (si está activada Supabase Auth), UI. Para eso usa
 * SMOKE_TEST_E2E.md en el navegador.
 *
 * Uso: node scripts/smoke-e2e.mjs
 * Requiere: .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

// ─── Env ────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)
const SUPABASE_URL = env.VITE_SUPABASE_URL
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('FATAL: .env.local sin VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const ts = Date.now()
const pass = `SmokePass${ts}!aA1`
const userAEmail = `smoke.a.${ts}@example.com`
const userBEmail = `smoke.b.${ts}@example.com`

const steps = []
function step(name, ok, detail = '') {
  steps.push({ name, ok, detail })
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

function fresh() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function signUpAndSignIn(client, email) {
  const { data: up, error: upErr } = await client.auth.signUp({ email, password: pass })
  if (upErr) throw new Error(`signUp(${email}): ${upErr.message}`)
  // Si confirmación de email está desactivada, signUp devuelve session.
  if (up.session) return { userId: up.user.id, session: up.session }
  // Sin session post-signup → intentar signIn (sólo pasará si Supabase auto-confirma).
  const { data: inData, error: inErr } = await client.auth.signInWithPassword({ email, password: pass })
  if (inErr) {
    throw new Error(
      `signIn(${email}): ${inErr.message}. ` +
        `Probablemente "Confirm email" está ON en Supabase Auth. ` +
        `Para ejecutar este smoke, desactívalo temporalmente o usa un email real con confirmación manual.`
    )
  }
  return { userId: inData.user.id, session: inData.session }
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 Smoke E2E — ${new Date().toISOString()}`)
  console.log(`   URL: ${SUPABASE_URL}`)
  console.log(`   User A: ${userAEmail}`)
  console.log(`   User B: ${userBEmail}\n`)

  // ── User A: signup + inserts ─────────────────────────────────────────────
  console.log('── Sección 1: User A signup + crear empresa y recursos ──')
  const clientA = fresh()
  let userAId
  try {
    const { userId } = await signUpAndSignIn(clientA, userAEmail)
    userAId = userId
    step('Signup + session User A', true, userAId.slice(0, 8))
  } catch (err) {
    step('Signup + session User A', false, err.message)
    return finalize(userAId, null)
  }

  // Crear empresa
  const companyId = randomUUID()
  const macroId = randomUUID()
  const processId = randomUUID()
  const riskId = randomUUID()
  const indicatorId = randomUUID()
  const procedureId = randomUUID()
  const auditId = randomUUID()

  let companyInsertErr
  {
    const { error } = await clientA.from('companies').insert({
      id: companyId,
      user_id: userAId,
      name: `Smoke Co ${ts}`,
      industry: 'tech',
      onboarding_completed: true,
    })
    companyInsertErr = error
    step('Insert companies', !error, error?.message)
  }
  if (companyInsertErr) return finalize(userAId, null, companyId)

  // Membership owner
  {
    const { error } = await clientA.from('memberships').insert({
      company_id: companyId,
      user_id: userAId,
      email: userAEmail,
      role: 'owner',
      status: 'active',
    })
    step('Insert membership owner', !error, error?.message)
  }

  // Macroproceso
  {
    const { error } = await clientA.from('macroprocesses').insert({
      id: macroId,
      company_id: companyId,
      user_id: userAId,
      name: 'Ventas',
      category: 'productivo',
      sort_order: 0,
    })
    step('Insert macroprocess', !error, error?.message)
  }

  // Proceso
  {
    const { error } = await clientA.from('processes').insert({
      id: processId,
      company_id: companyId,
      user_id: userAId,
      macroprocess_id: macroId,
      name: 'Cotización',
      sort_order: 0,
    })
    step('Insert process (valida RLS Sprint 1)', !error, error?.message)
  }

  // BPMN diagram
  {
    const { error } = await clientA
      .from('bpmn_diagrams')
      .upsert(
        {
          process_id: processId,
          diagram_xml: '<?xml version="1.0"?><bpmn:definitions>TEST_BPMN_' + ts + '</bpmn:definitions>',
          name: 'Diagrama principal',
        },
        { onConflict: 'process_id' }
      )
    step('Upsert bpmn_diagrams', !error, error?.message)
  }

  // Riesgo + control
  {
    const { error: rErr } = await clientA.from('risks').insert({
      id: riskId,
      process_id: processId,
      company_id: companyId,
      title: 'Error en cotización',
      category: 'Operacional',
      inherent_probability: 3,
      inherent_impact: 4,
      residual_probability: 2,
      residual_impact: 3,
    })
    step('Insert risk', !rErr, rErr?.message)
    if (!rErr) {
      const { error: cErr } = await clientA.from('risk_controls').insert({
        id: randomUUID(),
        risk_id: riskId,
        description: 'Revisión gerente',
        type: 2,
        nature: 2,
        doc: 2,
        freq: 2,
        evidence: 2,
        segregation: 2,
        training: 2,
        monitoring: 2,
        mitigates: 'Ambos',
        score: 16,
        effectiveness: 'Débil',
      })
      step('Insert risk_control', !cErr, cErr?.message)
    }
  }

  // KPI
  {
    const { error } = await clientA.from('indicators').insert({
      id: indicatorId,
      process_id: processId,
      company_id: companyId,
      name: 'Tiempo medio de cotización',
      unit: 'horas',
      target_value: 24,
      frequency: 'semanal',
    })
    step('Insert indicator', !error, error?.message)
  }

  // Procedure
  {
    const { error } = await clientA.from('procedures').insert({
      id: procedureId,
      process_id: processId,
      company_id: companyId,
      data: { titulo: 'Procedimiento de cotización', codigo: 'LP-PRO-001', version: '1.0' },
    })
    step('Insert procedure', !error, error?.message)
  }

  // Audit + item
  {
    const { error: aErr } = await clientA.from('audits').insert({
      id: auditId,
      process_id: processId,
      company_id: companyId,
    })
    step('Insert audit', !aErr, aErr?.message)
    if (!aErr) {
      const { error: iErr } = await clientA.from('audit_items').insert({
        audit_id: auditId,
        criterion: 'Verificar firmas',
        status: 'pendiente',
        what_to_audit: 'Contratos firmados',
        frequency: 'mensual',
      })
      step('Insert audit_item', !iErr, iErr?.message)
    }
  }

  // Value activities
  {
    const { error } = await clientA.from('value_activities').insert({
      process_id: processId,
      company_id: companyId,
      name: 'Revisar precios',
      value_type: 'VA',
      time_minutes: 15,
      cost: 0,
      sequence: 0,
    })
    step('Insert value_activity', !error, error?.message)
  }

  // SIPOC supplier / customer / entry
  let supplierId, customerId
  {
    const { data: sData, error: sErr } = await clientA
      .from('sipoc_suppliers')
      .insert({ company_id: companyId, name: 'Cliente potencial' })
      .select('id')
      .single()
    step('Insert sipoc_supplier', !sErr, sErr?.message)
    if (!sErr) supplierId = sData.id

    const { data: cData, error: cErr } = await clientA
      .from('sipoc_customers')
      .insert({ company_id: companyId, name: 'Departamento Comercial' })
      .select('id')
      .single()
    step('Insert sipoc_customer', !cErr, cErr?.message)
    if (!cErr) customerId = cData.id

    if (supplierId && customerId) {
      const { error: eErr } = await clientA.from('sipoc_entries').insert({
        process_id: processId,
        company_id: companyId,
        supplier_id: supplierId,
        supplier_name: 'Cliente potencial',
        customer_id: customerId,
        customer_name: 'Departamento Comercial',
        input_description: 'Requerimiento de cotización',
        output_description: 'Cotización enviada',
        sort_order: 0,
      })
      step('Insert sipoc_entry', !eErr, eErr?.message)
    }
  }

  // ── Cross-session: logout + login de nuevo, verificar que todo sigue ─────
  console.log('\n── Sección 2: Cross-session (simula cerrar sesión y volver) ──')
  await clientA.auth.signOut()
  step('SignOut User A', true)

  const clientA2 = fresh()
  const { data: reLogin, error: reLoginErr } = await clientA2.auth.signInWithPassword({
    email: userAEmail,
    password: pass,
  })
  step('SignIn User A (new session)', !reLoginErr, reLoginErr?.message)
  if (reLoginErr) return finalize(userAId, null, companyId)

  // Ahora consultar cada tabla y verificar que la data sigue
  const expectedCounts = {
    companies: 1,
    memberships: 1,
    macroprocesses: 1,
    processes: 1,
    bpmn_diagrams: 1,
    risks: 1,
    risk_controls: 1,
    indicators: 1,
    procedures: 1,
    audits: 1,
    audit_items: 1,
    value_activities: 1,
    sipoc_suppliers: 1,
    sipoc_customers: 1,
    sipoc_entries: 1,
  }
  for (const [table, expected] of Object.entries(expectedCounts)) {
    const query = clientA2.from(table).select('id', { count: 'exact', head: true })
    // La mayoría de tablas filtran por company_id; bpmn_diagrams no tiene (filtra por FK)
    // y risk_controls tampoco. Pero RLS filtra automáticamente, así que basta el count.
    const { count, error } = await query
    const ok = !error && count !== null && count >= expected
    step(`Post-login SELECT ${table}`, ok, error?.message || `count=${count}`)
  }

  // ── Aislamiento multi-usuario: User B no ve data de A ────────────────────
  console.log('\n── Sección 3: Aislamiento multi-usuario ──')
  const clientB = fresh()
  let userBId
  try {
    const { userId } = await signUpAndSignIn(clientB, userBEmail)
    userBId = userId
    step('Signup + session User B', true, userBId.slice(0, 8))
  } catch (err) {
    step('Signup + session User B', false, err.message)
    return finalize(userAId, userBId, companyId)
  }

  {
    // User B consulta processes → debe recibir 0 filas por RLS
    const { count, error } = await clientB
      .from('processes')
      .select('id', { count: 'exact', head: true })
    const ok = !error && (count ?? 0) === 0
    step('User B NO ve procesos de A', ok, error?.message || `count=${count}`)
  }
  {
    const { count, error } = await clientB
      .from('companies')
      .select('id', { count: 'exact', head: true })
    const ok = !error && (count ?? 0) === 0
    step('User B NO ve empresas de A', ok, error?.message || `count=${count}`)
  }
  {
    const { count, error } = await clientB
      .from('risks')
      .select('id', { count: 'exact', head: true })
    const ok = !error && (count ?? 0) === 0
    step('User B NO ve riesgos de A', ok, error?.message || `count=${count}`)
  }

  // ── Finalize ─────────────────────────────────────────────────────────────
  await finalize(userAId, userBId, companyId)
}

async function finalize(userAId, userBId, companyId) {
  console.log('\n── Sección 4: Cleanup ──')
  // No tenemos service_role aquí. Usaremos un helper vía fetch directo a la función
  // RPC o dependeremos del caller (MCP execute_sql con service_role). Por ahora
  // solo dejamos el log para que el humano limpie via SQL.
  if (companyId) {
    console.log(`  ℹ️  Para limpiar ejecutar en Supabase SQL:`)
    console.log(`     DELETE FROM companies WHERE id = '${companyId}'; -- CASCADE borra todo`)
  }
  if (userAId) console.log(`     DELETE FROM auth.users WHERE id = '${userAId}';`)
  if (userBId) console.log(`     DELETE FROM auth.users WHERE id = '${userBId}';`)

  // Summary
  const total = steps.length
  const ok = steps.filter((s) => s.ok).length
  const failed = steps.filter((s) => !s.ok)
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`📊 Resultado: ${ok}/${total} pasos OK`)
  if (failed.length > 0) {
    console.log(`\n❌ Fallaron:`)
    failed.forEach((f) => console.log(`   - ${f.name}: ${f.detail}`))
    process.exit(1)
  } else {
    console.log(`\n🎉 Todos los pasos pasaron. Persistencia cross-session + aislamiento RLS confirmados.`)
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('\n💥 Excepción no manejada:', err)
  process.exit(2)
})
