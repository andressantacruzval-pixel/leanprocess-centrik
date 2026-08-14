import { useState } from 'react'
import { Building2, X } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCompanyStore } from '@/stores/companyStore'
import type { Company } from '@/types/organization'
import { ComboboxSelect } from '@/components/ui/ComboboxSelect'
import { INDUSTRY_OPTIONS, COUNTRY_OPTIONS, SIZE_OPTIONS } from '@/utils/selectOptions'

interface Props {
  open: boolean
  company: Company
  onClose: () => void
}


export function EditCompanyModal({ open, company, onClose }: Props) {
  const updateCompany = useWorkspaceStore((s) => s.updateCompany)
  const [name, setName] = useState(company.name)
  const [industry, setIndustry] = useState(company.industry ?? '')
  const [country, setCountry] = useState(company.country ?? '')
  const [companySize, setCompanySize] = useState(company.company_size ?? '')
  const [description, setDescription] = useState(company.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleSave = () => {
    if (!name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    const nextName = name.trim()
    updateCompany(company.id, {
      name: nextName,
      industry: industry.trim() || undefined,
      country: country.trim() || undefined,
      company_size: companySize || undefined,
      description: description.trim() || undefined,
    })

    // Corregir el nombre aqui y no en el organigrama dejaria la raiz con el nombre
    // viejo: solo se sincronizaban durante el onboarding (StepOrgChart.tsx:22-33).
    // El filtro por company.id se basta como guarda: si la empresa editada no es la
    // activa, sus unidades no estan cargadas y no se encuentra raiz que tocar.
    if (nextName !== company.name) {
      const { orgUnits, updateOrgUnit } = useCompanyStore.getState()
      const root = orgUnits.find((u) => u.parent_id === null && u.company_id === company.id)
      if (root && root.name !== nextName) updateOrgUnit(root.id, { name: nextName })
    }

    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-[#0d1420] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-cyan-500/30 flex items-center justify-center">
              <Building2 size={16} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Editar empresa</h2>
              <p className="text-xs text-white/40">Actualiza los datos de la empresa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — se desplaza: el formulario no cabe en una pantalla baja */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Nombre de la empresa *">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Acme Corp"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Industria / Rubro">
              <ComboboxSelect
                value={industry}
                onChange={setIndustry}
                options={INDUSTRY_OPTIONS}
                placeholder="Buscar industria..."
              />
            </Field>
            <Field label="País">
              <ComboboxSelect
                value={country}
                onChange={setCountry}
                options={COUNTRY_OPTIONS}
                placeholder="Buscar país..."
              />
            </Field>
          </div>
          <Field label="Tamaño de empresa">
            <ComboboxSelect
              value={companySize}
              onChange={setCompanySize}
              options={SIZE_OPTIONS}
              placeholder="Seleccionar tamaño..."
            />
          </Field>
          <Field label="Breve descripción">
            {/* `field-sizing-content` crece con el texto sin JS. Donde no exista
                (Safari/Firefox hoy), degrada a las 3 filas de siempre: el `rows`
                hace de suelo y `max-h` evita que un texto largo se coma el modal,
                que ya se desplaza solo. */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe brevemente a que se dedica tu empresa"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40 resize-y field-sizing-content max-h-64"
            />
          </Field>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-white/5 flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/60 hover:text-white/90 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-all"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5">{label}</div>
      {children}
    </label>
  )
}
