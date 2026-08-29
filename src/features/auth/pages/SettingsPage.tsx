/**
 * SettingsPage
 * ------------
 * Punto unico de configuracion con tabs:
 *   - Empresas   : lista, crear nueva (con gate de pago)
 *   - Miembros   : gestion de miembros de la empresa activa
 *   - General    : datos del perfil y cambio de contraseña
 *
 * La facturacion vive en el Hub de Lite, no aqui: es una sola pantalla para
 * las dos apps y el cobro ya pasa por alli.
 */

import { useState } from 'react'
import { Building2, Users, SlidersHorizontal, Cpu, Settings } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { IS_PHASE_1 } from '@/lib/phaseFlags'
import { CompaniesPanel } from '@/components/workspace/CompaniesPanel'
import { MembersPanel } from '@/components/workspace/MembersPanel'
import { AiUsageHistory } from '@/features/auth/components/AiUsageHistory'
import { useAuthStore } from '@/stores/authStore'

type Tab = 'companies' | 'members' | 'ai-usage' | 'general'

const TABS_ALL: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: 'companies', label: 'Empresas', icon: Building2 },
  { id: 'members', label: 'Miembros', icon: Users },
  { id: 'ai-usage', label: 'Uso de IA', icon: Cpu },
  { id: 'general', label: 'General', icon: SlidersHorizontal },
]

const TABS = TABS_ALL.filter((t) => !(IS_PHASE_1 && t.id === 'members'))

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('companies')
  const profile = useAuthStore((s) => s.profile)

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        icon={Settings}
        title="Configuracion"
        subtitle="Administra tus empresas, miembros y suscripcion."
      />

      <div className="flex items-center gap-1 border-b border-gray-100 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-all border-b-2 -mb-px ${
              tab === id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {tab === 'companies' && <CompaniesPanel />}
        {tab === 'members' && <MembersPanel />}
        {tab === 'ai-usage' && <AiUsageHistory />}
        {tab === 'general' && (
          <div className="space-y-6">
            {/* Profile info display */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Perfil</h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm bg-primary-500">
                    {profile?.full_name?.[0]?.toUpperCase() ?? profile?.email?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{profile?.full_name ?? 'Sin nombre'}</div>
                    <div className="text-xs text-gray-500">{profile?.email}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* El cambio de contraseña salió de aquí el 2026-08-08. App ya no es
                dueña del login (vive en Lite), y el formulario además pedía un
                mínimo de 6 caracteres cuando la política de Auth son 8 con letras
                y números: aceptaba lo que Supabase iba a rechazar. Queda el correo
                de recuperación, que sí está validado. */}
          </div>
        )}
      </div>
    </div>
  )
}
