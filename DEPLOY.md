# Lean Process — Guia de Despliegue a Produccion

## Arquitectura

```
Frontend (SPA)          Backend (BaaS)         AI
├── React 19            ├── Supabase           └── Google Gemini
├── TypeScript 6        │   ├── PostgreSQL
├── Vite 8              │   ├── Auth (email/OAuth)
├── Tailwind CSS 4      │   ├── Row Level Security
├── Zustand 5           │   └── Realtime
└── React Router 7      └── Stripe (pagos)
```

**Es una SPA (Single Page Application)** — se compila a archivos estaticos (HTML/CSS/JS) que se sirven desde cualquier CDN o servidor web.

---

## 1. Requisitos previos

| Herramienta | Version minima |
|-------------|---------------|
| Node.js     | 22.x LTS      |
| npm         | 10.x          |
| Git         | 2.x           |

---

## 2. Variables de entorno

Copiar `.env.example` a `.env` y completar:

```bash
cp .env.example .env
```

| Variable | Descripcion | Requerida |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase (ej: `https://abc123.supabase.co`) | Si (para auth y DB) |
| `VITE_SUPABASE_ANON_KEY` | Clave anonima publica de Supabase | Si (para auth y DB) |
| `VITE_GEMINI_API_KEY` | API key de Google Gemini (AI Studio) | Si (para funciones IA) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Clave publica de Stripe | No (solo para pagos) |

> **IMPORTANTE**: Las variables `VITE_*` se embeben en el build. NO incluir secretos del servidor. Son visibles en el cliente.

---

## 3. Configurar Supabase

### 3.1 Crear proyecto
1. Ir a [supabase.com](https://supabase.com) y crear un proyecto
2. Copiar la URL y Anon Key a `.env`

### 3.2 Ejecutar migraciones
Las migraciones SQL estan en `supabase/migrations/`:

```
001_initial_schema.sql    — Tablas base (users, companies, processes, risks)
002_indicators.sql        — Tabla de indicadores/KPIs
003_company_org_structure.sql — Estructura organizacional
```

Ejecutar en orden desde el SQL Editor de Supabase o con la CLI:

```bash
npx supabase db push
```

### 3.3 Configurar Auth
En Supabase Dashboard > Authentication > Settings:
- Habilitar Email/Password
- (Opcional) Configurar proveedores OAuth (Google, GitHub)
- Configurar Site URL al dominio de produccion: `https://tu-dominio.com`
- Agregar redirect URL: `https://tu-dominio.com/**`

---

## 4. Build de produccion

```bash
# Instalar dependencias
npm ci

# Compilar TypeScript + build Vite
npm run build
```

El output queda en `dist/`. Contiene:
- `index.html` — punto de entrada
- `assets/` — JS/CSS con hash para cache inmutable

---

## 5. Opciones de despliegue

### Opcion A: Vercel (recomendado — mas rapido)

```bash
npm i -g vercel
vercel --prod
```

O conectar el repo de GitHub en [vercel.com](https://vercel.com). El archivo `vercel.json` ya esta configurado.

**Variables de entorno**: Agregar en Vercel Dashboard > Settings > Environment Variables.

### Opcion B: Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

O conectar el repo en [netlify.com](https://netlify.com). El archivo `netlify.toml` ya esta configurado.

### Opcion C: Docker (servidor propio / VPS / AWS ECS)

```bash
# Build y levantar
docker compose up -d --build

# O sin compose
docker build -t lean-process .
docker run -d -p 80:80 lean-process
```

Incluye Nginx optimizado con:
- Gzip compresion
- Cache inmutable para assets con hash
- SPA fallback (todas las rutas → `index.html`)
- Security headers

### Opcion D: AWS S3 + CloudFront

```bash
# Build
npm run build

# Subir a S3
aws s3 sync dist/ s3://tu-bucket --delete

# Invalidar cache de CloudFront
aws cloudfront create-invalidation --distribution-id XXXX --paths "/*"
```

Configurar CloudFront con:
- Custom error response: 403/404 → `/index.html` (status 200)
- Cache policy: `assets/*` → 1 year immutable

---

## 6. Dominio personalizado y SSL

### Vercel/Netlify
Agregar dominio en el dashboard. SSL automatico.

### Docker / VPS
Usar Caddy o Certbot para SSL:

```bash
# Con Caddy (auto-SSL)
caddy reverse-proxy --from tu-dominio.com --to localhost:80
```

O con Certbot + Nginx:
```bash
certbot --nginx -d tu-dominio.com
```

---

## 7. Modo Demo (sin backend)

La app funciona en **modo demo** sin Supabase configurado:
- Login via "Entrar como Demo" con 5 usuarios pre-cargados
- Datos almacenados en localStorage del navegador
- Ideal para demos y presentaciones

Los usuarios demo son:

| Rol | Nombre | Email | Empresa |
|-----|--------|-------|---------|
| Admin | Carlos Mendoza | admin@leanprocess.app | Todas las empresas |
| Usuario | Maria Rodriguez | maria@techstartup.io | NexaTech Solutions |
| Usuario | Jorge Paredes | jorge@clinicasalud.com | Clinica Salud Integral |
| Usuario | Lucia Bravo | lucia@logisticaexpress.ec | Logistica Express SA |
| Nuevo | Usuario Nuevo | nuevo@empresa.com | Empieza desde cero |

---

## 8. Checklist pre-produccion

- [ ] Variables de entorno configuradas en el hosting
- [ ] Migraciones de Supabase ejecutadas
- [ ] Auth de Supabase configurado con dominio correcto
- [ ] Build exitoso sin errores (`npm run build`)
- [ ] Probar login con email real
- [ ] Probar modo demo (5 usuarios)
- [ ] Verificar que el dominio tiene SSL (HTTPS)
- [ ] Configurar backup de base de datos en Supabase
- [ ] (Opcional) Configurar Stripe para pagos
- [ ] (Opcional) Configurar Google Analytics o Plausible

---

## 9. Estructura del proyecto

```
lean-process/
├── src/
│   ├── components/     # Componentes React reutilizables
│   ├── hooks/          # Custom hooks (useCompanyScopedData, useProcesses, etc.)
│   ├── lib/            # Utilidades (supabase client, seedData)
│   ├── pages/          # Paginas de la app (Dashboard, ProcessMap, etc.)
│   ├── stores/         # Zustand stores (auth, process, risk, workspace, etc.)
│   ├── types/          # TypeScript types/interfaces
│   └── utils/          # Funciones auxiliares
├── supabase/
│   └── migrations/     # SQL migrations para PostgreSQL
├── public/             # Assets estaticos
├── Dockerfile          # Build multi-stage con Nginx
├── docker-compose.yml  # Orquestacion Docker
├── nginx.conf          # Config Nginx optimizada para SPA
├── vercel.json         # Config para Vercel
├── netlify.toml        # Config para Netlify
├── .env.example        # Template de variables de entorno
└── package.json        # Dependencias y scripts
```

---

## 10. Soporte

Contacto del equipo de desarrollo:
- Proyecto: Lean Process v0.1.0
- Stack: React 19 + TypeScript 6 + Vite 8 + Supabase + Tailwind CSS 4
- Modelo: B2C multi-tenant con aislamiento por empresa
