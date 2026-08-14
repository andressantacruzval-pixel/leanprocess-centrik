# Lean Process — Correr en LOCAL (aislado de producción)

Esta guía levanta la app completa en tu máquina con una base de datos Supabase
**local** (Docker), sin tocar producción y sin depender del "Hub Lite" externo.

> Todo lo local vive en tu equipo. Nada de esto se conecta a Supabase de
> producción ni consume tu cuota real. La IA (Gemini) es opcional.

---

## 1. Requisitos

| Herramienta | Versión | Nota |
|-------------|---------|------|
| Node.js | 22.x LTS | `node -v` |
| npm | 10.x | viene con Node |
| Docker | Desktop en marcha | necesario para Supabase local |

---

## 2. Instalar dependencias

```bash
npm install
```

## 3. Levantar Supabase local

El primer arranque descarga imágenes de Docker (unos minutos). Aplica **todas
las migraciones** de `supabase/migrations/` y el `supabase/seed.sql`
automáticamente.

```bash
npx supabase start
```

Al terminar imprime las URLs y llaves. Puedes volver a verlas con:

```bash
npx supabase status
```

Servicios locales típicos:

| Servicio | URL |
|----------|-----|
| API / Auth / REST | http://127.0.0.1:54321 |
| Supabase Studio (ver la BD) | http://127.0.0.1:54323 |
| Correos de prueba (Mailpit) | http://127.0.0.1:54324 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

## 4. Crear el archivo `.env`

Crea `.env` en la raíz apuntando al Supabase local. La `anon key` local es
estándar (la que imprime `npx supabase status`, campo `ANON_KEY`):

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<pega aquí ANON_KEY de "npx supabase status">

# Opcional — sin esto la app funciona, pero las funciones de IA no.
VITE_GEMINI_API_KEY=
```

## 5. Arrancar la app

```bash
npm run dev
```

Abre **http://localhost:5173**.

## 6. Entrar (registro / login LOCAL)

En local NO existe el "Hub Lite", así que la propia app muestra un formulario de
login/registro (rutas `/login` y `/register`). El botón **Registrarse** /
**Iniciar sesión** de la landing ya apuntan ahí automáticamente cuando corres en
`localhost`.

> ⚠️ El registro está restringido a "miembros de la comunidad" por un trigger de
> la base (`community_whitelist`). El `seed.sql` ya habilita un correo de
> desarrollo:
>
> - **Correo:** `dev@local.test`
> - **Contraseña:** la que quieras (mínimo 6 caracteres)
>
> Para habilitar más correos, edita `supabase/seed.sql` y corre
> `npx supabase db reset`, o insértalos en la tabla `community_whitelist` desde
> Supabase Studio.

Tras registrarte entrarás al **onboarding** (define tu empresa) y de ahí al
**Dashboard**.

---

## Comandos útiles

```bash
npm run build      # build de producción (tsc + vite)
npm run test       # tests (vitest)
npx supabase stop  # apagar la BD local (conserva datos)
npx supabase db reset   # recrear la BD desde migraciones + seed (borra datos)
```

---

## Qué se ajustó para que corriera en local

La app y el Hub "Lite" comparten una misma base Supabase en producción y sus
migraciones están repartidas en dos repos; este repo es solo la mitad (App).
Para poder levantar todo **en local desde cero** se añadió, de forma aislada e
idempotente (no afecta producción):

- **`src/features/auth/pages/LocalLoginPage.tsx`** — login/registro que solo se
  activa en `localhost` (usa el `auth.service` que ya existía). En producción el
  flujo sigue yendo al Hub Lite igual que antes.
- **`src/features/auth/lite.tsx`** y **`src/App.tsx`** — en `localhost` (y sin
  `VITE_LITE_URL`) los enlaces de login/registro usan las rutas locales.
- **`supabase/migrations/20260731000000_local_dev_lite_contract.sql`** — recrea
  el contrato que normalmente aporta el repo de Lite (`profiles.plan_type`,
  `plan_level`, `credits`, y las funciones `plan_cap` / `plan_tokens` /
  `plan_name`).
- **`supabase/migrations/20260812000000_local_dev_grants.sql`** — otorga a los
  roles `authenticated` / `service_role` los permisos de tabla que en producción
  da la plataforma (la seguridad por fila la sigue aplicando RLS).
- **`supabase/seed.sql`** — habilita `dev@local.test` en la whitelist.
- Se corrigieron dos migraciones para que sean **reproducibles desde cero**
  (`20260417000002` soltaba una policy que dependía de `user_id`; `20260428000001`
  usaba `CREATE OR REPLACE VIEW` para renombrar columnas). Ambos arreglos son
  `IF EXISTS` / `DROP VIEW` idempotentes.

> Si algún día conectas el repo real de Lite a la misma base, estos archivos
> `*local_dev*` y el `seed.sql` son inocuos (idempotentes) o se pueden retirar.

Para apuntar a un Lite real (preview) en vez del login local, define
`VITE_LITE_URL` en tu `.env`.
