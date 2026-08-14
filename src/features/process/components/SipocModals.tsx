import { useState } from 'react'
import { X } from 'lucide-react'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import type { SipocEntry } from '@/features/catalog/catalogStore'

function ModalOverlay({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1420] rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto mx-4 p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Agregar nueva entrada (proveedor + input) ────────────────────────────────

export function SipocLeftModal({
  suppliers, addSupplier, onSave, onClose,
}: {
  suppliers: { id: string; name: string }[]
  addSupplier: (name: string) => { id: string; name: string }
  onSave: (supplierId: string, supplierName: string, inputDesc: string) => void
  onClose: () => void
}) {
  const [selectedSupplier, setSelectedSupplier] = useState<{ id: string; name: string } | null>(null)
  const [inputDesc, setInputDesc] = useState('')
  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }))

  return (
    <ModalOverlay onClose={onClose} title="Proveedores y Entradas">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Proveedor / Origen</label>
          <CreatableSelect
            options={supplierOptions}
            value={selectedSupplier?.id || ''}
            onChange={(v) => { const s = suppliers.find((sup) => sup.id === v); if (s) setSelectedSupplier(s) }}
            onCreateOption={(name) => { const s = addSupplier(name); setSelectedSupplier(s) }}
            placeholder="Buscar o crear proveedor..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Entradas / Inputs</label>
          <input type="text" value={inputDesc} onChange={(e) => setInputDesc(e.target.value)}
            placeholder="Descripcion de la entrada" className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 text-white focus:ring-1 focus:ring-cyan-500/50"
            disabled={!selectedSupplier} />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white/70">Cancelar</button>
        <button
          onClick={() => { if (selectedSupplier && inputDesc.trim()) onSave(selectedSupplier.id, selectedSupplier.name, inputDesc.trim()) }}
          disabled={!selectedSupplier || !inputDesc.trim()}
          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </ModalOverlay>
  )
}

// ── Agregar nueva salida (output + cliente) ──────────────────────────────────

export function SipocRightModal({
  customers, addCustomer, entries, onSave, onClose,
}: {
  customers: { id: string; name: string }[]
  addCustomer: (name: string) => { id: string; name: string }
  entries: { id: string; output_description: string; customer_id: string }[]
  onSave: (entryId: string | null, outputDesc: string, customerId: string, customerName: string) => void
  onClose: () => void
}) {
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null)
  const [outputDesc, setOutputDesc] = useState('')
  const unpaired = entries.find((e) => !e.output_description && !e.customer_id)
  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }))

  return (
    <ModalOverlay onClose={onClose} title="Salidas y Clientes">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Salidas / Outputs</label>
          <input type="text" value={outputDesc} onChange={(e) => setOutputDesc(e.target.value)}
            placeholder="Descripcion de la salida" className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 text-white focus:ring-1 focus:ring-cyan-500/50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Cliente / Destino</label>
          <CreatableSelect
            options={customerOptions}
            value={selectedCustomer?.id || ''}
            onChange={(v) => { const c = customers.find((cust) => cust.id === v); if (c) setSelectedCustomer(c) }}
            onCreateOption={(name) => { const c = addCustomer(name); setSelectedCustomer(c) }}
            placeholder="Buscar o crear cliente..."
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white/70">Cancelar</button>
        <button
          onClick={() => { if (selectedCustomer && outputDesc.trim()) onSave(unpaired?.id || null, outputDesc.trim(), selectedCustomer.id, selectedCustomer.name) }}
          disabled={!selectedCustomer || !outputDesc.trim()}
          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </ModalOverlay>
  )
}

// ── Editar entrada existente (popup pre-relleno) ─────────────────────────────

export function SipocEditInputModal({
  entry, suppliers, addSupplier, onSave, onClose,
}: {
  entry: SipocEntry
  suppliers: { id: string; name: string }[]
  addSupplier: (name: string) => { id: string; name: string }
  onSave: (supplierId: string, supplierName: string, inputDesc: string) => void
  onClose: () => void
}) {
  const [selectedSupplier, setSelectedSupplier] = useState<{ id: string; name: string } | null>(
    entry.supplier_id ? { id: entry.supplier_id, name: entry.supplier_name } : null
  )
  const [inputDesc, setInputDesc] = useState(entry.input_description)
  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }))

  return (
    <ModalOverlay onClose={onClose} title="Editar Proveedor y Entrada">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Proveedor / Origen</label>
          <CreatableSelect
            options={supplierOptions}
            value={selectedSupplier?.id || ''}
            onChange={(v) => { const s = suppliers.find((sup) => sup.id === v); if (s) setSelectedSupplier(s) }}
            onCreateOption={(name) => { const s = addSupplier(name); setSelectedSupplier(s) }}
            placeholder="Buscar o crear proveedor..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Entradas / Inputs</label>
          <input
            type="text"
            value={inputDesc}
            onChange={(e) => setInputDesc(e.target.value)}
            placeholder="Descripcion de la entrada"
            className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 text-white focus:ring-1 focus:ring-cyan-500/50"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white/70">Cancelar</button>
        <button
          onClick={() => { if (selectedSupplier && inputDesc.trim()) onSave(selectedSupplier.id, selectedSupplier.name, inputDesc.trim()) }}
          disabled={!selectedSupplier || !inputDesc.trim()}
          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Guardar cambios
        </button>
      </div>
    </ModalOverlay>
  )
}

// ── Editar salida existente (popup pre-relleno) ──────────────────────────────

export function SipocEditOutputModal({
  entry, customers, addCustomer, onSave, onClose,
}: {
  entry: SipocEntry
  customers: { id: string; name: string }[]
  addCustomer: (name: string) => { id: string; name: string }
  onSave: (outputDesc: string, customerId: string, customerName: string) => void
  onClose: () => void
}) {
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(
    entry.customer_id ? { id: entry.customer_id, name: entry.customer_name } : null
  )
  const [outputDesc, setOutputDesc] = useState(entry.output_description)
  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }))

  return (
    <ModalOverlay onClose={onClose} title="Editar Salida y Cliente">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Salidas / Outputs</label>
          <input
            type="text"
            value={outputDesc}
            onChange={(e) => setOutputDesc(e.target.value)}
            placeholder="Descripcion de la salida"
            className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 text-white focus:ring-1 focus:ring-cyan-500/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Cliente / Destino</label>
          <CreatableSelect
            options={customerOptions}
            value={selectedCustomer?.id || ''}
            onChange={(v) => { const c = customers.find((cust) => cust.id === v); if (c) setSelectedCustomer(c) }}
            onCreateOption={(name) => { const c = addCustomer(name); setSelectedCustomer(c) }}
            placeholder="Buscar o crear cliente..."
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white/70">Cancelar</button>
        <button
          onClick={() => { if (selectedCustomer && outputDesc.trim()) onSave(outputDesc.trim(), selectedCustomer.id, selectedCustomer.name) }}
          disabled={!selectedCustomer || !outputDesc.trim()}
          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Guardar cambios
        </button>
      </div>
    </ModalOverlay>
  )
}
