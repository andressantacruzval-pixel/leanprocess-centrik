/**
 * WorkspaceSwitcher
 * -----------------
 * Dropdown que vive en el sidebar y permite:
 *  - ver la empresa activa
 *  - cambiar entre empresas del usuario
 *  - abrir el modal de "crear nueva empresa" (con gate de pago)
 */

import { useState, useRef, useEffect } from 'react'
import { Building2, Check, ChevronDown, Plus } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useCompanyList } from '@/hooks/useActiveCompany'
import { CreateCompanyModal } from './CreateCompanyModal'

interface Props {
  collapsed?: boolean
}

export function WorkspaceSwitcher({ collapsed = false }: Props) {
  const { companies, activeCompanyId } = useCompanyList()
  const setActiveCompany = useWorkspaceStore((s) => s.setActiveCompany)
  const syncCompany = useCompanyStore((s) => s.syncWithActiveCompany)
  const [open, setOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const active = companies.find((c) => c.id === activeCompanyId) ?? null

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const handleSelect = (id: string) => {
    setActiveCompany(id)
    const selected = companies.find((c) => c.id === id) ?? null
    syncCompany(selected)
    setOpen(false)
  }

  if (collapsed) {
    return (
      <>
        <div ref={rootRef} className="relative px-2">
          <button
            onClick={() => setOpen((v) => !v)}
            title={active?.name ?? 'Sin empresa'}
            className="w-full flex items-center justify-center p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-cyan-400 transition-colors"
          >
            <Building2 size={16} />
          </button>
          {open && (
            <DropdownPanel
              companies={companies}
              activeId={activeCompanyId}
              onSelect={handleSelect}
              onCreate={() => {
                setOpen(false)
                setModalOpen(true)
              }}
            />
          )}
        </div>
        <CreateCompanyModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    )
  }

  return (
    <>
      <div ref={rootRef} className="relative px-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center ring-1 ring-cyan-500/30 shrink-0">
            <Building2 size={14} className="text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-white/30">Empresa</div>
            <div className="text-sm font-medium text-white/80 truncate">
              {active?.name ?? 'Crear empresa'}
            </div>
          </div>
          <ChevronDown size={14} className="text-white/30 shrink-0" />
        </button>
        {open && (
          <DropdownPanel
            companies={companies}
            activeId={activeCompanyId}
            onSelect={handleSelect}
            onCreate={() => {
              setOpen(false)
              setModalOpen(true)
            }}
          />
        )}
      </div>
      <CreateCompanyModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}

interface DropdownProps {
  companies: ReturnType<typeof useCompanyList>['companies']
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
}

function DropdownPanel({ companies, activeId, onSelect, onCreate }: DropdownProps) {
  return (
    <div className="absolute left-3 right-3 top-full mt-2 z-50 bg-[#0d1420] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
      <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-white/30 border-b border-white/5">
        Mis empresas
      </div>
      <div className="max-h-60 overflow-y-auto">
        {companies.length === 0 && (
          <div className="px-3 py-4 text-xs text-white/40">
            Aun no tienes empresas creadas.
          </div>
        )}
        {companies.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left"
          >
            <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center shrink-0">
              <Building2 size={12} className="text-white/50" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/80 truncate">{c.name}</div>
              {c.industry && (
                <div className="text-[10px] text-white/30 truncate">{c.industry}</div>
              )}
            </div>
            {c.id === activeId && <Check size={14} className="text-cyan-400 shrink-0" />}
          </button>
        ))}
      </div>
      <button
        onClick={onCreate}
        className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-white/5 bg-white/[0.02] hover:bg-cyan-500/10 text-cyan-400 text-sm font-medium transition-colors"
      >
        <Plus size={14} />
        Crear nueva empresa
      </button>
    </div>
  )
}
