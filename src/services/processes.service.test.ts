/**
 * processes.service — verifica que getMacroprocesses y getProcesses
 * filtren por company_id (no por user_id).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted permite usar variables en el factory de vi.mock sin problemas de hoisting
const { mockFrom, mockSelect, mockEq, mockOrder } = vi.hoisted(() => {
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null })
  const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })
  return { mockFrom, mockSelect, mockEq, mockOrder }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { getMacroprocesses, getProcesses } from './processes.service'

describe('processes.service — filtros de consulta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrder.mockResolvedValue({ data: [], error: null })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  describe('getMacroprocesses', () => {
    it('filtra por company_id, no por user_id', async () => {
      await getMacroprocesses('test-company-id')
      expect(mockEq).toHaveBeenCalledWith('company_id', 'test-company-id')
    })

    it('no usa user_id como filtro de empresa', async () => {
      await getMacroprocesses('test-company-id')
      const calls = mockEq.mock.calls
      const usesUserId = calls.some(([col]: [string]) => col === 'user_id')
      expect(usesUserId).toBe(false)
    })

    it('devuelve data vacía sin error cuando supabase retorna []', async () => {
      const result = await getMacroprocesses('any-id')
      expect(result.error).toBeNull()
      expect(result.data).toEqual([])
    })

    it('devuelve error encapsulado cuando supabase falla', async () => {
      mockEq.mockReturnValue({ order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }) })
      const result = await getMacroprocesses('any-id')
      expect(result.error).toBeInstanceOf(Error)
      expect(result.data).toBeNull()
    })
  })

  describe('getProcesses', () => {
    it('filtra por company_id, no por user_id', async () => {
      await getProcesses('test-company-id')
      expect(mockEq).toHaveBeenCalledWith('company_id', 'test-company-id')
    })

    it('no usa user_id como filtro de empresa', async () => {
      await getProcesses('test-company-id')
      const calls = mockEq.mock.calls
      const usesUserId = calls.some(([col]: [string]) => col === 'user_id')
      expect(usesUserId).toBe(false)
    })

    it('devuelve data vacía sin error cuando supabase retorna []', async () => {
      const result = await getProcesses('any-id')
      expect(result.error).toBeNull()
      expect(result.data).toEqual([])
    })

    it('devuelve error encapsulado cuando supabase falla', async () => {
      mockEq.mockReturnValue({ order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }) })
      const result = await getProcesses('any-id')
      expect(result.error).toBeInstanceOf(Error)
      expect(result.data).toBeNull()
    })
  })
})
