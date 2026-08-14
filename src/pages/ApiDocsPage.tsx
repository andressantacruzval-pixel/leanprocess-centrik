import { useState } from 'react'
import { Code, Globe, Key, Webhook, Zap } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface Endpoint {
  method: HttpMethod
  path: string
  description: string
  exampleResponse: string
}

// ── Data ─────────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.leanprocess.app/v1'

const methodColors: Record<HttpMethod, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const endpoints: Endpoint[] = [
  {
    method: 'GET',
    path: '/processes',
    description: 'Listar todos los procesos del workspace activo. Soporta paginacion y filtros por categoria.',
    exampleResponse: JSON.stringify(
      {
        data: [
          { id: 'uuid', name: 'Gestion de Reclamos', macroprocess_id: 'uuid', category: 'productivo' },
        ],
        meta: { page: 1, per_page: 25, total: 42 },
      },
      null,
      2,
    ),
  },
  {
    method: 'GET',
    path: '/processes/:id',
    description: 'Obtener el detalle completo de un proceso, incluyendo caracterizacion y SIPOC.',
    exampleResponse: JSON.stringify(
      {
        id: 'uuid',
        name: 'Gestion de Reclamos',
        code: 'PRD-001',
        description: 'Proceso de atencion y resolucion de reclamos',
        macroprocess_id: 'uuid',
        entity: 'Operaciones',
      },
      null,
      2,
    ),
  },
  {
    method: 'GET',
    path: '/processes/:id/risks',
    description: 'Listar los riesgos asociados a un proceso con probabilidad e impacto inherente y residual.',
    exampleResponse: JSON.stringify(
      {
        data: [
          {
            id: 'uuid',
            description: 'Falta de documentacion',
            inherentProbability: 4,
            inherentImpact: 3,
            residualProbability: 2,
            residualImpact: 2,
          },
        ],
      },
      null,
      2,
    ),
  },
  {
    method: 'GET',
    path: '/processes/:id/indicators',
    description: 'KPIs configurados para un proceso con sus umbrales y frecuencia de medicion.',
    exampleResponse: JSON.stringify(
      {
        data: [
          {
            id: 'uuid',
            nombre: 'Tiempo promedio de resolucion',
            formula: 'Suma(dias) / Total reclamos',
            meta: '< 5 dias',
            frecuencia: 'Mensual',
          },
        ],
      },
      null,
      2,
    ),
  },
  {
    method: 'GET',
    path: '/processes/:id/procedure',
    description: 'Procedimiento documentado del proceso en formato estructurado.',
    exampleResponse: JSON.stringify(
      {
        process_id: 'uuid',
        version: '1.0',
        sections: [
          { title: 'Objetivo', content: '...' },
          { title: 'Alcance', content: '...' },
        ],
        generated_at: '2026-04-12T00:00:00Z',
      },
      null,
      2,
    ),
  },
  {
    method: 'GET',
    path: '/org-structure',
    description: 'Estructura organizacional completa con areas y cargos.',
    exampleResponse: JSON.stringify(
      {
        data: [
          { id: 'uuid', name: 'Gerencia General', type: 'department', parent_id: null },
          { id: 'uuid', name: 'Operaciones', type: 'department', parent_id: 'uuid' },
        ],
      },
      null,
      2,
    ),
  },
  {
    method: 'POST',
    path: '/webhooks',
    description: 'Configurar un webhook para recibir notificaciones de eventos en tiempo real.',
    exampleResponse: JSON.stringify(
      {
        id: 'uuid',
        url: 'https://your-server.com/webhook',
        events: ['process.created', 'risk.identified'],
        active: true,
        created_at: '2026-04-12T00:00:00Z',
      },
      null,
      2,
    ),
  },
]

const webhookEvents = [
  { event: 'process.created', description: 'Se crea un nuevo proceso o subproceso' },
  { event: 'risk.identified', description: 'Se identifica un nuevo riesgo en un proceso' },
  { event: 'procedure.generated', description: 'Se genera o actualiza un procedimiento documentado' },
]

// ── Collapsible endpoint card ────────────────────────────────────────────

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition text-left"
      >
        <span
          className={`shrink-0 px-2.5 py-0.5 rounded text-xs font-bold border ${methodColors[endpoint.method]}`}
        >
          {endpoint.method}
        </span>
        <code className="text-sm text-gray-300 font-mono">{endpoint.path}</code>
        <span className="ml-auto text-xs text-gray-500">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5">
          <p className="text-sm text-gray-400 pt-4">{endpoint.description}</p>
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Ejemplo de respuesta
            </span>
            <pre className="mt-2 p-4 rounded-lg bg-[#0a0f1a] text-xs text-gray-300 font-mono overflow-x-auto">
              {endpoint.exampleResponse}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Globe className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">API Publica de Lean Process</h1>
          <span className="ml-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/30">
            Coming Soon
          </span>
        </div>
        <p className="text-gray-400 text-lg">
          REST API para integrar Lean Process con sistemas externos, automatizar flujos y construir integraciones personalizadas.
        </p>
      </div>

      {/* Authentication */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-semibold text-white">Autenticacion</h2>
        </div>
        <p className="text-sm text-gray-400">
          Usa un API Key en el header de cada peticion:
        </p>
        <pre className="p-4 rounded-lg bg-[#0a0f1a] text-sm text-gray-300 font-mono">
          Authorization: Bearer {'<api-key>'}
        </pre>
        <p className="text-xs text-gray-500">
          Genera tu API Key en <span className="text-cyan-400">Configuracion &rarr; API Keys</span>.
        </p>
      </section>

      {/* Base URL */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Base URL</h2>
        <pre className="p-4 rounded-lg bg-[#0a0f1a] text-sm text-cyan-400 font-mono">
          {BASE_URL}
        </pre>
      </section>

      {/* Endpoints */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Code className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-semibold text-white">Endpoints</h2>
        </div>
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <EndpointCard key={`${ep.method}-${ep.path}`} endpoint={ep} />
          ))}
        </div>
      </section>

      {/* Webhooks */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-semibold text-white">Webhooks</h2>
        </div>
        <p className="text-sm text-gray-400">
          Configura webhooks para recibir notificaciones en tiempo real cuando ocurren eventos en tu workspace.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Evento
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Descripcion
                </th>
              </tr>
            </thead>
            <tbody>
              {webhookEvents.map((w) => (
                <tr key={w.event} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3">
                    <code className="text-xs text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded">
                      {w.event}
                    </code>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{w.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Rate Limits */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Rate Limits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center">
            <p className="text-3xl font-bold text-white">100</p>
            <p className="text-sm text-gray-400 mt-1">requests/minuto</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              Plan Pro
            </span>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center">
            <p className="text-3xl font-bold text-white">500</p>
            <p className="text-sm text-gray-400 mt-1">requests/minuto</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Plan Max
            </span>
          </div>
        </div>
      </section>

      {/* N8N Integration */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-semibold text-white">Integracion con N8N</h2>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <p className="text-sm text-gray-400">
            Conecta Lean Process con N8N para automatizar flujos de trabajo. Usa los webhooks y la API REST para crear pipelines de automatizacion sin codigo.
          </p>
          <p className="text-sm text-gray-400">
            Configura el webhook URL en{' '}
            <span className="text-cyan-400">Configuracion &rarr; Integraciones &rarr; N8N</span>.
          </p>
          <pre className="p-4 rounded-lg bg-[#0a0f1a] text-xs text-gray-300 font-mono">
{`// Ejemplo: Trigger en N8N
{
  "webhook_url": "https://n8n.your-server.com/webhook/lean-process",
  "events": ["process.created", "procedure.generated"],
  "secret": "your-webhook-secret"
}`}
          </pre>
        </div>
      </section>
    </div>
  )
}
