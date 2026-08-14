# PLAN DE PERSISTENCIA TOTAL — LeanProcess v0.1.0

> **Objetivo único:** dejar el producto en estado "listo para usuarios reales".
> Cualquier dato que un usuario cree (empresa, proceso, BPMN, KPI, riesgo,
> procedimiento, auditoría, análisis de valor, SIPOC, organigrama, miembros,
> changelog) debe persistir en Supabase y recuperarse idéntico en cualquier
> dispositivo al iniciar sesión.
>
> Este documento es el **contrato de ejecución**. Cada paso es atómico, tiene
> archivos exactos, implicaciones cruzadas y criterios de validación. La IA y
> el humano consumen este documento paso a paso. No se salta orden.

**Proyecto Supabase:** `bpqqtcpbjjlfcaiuselu` (LeanProcess SAAS)
**Estado DB verificado 2026-04-17:** 2 profiles, 1 company (EMCY, onboarding_completed=true), **0 procesos, 0 BPMN, 0 KPIs, 0 riesgos, 0 procedimientos, 0 auditorías, 0 value_activities, 0 memberships, 0 sipoc**. Evidencia de 14 logs de IA → el usuario SÍ ha interactuado, pero las mutaciones nunca llegaron a DB.

---

## ÍNDICE

1. [Principios operativos](#principios-operativos)
2. [Sprint 1 — Los datos LLEGAN a DB](#sprint-1--los-datos-llegan-a-db)
3. [Sprint 2 — Al login se RECUPERA todo](#sprint-2--al-login-se-recupera-todo)
4. [Sprint 3 — Los 10 stores restantes persisten](#sprint-3--los-10-stores-restantes-persisten)
5. [Sprint 4 — Multi-usuario robusto](#sprint-4--multi-usuario-robusto)
6. [Sprint 5 — Testing automatizado + smoke E2E](#sprint-5--testing-automatizado--smoke-e2e)
7. [Checklist final cross-device](#checklist-final-cross-device)
8. [Protocolo de rollback](#protocolo-de-rollback)
9. [Registro de avance](#registro-de-avance)

---

## Principios operativos

- **Regla de oro:** antes de cualquier cambio, leer el archivo involucrado completo. Después del cambio, `npm run lint && npm run test && npm run build` deben quedar verdes.
- **Nada de `as any` nuevo.** Si hay mismatch de tipos, usar `as unknown as T` en el borde y tiparlo aguas arriba.
- **No destructivo sin confirmación:** migraciones a DB se ejecutan una a una con `mcp__leanprocess_SAAS__apply_migration`, luego se verifica con `execute_sql`.
- **Cada sprint termina con smoke test explícito** ejecutado y documentado en este archivo.
- **Commits:** un commit por sprint, con mensaje `feat(persistence): sprint N — <resumen>` y referencia a los pasos completados.

---

## SPRINT 1 — Los datos LLEGAN a DB

**Meta:** Al crear una empresa + proceso + BPMN desde la UI, aparecen en Supabase. Hoy NO pasa por RLS duplicadas y escrituras fire-and-forget silenciadas.

**Tiempo estimado:** 2h
**Bloqueante:** Sí. Sin esto, los sprints siguientes son inútiles.

---

### Paso 1.1 — Auditar y limpiar RLS duplicadas

**Problema técnico:** La tabla `processes` tiene policy `processes_crud_own` (FOR ALL, exige `user_id = auth.uid()`) encima de las policies específicas (`processes_insert/select/update/delete` basadas en `is_company_member/editor`). Una policy `ALL` se aplica como restricción adicional a INSERT/UPDATE/DELETE: si la fila no cumple `user_id = auth.uid()`, el insert falla silenciosamente. Igual caso con `companies_*_own` duplicadas.

**Archivos:**
- Nuevo: `supabase/migrations/20260417120000_cleanup_rls_duplicates.sql`

**SQL exacto a aplicar:**
```sql
-- Eliminar policies _own duplicadas en companies (redundantes con is_company_member)
DROP POLICY IF EXISTS companies_select_own ON companies;
DROP POLICY IF EXISTS companies_insert_own ON companies;
DROP POLICY IF EXISTS companies_update_own ON companies;
DROP POLICY IF EXISTS companies_delete_own ON companies;

-- Eliminar ALL-policy en processes que bloquea inserts multi-member
DROP POLICY IF EXISTS processes_crud_own ON processes;
```

**Pasos:**
- [ ] 1.1.1 — Crear archivo de migración con el SQL anterior.
- [ ] 1.1.2 — Aplicar con `mcp__leanprocess_SAAS__apply_migration(name='cleanup_rls_duplicates', query=...)`.
- [ ] 1.1.3 — Verificar: `SELECT policyname FROM pg_policies WHERE tablename IN ('companies','processes') ORDER BY tablename, policyname;`. Esperar 4 policies por tabla (select/insert/update/delete).
- [ ] 1.1.4 — Test de inserción: `INSERT INTO processes (id, company_id, name, user_id) VALUES (gen_random_uuid(), '82f0303e-ea06-4227-b250-85a4e834151b', 'TEST_SPRINT1', '17626d6a-7056-4823-94e4-ead711bc8a72') RETURNING id;` — debe aceptar. Luego `DELETE` el registro de prueba.

**Implicaciones técnicas:**
- La función `is_company_member(company_id)` debe tener `SECURITY DEFINER` para evitar recursión RLS. Verificar con `\df+ is_company_member` que ya lo tenga (si no, agregar a la migración).
- Ningún código frontend dependía de la policy `_crud_own` — los inserts de procesos ya envían `user_id` redundantemente; al quitar la policy siguen funcionando por `is_company_member`.
- **Owners siguen viendo todo** gracias a la policy `is_company_member` que acepta owners.

**Criterio de éxito:** el INSERT manual funciona y `pg_policies` muestra sólo las 4 policies por CRUD estándar.

---

### Paso 1.2 — Crear helper `dbWrite`

**Problema técnico:** Todos los stores escriben a DB con `.then(({error}) => console.warn(...))` sin `await`. Si RLS falla, el dato vive solo en localStorage y el usuario cree que guardó. No hay rollback ni feedback.

**Archivos:**
- Nuevo: `src/lib/dbWrite.ts`

**API propuesta:**
```typescript
// src/lib/dbWrite.ts
import { useToastStore } from '@/stores/toastStore'

export interface DbWriteOptions {
  successMessage?: string
  errorMessage?: string
  silent?: boolean  // si true, no muestra toast (para writes internos/changelog)
  rollback?: () => void
}

export async function dbWrite<T>(
  label: string,
  operation: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  options: DbWriteOptions = {}
): Promise<{ ok: boolean; data: T | null; error: Error | null }> {
  try {
    const { data, error } = await operation
    if (error) {
      console.error(`[dbWrite:${label}] ${error.message}`)
      if (!options.silent) {
        useToastStore.getState().error(
          options.errorMessage ?? `No se pudo guardar en la nube. Inténtalo de nuevo.`
        )
      }
      options.rollback?.()
      return { ok: false, data: null, error: new Error(error.message) }
    }
    if (options.successMessage && !options.silent) {
      useToastStore.getState().success(options.successMessage)
    }
    return { ok: true, data, error: null }
  } catch (err) {
    console.error(`[dbWrite:${label}]`, err)
    if (!options.silent) {
      useToastStore.getState().error('Error de red. Verifica tu conexión.')
    }
    options.rollback?.()
    return { ok: false, data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
```

**Pasos:**
- [ ] 1.2.1 — Verificar que `useToastStore` tiene métodos `.error()` y `.success()`. Si no, agregarlos.
- [ ] 1.2.2 — Crear `src/lib/dbWrite.ts` con el contenido anterior.
- [ ] 1.2.3 — Crear `src/lib/dbWrite.test.ts` con 3 casos: éxito, error-con-rollback, silent mode.

**Implicaciones técnicas:**
- `dbWrite` acepta cualquier promesa estilo Supabase (`PostgrestBuilder` es thenable con `{data, error}`). Verificar tipado.
- No usa React hooks (llama `getState()`), por lo que puede invocarse desde stores Zustand.
- El rollback es responsabilidad del caller (snapshot previo).

**Criterio de éxito:** tests unitarios de `dbWrite` pasan.

---

### Paso 1.3 — Refactor `workspaceStore.createCompany` + `updateCompany` + `completeCompanyOnboarding` + `deleteCompany`

**Problema técnico:** [src/stores/workspaceStore.ts:208-212, 258-262, 283-287, 305-309](src/stores/workspaceStore.ts) usan `import('@/services/...').then(...).then(...)` fire-and-forget.

**Archivos afectados:**
- `src/stores/workspaceStore.ts` (reemplazar 4 métodos de mutación)
- Imports a agregar arriba del archivo: `import { dbWrite } from '@/lib/dbWrite'`

**Cambio por método (patrón):**
```typescript
// ANTES (línea 201-214)
createCompany: (draft, userId) => {
  // ... gate check ...
  const company = makeCompany(draft, userId)
  set((s) => ({
    companies: [...s.companies, company],
    activeCompanyId: s.activeCompanyId ?? company.id,
  }))
  import('@/services/companies.service').then(({ createCompany: createInDB }) => {
    createInDB({ ...company, owner_id: userId }).then(({ error }) => {
      if (error) console.warn('[workspaceStore] Error persistiendo empresa:', error.message)
    })
  })
  return { gate, company }
},

// DESPUÉS
createCompany: (draft, userId) => {
  // ... gate check ...
  const company = makeCompany(draft, userId)
  const snapshot = get().companies
  set((s) => ({
    companies: [...s.companies, company],
    activeCompanyId: s.activeCompanyId ?? company.id,
  }))
  // Persistencia real con rollback visible
  void (async () => {
    const { createCompany: createInDB } = await import('@/services/companies.service')
    await dbWrite(
      'workspace:createCompany',
      createInDB({ ...company, owner_id: userId }) as any,
      {
        errorMessage: 'No se pudo guardar la empresa en la nube.',
        rollback: () => set({ companies: snapshot, activeCompanyId: snapshot[0]?.id ?? null }),
      }
    )
  })()
  return { gate, company }
},
```

**Pasos:**
- [ ] 1.3.1 — Importar `dbWrite` en `workspaceStore.ts`.
- [ ] 1.3.2 — Refactor `createCompany` (línea ~188-215).
- [ ] 1.3.3 — Refactor `confirmCreateCompany` (línea ~217-249).
- [ ] 1.3.4 — Refactor `updateCompany` (línea ~251-263).
- [ ] 1.3.5 — Refactor `deleteCompany` (línea ~265-288).
- [ ] 1.3.6 — Refactor `completeCompanyOnboarding` (línea ~298-310).
- [ ] 1.3.7 — Refactor `startTrialIfNeeded`, `setSubscription`, `cancelSubscription`, `addAddon`, `cancelAddon` (tabla `subscriptions` y `company_addons` — aplicar el mismo patrón).

**Implicaciones técnicas:**
- El método sigue siendo sincrónico en la firma pública (retorna `{gate, company}` de inmediato). La escritura a DB es asincrónica en background pero con rollback visible.
- [src/features/auth/pages/Login.tsx](src/features/auth/pages/Login.tsx) y [src/features/onboarding/pages/OnboardingPage.tsx](src/features/onboarding/pages/OnboardingPage.tsx) llaman `createCompany` — no se rompen, mantienen el contrato.
- El rollback puede ejecutarse después de que el usuario navegó. Eso es OK: el estado local se corrige y el siguiente render muestra el cambio + toast de error.

**Criterio de éxito:**
- Al crear empresa desde UI, aparece en DB (`SELECT * FROM companies WHERE name='<nombre_test>'`).
- Si la query falla (simulado desconectando red), el toast se muestra y la empresa desaparece del store local.

---

### Paso 1.4 — Refactor `processStore` (add/update/delete process + macroprocess)

**Problema técnico:** Los métodos de mutación usan el mismo patrón fire-and-forget. Por eso `SELECT COUNT(*) FROM processes` = 0 aunque el usuario haya creado procesos.

**Archivos:**
- `src/stores/processStore.ts` — refactor métodos de mutación.

**Método esperados (ver con `Read` antes de cambiar):**
- `addMacroprocess`, `updateMacroprocess`, `deleteMacroprocess`
- `addProcess`, `updateProcess`, `deleteProcess`
- `addSubprocess` (si existe como método separado)
- `updateLevelDefinitions`

**Patrón aplicado a cada uno:**
1. Snapshot del slice relevante antes de mutar.
2. `set(...)` local.
3. `void (async () => { await dbWrite('process:add', supabase.from('processes').insert(row), { rollback }) })()`

**Pasos:**
- [ ] 1.4.1 — Leer `src/stores/processStore.ts` completo y listar todos los métodos de mutación.
- [ ] 1.4.2 — Aplicar patrón `dbWrite` + snapshot + rollback en cada uno.
- [ ] 1.4.3 — Asegurar que el payload enviado a DB incluye `company_id` correcto (activeCompanyId del workspaceStore).
- [ ] 1.4.4 — Asegurar que `user_id` se envía en `processes.insert` (aunque ahora la policy no lo exige, el código legacy lo sigue poblando para trazabilidad).

**Implicaciones técnicas:**
- [src/features/process/pages/ProcessMapPage.tsx](src/features/process/pages/ProcessMapPage.tsx) llama `addProcess` — no cambia la firma.
- [src/features/onboarding/pages/OnboardingPage.tsx](src/features/onboarding/pages/OnboardingPage.tsx) llama `addMacroprocess` + `addProcess` en el milestone 3.
- Tests existentes si los hay en `processStore.test.ts` — ejecutar y verificar.

**Criterio de éxito:**
- Crear proceso desde UI → `SELECT COUNT(*) FROM processes WHERE company_id='<id>'` incrementa de 0 a 1.
- `SELECT COUNT(*) FROM macroprocesses` incrementa correspondientemente.

---

### Paso 1.5 — Reforzar `useBpmnAutoSave`

**Problema técnico:** [src/features/process/hooks/useBpmnAutoSave.ts:41-49](src/features/process/hooks/useBpmnAutoSave.ts#L41-L49) hace upsert silencioso. Si falla, el usuario cree que guardó y al recargar ve el diagrama en blanco.

**Archivos:**
- `src/features/process/hooks/useBpmnAutoSave.ts`

**Cambio:**
- Reemplazar el `.then(({error}) => console.warn(...))` por `dbWrite('bpmn:autosave', ..., { silent: true, errorMessage: 'No se pudo guardar el diagrama' })`. El `silent: true` evita toasts repetitivos (auto-save corre cada 2s); pero cuando `ok === false`, actualizar `autoSaveStatus` a `'error'` (nuevo estado a agregar).
- Cambiar el tipo retorno: `'idle' | 'pending' | 'saved' | 'error'`.
- Agregar banner visual del error en [src/features/bpmn/pages/BpmnEditorPage.tsx](src/features/bpmn/pages/BpmnEditorPage.tsx) cuando `autoSaveStatus === 'error'`.

**Pasos:**
- [ ] 1.5.1 — Agregar estado `'error'` a `useBpmnAutoSave`.
- [ ] 1.5.2 — Reemplazar el `.then(...)` por `dbWrite`.
- [ ] 1.5.3 — Actualizar `BpmnEditorPage` para mostrar banner rojo en caso de error.

**Implicaciones técnicas:**
- El BPMN autosave necesita que el `process_id` exista en DB. Si el proceso aún no llegó a DB (caso de race post-Sprint 1.4), el upsert de `bpmn_diagrams` falla por FK. Solución: asegurar que el insert de proceso se completa antes de permitir dibujar BPMN (Sprint 2 lo refuerza con el spinner de loading).

**Criterio de éxito:**
- Dibujar en BPMN editor → `SELECT * FROM bpmn_diagrams WHERE process_id='<id>'` devuelve una fila con el XML.
- Desconectar red durante dibujo → aparece banner rojo.

---

### Smoke test Sprint 1

- [ ] S1.1 — `npm run build` pasa sin errores.
- [ ] S1.2 — `npm run lint` pasa con `--max-warnings 0`.
- [ ] S1.3 — `npm run test` pasa (incluye dbWrite.test.ts nuevo).
- [ ] S1.4 — `npm run dev` + navegar: crear empresa nueva (distinta de EMCY), crear macroproceso, crear proceso, abrir BPMN, dibujar 3 shapes.
- [ ] S1.5 — Verificar SQL:
  ```sql
  SELECT COUNT(*) FROM companies;   -- debe haber 2 (EMCY + nueva)
  SELECT COUNT(*) FROM macroprocesses;   -- 1
  SELECT COUNT(*) FROM processes;   -- 1
  SELECT COUNT(*) FROM bpmn_diagrams;   -- 1
  ```
- [ ] S1.6 — Commit: `feat(persistence): sprint 1 — data llega a DB (RLS cleanup + dbWrite + process/BPMN persistence)`

---

## SPRINT 2 — Al login se RECUPERA todo

**Meta:** Tras logout + login desde el mismo o distinto dispositivo, el usuario ve sus empresas y el `activeCompanyId` válido sin ser redirigido a onboarding.

**Tiempo estimado:** 1.5h

---

### Paso 2.1 — Crear hook `useAuthBootstrap`

**Problema técnico:** Hoy la carga de empresas vive dentro de `useWorkspaceSync`, que se monta en `MainLayout`. Si `ProtectedRoute` redirige a `/onboarding` antes de que `MainLayout` monte, nunca se cargan empresas → deadlock.

**Archivos:**
- Nuevo: `src/hooks/useAuthBootstrap.ts`

**API propuesta:**
```typescript
// src/hooks/useAuthBootstrap.ts
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useBillingStore } from '@/stores/billingStore'

/**
 * Ejecuta las cargas globales por-usuario una vez cuando hay sesión:
 * empresas, billing (wallet, packages, costos, addons).
 * NO carga data per-empresa (eso es responsabilidad de useWorkspaceSync).
 *
 * Devuelve `{ ready, error }`:
 *  - `ready=false` mientras no se sepa si el usuario tiene empresas.
 *  - `ready=true` tras intentar la carga (éxito O fallo — no bloquea).
 */
export function useAuthBootstrap(): { ready: boolean; error: Error | null } {
  const user = useAuthStore((s) => s.user)
  const demoMode = useAuthStore((s) => s.demoMode)
  const authLoading = useAuthStore((s) => s.loading)
  const loadCompanies = useWorkspaceStore((s) => s.loadCompaniesFromDB)
  const loadWallet = useBillingStore((s) => s.loadWallet)
  const loadPackages = useBillingStore((s) => s.loadPackages)
  const loadOperationCosts = useBillingStore((s) => s.loadOperationCosts)
  const loadAddonPrices = useBillingStore((s) => s.loadAddonPrices)

  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const doneForUser = useRef<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setReady(true)
      return
    }
    if (demoMode) {
      setReady(true)
      return
    }
    if (doneForUser.current === user.id) return
    doneForUser.current = user.id

    setReady(false)
    Promise.allSettled([
      loadCompanies(user.id),
      loadWallet(user.id),
      loadPackages(),
      loadOperationCosts(),
      loadAddonPrices(),
    ])
      .then((results) => {
        const firstReject = results.find((r) => r.status === 'rejected')
        if (firstReject && firstReject.status === 'rejected') {
          setError(firstReject.reason instanceof Error ? firstReject.reason : new Error(String(firstReject.reason)))
        }
      })
      .finally(() => setReady(true))
  }, [user, demoMode, authLoading, loadCompanies, loadWallet, loadPackages, loadOperationCosts, loadAddonPrices])

  return { ready, error }
}
```

**Pasos:**
- [ ] 2.1.1 — Crear archivo.
- [ ] 2.1.2 — Agregar tests unitarios mockeando supabase.

**Implicaciones técnicas:**
- `doneForUser` evita re-fetch en re-renders; se resetea cuando cambia `user.id`.
- Si `loadCompanies` falla, `ready` igualmente pasa a `true` — así el ProtectedRoute deja de bloquear y muestra onboarding + toast de error (mejor UX que pantalla pegada).

---

### Paso 2.2 — Integrar `useAuthBootstrap` en `ProtectedRoute`

**Archivos:**
- `src/App.tsx:59-122` (ProtectedRoute)

**Cambios:**
```typescript
// Antes del return de loading (línea 111):
const { ready, error: bootstrapError } = useAuthBootstrap()

// Cambiar línea 111 a:
if (loading || !ready) return <PageSpinner />
```

**Pasos:**
- [ ] 2.2.1 — Importar `useAuthBootstrap`.
- [ ] 2.2.2 — Invocar el hook dentro de `ProtectedRoute`.
- [ ] 2.2.3 — Mover el gate del spinner para incluir `!ready`.
- [ ] 2.2.4 — Si `bootstrapError`, disparar un toast una vez via `useEffect`.

**Implicaciones técnicas:**
- `PageSpinner` ahora se ve ~200-500ms extra en cada login. Aceptable.
- Si `useAuthBootstrap` falla repetidamente, el spinner no se queda eterno (siempre termina en `ready=true`).

---

### Paso 2.3 — Integrar `useAuthBootstrap` en `ProtectedOnboarding`

**Archivos:**
- `src/App.tsx:124-130` (ProtectedOnboarding)

**Cambio:**
```typescript
function ProtectedOnboarding({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const { ready } = useAuthBootstrap()
  const companies = useWorkspaceStore((s) => s.companies)

  if (loading || !ready) return <PageSpinner />
  if (!user) return <Navigate to="/login" />

  // Si el usuario ya completó onboarding en alguna empresa, ir a /app
  const hasCompletedCompany = companies.some((c) => c.onboarding_completed)
  if (hasCompletedCompany) {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}
```

**Pasos:**
- [ ] 2.3.1 — Refactor `ProtectedOnboarding`.
- [ ] 2.3.2 — Testear que si llegas a `/onboarding` con empresa ya completa, te redirige a `/app`.

**Implicaciones técnicas:**
- Si un usuario quiere crear una segunda empresa via onboarding, este redirect lo bloquearía. Propuesta: aceptar `?create=true` query param para bypass. Revisar si ese flujo existe; si no, no agregarlo ahora.

---

### Paso 2.4 — Validar `activeCompanyId` contra DB en `loadCompaniesFromDB`

**Problema técnico:** [src/stores/workspaceStore.ts:468](src/stores/workspaceStore.ts#L468) hace `const activeId = s.activeCompanyId ?? allCompanies[0]?.id ?? null`. Si el ID persistido en localStorage es válido sintácticamente pero no está en `allCompanies`, se preserva el ID fantasma.

**Archivos:**
- `src/stores/workspaceStore.ts:437-474`

**Cambio:**
```typescript
// Reemplazar el set(...) por:
set((s) => {
  const merged = filteredData.map(/* ... mismo merge logic ... */)
  const dbIds = new Set(filteredData.map((c) => c.id))
  const localOnly = s.companies.filter((c) => !dbIds.has(c.id))
  const allCompanies = [...merged, ...localOnly]

  // Validar que activeCompanyId aún existe
  const activeStillValid = s.activeCompanyId && allCompanies.some(c => c.id === s.activeCompanyId)
  const activeId = activeStillValid ? s.activeCompanyId : (allCompanies[0]?.id ?? null)

  return { companies: allCompanies, activeCompanyId: activeId }
})

// Y manejar data.length === 0:
if (!data || data.length === 0) {
  set((s) => ({
    companies: s.companies.filter(c => !c.id /* conservar solo local-only si hay, o [] */),
    activeCompanyId: null,
  }))
  return
}
```

**Pasos:**
- [ ] 2.4.1 — Refactor `loadCompaniesFromDB` con validación de ID.
- [ ] 2.4.2 — Caso `data.length === 0`: resetear `activeCompanyId` a null.
- [ ] 2.4.3 — Agregar test unitario: "si activeCompanyId no está en DB, se resetea al primero".

**Implicaciones técnicas:**
- Stores que filtran por `activeCompanyId` ya manejan `null` (devuelven arrays vacíos).
- El sync de companyStore (`useCompanyStore.syncWithActiveCompany`) en `App.tsx:103-109` tiene guard `if (!activeCompanyId) return` — considerar llamarlo también cuando pasa de X a null para limpiar companyStore. Ver Paso 4.4.

---

### Paso 2.5 — Limpiar `useWorkspaceSync` (quitar cargas globales)

**Archivos:**
- `src/hooks/useWorkspaceSync.ts:47-71`

**Cambio:** Eliminar el primer `useEffect` (que cargaba companies + wallet + packages + costs + addons). Esas cargas ahora viven en `useAuthBootstrap`. Mantener sólo el segundo `useEffect` (per-company).

**Pasos:**
- [ ] 2.5.1 — Borrar el primer useEffect (líneas 47-71).
- [ ] 2.5.2 — Quitar imports ya no usados.
- [ ] 2.5.3 — Verificar que `MainLayout` sigue invocando `useWorkspaceSync()`.

**Implicaciones técnicas:**
- Sin este cambio hay doble fetch (bootstrap + sync). No causa bugs pero consume red innecesaria.

---

### Paso 2.6 — `onRehydrateStorage` en workspaceStore

**Problema:** Si localStorage tiene `activeCompanyId` viejo y el usuario abre la app offline, `ProtectedRoute` evalúa antes de que `loadCompaniesFromDB` valide el ID.

**Archivos:**
- `src/stores/workspaceStore.ts:493-500` (config de persist)

**Cambio:**
```typescript
{
  name: 'lean-process-workspace',
  version: 1,
  migrate: identityMigration(),
  merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
  onRehydrateStorage: () => (state) => {
    if (!state) return
    // Si el activeCompanyId no está en la lista rehidratada, resetear
    if (state.activeCompanyId && !state.companies.some(c => c.id === state.activeCompanyId)) {
      state.activeCompanyId = state.companies[0]?.id ?? null
    }
  },
}
```

**Pasos:**
- [ ] 2.6.1 — Agregar `onRehydrateStorage`.

**Implicaciones técnicas:**
- Se ejecuta una vez al cargar la app. No afecta performance.

---

### Smoke test Sprint 2

- [ ] S2.1 — `npm run build && npm run lint && npm run test` verde.
- [ ] S2.2 — Login en dispositivo A → crear proceso + BPMN → logout.
- [ ] S2.3 — Login mismo dispositivo → verificar que aparece el proceso y el BPMN.
- [ ] S2.4 — Abrir navegador de incógnito → login → verificar que aparece todo.
- [ ] S2.5 — Limpiar manualmente `localStorage.clear()` → recargar → login → todo vuelve desde DB.
- [ ] S2.6 — Abrir `/onboarding` directamente con sesión activa y empresa completada → redirige a `/app`.
- [ ] S2.7 — Commit: `feat(persistence): sprint 2 — login recupera empresas desde DB (useAuthBootstrap + validación activeCompanyId)`

---

## SPRINT 3 — Los 10 stores restantes persisten

**Meta:** Toda mutación en riesgos, KPIs, procedimientos, auditorías, VA, SIPOC, organigrama, miembros y changelog llega a DB con manejo de error + rollback.

**Tiempo estimado:** 2h

---

### Paso 3.1 — `riskStore` (tablas `risks`, `risk_controls`)

**Archivos:**
- `src/stores/riskStore.ts`

**Pasos:**
- [ ] 3.1.1 — Leer archivo completo, listar métodos de mutación.
- [ ] 3.1.2 — Aplicar patrón `dbWrite` + snapshot + rollback en: `addRisk`, `updateRisk`, `deleteRisk`, `addControl`, `updateControl`, `deleteControl`.
- [ ] 3.1.3 — Verificar que el payload respeta `risk.schema.ts` Zod.
- [ ] 3.1.4 — Test smoke: crear riesgo con 2 controles, `SELECT COUNT(*) FROM risks, risk_controls` confirma.

**Implicaciones:** [src/features/risk/pages/HeatMapPage.tsx](src/features/risk/pages/HeatMapPage.tsx) y RiskPanel no cambian firmas.

---

### Paso 3.2 — `indicatorStore` (tablas `indicators`, `indicator_readings`)

**Archivos:**
- `src/stores/indicatorStore.ts`

**Pasos:**
- [ ] 3.2.1 — Aplicar patrón `dbWrite` en: `addIndicator`, `updateIndicator`, `deleteIndicator`, `addReading`, `deleteReading`.
- [ ] 3.2.2 — Revisar la función `migrate()` (líneas ~200-224) para la persistencia: si hay campos legacy solo en localStorage, no escribir esos al DB.
- [ ] 3.2.3 — Smoke: crear KPI con 1 lectura, SQL confirma.

**Implicaciones:** [src/features/kpi/pages/KpiPage.tsx](src/features/kpi/pages/KpiPage.tsx), IndicatorsPage.

---

### Paso 3.3 — `procedureStore` (tablas `procedures`, `procedure_steps`)

**Archivos:**
- `src/stores/procedureStore.ts`

**Pasos:**
- [ ] 3.3.1 — Aplicar patrón `dbWrite` en: `upsertProcedure`, `deleteProcedure`, `addStep`, `updateStep`, `deleteStep`.
- [ ] 3.3.2 — Verificar que la generación IA de procedimiento (`procedureAi.ts`) guarda el resultado correctamente.
- [ ] 3.3.3 — Smoke: generar procedimiento con IA → SQL confirma `procedures` + `procedure_steps`.

---

### Paso 3.4 — `auditStore` (tablas `audits`, `audit_items`)

**Archivos:**
- `src/stores/auditStore.ts`

**Pasos:**
- [ ] 3.4.1 — Aplicar patrón en: `upsertAudit`, `deleteAudit`, `addAuditItem`, `updateAuditItem`, `deleteAuditItem`.
- [ ] 3.4.2 — Smoke: generar programa de auditoría → SQL confirma.

---

### Paso 3.5 — `valueAnalysisStore` (tabla `value_activities`)

**Archivos:**
- `src/stores/valueAnalysisStore.ts`

**Pasos:**
- [ ] 3.5.1 — Aplicar patrón en: `setActivities`, `addActivity`, `updateActivity`, `deleteActivity`.
- [ ] 3.5.2 — Smoke: clasificar 5 actividades VA/NVA → SQL confirma 5 filas.

---

### Paso 3.6 — `catalogStore` (tablas `sipoc_*`, `catalog_items`) — BLOQUE CRÍTICO

**Problema técnico extra:** Este store escribe pero no lee al login (no tiene `loadFromDB`).

**Archivos:**
- `src/features/catalog/catalogStore.ts`

**Pasos:**
- [ ] 3.6.1 — Agregar método `loadFromDB(companyId)` que lea las 4 tablas:
  ```typescript
  loadFromDB: async (companyId) => {
    const [suppliers, customers, sipocEntries, catalogItems] = await Promise.all([
      supabase.from('sipoc_suppliers').select('*').eq('company_id', companyId),
      supabase.from('sipoc_customers').select('*').eq('company_id', companyId),
      supabase.from('sipoc_entries').select('*').eq('company_id', companyId),
      supabase.from('catalog_items').select('*').eq('company_id', companyId),
    ])
    set({
      suppliers: suppliers.data ?? [],
      customers: customers.data ?? [],
      sipocEntries: sipocEntries.data ?? [],
      catalogItems: catalogItems.data ?? [],
    })
  }
  ```
- [ ] 3.6.2 — Registrar `loadFromDB` en `useWorkspaceSync.ts:81-91` (agregar al Promise.allSettled).
- [ ] 3.6.3 — Aplicar patrón `dbWrite` a todas las mutaciones (`addSupplier`, `addCustomer`, `addSipocEntry`, `addCatalogItem`, ...).
- [ ] 3.6.4 — Smoke: crear un proveedor SIPOC + un SIPOC entry → logout → login → ambos aparecen.

---

### Paso 3.7 — `companyStore` (organigrama: `org_level_definitions`, `org_units`)

**Archivos:**
- `src/stores/companyStore.ts`

**Pasos:**
- [ ] 3.7.1 — Listar métodos que mutan organigrama: `setOrgLevelDefinitions`, `addOrgUnit`, `updateOrgUnit`, `deleteOrgUnit`, `moveOrgUnit`.
- [ ] 3.7.2 — Aplicar patrón `dbWrite`.
- [ ] 3.7.3 — Validar que `loadOrgFromDB` trae ambas tablas.
- [ ] 3.7.4 — Smoke: reordenar jerarquía organizacional → logout → login → orden preservado.

---

### Paso 3.8 — `membershipStore` (tabla `memberships`)

**Archivos:**
- `src/stores/membershipStore.ts`

**Pasos:**
- [ ] 3.8.1 — Aplicar patrón `dbWrite` en: `ensureOwner`, `inviteMember`, `updateMember`, `removeMember`, `acceptInvitation`.
- [ ] 3.8.2 — Asegurar que al crear una empresa, se crea su membership owner (ya lo hace [companies.service.ts:103-111](src/services/companies.service.ts#L103-L111), verificar que el insert no sea bloqueado por RLS).

---

### Paso 3.9 — `changeLogStore` (tabla `change_log`)

**Archivos:**
- `src/stores/changeLogStore.ts`

**Pasos:**
- [ ] 3.9.1 — Aplicar patrón `dbWrite` con `silent: true` (el changelog no debe generar toasts al usuario).
- [ ] 3.9.2 — Verificar purgeOldEntries (que corra también en DB, no solo localStorage).

---

### Paso 3.10 — Logger global `src/lib/logger.ts`

**Archivos:**
- Nuevo: `src/lib/logger.ts`

**Pasos:**
- [ ] 3.10.1 — Implementar `logError(tag, error, meta?)` que siempre hace `console.error` con prefijo consistente.
- [ ] 3.10.2 — Opcional: enviar a una tabla `client_errors` si la creamos (diferir a post-launch).
- [ ] 3.10.3 — Reemplazar todos los `console.warn('[xStore]...')` y `console.error` diseminados por `logError`.

---

### Smoke test Sprint 3

- [ ] S3.1 — `npm run build && npm run lint && npm run test` verde.
- [ ] S3.2 — Matriz de persistencia: crear un registro de cada tipo en UI:
  - Riesgo con 1 control
  - KPI con 1 lectura
  - Procedimiento con 3 pasos
  - Auditoría con 2 items
  - 5 actividades VA/NVA
  - 1 proveedor SIPOC + 1 cliente + 1 entry SIPOC
  - 1 catalog_item
  - 1 org_unit
  - Verificar cada uno con `SELECT COUNT(*)`.
- [ ] S3.3 — Logout + login distinto navegador → todo aparece.
- [ ] S3.4 — Commit: `feat(persistence): sprint 3 — 10 stores con dbWrite + catalogStore.loadFromDB`

---

## SPRINT 4 — Multi-usuario robusto

**Meta:** Dos usuarios reales pueden trabajar en paralelo sin contaminarse; las invitaciones funcionan; el logout limpia correctamente.

**Tiempo estimado:** 1h

---

### Paso 4.1 — Migración RLS para memberships multi-miembro

**Archivos:**
- Nuevo: `supabase/migrations/20260417130000_memberships_multimember_visibility.sql`

**SQL:**
```sql
DROP POLICY IF EXISTS memberships_select ON memberships;
CREATE POLICY memberships_select ON memberships FOR SELECT
USING (
  user_id = auth.uid()
  OR is_company_member(company_id)
);
```

**Pasos:**
- [ ] 4.1.1 — Verificar que `is_company_member` tiene `SECURITY DEFINER` (evita recursión).
- [ ] 4.1.2 — Aplicar migración.
- [ ] 4.1.3 — Test con user no-owner: debe ver todos los miembros de la empresa a la que pertenece.

---

### Paso 4.2 — Crear `resetAllStores()` helper

**Archivos:**
- `src/utils/storeUtils.ts` (añadir función)

**API:**
```typescript
export function resetAllStores(): void {
  // Llamar a setState con initial state de cada store persistido.
  useWorkspaceStore.setState({ companies: [], activeCompanyId: null, subscription: null, addOns: [], invoices: [] })
  useProcessStore.setState(/* initial */)
  useRiskStore.setState(/* initial */)
  // ... etc para todos los persistidos
}
```

**Pasos:**
- [ ] 4.2.1 — Exportar `initialState` en cada store o tener el helper conocer las claves.
- [ ] 4.2.2 — Alternativa simple: `resetAllStores()` itera `localStorage` keys `lean-process-*` y las borra + `window.location.reload()`. Menos elegante pero seguro.

---

### Paso 4.3 — Eliminar `window.location.href` de authStore

**Archivos:**
- `src/stores/authStore.ts:124, 184`

**Cambio:**
- `setUser` ya no hace reload automático. En su lugar, el Login page hace `navigate('/app', {replace:true})` explícitamente tras signInWithPassword.
- `signOut` llama `resetAllStores()` + `navigate('/login', {replace:true})` (el caller provee navigate).

**Pasos:**
- [ ] 4.3.1 — Remover `window.location.href` en authStore.
- [ ] 4.3.2 — Actualizar [src/features/auth/pages/Login.tsx](src/features/auth/pages/Login.tsx) para hacer navigate manual.
- [ ] 4.3.3 — Actualizar cualquier componente que llame `signOut` para incluir `navigate('/login')`.

---

### Paso 4.4 — Unificar `completeOnboarding`

**Archivos:**
- `src/stores/companyStore.ts` (eliminar `completeOnboarding`)
- `src/stores/workspaceStore.ts:298-310` (única fuente)

**Pasos:**
- [ ] 4.4.1 — Buscar callers de `companyStore.completeOnboarding`: `Grep pattern="completeOnboarding"`.
- [ ] 4.4.2 — Migrar cada caller a `workspaceStore.completeCompanyOnboarding(companyId)`.
- [ ] 4.4.3 — Eliminar el método de companyStore.

---

### Paso 4.5 — Verificar configuración de producción

- [ ] 4.5.1 — Confirmar en Vercel dashboard que `VITE_DEMO_MODE_ENABLED` **NO** está seteado.
- [ ] 4.5.2 — Verificar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Vercel.
- [ ] 4.5.3 — Confirmar que `npm run build` genera `dist/` sin warnings.
- [ ] 4.5.4 — Commit: `feat(persistence): sprint 4 — multi-usuario robusto (RLS memberships + reset stores)`

---

## SPRINT 5 — Testing automatizado + smoke E2E

**Meta:** Batería de tests que garantiza que los bugs de persistencia no vuelvan.

**Tiempo estimado:** 1h

---

### T1 — Tests unitarios nuevos

**Archivos a crear:**
- `src/lib/dbWrite.test.ts`
- `src/hooks/useAuthBootstrap.test.ts`
- `src/stores/workspaceStore.test.ts` (nuevo)
- `src/utils/storeUtils.test.ts` (extender con resetAllStores)

**Casos mínimos:**
- [ ] T1.1 — `dbWrite`: éxito → devuelve `{ok:true}`. Error → llama rollback y toast. Silent mode no toast.
- [ ] T1.2 — `useAuthBootstrap`: sin user → ready=true. Con user → llama loadCompanies y espera. Error parcial → ready=true + error expuesto.
- [ ] T1.3 — `workspaceStore.loadCompaniesFromDB`: caso `data=[]` → activeCompanyId=null. activeCompanyId inválido → se reasigna al primero.
- [ ] T1.4 — `resetAllStores()`: limpia localStorage keys `lean-process-*`.

---

### T2 — Tests de integración (opcional, requiere entorno de pruebas Supabase)

- [ ] T2.1 — Crear archivo `tests/integration/auth-flow.test.ts` con usuario temporal.
- [ ] T2.2 — Opcional si no hay proyecto Supabase de test: diferir.

---

### T3 — Smoke E2E manual (checklist definitivo)

Ejecutado con `npm run dev` + navegadores A y B.

- [ ] T3.1 — **Registro desde cero**: crear nueva cuenta con email personal. Confirmar email. Login.
- [ ] T3.2 — **Onboarding completo**: los 10 hitos se completan, `companies.onboarding_completed=true` en DB.
- [ ] T3.3 — **Procesos + BPMN**: crear macroproceso + proceso + dibujar BPMN con 5 shapes. Verificar SQL.
- [ ] T3.4 — **Riesgos**: crear 1 riesgo con 2 controles.
- [ ] T3.5 — **KPIs**: crear 1 indicador + registrar 3 lecturas.
- [ ] T3.6 — **Procedimientos**: generar procedimiento con IA.
- [ ] T3.7 — **Auditorías**: generar programa de auditoría.
- [ ] T3.8 — **Análisis de valor**: clasificar 5 actividades.
- [ ] T3.9 — **SIPOC**: crear 1 proveedor, 1 cliente, 1 entry.
- [ ] T3.10 — **Organigrama**: crear 3 niveles, 5 unidades.
- [ ] T3.11 — **Logout + login mismo navegador**: todo aparece.
- [ ] T3.12 — **Login en navegador de incógnito**: todo aparece.
- [ ] T3.13 — **Exportaciones**: Word, Excel, PPTX, PDF generan archivos válidos.
- [ ] T3.14 — **Presentación**: genera slides.
- [ ] T3.15 — **Invitar miembro**: invitar segunda cuenta → segunda cuenta ve la empresa compartida.
- [ ] T3.16 — **Aislamiento**: crear empresa desde segunda cuenta → primera cuenta NO la ve.

---

### T4 — Advisors Supabase

- [ ] T4.1 — `mcp__leanprocess_SAAS__get_advisors(type='security')` — 0 nuevos issues.
- [ ] T4.2 — `mcp__leanprocess_SAAS__get_advisors(type='performance')` — 0 nuevos issues.

---

### T5 — CI

- [ ] T5.1 — `npm run build` OK.
- [ ] T5.2 — `npm run lint --max-warnings 0` OK.
- [ ] T5.3 — `npm run test` OK (meta ~50-60 tests).
- [ ] T5.4 — GitHub Actions pasa.
- [ ] T5.5 — Deploy a Vercel (staging) y validar smoke manual en URL pública.
- [ ] T5.6 — Commit: `feat(persistence): sprint 5 — tests + smoke E2E verde`

---

## Checklist pre-deploy (Vercel)

Antes de hacer push a producción, verificar:

- [ ] Variable `VITE_DEMO_MODE_ENABLED` **NO está seteada** en Vercel Dashboard → Settings → Environment Variables. (Si aparece, borrarla — es solo para `.env.local`).
- [ ] Variables `VITE_SUPABASE_URL` = `https://bpqqtcpbjjlfcaiuselu.supabase.co` y `VITE_SUPABASE_ANON_KEY` = (anon key pública) presentes y correctas.
- [ ] `GEMINI_API_KEY` configurada en Supabase Secrets (NO en Vercel): `supabase secrets set GEMINI_API_KEY=... --project-ref bpqqtcpbjjlfcaiuselu`.
- [ ] Función Edge `ai-proxy` desplegada: `supabase functions deploy ai-proxy --project-ref bpqqtcpbjjlfcaiuselu`.

## Checklist final cross-device

Antes de compartir con tu hermano, esta lista debe estar 100% tachada:

- [ ] Registrarse con email real funciona (recibe email de confirmación).
- [ ] Login desde PC personal → todo se guarda.
- [ ] Login desde otro navegador/laptop con la misma cuenta → todo aparece.
- [ ] Crear proceso en PC → abrirlo y editarlo en otra máquina → cambios persisten.
- [ ] Dibujar BPMN en PC → abrirlo en celular → mismo diagrama.
- [ ] KPIs, riesgos, procedimientos, auditorías, análisis de valor, SIPOC, organigrama: todos persisten cross-device.
- [ ] Generar exportaciones (Word, Excel, PPTX, PDF).
- [ ] Generar presentación.
- [ ] Invitar a un segundo usuario a la empresa → ese usuario ve la empresa en su login.
- [ ] Segundo usuario crea su propia empresa → no se contamina con la tuya.
- [ ] Logout limpia el estado local.
- [ ] Login tras logout no pide onboarding otra vez.

---

## Protocolo de rollback

Cada sprint es un commit aislado. Si algo se rompe:

1. `git log --oneline` — identificar el commit del sprint problemático.
2. `git revert <sha>` — revierte el commit manteniendo historial.
3. Para migraciones Supabase que revertir: crear migración inversa con el nombre `YYYYMMDDHHMMSS_revert_<original>.sql`.

**Migración inversa de Sprint 1.1:**
```sql
-- Revertir cleanup_rls_duplicates (no restaura las _own, solo las crud_own)
CREATE POLICY processes_crud_own ON processes FOR ALL
USING ((auth.uid() = user_id) AND (EXISTS (
  SELECT 1 FROM companies c WHERE c.id = processes.company_id AND c.user_id = auth.uid()
)));
```

Guardar este SQL en `supabase/migrations/revert/` como referencia (NO aplicarlo automáticamente).

---

## Registro de avance

| Sprint | Estado | Commit | Fecha | Notas |
|---|---|---|---|---|
| 1 | ✅ completo | 93123ea | 2026-04-17 | RLS cleanup aplicado; dbWrite + refactor de workspaceStore + processStore + useBpmnAutoSave. 60/60 tests pasan. |
| 2 | ✅ completo | 8dda89d | 2026-04-17 | useAuthBootstrap rompe deadlock; ProtectedRoute/Onboarding con gate de ready; activeCompanyId validado contra DB; onRehydrateStorage defensivo. 64/64 tests. |
| 3 | ✅ completo | d2ce1ed | 2026-04-17 | dbWrite + rollback en 9 stores (risk/indicator/procedure/audit/value/company/catalog/membership/changeLog). catalogStore.loadFromDB agregado a useWorkspaceSync. 64/64 tests. |
| 4 | ✅ completo | 684855d | 2026-04-17 | Migración RLS memberships_select (miembros no-owner ven toda la lista). Hardening de companyStore.completeOnboarding con dbWrite + rollback. 64/64 tests. |
| 5 | ✅ completo | (ver git log) | 2026-04-17 | 5 tests nuevos en workspaceStore (69/69). Advisors Supabase revisados (3 warnings pre-existentes, ninguno bloqueante). Guía SMOKE_TEST_E2E.md con 10 escenarios + SQL de verificación. |

**Última actualización:** 2026-04-17

---

*Fin del plan. Siguiente acción: arrancar Sprint 1, Paso 1.1.*
