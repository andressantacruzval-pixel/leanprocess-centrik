/**
 * ProcessMapOnboardingPage
 * ------------------------
 * Onboarding conversacional del mapa de procesos. Split-screen:
 *   - Izquierda: ConversationalPanel (chat streaming con IA)
 *   - Derecha : mapa de procesos construyendose en vivo
 *
 * Cada vez que la IA emite un tool call <<ADD_MACRO ...>>, el macro
 * se agrega al processStore instantaneamente y el mapa se actualiza
 * con una pequena animacion. No hay "generar todo al final".
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useActiveCompany } from '@/hooks/useActiveCompany'
import { ConversationalPanel } from '@/components/ai/ConversationalPanel'
import { useConversationalAgent } from '@/hooks/useConversationalAgent'
import { PROCESS_MAP_ONBOARDING_PROMPT } from '@/lib/prompts/processMapOnboarding'
import { FAST_MODEL } from '@/lib/conversationalAi'
import { ACCIONES_AL_PASAR, PROCESS_CATEGORIES } from '@/lib/constants'
import type { Macroprocess } from '@/types'

type Category = 'estrategico' | 'productivo' | 'apoyo'
const ORDERED: Category[] = ['estrategico', 'productivo', 'apoyo']

const COMPANY_TYPES = [
  'Retail',
  'Servicios profesionales',
  'Manufactura',
  'Tecnologia / SaaS',
  'Consultoria',
  'Financiero',
]

function buildExistingMacroContext(scoped: Macroprocess[]): string {
  if (scoped.length === 0) return ''
  const bycat: Record<string, string[]> = { estrategico: [], productivo: [], apoyo: [] }
  for (const m of scoped) {
    if (m.category in bycat) bycat[m.category].push(m.name)
  }
  const lines = ['\n\nMAPA ACTUAL (ya confirmados por el usuario — NO volver a sugerir):']
  if (bycat.estrategico.length) lines.push(`Estratégico: ${bycat.estrategico.join(', ')}`)
  if (bycat.productivo.length) lines.push(`Productivo: ${bycat.productivo.join(', ')}`)
  if (bycat.apoyo.length) lines.push(`Apoyo: ${bycat.apoyo.join(', ')}`)
  lines.push('Sugiere únicamente macroprocesos en áreas aún no cubiertas.')
  return lines.join('\n')
}

// Inyecta TODO lo que la empresa ya definió para que la IA no lo vuelva a
// preguntar (giro, país, tamaño, descripción, áreas del organigrama).
interface CompanyLike { name: string; industry?: string | null; country?: string | null; company_size?: string | null; description?: string | null }
function buildCompanyContext(company: CompanyLike | null | undefined, orgUnits: { name: string }[]): string {
  if (!company) return ''
  const L = ['\n\nDATOS DE LA EMPRESA (YA LOS CONOCES — no los preguntes, úsalos y salta esas preguntas):']
  L.push(`Nombre: ${company.name}`)
  if (company.industry) L.push(`Sector / giro: ${company.industry}`)
  if (company.country) L.push(`País: ${company.country}`)
  if (company.company_size) L.push(`Tamaño: ${company.company_size}`)
  if (company.description) L.push(`Descripción: ${company.description}`)
  const areas = [...new Set(orgUnits.map((u) => u.name).filter(Boolean))]
  if (areas.length) L.push(`Estructura organizacional (áreas / unidades ya definidas): ${areas.join(', ')}`)
  return L.join('\n')
}

function buildContinuationGreeting(companyName: string, scoped: Macroprocess[]): string {
  const total = scoped.length
  const parts: string[] = []
  const e = scoped.filter(m => m.category === 'estrategico').length
  const p = scoped.filter(m => m.category === 'productivo').length
  const a = scoped.filter(m => m.category === 'apoyo').length
  if (e) parts.push(`${e} estratégico${e > 1 ? 's' : ''}`)
  if (p) parts.push(`${p} productivo${p > 1 ? 's' : ''}`)
  if (a) parts.push(`${a} de apoyo`)
  return `Bienvenido de vuelta. Ya tienes ${total} macroproceso${total > 1 ? 's' : ''} en el mapa de ${companyName} (${parts.join(', ')}). ¿Qué áreas te faltan por cubrir, o quieres ajustar algo?`
}

export default function ProcessMapOnboardingPage() {
  const navigate = useNavigate()
  const { activeCompany } = useActiveCompany()
  const macroprocesses = useProcessStore((s) => s.macroprocesses)
  const addMacroprocess = useProcessStore((s) => s.addMacroprocess)
  const deleteMacroprocess = useProcessStore((s) => s.deleteMacroprocess)
  const orgUnits = useCompanyStore((s) => s.orgUnits)

  const [justAdded, setJustAdded] = useState<string | null>(null)

  // Macros filtrados por empresa activa
  const scoped = useMemo(
    () =>
      macroprocesses.filter(
        (m) =>
          !m.company_id ||
          !activeCompany ||
          m.company_id === activeCompany.id
      ),
    [macroprocesses, activeCompany]
  )

  const byCategory = useMemo(() => {
    const out: Record<Category, Macroprocess[]> = {
      estrategico: [],
      productivo: [],
      apoyo: [],
    }
    for (const m of scoped) {
      if (ORDERED.includes(m.category)) {
        out[m.category].push(m)
      }
    }
    for (const cat of ORDERED) {
      out[cat].sort((a, b) => a.sort_order - b.sort_order)
    }
    return out
  }, [scoped])

  const companyCtx = buildCompanyContext(activeCompany, orgUnits)

  const agent = useConversationalAgent({
    systemPrompt: PROCESS_MAP_ONBOARDING_PROMPT + companyCtx + buildExistingMacroContext(scoped),
    model: FAST_MODEL,
    feature: 'process_map_onboarding',
    companyId: activeCompany?.id,
    greeting: activeCompany && scoped.length > 0
      ? buildContinuationGreeting(activeCompany.name, scoped)
      : activeCompany
      ? `Hola, soy tu arquitecto de procesos. Ya tengo los datos base de ${activeCompany.name}${activeCompany.industry ? ' (' + activeCompany.industry + ')' : ''}, así que iré directo y saltaré lo que ya sé. Para arrancar el mapa Nivel 0: descríbeme el flujo de punta a punta —desde que aparece un cliente hasta que se le entrega y se cobra— en el orden real de operación.`
      : 'Hola, soy tu arquitecto de procesos. Para armar el mapa Nivel 0, cuéntame en una frase a qué se dedica tu empresa.',
    augmentSystemPromptForTurn: () => buildExistingMacroContext(
      macroprocesses.filter(m => !m.company_id || !activeCompany || m.company_id === activeCompany.id)
    ),
    onToolCall: (call) => {
      if (call.name !== 'ADD_MACRO') return
      const rawCategory = (call.params.category ?? '').toLowerCase().trim()
      const category = rawCategory as Category
      const name = (call.params.name ?? '').trim()
      if (!name || !ORDERED.includes(category)) {
        console.warn('[ProcessMapOnboarding] tool call ignorado:', call.params)
        return
      }

      // Evitar duplicados exactos
      const exists = scoped.some(
        (m) => m.name.toLowerCase() === name.toLowerCase() && m.category === category
      )
      if (exists) return

      const created = addMacroprocess(name, category)
      setJustAdded(created.id)
      setTimeout(() => {
        setJustAdded((curr) => (curr === created.id ? null : curr))
      }, 1400)
    },
  })

  const handleFinish = () => {
    navigate('/app/process-map')
  }

  const total = scoped.length

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* LEFT — Chat */}
      <div className="w-[420px] shrink-0">
        <ConversationalPanel
          agent={agent}
          title="Consultor de procesos"
          subtitle={`Gemini ${FAST_MODEL} · streaming en vivo`}
          placeholder="Responde o pide sugerencias..."
          quickReplies={COMPANY_TYPES}
        />
      </div>

      {/* RIGHT — Live process map */}
      <div className="flex-1 flex flex-col bg-[#0a0f1a] border border-white/5 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Mapa de procesos en vivo</h2>
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">
              {total} macroproceso{total === 1 ? '' : 's'} agregado{total === 1 ? '' : 's'}
              {activeCompany && ` a ${activeCompany.name}`}
            </div>
          </div>
          <button
            onClick={handleFinish}
            disabled={total === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Check size={14} />
            Terminar y ver mapa
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {ORDERED.map((cat) => {
            const meta = PROCESS_CATEGORIES[cat]
            const items = byCategory[cat]
            return (
              <section key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-white/60">
                    {meta.label}
                  </h3>
                  <span className="text-[10px] text-white/30">({items.length})</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {items.map((m) => {
                    const isNew = justAdded === m.id
                    return (
                      <div
                        key={m.id}
                        className={`group relative rounded-xl border p-3 transition-all ${
                          isNew
                            ? 'border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/20 scale-[1.02]'
                            : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                        }`}
                        style={{
                          borderLeftColor: meta.color,
                          borderLeftWidth: 3,
                        }}
                      >
                        <div className="text-sm font-medium text-white pr-10">{m.name}</div>
                        <button
                          onClick={() => deleteMacroprocess(m.id)}
                          className={`absolute top-1 right-1 p-2 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors ${ACCIONES_AL_PASAR}`}
                          title="Eliminar"
                        >
                          <Trash2 size={12} />
                        </button>
                        {isNew && (
                          <div className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-cyan-400 text-[9px] text-[#0a0f1a] font-bold">
                            NUEVO
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {items.length === 0 && (
                    <div className="col-span-full rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-4 text-center text-[11px] text-white/30">
                      Aun no hay macroprocesos {meta.label.toLowerCase()}. Conversa con la IA para agregarlos.
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
