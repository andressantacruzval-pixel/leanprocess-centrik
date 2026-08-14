# CLAUDE.md — LeanProcess v0.1.0

> Guía de referencia para Claude Code. Contiene arquitectura, seguridad, base de datos,
> convenciones y patrones críticos del sistema. Leer antes de tocar cualquier archivo.

---

## Cambios recientes (2026-07-31) — Niveles de documentación y tope de planes

> **Antes de tocar procesos o documentación, leer `lean-process-brain/docs/App/niveles-y-documentacion.md`
> y `docs/App/planes.md`.** Son el contrato; esto es solo el resumen.

**1. La documentación va SIEMPRE en el nivel más bajo declarado, y ahora es imposible saltárselo.**
La empresa elige 2 o 3 niveles en el paso 2 del onboarding (`companies.process_level_count`). El
predicado único vive en **`src/lib/processLevels.ts`** — `isDocumentable(proceso, levelCount)` — y
**no debe reimplementarse**.

⚠️ **«Nivel más bajo» NO es «no tiene hijos».** Un proceso de nivel 2 sin subprocesos en una estructura
de 3 es una rama a medio construir, no una hoja. Confundirlo dejó **1.031 registros mal ubicados**;
se remediaron el 2026-07-31 (migs. `20260731000001`–`0004`).

Cinco capas: el esquema (ninguna tabla de documentación tiene FK a `macroprocesses`) ·
`useDocumentableGuard` en las 7 pantallas · triggers en las 7 tablas y en `processes`
(migs. `0005`/`0006`) · `process_level_count` **congelado incluso para el owner** (mig. `0007`) ·
y cambiarlo exige `reset_company`, que borra la empresa entera.

**2. El tope de plan.** `profiles.plan_level` (0–3) → `cap = 20 + n*10`. La escalera está en
**`src/lib/plans.ts`** (`planCap`, `planTokens`, `planPrice`, `planName`); `plan_cap()`,
`plan_tokens()` y `plan_name()` son **de Lite** y aquí solo se consumen.

| Nivel | Nombre | Procesos | Tokens |
|---:|---|---:|---:|
| 0 | Community | 20 | 1.000 |
| 1 | Community Plus | 30 | 2.000 |
| 2 | Community Pro | 40 | 3.000 |
| 3 | Community Max | 50 | 4.000 |

- ✅ **Aplicado:** `trg_plan_cap_processes` (mig. `20260731000010` + `0013` para el mensaje). Bloquea
  crear procesos del nivel más bajo. Los agrupadores y macroprocesos **no consumen cupo**.
- ✅ **Aplicado también el de DOCUMENTAR** (desde el 2026-08-04): la cuota vive dentro de
  `enforce_documentable_level()` y de `enforce_documentable_level_processes()`.
- **Grandfathering:** los topes solo miran `INSERT`. Quien excede conserva todo lo suyo, y **puede
  terminar** lo que ya cuenta dentro del cupo: la cuota solo frena empezar uno nuevo.

> 🛡️ **El blindaje está DEMOSTRADO en la base, no solo en la interfaz** (2026-08-08). Se atacó por los
> nueve caminos contra dos empresas reales, en transacción revertida: crear el proceso 21, SIPOC,
> flujograma por `bpmn_diagrams`, **flujograma por la columna legacy `processes.bpmn_xml`**, riesgo,
> KPI, procedimiento, auditoría y análisis de valor. **Los nueve bloqueados**, y terminar un proceso que
> ya cuenta sigue permitido.
>
> ⚠️ **El ataque por `bpmn_xml` solo se bloquea con más de 100 caracteres.** El trigger y
> `is_process_documented` comparten ese umbral, así que por debajo ni bloquea ni cuenta como
> documentado — es coherente, pero probarlo con `'<x/>'` da un falso negativo. Guion completo en
> `lean-process-brain/docs/Compartido/validacion-del-cobro.md`; **volver a correrlo tras cualquier
> migración que toque `processes` o las 7 tablas de documentación.**

**2b. El muro que vende (2026-08-08).** Al topar ya no sale un aviso: sale `PlanUpgradeModal` con el
escalón siguiente, su precio, el salto con los números de ESA cuenta (`20 → 30`) y un botón que lleva
**directo a la pantalla de pago**. El enganche es UNA función —`avisarSiSinCupo()` en
`src/lib/planGateMessage.ts`— así que las nueve puertas se actualizan sin tocar ninguna pantalla.

> ⚠️ **App NO habla con Stripe.** El botón va a `/hub/subir?nivel=N`, que vive en Lite. Mantener esa
> frontera: duplicar el cobro aquí sería un segundo sitio donde equivocarse de precio.
>
> ⚠️ **`planGate.invariant.test.ts` no caza si una pantalla responde MAL.** Comprueba que consulte la
> cuota, y el mapa la consultaba — para pintar un aviso en vez de ofrecer la salida. Consultar no es
> responder bien.

**3. ⚠️ `plan_type` NO es `plan_level`.** El primero es la **membresía** (`community` para todo el que
viene de la comunidad, **haya comprado o no**); el segundo, la **escalera**. Atar un texto al primero
llamó "Community" a quien acababa de pagar el Plus. **El nombre sale siempre del nivel**, vía
`planName(level)`. `isCommunity` sirve solo para decidir *si hay tope*.

**4. `dbWrite` deja pasar los mensajes de negocio.** Antes reemplazaba el error de la base por
*"No se pudo guardar en la nube"* y el texto escrito para el usuario solo llegaba a la consola. Ahora
`mensajeDeNegocio()` deja pasar los `check_violation` (SQLSTATE `23514`) y sigue tapando los `CHECK`
declarativos de Postgres, que son ilegibles. **Los mensajes de esos triggers los lee el cliente tal
cual: escribirlos bien no es adorno.**

**5. Cómo probar un tope contra producción sin encenderlo para todos.** Instalarlo dentro de un
bloque `DO` que termina en `raise exception`: el rollback deshace también el `CREATE TRIGGER` (el DDL
es transaccional en Postgres). Nada persiste. Así se encontró el agujero de `bpmn_xml`.

---

## CONTEXTO DEL PROYECTO

**LeanProcess** es un SaaS B2C de gestión de procesos empresariales. Permite a empresas:
- Mapear procesos en jerarquía (Macroproceso → Proceso → Subproceso)
- Diagramar con BPMN 2.0 (compatible Bizagi)
- Generar procedimientos, KPIs, riesgos y programas de auditoría con IA
- Exportar a PDF, Excel, Word y PowerPoint
- Gestionar múltiples empresas (workspace multi-tenant)

**Estado:** Producción activa con usuarios reales en Vercel.
**Supabase project:** `hucebvuhyedqbfhyzybo` (LeanProcess SAAS — verificar SIEMPRE antes de cualquier operación)
**URL producción:** https://app.leanprocess.app
⚠️ **NO es `leanprocess.app`** — ese dominio sirve **Lite** desde que se repartieron los subdominios
(`www` = Lite, `app` = App, `crm` = CRM). Este documento decía lo contrario. Y `app.leanprocess.app/`
hace un **307 al Hub de Lite**, así que la landing de App no la ve nadie. Mapa completo en la bóveda:
`lean-process-brain/docs/Compartido/dominios.md`.

> ⚠️ PRODUCCIÓN ACTIVA — Nunca romper el build. Siempre ejecutar `npm run build` antes de commit.

---

## PROYECTOS SUPABASE — DOS ENTORNOS

> ⚠️ REGLA CRÍTICA: SIEMPRE operar en el proyecto NUEVO (`hucebvuhyedqbfhyzybo`). El proyecto antiguo es solo referencia de lectura.

### Proyecto NUEVO — Producción activa (compartido con LeanProcess Lite)
| Campo | Valor |
|-------|-------|
| **Ref** | `hucebvuhyedqbfhyzybo` |
| **Nombre** | LeanProcess SAAS (HUB unificado) |
| **URL** | `https://hucebvuhyedqbfhyzybo.supabase.co` |

### Proyecto ANTIGUO — Solo referencia histórica
| Campo | Valor |
|-------|-------|
| **Ref** | `bpqqtcpbjjlfcaiuselu` |
| **Nombre** | LeanProcess App (pre-migración) |
| **Uso** | **Solo lectura.** Nunca modificar, nunca desplegar aquí. Útil para consultar schema original. |

### Herramientas y conexiones
- **MCP `leanprocess_SAAS`** → conectado al proyecto **ANTIGUO** (`bpqqtcpbjjlfcaiuselu`). **No usarlo para DDL ni migraciones.**
- **Management API** → `POST https://api.supabase.com/v1/projects/hucebvuhyedqbfhyzybo/database/query` con token `SUPABASE_ACCESS_TOKEN` (nunca commitear el token; generarlo en el dashboard y guardarlo como variable de entorno local)
- **Edge Functions** → `supabase functions deploy ... --project-ref hucebvuhyedqbfhyzybo`
- **Variables de entorno** → `VITE_SUPABASE_URL=https://hucebvuhyedqbfhyzybo.supabase.co`

---

## COEXISTENCIA DE DOS SISTEMAS EN UNA BASE DE DATOS

> ⚠️ CRÍTICO: La base de datos `hucebvuhyedqbfhyzybo` es compartida entre **LeanProcess App** y **LeanProcess Lite**. Ambos sistemas usan los mismos usuarios (`auth.users`). Cualquier cambio de schema debe considerar que NO rompe el otro sistema.

### Tablas de LeanProcess Lite — NUNCA MODIFICAR
Estas tablas pertenecen a LeanProcess Lite (Next.js). Tocarlas puede romper un sistema en producción con 67 usuarios activos:

| Tabla | Uso en Lite |
|-------|-------------|
| `profiles` | Perfil de usuario + créditos (`credits`, `plan_id`, `role`). Compartida. Solo ADD COLUMN, nunca DROP o modificar columnas existentes. |
| `clientes` | Clientes de Lite |
| `usage_logs` | Log de uso de herramientas IA de Lite |
| `comunidad_whitelist` | Whitelist de acceso a comunidad |
| `comunidad_whitelist_stripe_test` | Whitelist de prueba Stripe |
| `circle_sync_runs` | Sincronización con Circle.so |
| `gamification_sync` | Sincronización de gamificación |
| `dashboard_snapshots` | Snapshots de dashboard de Lite |

### Tabla compartida — Reglas especiales
| Tabla | Regla |
|-------|-------|
| `profiles` | **Compartida entre ambos sistemas.** LeanProcess App puede leer `credits`, `plan_id`, `is_admin`, `full_name`. Solo agregar columnas nuevas con `ADD COLUMN IF NOT EXISTS`. NUNCA hacer `DROP COLUMN`, NUNCA renombrar columnas existentes. NUNCA sobreescribir las funciones `consume_credits()`, `handle_new_lean_user()`, `renew_community_credits()`. |

### Tablas de LeanProcess App — Propiedad de esta app
Estas tablas fueron creadas para LeanProcess App y son seguras de modificar:
`companies`, `memberships`, `macroprocesses`, `process_level_definitions`, `processes`,
`bpmn_diagrams`, `procedures`, `procedure_steps`, `risks`, `risk_controls`,
`indicators`, `indicator_readings`, `audits`, `audit_items`,
`sipoc_suppliers`, `sipoc_customers`, `sipoc_entries`, `catalog_items`,
`value_activities`, `org_level_definitions`, `org_units`, `change_log`,
`ai_rate_limit_log`, `ai_usage_log`, `ai_model_prices`,
`achievements`, `user_achievements`, `user_streaks`,
`notifications`, `company_addons`

### Tablas eliminadas en la migración (no existen en el proyecto nuevo)
`token_wallets`, `token_transactions`, `token_packages`, `operation_costs`,
`addon_prices`, `plan_token_allocations`, `subscriptions`, `payment_history`, `stripe_events`
El sistema de créditos ahora usa `profiles.credits` via la función `consume_credits()` de Lite.

### Reglas de coexistencia
1. **Antes de cualquier migración**: verificar que la tabla afectada pertenece a LeanProcess App, no a Lite.
2. **En `profiles`**: solo `ADD COLUMN IF NOT EXISTS`. Nunca `DROP`, `ALTER TYPE`, ni renombrar.
3. **Nunca reemplazar funciones RPC de Lite**: `consume_credits()`, `handle_new_lean_user()`, `renew_community_credits()`, `is_admin()`.
4. **Al crear RLS**: verificar que las policies no interfieren con las policies existentes de Lite en `profiles`.
5. **Usuarios compartidos**: `auth.users` es la misma tabla para ambos sistemas. Un registro nuevo en LeanProcess App ya existe como usuario de Lite (o viceversa).

---

## STACK TECNOLÓGICO

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | React | 19.2.4 |
| Routing | React Router | v7.14 |
| Estado | Zustand | 5.0.12 |
| Backend/Auth | Supabase JS | 2.102.1 |
| Build | Vite | 8.0.4 |
| Estilos | Tailwind CSS | 4.2.2 |
| Tipos | TypeScript | ~6.0.2 |
| Validación | Zod | 4.3.6 |
| BPMN Editor | bpmn-js | 18.14.0 |
| Diagramas | ReactFlow + Dagre | 11.11.4 / 0.8.5 |
| IA | Google Gemini | @google/genai 1.48 |
| Gráficas | Recharts | 3.8.1 |
| Iconos | Lucide React | 1.7.0 |
| Tests | Vitest | 4.1.4 |
| Exportes | docx / exceljs / pptxgenjs / jspdf | v9/v4/v4/v4 |
| Cache | TanStack Query | 5.96.2 |
| Tour guiado | React Joyride | 3.0.2 |

---

## SCRIPTS DE DESARROLLO

```bash
npm run dev              # Servidor de desarrollo (http://localhost:5173)
npm run build            # tsc -b && vite build  ← SIEMPRE ejecutar antes de commit
npm run lint             # ESLint (max-warnings 0)
npm run test             # Vitest (37 tests)
npm run test:watch       # Vitest modo watch
npm run test:coverage    # Cobertura (umbral: 60%)
```

**Pre-commit hook:** lint-staged ejecuta `eslint --fix --max-warnings 0` en `.ts/.tsx` staged.

---

## VARIABLES DE ENTORNO

```bash
# .env.local (desarrollo) — NUNCA commitear
VITE_SUPABASE_URL=https://hucebvuhyedqbfhyzybo.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key_publico>
VITE_DEMO_MODE_ENABLED=true          # Solo local — NO poner en Vercel
NEXT_PUBLIC_APP_URL=http://localhost:5173

# GEMINI_API_KEY vive en Supabase Secrets, NO en .env
# supabase secrets set GEMINI_API_KEY=<key> --project-ref hucebvuhyedqbfhyzybo
```

**Regla:** `VITE_` prefix = llega al bundle del cliente. Todo secreto va en Supabase secrets (servidor).

---

## ARQUITECTURA DE CARPETAS

```
src/
├── App.tsx                    # Router principal + lazy loading de rutas
├── main.tsx                   # Entry point
├── features/                  # 20 módulos de features (estructura principal)
│   ├── ai-consultant/         # Chat IA para consultoría de procesos
│   ├── analytics/             # Dashboard admin + métricas (admin-only)
│   ├── audit/                 # Programa de auditoría por proceso
│   ├── auth/                  # Login, Register, ForgotPassword, Settings
│   ├── benchmarking/          # Comparativa de procesos (stub)
│   ├── bpmn/                  # Editor BPMN 2.0 (bpmn-js)
│   ├── catalog/               # Catálogos de dropdowns configurables
│   ├── gamification/          # Logros, streaks, puntos
│   ├── kpi/                   # Indicadores KPI por proceso
│   ├── notifications/         # Notificaciones in-app
│   ├── onboarding/            # Flujo de configuración inicial (10 hitos)
│   ├── org-structure/         # Organigrama empresarial
│   ├── presentation/          # Exportar presentación PowerPoint
│   ├── procedure/             # Documentación de procedimientos
│   ├── process/               # Núcleo: mapa de procesos y caracterización
│   ├── reporting/             # Reportes y exportaciones
│   ├── risk/                  # Gestión de riesgos + heat map
│   ├── search/                # Búsqueda global (Ctrl+K)
│   └── value-analysis/        # Análisis VA/NVA/NVABN
├── components/                # Componentes compartidos (no feature-específicos)
│   ├── layout/                # Header, Sidebar, Layout wrapper
│   ├── ui/                    # ErrorBoundary, KpiCard, etc.
│   ├── bpmn-editor/           # Subcomponentes del editor BPMN
│   └── ...
├── hooks/                     # 19 custom hooks globales
├── lib/                       # Clientes y utilidades de bajo nivel
│   ├── supabase.ts            # Cliente Supabase tipado
│   ├── aiClient.ts            # Proxy IA (llama a Edge Function)
│   ├── aiSanitizer.ts         # Sanitización de inputs para prompts
│   ├── claude.ts              # Funciones IA: BPMN, SIPOC, indicadores
│   ├── procedureAi.ts         # Funciones IA: procedimientos, auditoría, valor
│   ├── riskAi.ts              # Funciones IA: identificación de riesgos
│   ├── conversationalAi.ts    # Streaming chat con tool-call parsing
│   ├── schemas/               # Schemas Zod para validación pre-upsert
│   └── prompts/               # System prompts estáticos para onboarding
├── pages/                     # Páginas raíz (Dashboard, Landing, 404, etc.)
├── services/                  # Capa de acceso a datos Supabase (10 servicios)
├── stores/                    # 21 stores Zustand con persist
├── types/                     # Interfaces TypeScript del dominio
├── utils/                     # Helpers puros (id, storeUtils, exporters, etc.)
└── test/                      # Setup de Vitest
```

**Regla de 300 líneas:** Ningún archivo debe superar 300 líneas. Si supera, dividir.

**Alias de paths:** `@/` → `src/` (configurado en `vite.config.ts` y `tsconfig.app.json`)

---

## RUTAS Y ACCESO

### Rutas públicas
| Ruta | Componente |
|------|-----------|
| `/` | Landing — ⚠️ **no se sirve**: el dominio hace 307 al Hub de Lite |
| `/login` | `RedirectToLite` → `www.leanprocess.app/login` |
| `/register` | `RedirectToLite` → `www.leanprocess.app/login?view=signup` |
| `/forgot-password` | ForgotPasswordPage |
| `/reset-password` | ResetPasswordPage — acepta `token_hash` |
| `/hub-entry`, `/app/hub-entry` | HubEntry (handoff desde el Hub de Lite) |

> **App no tiene login ni registro propios desde el 2026-08-05.** `Login.tsx` y `Register.tsx` se
> borraron: había dos puertas sobre el mismo `auth.users` y mantener las reglas del alta por duplicado
> las separaba solas. Quien llega sin sesión va a Lite (`src/features/auth/lite.tsx`, con
> `VITE_LITE_URL` como override y `https://www.leanprocess.app` por defecto) y vuelve por el handoff del
> Hub, sin teclear credenciales. `ProtectedRoute` y `ProtectedOnboarding` redirigen igual.
>
> `/forgot-password` y `/reset-password` **se quedan**: no son puerta de entrada, sirven a los enlaces
> de recuperación ya enviados. La pantalla de reset canjea `token_hash` con `verifyOtp` y conserva el
> camino antiguo por fragment mientras caduquen los enlaces viejos.

### Rutas protegidas (`ProtectedRoute`)
Requieren sesión válida. Si no hay empresa configurada, redirigen a `/onboarding`.

| Ruta | Componente | Notas |
|------|-----------|-------|
| `/onboarding` | OnboardingPage | Setup inicial |
| `/app` | Dashboard | Índice |
| `/app/process-map` | ProcessMapPage | Mapa de procesos |
| `/app/process/:id` | ProcessDetailPage | Detalle de proceso |
| `/app/process/:id/characterization` | ProcessCharacterizationPage | Caracterización |
| `/app/process/:id/procedure` | ProcedurePage | Procedimientos |
| `/app/process/:id/indicators` | KpiPage | KPIs |
| `/app/bpmn/:processId` | BpmnEditorPage | Editor BPMN |
| `/app/org-structure` | OrgStructurePage | Organigrama |
| `/app/indicators` | IndicatorsPage | Todos los KPIs |
| `/app/heat-map` | HeatMapPage | Mapa de calor de riesgos |
| `/app/reports` | ReportsPage | Reportes y exportaciones |
| `/app/presentation` | PresentationPage | Presentación |
| `/app/ai-consultant` | AiConsultantPage | Consultor IA |
| `/app/achievements` | AchievementsPage | Logros (gamificación) |
| `/app/catalogs` | CatalogsPage | Configurar catálogos |
| `/app/settings` | SettingsPage | Configuración empresa |
| `/app/admin` | AdminPage | **Admin only** |
| `/app/process-levels` | ProcessLevelsPage | Niveles de proceso |

**Control de acceso:** `ProtectedRoute` verifica `useAuthStore` (user + profile). Admin detectado por `profile.is_admin`.

---

## SEGURIDAD

### 1. IA — API Key del servidor (nunca en cliente)
```
Cliente → aiClient.ts → Edge Function ai-proxy → Gemini API
```
- `GEMINI_API_KEY` vive en Supabase Secrets. **Nunca en bundle JS.**
- La Edge Function (`supabase/functions/ai-proxy/index.ts`) verifica JWT antes de llamar a Gemini.
- Rate limit: 20 llamadas/minuto por usuario (tabla `ai_rate_limit_log`).
- Soporta streaming SSE y respuesta completa.

### 2. Sanitización de prompts (prompt injection)
```typescript
import { sanitizePromptInput, sanitizeLargeContent } from '@/lib/aiSanitizer'

// Para texto de usuario corto (nombre empresa, nombre proceso):
const safe = sanitizePromptInput(userInput)          // maxLen=200, strip <> y control chars

// Para contenido largo (XML BPMN):
const safeXml = sanitizeLargeContent(bpmnXml)        // maxLen=80_000, mantiene < >
```
- **Nunca** interpolar `process.name`, `company.name`, `bpmnXml` directamente en prompts.
- Usar separación XML en prompts críticos: `<context><company>...</company></context>`

### 3. Demo mode guard
```typescript
// authStore.ts — loginDemo() solo funciona si:
if (import.meta.env.VITE_DEMO_MODE_ENABLED !== 'true') return

// En Vercel: VITE_DEMO_MODE_ENABLED no está definido → demos bloqueados en producción
```

### 4. Validación Zod antes de upsert a Supabase
```typescript
import { RiskRowSchema } from '@/lib/schemas/risk.schema'

const validated = RiskRowSchema.parse(riskData)  // throws si inválido
await supabase.from('risks').upsert(validated)
```
Schemas disponibles: `risk.schema.ts`, `process.schema.ts`, `indicator.schema.ts`, `procedure.schema.ts`

### 5. Row Level Security (RLS)
Todas las tablas tienen RLS habilitado. Funciones helper:
- `is_company_member(company_id)` — usuario es miembro activo o dueño
- `is_company_editor(company_id)` — rol owner/admin/editor
- `is_company_owner(company_id)` — solo el dueño

### 6. Supabase client tipado (NO `as any`)
```typescript
// ✅ Correcto — cliente tipado con Database
import { supabase } from '@/lib/supabase'
const { data } = await supabase.from('risks').select('*')

// ❌ Prohibido — nunca agregar esto
const { data } = await (supabase as any).from('risks').select('*')
```
Si hay mismatch de tipos entre tipos de app y DB, usar `as unknown as AppType` en el resultado.

---

## SISTEMA DE IA

### Arquitectura de funciones

```
src/lib/
├── aiClient.ts         # callAiProxy() / streamAiProxy() — wrapper del Edge Function
├── aiSanitizer.ts      # Sanitización + ProcessAiInputSchema
├── claude.ts           # generateBpmnDiagram, generateSipoc, generateIndicators,
│                       # conductProcessInterview, generateBpmnFromInterview,
│                       # refineBpmnDiagram, generateProcessDescription,
│                       # generateProcessObjective
├── procedureAi.ts      # analyzeDiagramForProcedure, generateProcedureFromContext,
│                       # generateProcedureFromBpmn, generateRisksForProcedure,
│                       # generateAuditFromBpmn, classifyActivitiesValue, improveText
├── riskAi.ts           # identifyRisksFromBpmn
└── conversationalAi.ts # streamChat (streaming SSE), parseInlineToolCalls
```

### Modelos usados
| Modelo | Uso | Característica |
|--------|-----|---------------|
| `gemini-2.5-flash` | Generación estructurada, BPMN, procedimientos | Balance calidad/velocidad |
| `gemini-2.5-flash-lite` | Chat conversacional | TTFT ~250ms, alta velocidad |

### Patrón de llamada IA
```typescript
import { callAiProxy } from '@/lib/aiClient'
import { sanitizePromptInput } from '@/lib/aiSanitizer'

const safeName = sanitizePromptInput(processName)
const response = await callAiProxy([
  { role: 'user', content: `Analiza: ${safeName}` }
], { systemPrompt: SYSTEM_PROMPT })
```

### Tool calls inline (conversationalAi.ts)
El sistema de chat detecta marcadores `<<ACTION param="val">>` en el texto del LLM para ejecutar acciones (generar BPMN, navegar, etc.) sin function calling nativo.

---

## BASE DE DATOS (36 tablas)

### Tablas principales

| Tabla | Propósito | Relaciones clave |
|-------|-----------|-----------------|
| `profiles` | Perfil de usuario (extensión de auth.users) | FK auth.users |
| `companies` | Empresa/workspace multi-tenant | user_id → profiles |
| `memberships` | Miembros de empresa | company_id + user_id |
| `macroprocesses` | Categorías de proceso (estratégico/productivo/apoyo) | company_id |
| `processes` | Procesos y subprocesos con jerarquía | macroprocess_id, parent_process_id (self-ref) |
| `process_level_definitions` | Niveles de jerarquía configurables | company_id |
| `bpmn_diagrams` | Diagramas BPMN por proceso (XML + JSON) | process_id |
| `procedures` | Documentación de procedimientos | process_id (1:1) |
| `procedure_steps` | Pasos del procedimiento | procedure_id |
| `risks` | Riesgos por proceso (5×5 matriz) | process_id, company_id |
| `risk_controls` | Controles de mitigación (8 variables) | risk_id |
| `indicators` | KPIs/indicadores por proceso | company_id, process_id |
| `indicator_readings` | Lecturas/mediciones de KPIs | indicator_id |
| `audits` | Programa de auditoría | process_id |
| `audit_items` | Items del programa de auditoría (criterion, what_to_audit, how_to_audit, frequency, responsible, evidence_type) | audit_id |
| `sipoc_entries` | Mapeo SIPOC por proceso | process_id |
| `sipoc_suppliers` | Catálogo de proveedores SIPOC | company_id |
| `sipoc_customers` | Catálogo de clientes SIPOC | company_id |
| `catalog_items` | Opciones de dropdowns configurables | company_id |
| `value_activities` | Actividades clasificadas VA/NVA/NVABN | process_id, company_id |
| `change_log` | Historial de cambios en procesos | process_id (tabla real: `change_log`) |
| `ai_rate_limit_log` | Trazabilidad para rate limiting de IA | user_id |
| `ai_usage_log` | Log detallado de uso de IA | user_id |
| `plans` | Planes de suscripción (free/community/pro/max) | — |
| `plan_limits` | Límites de features por plan | plan_id |
| `subscriptions` | Suscripción por empresa | company_id (1:1) |
| `company_addons` | Add-ons adicionales (extra empresa, miembro, tokens) | company_id |
| `org_level_definitions` | Niveles del organigrama (Gerencia, Depto, Área...) | company_id |
| `org_units` | Unidades organizacionales con jerarquía | company_id, parent_id (self-ref) |
| `notifications` | Notificaciones in-app | user_id |

### Campos críticos de `processes`
Los procesos tienen 30+ columnas incluyendo metadata avanzada:
- **Banderas booleanas:** `is_critical`, `involves_cash_movement`, `has_tax_operations`, `affects_accounting`, `handles_personal_data`, `provided_by_third_party`, `has_contingency_plan`
- **Clasificación:** `process_type`, `execution_type`, `execution_level`, `execution_frequency`, `delivery_method`
- **Gestión:** `management`, `coordination`, `operative`, `supervision_level`
- **BPMN embebido:** `bpmn_xml` (legacy, se migra a `bpmn_diagrams`)

### Enum de base de datos
```sql
-- macroprocess_category
'estrategico' | 'productivo' | 'apoyo'
```

### Tabla de riesgos
- `risks` — tabla canónica en uso por `riskStore` (junto con `risk_controls`).
- La tabla alternativa `process_risks` fue eliminada en `20260417000003_drop_orphan_tables` (H-5 del plan de auditoría).

### Convención de nomenclatura de columnas
Todas las columnas de las tablas de dominio usan inglés (`name`, `description`, `frequency`, `target_value`, etc.). El contenido puede ser en español. La migración `20260417000001_consolidate_indicators_en` unificó `indicators` (removió `nombre`, `objetivo`, `umbral_verde`, etc.).

---

## STORES ZUSTAND (21 stores)

Todos usan `persist()` middleware con migración `identityMigration<T>()`.

### Stores críticos

```typescript
// Pattern de acceso cross-store (sin hook)
const companyId = useWorkspaceStore.getState().activeCompanyId

// Company scoping — SIEMPRE filtrar por companyId
const myProcesses = useProcessStore(s =>
  s.processes.filter(p => p.company_id === companyId)
)
```

| Store | Key localStorage | Estado principal |
|-------|-----------------|-----------------|
| `authStore` | lean-process-auth | user, profile, demoMode |
| `workspaceStore` | lean-process-workspace | companies[], activeCompanyId, subscription, addOns |
| `processStore` | lean-process-processes | macroprocesses[], processes[], levelDefinitions[] |
| `riskStore` | lean-process-risks | risks[] (con controles anidados) |
| `indicatorStore` | lean-process-indicators | indicators[] (StoredIndicator) |
| `procedureStore` | lean-process-procedures | procedures[] (StoredProcedure) |
| `auditStore` | lean-process-audits | audits: Record\<processId, AuditItem[]\> |
| `valueAnalysisStore` | lean-process-value-analysis | analyses: Record\<processId, ValueActivity[]\> |
| `companyStore` | lean-process-company | company, orgLevelDefinitions[], orgUnits[] |
| `changeLogStore` | lean-process-changelog | entries[] (max 100/proceso, purge 90d) |
| `analyticsStore` | lean-process-analytics | events[] (max 500), sessions[] (max 50) |
| `catalogStore` | lean-process-catalogs | suppliers, customers, sipocEntries, catalogItems |
| `achievementStore` | lean-process-achievements | achievements, totalPoints, communityQueue |
| `membershipStore` | lean-process-memberships | memberships[], invitations[] |
| `onboardingStore` | (features/onboarding) | milestones[], activeTooltip, showChecklist |

### Patrón de billing gate (dos pasos)
```typescript
// createCompany no crea directamente — primero evalúa la gate
const gate = workspaceStore.createCompany(data)
if (gate.requires_payment) {
  // mostrar UI de pago
  workspaceStore.confirmCreateCompany()  // confirma tras pago
}
```

---

## CAPA DE SERVICIOS

Todos los servicios devuelven `ServiceResult<T>` = `Promise<{data: T|null, error: Error|null}>`.

```typescript
import { companiesService } from '@/services'  // barrel export en services/index.ts

const { data, error } = await companiesService.getCompanies(userId)
```

| Servicio | Tablas que usa | Responsabilidad |
|---------|----------------|-----------------|
| `auth.service.ts` | profiles, auth.users | signIn, signUp, signOut, getProfile, resetPassword |
| `companies.service.ts` | companies, memberships | CRUD empresas + auto-crear membresía owner |
| `processes.service.ts` | macroprocesses, processes | CRUD jerarquía de procesos |
| `risks.service.ts` | risks, risk_controls | CRUD riesgos con controles anidados |
| `indicators.service.ts` | indicators, indicator_readings | CRUD KPIs y lecturas |
| `procedures.service.ts` | procedures, procedure_steps | CRUD procedimientos con pasos |
| `catalog.service.ts` | catalog_items, sipoc_* | CRUD catálogos y SIPOC |
| `memberships.service.ts` | memberships | Invitar/gestionar miembros |
| `storage.service.ts` | Buckets Supabase | Upload de avatares, logos, BPMN XML |
| `changeLog.service.ts` | change_log | Insertar/consultar historial de cambios |

---

## HOOKS CLAVE

```typescript
// Hook central — filtra TODOS los stores por empresa activa
const { macroprocesses, processes, risks, indicators, analyses, procedures } =
  useCompanyScopedData()

// Puntuación de completitud de proceso (0-100%)
const healthMap: ProcessHealthMap = useProcessHealth()  // Record<processId, {score, checks}>

// Estado de carga async con error handling
const { loading, error, run } = useAsync()
await run(async () => { /* operación async */ })

// Empresa activa + billing
const { activeCompany, canPerformAction, availableSeats } = useActiveCompany()

// Contexto estructurado para el consultor IA
const context = useAdvisorContext()  // Resumen completo de la empresa para prompts

// Shortcuts de teclado globales
useKeyboardShortcuts()  // Ctrl+K para búsqueda, etc.

// Sync inicial de Supabase al cambiar empresa
useWorkspaceSync()  // Dispara loadFromDB en todos los stores al cambiar activeCompanyId
```

---

## CONVENCIONES DE CÓDIGO

### Nomenclatura

| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Componente React | PascalCase.tsx | `RiskPanel.tsx`, `SlideRenderer.tsx` |
| Hook | camelCase con prefijo `use` | `useAsync.ts`, `useProcessHealth.ts` |
| Store Zustand | camelCase con sufijo `Store` | `riskStore.ts`, `processStore.ts` |
| Servicio | camelCase con sufijo `.service.ts` | `risks.service.ts` |
| Schema Zod | camelCase con sufijo `.schema.ts` | `risk.schema.ts` |
| Utilidad | camelCase | `id.ts`, `storeUtils.ts` |
| Constante global | SCREAMING_SNAKE_CASE | `MAX_EVENTS = 500` |
| Feature folder | kebab-case | `value-analysis/`, `org-structure/` |

### Idioma del código
- **Variables, funciones, interfaces:** inglés (`processName`, `RiskItem`, `loadFromDB`)
- **Comentarios:** español (el equipo es hispanohablante)
- **UI labels / mensajes de error al usuario:** español
- **Campos de DB (snake_case):** inglés (`company_id`, `risk_event`)

### Estructura interna de componentes React
```tsx
// 1. Imports externos (react, librerías)
// 2. Imports internos (stores, hooks, utils, types)
// 3. Tipos/interfaces locales (si son pequeños)
// 4. Constantes del módulo
// 5. Componente principal
//    a. Props destructuring
//    b. Hooks de store/contexto
//    c. Estado local (useState)
//    d. Refs (useRef)
//    e. Efectos (useEffect) — máximo 2 por componente
//    f. Handlers (handle* con nombre descriptivo, NO handleClick genérico)
//    g. Lógica derivada / memos
//    h. Return JSX
// 6. Export
```

### Reglas críticas
- **Sin `any` nuevo** — usar `unknown` + type guard, o `as unknown as T` para conversiones legítimas
- **Sin `console.log`** — `console.warn` para situaciones inesperadas, nada en happy path
- **Sin comentarios obvios** — solo comentar el *por qué*, no el *qué*
- **Máximo 300 líneas por archivo** — si supera, dividir en módulos
- **Máximo 3 props drilling** — usar store o contexto si necesitas pasar props >2 niveles
- **Máximo 2 `useEffect` por componente** — extraer a custom hook si necesitas más
- **Handlers descriptivos** — `handleOutsideClick`, `handleSlideAreaClick`, NO `handleClick`

---

## ONBOARDING (10 hitos)

El sistema de onboarding guía al usuario con tours Joyride y comprueba completitud automáticamente.

| # | Milestone ID | Descripción | Ruta |
|---|-------------|-------------|------|
| 1 | `company` | Configurar empresa (nombre + industria) | `/app/settings` |
| 2 | `org-structure` | Crear organigrama | `/app/org-structure` |
| 3 | `process-map` | Crear macroproceso + subproceso | `/app/process-map` |
| 4 | `bpmn` | Crear primer diagrama BPMN | `/app/process-map` |
| 5 | `procedure` | Generar procedimiento con IA | proceso/procedure |
| 6 | `kpi` | Definir indicadores | proceso/indicators |
| 7 | `risk` | Identificar riesgos | proceso/characterization |
| 8 | `audit` | Crear programa de auditoría | proceso/characterization |
| 9 | `value-analysis` | Clasificar actividades VA/NVA | proceso/characterization |
| 10 | `report` | Exportar primer reporte | `/app/reports` |

---

## GAMIFICACIÓN

- **30+ logros** organizados en categorías (procesos, riesgos, documentación, análisis, maestría, comunidad)
- Sistema de puntos con niveles
- **Circle.so integration**: https://process-masters.circle.so (compartir logros)
- **N8N webhook**: `communityQueue` en `achievementStore` produce eventos para consumo por N8N
  - Eventos: `achievement_unlocked`, `milestone_reached`, `report_shared`, `process_published`

---

## EXPORTACIÓN DE DOCUMENTOS

| Formato | Función | Archivo |
|---------|---------|---------|
| Word (.docx) | `exportProcedureToDocx()` | `src/utils/procedureDocxExporter.ts` |
| Excel (.xlsx) | `exportIndicatorsToExcel()` | `src/utils/indicatorExcelExporter.ts` |
| PDF | `exportToPdf()` (dentro de PresentationPage, no extraíble) | `src/features/presentation/pages/PresentationPage.tsx` |
| PowerPoint (.pptx) | `exportPresentationToPptx()` | `src/features/presentation/pptxExport.ts` |
| Reporte general | `exportReport()` | `src/utils/reportExporter.ts` |

**Nota importante:** `exportToPdf` en PresentationPage NO puede extraerse a módulo separado porque muta estado React (`setCurrent`, `setFade`) para renderizar cada slide antes de capturarlo con html2canvas.

---

## PATRONES ESPECIALES

### Company scoping universal
Todos los datos están filtrados por `activeCompanyId`. El hook `useCompanyScopedData()` es el punto de entrada estándar para consumir datos en componentes.

### Changelog automático
Las acciones críticas (crear proceso, generar BPMN, documentar procedimiento, identificar riesgos) insertan entradas automáticamente en `changeLogStore`. Los tipos de acción son:
`created | bpmn_updated | procedure_generated | risks_identified | kpis_defined | audit_created | value_analyzed | manual_edit`

### BPMN auto-save
El hook `useBpmnAutoSave` (en `src/features/process/hooks/`) gestiona el guardado automático del XML BPMN con debounce. Recibe `blankBpmn` como parámetro (el valor inicial en blanco) porque la constante vive en `src/pages/` y el hook en `src/features/`.

### Proceso de entrevista conversacional IA
`conductProcessInterview()` en `claude.ts` usa el marcador `"ENTREVISTA_COMPLETA"` en el texto del LLM para detectar cuándo terminar la entrevista antes de generar el BPMN.

### Clasificación de riesgos (5×5 matrix)
```typescript
RiskLevel = f(probability × impact)
// Extremo: ≥15 | Alto: 8-14 | Moderado: 3-7 | Bajo: 1-2

EffectivenessLevel = f(controlScore)
// score 8-12: Deficiente | 13-16: Débil | 17-24: Regular | 25-32: Bueno | 33-40: Óptimo
```

---

## DESPLIEGUE

### Vercel (producción)
```json
// vercel.json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [{ "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }]
}
```
- Build: `npm run build`
- Output: `dist/`
- Variables de entorno en Vercel Dashboard (NO incluir `VITE_DEMO_MODE_ENABLED`)

### Supabase Edge Functions
```bash
# Desplegar la función ai-proxy
supabase functions deploy ai-proxy --project-ref hucebvuhyedqbfhyzybo

# Configurar secretos
supabase secrets set GEMINI_API_KEY=<key> --project-ref hucebvuhyedqbfhyzybo
```

### Almacenamiento (4 buckets)
| Bucket | Contenido | Acceso |
|--------|-----------|--------|
| `avatars` | Fotos de perfil | Público lectura, user-scoped escritura |
| `company-assets` | Logos de empresa | Público lectura, autenticado escritura |
| `bpmn-diagrams` | XML de diagramas BPMN | Solo autenticados |
| `procedure-exports` | PDFs exportados | Solo autenticados |

---

## CI/CD (GitHub Actions)

`.github/workflows/ci.yml` ejecuta en cada push/PR que toca el proyecto:
1. `npx tsc -b` — verificación de tipos
2. `npm run lint` — ESLint
3. `npm run test` — 37 tests (Vitest)
4. `npm run build` — build de producción

Requiere secrets en GitHub: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

---

## TESTING

**37 tests** cubriendo las partes más críticas:

| Archivo test | Qué verifica |
|-------------|-------------|
| `src/utils/id.test.ts` | `generateId()` retorna UUID v4 único |
| `src/lib/aiSanitizer.test.ts` | Sanitización de prompt injection, schemas Zod |
| `src/lib/schemas/risk.schema.test.ts` | Validación RiskRowSchema y ControlRowSchema |
| `src/hooks/useAsync.test.ts` | Loading/error/reset/estabilidad de referencia |

Configuración: `jsdom` environment, globals habilitados, coverage umbral 60% en utils/schemas/hooks.

---

## PRECAUCIONES ESPECÍFICAS

1. **Nunca modificar RLS** sin verificar que no rompe acceso multi-tenant.
2. **Nunca hacer `supabase.from()` sin filtro de company_id** — rompe el aislamiento de datos.
3. **El proyecto Supabase de LeanProcess es `hucebvuhyedqbfhyzybo`** — verificar antes de migraciones SQL.
4. **`exportToPdf` en PresentationPage** no puede refactorizarse sin reescribir el flujo completo (muta estado React para renderizar slides).
5. **Demo mode** solo funciona con `VITE_DEMO_MODE_ENABLED=true`. En producción está deshabilitado por diseño.
6. **Los stores persisten en localStorage** — cambios en la estructura de un store requieren incrementar la versión e implementar migración.
7. **`change_log`** es el nombre real de la tabla en DB (NO `process_change_log`).
8. **Tabla `memberships`** es el nombre real (NO `company_memberships`).

---

## ARQUITECTURA MULTI-TENANT (B2C)

```
Usuario (auth.users)
  └── Profiles (perfil + plan)
        └── Companies[] (workspaces — un usuario puede tener N empresas)
              ├── Memberships[] (otros usuarios del equipo)
              ├── Processes[]
              ├── Risks[]
              ├── Indicators[]
              └── ...todo filtrado por company_id
```

Un usuario puede ser:
- **Owner** de múltiples empresas
- **Member** (admin/editor/viewer) de empresas de otros usuarios

El `workspaceStore` gestiona todas las empresas de un usuario y mantiene `activeCompanyId` como empresa activa. Todo el data layer filtra por este ID.

---

*Última actualización: 2026-04-14 — Fase 5 de refactorización completa (Seguridad + Fundamentos + Features + Monolitos + Calidad)*
