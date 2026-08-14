# LeanProcess × Circle.so — Sincronización de Puntos

> **Versión:** 1.0 | **Fecha:** 2026-04-28
> **Proyecto Supabase:** `bpqqtcpbjjlfcaiuselu`
> **Comunidad Circle:** https://process-masters.circle.so

---

## Índice

1. [Contexto y objetivo](#1-contexto-y-objetivo)
2. [Por qué no hay endpoint directo en Circle](#2-por-qué-no-hay-endpoint-directo-en-circle)
3. [La solución: posts sintéticos en espacio oculto](#3-la-solución-posts-sintéticos-en-espacio-oculto)
4. [Arquitectura completa](#4-arquitectura-completa)
5. [Schema de base de datos](#5-schema-de-base-de-datos)
6. [Lógica de sumatoria de puntos (delta)](#6-lógica-de-sumatoria-de-puntos-delta)
7. [Configuración de Circle (manual)](#7-configuración-de-circle-manual)
8. [Diseño del workflow N8N nodo por nodo](#8-diseño-del-workflow-n8n-nodo-por-nodo)
9. [Onboarding de nuevos miembros Circle](#9-onboarding-de-nuevos-miembros-circle)
10. [Consumo de API calls — cálculo y presupuesto](#10-consumo-de-api-calls--cálculo-y-presupuesto)
11. [Variables de entorno en N8N](#11-variables-de-entorno-en-n8n)
12. [Gestión de errores y reintentos](#12-gestión-de-errores-y-reintentos)
13. [Verificación y testing](#13-verificación-y-testing)

---

## 1. Contexto y objetivo

LeanProcess tiene un sistema de logros con **25 achievements** agrupados en 6 categorías.
Cada logro otorga puntos al usuario (10–150 pts por logro, máximo 1,315 pts totales).

El objetivo es que esos puntos aparezcan en el ranking de la comunidad **Process Masters** en Circle.so, de modo que los miembros puedan:

- Subir de rango dentro de Circle
- Acceder a beneficios exclusivos por nivel
- Ver su progreso en el leaderboard de la comunidad

**Constraint crítico:** Límite de **1,500 llamadas API/mes** a Circle. Por eso se usa un modelo de **batch semanal** (domingo 23:59 o lunes 02:00), no un disparo por cada logro.

---

## 2. Por qué no hay endpoint directo en Circle

Circle.so no expone un endpoint `POST /points/add` ni `PATCH /member/score`. Su sistema de puntos (gamification) funciona de forma **reactiva**: los puntos se otorgan automáticamente cuando un miembro realiza actividades dentro de la plataforma (crear posts, comentar, completar cursos, etc.).

No es un bug ni una omisión — es una decisión de diseño de Circle para evitar manipulación artificial del ranking.

---

## 3. La solución: posts sintéticos en espacio oculto

**Workaround documentado y estable:**

1. Se crea un **espacio oculto** en Circle llamado "LP Sync" (invisible para todos los miembros, no aparece en ningún feed ni búsqueda).
2. Se configura una **regla de gamificación** en Circle: "otorgar 10 puntos cada vez que un miembro crea un post en el espacio LP Sync".
3. Cuando N8N necesita sumar N puntos a un miembro, crea `N ÷ 10` posts en ese espacio **en nombre del miembro** usando el token de admin de Circle.
4. Circle detecta los posts, aplica la regla, y suma los puntos al score del miembro automáticamente.

**¿Por qué 10 pts/post y no 1?** Todos los logros de LeanProcess tienen valores múltiplos de 5 (mínimo 10 pts, máximo 150 pts). Con la regla de 10 pts/post, el logro más pequeño requiere 1 post y el más grande (Lean Process Master, 150 pts) requiere 15 posts. Esto mantiene el consumo de API calls bajo.

---

## 4. Arquitectura completa

```
┌─────────────────────────────────────┐
│  LeanProcess (React SPA)            │
│                                     │
│  useAchievementTracker              │
│    → unlockAchievement(id)          │
│    → INSERT user_achievements       │
│    → totalPoints acumulado en store │
└────────────────┬────────────────────┘
                 │ (datos en Supabase)
                 ↓
┌─────────────────────────────────────┐
│  Supabase                           │
│                                     │
│  user_achievements                  │
│    ← logros por usuario             │
│  profiles                           │
│    ← circle_member = true/false     │
│    ← circle_member_id (ID Circle)   │
│    ← circle_last_synced_pts         │
│  gamification_sync (VIEW)           │
│    ← total_points (calculado)       │
│    ← delta_points (calculado)       │
│    ← posts_to_create (calculado)    │
└────────────────┬────────────────────┘
                 │
        Domingo 23:59 (cron)
                 ↓
┌─────────────────────────────────────┐
│  N8N Workflow: circle-weekly-sync   │
│                                     │
│  1. Cron Trigger (domingo 23:59)    │
│  2. Crear registro en circle_sync_  │
│     runs (status='running')         │
│  3. GET gamification_sync           │
│     WHERE delta_points > 0          │
│     AND circle_member_id IS NOT NULL│
│  4. Para cada usuario:              │
│     Loop N veces (posts_to_create): │
│       POST /api/v1/posts → Circle   │
│       (espacio LP Sync, como member)│
│       Wait 400ms                    │
│  5. PATCH profiles                  │
│     SET circle_last_synced_pts =    │
│         total_points                │
│  6. Actualizar circle_sync_runs     │
│     status='completed'              │
└────────────────┬────────────────────┘
                 │ N posts por usuario
                 ↓
┌─────────────────────────────────────┐
│  Circle.so — Espacio "LP Sync"      │
│                                     │
│  Regla gamificación:                │
│  +10 pts por post en LP Sync        │
│                                     │
│  → Score del miembro se actualiza   │
│  → Ranking de comunidad refleja     │
│     los logros de LeanProcess       │
└─────────────────────────────────────┘
```

---

## 5. Schema de base de datos

### Tabla `profiles` (columnas agregadas)

```sql
circle_member_id       TEXT    NULL
  -- ID numérico del miembro en Circle (ej: "123456")
  -- Obtenido via GET /api/v1/community_members?email={email}
  -- NULL = usuario aún no resuelto → N8N lo ignora en el batch

circle_last_synced_pts INT     NOT NULL DEFAULT 0
  -- Puntos que ya fueron sincronizados exitosamente a Circle
  -- Se actualiza al final de cada batch exitoso
  -- NUNCA decrece (los puntos en Circle son acumulativos)
```

### Vista `gamification_sync`

La vista es el **único punto de entrada para N8N**. Solo es accesible con `service_role` key.

```sql
-- Columnas de la vista
email                  TEXT       -- email del usuario
user_id                UUID       -- ID en Supabase (auth.users)
full_name              TEXT
circle_member          BOOLEAN    -- siempre true (filtro de la vista)
circle_member_id       TEXT       -- ID en Circle (puede ser NULL)
circle_last_synced_pts INT        -- puntos ya enviados a Circle
achievements_count     INT        -- cantidad de logros desbloqueados
total_points           INT        -- suma de puntos de todos los logros activos
delta_points           INT        -- total_points - circle_last_synced_pts (≥ 0)
posts_to_create        INT        -- CEIL(delta_points / 10) — posts que N8N debe crear
last_achievement_at    TIMESTAMPTZ
```

**Ejemplo:**

| usuario | total_points | circle_last_synced_pts | delta_points | posts_to_create |
|---------|-------------|----------------------|--------------|-----------------|
| ana@empresa.com | 150 | 100 | 50 | 5 |
| carlos@corp.io | 75 | 0 | 75 | 8 |
| luis@startup.co | 200 | 200 | 0 | 0 (no procesado) |

### Tabla `circle_sync_runs`

Registro de auditoría de cada ejecución semanal.

```sql
id               UUID        PK
run_at           TIMESTAMPTZ -- cuándo inició el batch
users_processed  INT         -- usuarios con delta > 0 procesados
posts_created    INT         -- total de posts creados en Circle esta semana
api_calls_used   INT         -- llamadas API reales consumidas
status           TEXT        -- 'running' | 'completed' | 'partial' | 'failed'
error_details    JSONB       -- detalles si hubo errores por usuario
completed_at     TIMESTAMPTZ -- cuándo terminó
```

---

## 6. Lógica de sumatoria de puntos (delta)

**Principio fundamental:** Circle no permite "setear" un score directamente. Solo se pueden AGREGAR puntos. Por lo tanto, LeanProcess trackea cuántos puntos ya fueron enviados y solo envía la diferencia.

```
Semana 1:
  total_points = 50, circle_last_synced_pts = 0
  delta = 50 → crear 5 posts → Circle: +50 pts
  Al finalizar: circle_last_synced_pts ← 50

Semana 2 (usuario ganó 30 pts más):
  total_points = 80, circle_last_synced_pts = 50
  delta = 30 → crear 3 posts → Circle: +30 pts
  Al finalizar: circle_last_synced_pts ← 80

Semana 3 (usuario inactivo):
  total_points = 80, circle_last_synced_pts = 80
  delta = 0 → NO se procesa → 0 API calls
```

**Invariantes del sistema:**
- `circle_last_synced_pts` NUNCA puede superar `total_points`
- `delta_points` es siempre ≥ 0 (la vista usa `GREATEST(..., 0)`)
- Si N8N falla a mitad del loop de un usuario, `circle_last_synced_pts` NO se actualiza → en la próxima ejecución semanal se reintentará el delta completo (puede haber puntos duplicados en Circle si algunos posts ya se crearon; es aceptable dado que Circle no permite rollback)

**Redondeo:** `posts_to_create = CEIL(delta / 10)`. Si un delta es 15 pts, se crean 2 posts (= 20 pts en Circle). El usuario recibe 5 pts "de gracia". Esto es aceptable y evita fracciones de post.

Todos los logros actuales son múltiplos de 5. Un delta siempre será múltiplo de 5 dado que la diferencia entre dos múltiplos de 5 es también múltiplo de 5. Con regla de 10 pts/post: los únicos casos con redondeo son deltas de 5 pts (1 post = 10 pts). Se considera tolerable.

---

## 7. Configuración de Circle (manual, una sola vez)

### 7.1 Crear espacio oculto "LP Sync"

1. Ir a Circle admin → **Spaces** → **New Space**
2. Nombre: `LP Sync` (o cualquier nombre interno)
3. Visibility: **Hidden** (no aparece para miembros ni en búsquedas)
4. Desactivar notificaciones del espacio
5. Copiar el **Space ID** (visible en la URL del espacio en el panel admin)

### 7.2 Crear regla de gamificación

1. Ir a **Settings** → **Gamification** → **Rules** → **Add Rule**
2. Trigger: **"Member creates a post"**
3. Condition: **"In space: LP Sync"**
4. Points: **10**
5. Guardar y activar la regla

### 7.3 Obtener credenciales de API

1. Ir a **Settings** → **API** → generar token
2. Guardar el token como `CIRCLE_API_TOKEN` en N8N
3. Obtener `CIRCLE_COMMUNITY_ID` haciendo:
   ```
   GET https://app.circle.so/api/v1/spaces
   Authorization: Token {CIRCLE_API_TOKEN}
   ```
   Buscar el espacio "LP Sync" en la respuesta y copiar `community_id` y el `id` del espacio.

### 7.4 Valores a configurar en N8N

| Variable | Cómo obtenerla |
|----------|---------------|
| `CIRCLE_API_TOKEN` | Panel admin → Settings → API |
| `CIRCLE_COMMUNITY_ID` | Response de GET /api/v1/spaces |
| `CIRCLE_SYNC_SPACE_ID` | `id` del espacio "LP Sync" en el mismo response |

---

## 8. Diseño del workflow N8N nodo por nodo

### Workflow A: `circle-weekly-sync` (principal)

**Trigger:** Cron — todos los domingos a las 23:59

---

**Nodo 1: Cron Trigger**
```
Type: Schedule Trigger
Rule: 0 59 23 * * 0   (domingo 23:59)
```

---

**Nodo 2: Crear registro de ejecución**
```
Type: HTTP Request
Method: POST
URL: {{$env.SUPABASE_URL}}/rest/v1/circle_sync_runs
Headers:
  apikey: {{$env.SUPABASE_SERVICE_ROLE_KEY}}
  Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}
  Content-Type: application/json
  Prefer: return=representation
Body:
  { "status": "running" }

→ Guardar response[0].id como run_id para los siguientes nodos
```

---

**Nodo 3: Obtener usuarios con delta pendiente**
```
Type: HTTP Request
Method: GET
URL: {{$env.SUPABASE_URL}}/rest/v1/gamification_sync
     ?delta_points=gt.0
     &circle_member_id=not.is.null
     &select=user_id,email,full_name,circle_member_id,
             total_points,delta_points,posts_to_create
Headers:
  apikey: {{$env.SUPABASE_SERVICE_ROLE_KEY}}
  Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}

→ Retorna array de usuarios a sincronizar esta semana
```

---

**Nodo 4: IF — ¿hay usuarios?**
```
Type: IF
Condition: {{$json.length}} > 0
  → True: continuar al Nodo 5
  → False: saltar a Nodo 9 (marcar completed, 0 users)
```

---

**Nodo 5: Split — procesar usuario por usuario**
```
Type: Split In Batches
Batch Size: 1
(procesa un usuario a la vez para facilitar el manejo de errores)
```

---

**Nodo 6: Generar array de posts a crear**
```
Type: Function
// Para el usuario actual, crear un array de N elementos donde N = posts_to_create
const user = $input.item.json
const posts = []
for (let i = 0; i < user.posts_to_create; i++) {
  posts.push({
    user_id: user.user_id,
    email: user.email,
    circle_member_id: user.circle_member_id,
    total_points: user.total_points,
    post_index: i + 1,
    total_posts: user.posts_to_create
  })
}
return posts.map(p => ({ json: p }))
```

---

**Nodo 7: Loop — crear posts en Circle**
```
Type: Split In Batches
Batch Size: 1
  ↓ Para cada post:
```

**Nodo 7a: Crear post en Circle**
```
Type: HTTP Request
Method: POST
URL: https://app.circle.so/api/v1/posts
Headers:
  Authorization: Token {{$env.CIRCLE_API_TOKEN}}
  Content-Type: application/json
Body:
  {
    "community_id": "{{$env.CIRCLE_COMMUNITY_ID}}",
    "space_id": "{{$env.CIRCLE_SYNC_SPACE_ID}}",
    "member_id": "{{$json.circle_member_id}}",
    "name": "sync",
    "body": ".",
    "is_published": false,
    "skip_notifications": true
  }

Error handling: continuar en error (no abortar el loop)
Retry: 3 intentos, backoff exponencial 2s/4s/8s
```

**Nodo 7b: Wait entre posts**
```
Type: Wait
Duration: 400ms
(respeta el rate limit de Circle: 60 req/min → 400ms da margen 2.5×)
```

---

**Nodo 8: Actualizar circle_last_synced_pts en Supabase**

*Se ejecuta una vez por usuario, DESPUÉS de que su loop de posts termine.*

```
Type: HTTP Request
Method: PATCH
URL: {{$env.SUPABASE_URL}}/rest/v1/profiles
     ?id=eq.{{$json.user_id}}
Headers:
  apikey: {{$env.SUPABASE_SERVICE_ROLE_KEY}}
  Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}
  Content-Type: application/json
Body:
  { "circle_last_synced_pts": {{$json.total_points}} }

IMPORTANTE: solo se ejecuta si el loop del Nodo 7 completó sin errores críticos.
Si hubo errores en TODOS los posts del usuario → no actualizar (se reintentará la próxima semana).
```

---

**Nodo 9: Actualizar circle_sync_runs — completed**
```
Type: HTTP Request
Method: PATCH
URL: {{$env.SUPABASE_URL}}/rest/v1/circle_sync_runs
     ?id=eq.{{run_id}}
Headers: (mismo service_role)
Body:
  {
    "status": "completed",
    "users_processed": {{total_usuarios_procesados}},
    "posts_created": {{total_posts_creados}},
    "api_calls_used": {{total_posts_creados}},
    "completed_at": "{{new Date().toISOString()}}"
  }
```

---

### Workflow B: `circle-member-id-lookup` (onboarding)

**Trigger:** Supabase Webhook en UPDATE de `profiles` donde `circle_member` cambia de `false` a `true`.

ó alternativamente: llamarlo manualmente desde N8N cuando se necesita poblar `circle_member_id` para usuarios existentes.

**Nodos:**

1. **Webhook / Manual Trigger** — recibe `user_id` y `email`
2. **GET Circle member by email:**
   ```
   GET https://app.circle.so/api/v1/community_members
       ?email={email}&community_id={CIRCLE_COMMUNITY_ID}
   Authorization: Token {CIRCLE_API_TOKEN}
   ```
3. **IF** — ¿encontrado?
   - Sí: extraer `id` del primer resultado → PATCH `profiles` con `circle_member_id`
   - No: loggear que el usuario no está en Circle (puede que no se haya unido aún)
4. **PATCH profiles:**
   ```
   PATCH /rest/v1/profiles?id=eq.{user_id}
   Body: { "circle_member_id": "{circle_id_encontrado}" }
   ```

---

### Workflow C: `circle-backfill` (one-shot, ejecutar una vez)

Para poblar `circle_member_id` de todos los usuarios existentes con `circle_member = true`.

1. **Manual Trigger**
2. **GET gamification_sync** WHERE `circle_member_id IS NULL`
3. **Split In Batches** (batch size 1)
4. Por cada usuario: mismo lookup que Workflow B (nodos 2-4)
5. **Wait 1000ms** entre usuarios (el lookup de miembros es una llamada API adicional)

---

## 9. Onboarding de nuevos miembros Circle

Cuando un usuario de LeanProcess se une a la comunidad Process Masters:

1. El usuario (o un admin) activa `circle_member = true` en su perfil de LeanProcess
2. Se dispara el **Workflow B** automáticamente (via Supabase webhook) o manualmente
3. N8N busca al usuario en Circle por su email
4. Si lo encuentra: guarda el `circle_member_id` en `profiles`
5. En el próximo batch del domingo: sus puntos acumulados se sincronizan completos (delta = total_points - 0 = total_points)

**Nota:** El usuario recibirá todos sus puntos históricos en el primer batch, no progresivamente. Esto es intencional — refuerza el comportamiento de "recompensa al unirse".

---

## 10. Consumo de API calls — cálculo y presupuesto

**Presupuesto mensual:** 1,500 llamadas API a Circle

**Por batch semanal:** ~375 llamadas disponibles (1,500 ÷ 4 semanas)

**Consumo por usuario activo** (usuario que ganó puntos esa semana):

| Puntos ganados esa semana | Posts a crear | API calls |
|--------------------------|---------------|-----------|
| 10 pts (1 logro bronze)  | 1             | 1         |
| 30 pts (2-3 logros)      | 3             | 3         |
| 50 pts (logro gold)      | 5             | 5         |
| 150 pts (logro platinum) | 15            | 15        |

**Capacidad del sistema:**

| Usuarios activos/semana | Pts promedio ganados | API calls/semana | ¿Dentro del presupuesto? |
|------------------------|---------------------|-----------------|--------------------------|
| 30                     | 30 pts              | ~90             | ✅ Muy holgado           |
| 75                     | 30 pts              | ~225            | ✅ Holgado               |
| 150                    | 30 pts              | ~450            | ✅ OK                    |
| 300                    | 20 pts              | ~600            | ✅ OK                    |
| 375                    | 10 pts              | ~375            | ✅ En el límite          |

**Usuarios inactivos** esa semana = **0 llamadas API**. El sistema escala bien porque solo los usuarios que realmente ganaron puntos consumen el presupuesto.

**Si se supera el presupuesto:** aumentar la regla de Circle a 20 pts/post (divide las llamadas por 2) o limitar el batch a los top N usuarios por delta_points de esa semana.

---

## 11. Variables de entorno en N8N

Configurar como credenciales en N8N → Settings → Credentials:

```
SUPABASE_URL              = https://bpqqtcpbjjlfcaiuselu.supabase.co
SUPABASE_SERVICE_ROLE_KEY = <service_role_key del proyecto>
CIRCLE_API_TOKEN          = <token generado en Circle admin>
CIRCLE_COMMUNITY_ID       = <ID numérico de la comunidad Process Masters>
CIRCLE_SYNC_SPACE_ID      = <ID del espacio oculto "LP Sync">
```

**Importante:** El `SUPABASE_SERVICE_ROLE_KEY` tiene acceso completo a la DB. Nunca exponerlo en el cliente ni en logs. Usarlo únicamente en N8N y en Edge Functions del servidor.

---

## 12. Gestión de errores y reintentos

### Errores en el loop de posts (Nodo 7a)

| Escenario | Comportamiento |
|-----------|---------------|
| Circle API retorna 429 (rate limit) | N8N reintenta con backoff 2s → 4s → 8s. Si falla 3 veces, marca ese post como fallido pero continúa con el siguiente usuario. |
| Circle API retorna 404 (member not found) | El `circle_member_id` puede estar desactualizado. Loggear en `error_details` de `circle_sync_runs`. NO actualizar `circle_last_synced_pts`. |
| Circle API retorna 5xx | Reintento con backoff. Si persiste, marcar usuario como fallido en `error_details`. |
| N8N se cae a mitad del batch | `circle_sync_runs` queda en status `running`. Ejecutar el batch manualmente. Como `circle_last_synced_pts` no se actualizó para los usuarios fallidos, el delta persiste y serán reintentados en el próximo domingo. |

### Detección de doble sync

Si un batch se ejecuta dos veces en la misma semana (error de operador):
- `circle_last_synced_pts` ya fue actualizado en la primera ejecución
- En la segunda ejecución, `delta_points = 0` para todos los usuarios ya procesados
- → 0 posts creados → 0 duplicados ✅

### Status `partial`

Si al menos un usuario fue procesado exitosamente pero otros fallaron:
- Actualizar `circle_sync_runs.status = 'partial'`
- Guardar en `error_details` el array de usuarios fallidos con el motivo
- En el próximo domingo, esos usuarios tendrán su delta intacto y serán reintentados automáticamente

---

## 13. Verificación y testing

### Test de la vista (en Supabase SQL Editor con service_role)

```sql
-- Ver usuarios Circle con sus deltas
SELECT email, circle_member_id, total_points,
       circle_last_synced_pts, delta_points, posts_to_create
FROM gamification_sync
ORDER BY delta_points DESC;

-- Ver historial de sincronizaciones
SELECT * FROM circle_sync_runs ORDER BY run_at DESC LIMIT 10;
```

### Test del workflow N8N

1. Ejecutar **Workflow B** manualmente con el email de un usuario de prueba → verificar que `circle_member_id` se guarda en `profiles`
2. Modificar directamente en Supabase: `UPDATE profiles SET circle_last_synced_pts = 0 WHERE email = 'test@example.com'` para forzar un delta alto
3. Ejecutar **Workflow A** manualmente → verificar que se crean posts en el espacio LP Sync de Circle
4. Verificar en Circle que el score del miembro de prueba aumentó
5. Verificar que `circle_sync_runs` tiene un registro con `status = 'completed'`
6. Verificar que `profiles.circle_last_synced_pts` fue actualizado

### Checklist de go-live

- [ ] Espacio "LP Sync" creado y oculto en Circle
- [ ] Regla de gamificación activa: 10 pts/post en LP Sync
- [ ] Variables de entorno configuradas en N8N
- [ ] Workflow A importado y activado con el cron correcto
- [ ] Workflow B conectado al webhook de Supabase (o configurado para ejecución manual)
- [ ] Workflow C ejecutado una vez para backfill de usuarios existentes
- [ ] Test end-to-end verificado con usuario real
- [ ] Migración `20260428000001_circle_sync_tables.sql` aplicada en producción
