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
  GET: 'bg-emerald-100 text-emerald-600 border-emerald-300',
  POST: 'bg-blue-100 text-blue-600 border-blue-300',
  PUT: 'bg-amber-100 text-amber-600 border-amber-300',
  DELETE: 'bg-red-100 text-red-600 border-red-300',
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
    <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition text-left"
      >
        <span
          className={`shrink-0 px-2.5 py-0.5 rounded-md text-xs font-bold border ${methodColors[endpoint.method]}`}
        >
          {endpoint.method}
        </span>
        <code className="text-sm text-gray-300 font-mono">{endpoint.path}</code>
        <span className="ml-auto text-xs text-gray-500">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
          <p className="text-sm text-gray-400 pt-4">{endpoint.description}</p>
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Ejemplo de respuesta
            </span>
            <pre className="mt-2 p-4 rounded-lg bg-white text-xs text-gray-300 font-mono overflow-x-auto">
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
          <Globe className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900">API Publica de Lean Process</h1>
          <span className="ml-2 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-600 text-xs font-semibold border border-amber-300">
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
          <Key className="w-5 h-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">Autenticacion</h2>
        </div>
        <p className="text-sm text-gray-400">
          Usa un API Key en el header de cada peticion:
        </p>
        <pre className="p-4 rounded-lg bg-white text-sm text-gray-300 font-mono">
          Authorization: Bearer {'<api-key>'}
        </pre>
        <p className="text-xs text-gray-500">
          Genera tu API Key en <span className="text-primary-600">Configuracion &rarr; API Keys</span>.
        </p>
      </section>

      {/* Base URL */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Base URL</h2>
        <pre className="p-4 rounded-lg bg-white text-sm text-primary-600 font-mono">
          {BASE_URL}
        </pre>
      </section>

      {/* Endpoints */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Code className="w-5 h-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">Endpoints</h2>
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
          <Webhook className="w-5 h-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">Webhooks</h2>
        </div>
        <p className="text-sm text-gray-400">
          Configura webhooks para recibir notificaciones en tiempo real cuando ocurren eventos en tu workspace.
        </p>
        <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-100">
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
                <tr key={w.event} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-3">
                    <code className="text-xs text-primary-600 font-mono bg-primary-50 px-2 py-0.5 rounded-md">
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
        <h2 className="text-xl font-semibold text-gray-900">Rate Limits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-center">
            <p className="text-3xl font-bold text-gray-900">100</p>
            <p className="text-sm text-gray-400 mt-1">requests/minuto</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-xs font-semibold bg-primary-100 text-primary-600 border border-primary-300">
              Plan Pro
            </span>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-center">
            <p className="text-3xl font-bold text-gray-900">500</p>
            <p className="text-sm text-gray-400 mt-1">requests/minuto</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-600 border border-emerald-300">
              Plan Max
            </span>
          </div>
        </div>
      </section>

      {/* N8N Integration */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">Integracion con N8N</h2>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 space-y-3">
          <p className="text-sm text-gray-400">
            Conecta Lean Process con N8N para automatizar flujos de trabajo. Usa los webhooks y la API REST para crear pipelines de automatizacion sin codigo.
          </p>
          <p className="text-sm text-gray-400">
            Configura el webhook URL en{' '}
            <span className="text-primary-600">Configuracion &rarr; Integraciones &rarr; N8N</span>.
          </p>
          <pre className="p-4 rounded-lg bg-white text-xs text-gray-300 font-mono">
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
