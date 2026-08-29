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
            className="w-full flex items-center justify-center p-2 rounded-lg bg-gray-50 hover:bg-gray-50 border border-gray-100 text-primary-600 transition-colors"
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
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-50 border border-gray-100 transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center ring-1 ring-primary-500 shrink-0 bg-primary-100">
            <Building2 size={14} className="text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Empresa</div>
            <div className="text-sm font-medium text-gray-800 truncate">
              {active?.name ?? 'Crear empresa'}
            </div>
          </div>
          <ChevronDown size={14} className="text-gray-400 shrink-0" />
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
    <div className="absolute left-3 right-3 top-full mt-2 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden">
      <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
        Mis empresas
      </div>
      <div className="max-h-60 overflow-y-auto">
        {companies.length === 0 && (
          <div className="px-3 py-4 text-xs text-gray-500">
            Aun no tienes empresas creadas.
          </div>
        )}
        {companies.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
          >
            <div className="w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center shrink-0">
              <Building2 size={12} className="text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-800 truncate">{c.name}</div>
              {c.industry && (
                <div className="text-[10px] text-gray-400 truncate">{c.industry}</div>
              )}
            </div>
            {c.id === activeId && <Check size={14} className="text-primary-600 shrink-0" />}
          </button>
        ))}
      </div>
      <button
        onClick={onCreate}
        className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 bg-gray-50 hover:bg-primary-50 text-primary-600 text-sm font-medium transition-colors"
      >
        <Plus size={14} />
        Crear nueva empresa
      </button>
    </div>
  )
}
