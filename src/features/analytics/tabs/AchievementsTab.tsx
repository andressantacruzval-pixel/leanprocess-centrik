import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Eye, EyeOff, Save, X, AlertCircle } from 'lucide-react'
import { Card, SectionTitle } from '../components/AdminShared'
import {
  getAllAchievements,
  createAchievement,
  updateAchievement,
  toggleAchievementActive,
} from '@/services/achievements.service'
import { useAchievementStore } from '@/features/gamification/achievementStore'
import type { AchievementRow, AchievementCreate } from '@/lib/schemas/achievement.schema'

const CATEGORIES = ['procesos', 'riesgos', 'documentacion', 'analisis', 'maestria', 'comunidad'] as const
const TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const

const TIER_COLORS: Record<string, string> = {
  bronze:   'text-amber-600',
  silver:   'text-slate-400',
  gold:     'text-yellow-400',
  platinum: 'text-cyan-300',
}

const EMPTY_FORM: AchievementCreate = {
  id: '', title: '', description: '', icon: '', category: 'procesos',
  points: 10, tier: 'bronze', criteria: '', is_active: true, sort_order: 0,
}

export function AchievementsTab() {
  const [achievements, setAchievements] = useState<AchievementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AchievementCreate>(EMPTY_FORM)

  const loadCatalog = useAchievementStore((s) => s.loadCatalog)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await getAllAchievements()
    setLoading(false)
    if (err) { setError(err.message); return }
    setAchievements(data ?? [])
  }, [])

  useEffect(() => { void fetchAll() }, [fetchAll])

  const handleEdit = useCallback((a: AchievementRow) => {
    setForm({ ...a })
    setEditingId(a.id)
    setShowForm(true)
    setError(null)
  }, [])

  const handleNew = useCallback(() => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
    setError(null)
  }, [])

  const handleCancel = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }, [])

  const handleToggleActive = useCallback(async (a: AchievementRow) => {
    const { error: err } = await toggleAchievementActive(a.id, !a.is_active)
    if (err) { setError(err.message); return }
    await fetchAll()
    void loadCatalog()
  }, [fetchAll, loadCatalog])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        const { error: err } = await updateAchievement(editingId, form)
        if (err) { setError(err.message); return }
      } else {
        const { error: err } = await createAchievement(form)
        if (err) { setError(err.message); return }
      }
      setShowForm(false)
      setEditingId(null)
      await fetchAll()
      void loadCatalog()
    } finally {
      setSaving(false)
    }
  }, [editingId, form, fetchAll, loadCatalog])

  const field = (key: keyof AchievementCreate, value: string | number | boolean) =>
    setForm((f) => ({ ...f, [key]: value }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Achievements ({achievements.length})</SectionTitle>
        {!showForm && (
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
          >
            <Plus size={13} />
            Nuevo Achievement
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-white">
              {editingId ? 'Editar Achievement' : 'Nuevo Achievement'}
            </h4>
            <button onClick={handleCancel} className="text-white/30 hover:text-white/60 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="ID (kebab-case)">
              <input
                value={form.id}
                onChange={(e) => field('id', e.target.value)}
                disabled={!!editingId}
                placeholder="ej: first-process"
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 disabled:opacity-40 focus:outline-none focus:border-cyan-500/50"
              />
            </FormField>

            <FormField label="Título">
              <input
                value={form.title}
                onChange={(e) => field('title', e.target.value)}
                placeholder="ej: Primer Paso"
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50"
              />
            </FormField>

            <FormField label="Descripción" className="sm:col-span-2">
              <textarea
                value={form.description}
                onChange={(e) => field('description', e.target.value)}
                rows={2}
                placeholder="ej: Crea tu primer subproceso"
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 resize-none"
              />
            </FormField>

            <FormField label="Ícono (Lucide)">
              <input
                value={form.icon}
                onChange={(e) => field('icon', e.target.value)}
                placeholder="ej: Star, Trophy, Flame"
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50"
              />
            </FormField>

            <FormField label="Categoría">
              <select
                value={form.category}
                onChange={(e) => field('category', e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-[#0b1020] text-white">{c}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Puntos">
              <input
                type="number"
                min={1}
                value={form.points}
                onChange={(e) => field('points', parseInt(e.target.value) || 1)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              />
            </FormField>

            <FormField label="Tier">
              <select
                value={form.tier}
                onChange={(e) => field('tier', e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t} className="bg-[#0b1020] text-white">{t}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Criterio (para UI)">
              <input
                value={form.criteria}
                onChange={(e) => field('criteria', e.target.value)}
                placeholder="ej: Crea 1 subproceso"
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50"
              />
            </FormField>

            <FormField label="Orden">
              <input
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => field('sort_order', parseInt(e.target.value) || 0)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.id || !form.title}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 disabled:opacity-40 transition-colors"
            >
              <Save size={13} />
              {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card>
        {loading ? (
          <p className="text-white/30 text-sm text-center py-8">Cargando achievements...</p>
        ) : achievements.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-8">Sin achievements</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/5">
                  <th className="text-left pb-3 font-medium">ID</th>
                  <th className="text-left pb-3 font-medium">Título</th>
                  <th className="text-left pb-3 font-medium">Categoría</th>
                  <th className="text-right pb-3 font-medium">Pts</th>
                  <th className="text-left pb-3 font-medium">Tier</th>
                  <th className="text-center pb-3 font-medium">Estado</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {achievements.map((a) => (
                  <tr key={a.id} className={`transition-colors ${!a.is_active ? 'opacity-40' : ''}`}>
                    <td className="py-3 pr-4 font-mono text-white/50 text-xs">{a.id}</td>
                    <td className="py-3 pr-4 text-white">{a.title}</td>
                    <td className="py-3 pr-4 text-white/50">{a.category}</td>
                    <td className="py-3 pr-4 text-right text-white/70">{a.points}</td>
                    <td className={`py-3 pr-4 font-medium capitalize ${TIER_COLORS[a.tier] ?? ''}`}>{a.tier}</td>
                    <td className="py-3 pr-4 text-center">
                      <button
                        onClick={() => void handleToggleActive(a)}
                        title={a.is_active ? 'Desactivar' : 'Activar'}
                        className="text-white/30 hover:text-white/70 transition-colors"
                      >
                        {a.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleEdit(a)}
                        className="text-white/30 hover:text-cyan-400 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function FormField({ label, children, className = '' }: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}
