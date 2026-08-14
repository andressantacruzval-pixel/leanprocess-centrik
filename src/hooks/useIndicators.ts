import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { Database } from '@/types/database'

type Indicator = Database['public']['Tables']['indicators']['Row']
type IndicatorInsert = Database['public']['Tables']['indicators']['Insert']
type IndicatorUpdate = Database['public']['Tables']['indicators']['Update']

export function useIndicators(processId?: string) {
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIndicators = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('indicators')
        .select('*')
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: true })

      if (processId) {
        query = query.eq('process_id', processId)
      }

      const { data, error: err } = await query
      if (err) throw err
      setIndicators(data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar indicadores')
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, processId])

  useEffect(() => {
    fetchIndicators()
  }, [fetchIndicators])

  async function createIndicator(
    indicator: Omit<IndicatorInsert, 'id' | 'created_at' | 'updated_at'> & {
      name: string
      process_id: string
    }
  ) {
    if (!activeCompanyId) return null
    const { data, error: err } = await supabase
      .from('indicators')
      .insert({ ...indicator, company_id: activeCompanyId })
      .select()
      .single()

    if (err) throw err
    setIndicators((prev) => [...prev, data as Indicator])
    return data as Indicator
  }

  async function createMany(
    items: Array<
      Omit<IndicatorInsert, 'id' | 'created_at' | 'updated_at'> & {
        name: string
        process_id: string
      }
    >
  ) {
    if (!activeCompanyId) return []
    const rows = items.map((item) => ({
      ...item,
      company_id: activeCompanyId,
    }))

    const { data, error: err } = await supabase
      .from('indicators')
      .insert(rows)
      .select()

    if (err) throw err
    const created = (data || []) as Indicator[]
    setIndicators((prev) => [...prev, ...created])
    return created
  }

  async function updateIndicator(id: string, updates: Partial<IndicatorUpdate>) {
    const { data, error: err } = await supabase
      .from('indicators')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (err) throw err
    setIndicators((prev) => prev.map((ind) => (ind.id === id ? (data as Indicator) : ind)))
    return data as Indicator
  }

  async function deleteIndicator(id: string) {
    const { error: err } = await supabase
      .from('indicators')
      .delete()
      .eq('id', id)

    if (err) throw err
    setIndicators((prev) => prev.filter((ind) => ind.id !== id))
  }

  return {
    indicators,
    loading,
    error,
    fetchIndicators,
    createIndicator,
    createMany,
    updateIndicator,
    deleteIndicator,
  }
}
