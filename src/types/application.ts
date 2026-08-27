// ── Aplicaciones / Software (Application Portfolio Management) ─────────────
// Inventario de aplicaciones a nivel empresa (se define una vez) y su uso por
// actividad/proceso. Base: ITIL 4 CMDB · ISO/IEC 19770 (SAM) · TOGAF · Gartner APM.

export type Ownership = 'propia' | 'terceros' | 'mixta'
export const OWNERSHIP_OPTIONS: { value: Ownership; label: string }[] = [
  { value: 'propia', label: 'Propia (desarrollo interno)' },
  { value: 'terceros', label: 'De terceros (COTS / SaaS)' },
  { value: 'mixta', label: 'Mixta' },
]

export type Deployment = 'on_premise' | 'cloud_saas' | 'cloud_iaas' | 'hibrido'
export const DEPLOYMENT_OPTIONS: { value: Deployment; label: string }[] = [
  { value: 'on_premise', label: 'On-premise' },
  { value: 'cloud_saas', label: 'Cloud (SaaS)' },
  { value: 'cloud_iaas', label: 'Cloud (IaaS / PaaS)' },
  { value: 'hibrido', label: 'Híbrido' },
]

export type AppStatus = 'activo' | 'en_evaluacion' | 'deprecado' | 'a_reemplazar'
export const APP_STATUS_OPTIONS: { value: AppStatus; label: string }[] = [
  { value: 'activo', label: 'Activo' },
  { value: 'en_evaluacion', label: 'En evaluación' },
  { value: 'deprecado', label: 'Deprecado' },
  { value: 'a_reemplazar', label: 'A reemplazar' },
]

export const INTEGRATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'API', label: 'API' },
  { value: 'archivo', label: 'Archivo (CSV/Excel)' },
  { value: 'manual', label: 'Manual (sin integración)' },
  { value: 'RPA', label: 'RPA / automatización' },
]

export const AUTH_OPTIONS: { value: string; label: string }[] = [
  { value: 'SSO', label: 'SSO (inicio de sesión único)' },
  { value: 'MFA', label: 'MFA (multifactor)' },
  { value: 'local', label: 'Usuario/contraseña local' },
  { value: 'ninguno', label: 'Sin autenticación' },
]

export const LICENSE_OPTIONS: { value: string; label: string }[] = [
  { value: 'suscripcion', label: 'Suscripción' },
  { value: 'perpetua', label: 'Perpetua' },
  { value: 'open_source', label: 'Open source' },
  { value: 'free', label: 'Gratuita' },
]

export interface Application {
  id: string
  company_id: string
  code: string
  name: string
  description: string
  category: string
  ownership: string
  vendor: string
  deployment: string
  url: string
  criticality: number | null
  business_owner: string
  technical_custodian: string
  status: string
  has_api: boolean
  integration_type: string
  automatable: boolean
  handles_personal_data: boolean
  auth_method: string
  license_model: string
  cost_estimate: number | null
  cost_period: string
  version: string
  created_at: string
  updated_at: string
}

export interface ApplicationUsage {
  id: string
  company_id: string
  application_id: string
  process_id: string | null
  bpmn_element_id: string | null
  activity_name: string
  note: string
  sort_order: number
  created_at: string
  updated_at: string
}

// ── Semáforo de riesgo tecnológico ────────────────────────────────────────
// Riesgo compuesto por criticidad + factores técnicos: legado on-premise, sin
// API (difícil de integrar/automatizar), autenticación débil, de terceros sin
// control y en estado deprecado / a reemplazar. Escala 0-100 → banda.
export interface TechRisk { score: number; level: 'bajo' | 'medio' | 'alto' | 'critico'; label: string; hex: string; factors: string[] }

export function techRisk(app: Application): TechRisk {
  const factors: string[] = []
  let score = 0
  const crit = app.criticality || 0
  score += crit * 8 // hasta 40: la criticidad pesa más
  if (crit >= 4) factors.push('Criticidad alta')

  if (app.deployment === 'on_premise') { score += 12; factors.push('On-premise (legado)') }
  if (!app.has_api) { score += 14; factors.push('Sin API (difícil integrar/automatizar)') }
  if (app.auth_method === 'local' || app.auth_method === 'ninguno' || !app.auth_method) { score += 14; factors.push('Autenticación débil') }
  if (app.status === 'deprecado' || app.status === 'a_reemplazar') { score += 12; factors.push('Deprecado / a reemplazar') }
  if (app.handles_personal_data) { score += 8; factors.push('Maneja datos personales') }

  score = Math.min(100, score)
  const level = score >= 70 ? 'critico' : score >= 45 ? 'alto' : score >= 22 ? 'medio' : 'bajo'
  const hex = { bajo: '#10b981', medio: '#facc15', alto: '#f97316', critico: '#ef4444' }[level]
  const label = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'Crítico' }[level]
  return { score, level, label, hex, factors }
}
