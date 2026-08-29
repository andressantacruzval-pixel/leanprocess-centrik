import { useState, useCallback, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  BarChart3, Upload, Sparkles, Loader2, AlertCircle,
  Download, Save, Trash2, TrendingUp,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { IndicatorsList } from '@/features/kpi/components/IndicatorsList'
import { useIndicators } from '@/hooks/useIndicators'
import { useAuthStore } from '@/stores/authStore'
import { useDocumentableGuard } from '@/hooks/useDocumentableGuard'
import { generateIndicators } from '@/lib/claude'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import type { ProcessIndicator } from '@/types/indicator'
import { EXCEL_COLORS, THRESHOLD_COLORS } from '@/utils/excelStyles'
// ExcelJS + file-saver loaded dynamically on export to keep initial bundle lean

function formatRange(min: number | null | undefined, max: number | null | undefined): string {
  const lo = min ?? null
  const hi = max ?? null
  if (lo === null && hi === null) return '—'
  if (lo !== null && hi !== null) return `${lo} – ${hi}`
  if (lo !== null) return `≥ ${lo}`
  return `≤ ${hi}`
}

type TempIndicator = ProcessIndicator & { _tempId?: string }

export default function IndicatorsPage() {
  const { processId } = useParams()

  // Ruta `/app/indicators/:processId`: crea KPIs sobre un proceso concreto, asi
  // que necesita el mismo guard que KpiPage. Sin processId (listado general) el
  // hook no hace nada. Ver @/lib/processLevels.
  useDocumentableGuard(processId)
  const [searchParams] = useSearchParams()
  const processName = searchParams.get('name') || ''
  const processDescription = searchParams.get('description') || ''
  const user = useAuthStore((s) => s.user)

  const { indicators: savedIndicators, createMany, loading: loadingSaved } = useIndicators(processId)

  const [generatedIndicators, setGeneratedIndicators] = useState<TempIndicator[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const indicatorBudget = useTokenBudget({ operationKey: 'indicators' })

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [manualName, setManualName] = useState(processName)
  const [manualDescription, setManualDescription] = useState(processDescription)

  // Mode: from process context vs manual upload
  const hasProcessContext = !!processId

  const allIndicators = useMemo((): TempIndicator[] => {
    if (generatedIndicators.length > 0) return generatedIndicators
    return savedIndicators.map((ind) => ({ ...ind, _tempId: ind.id })) as unknown as TempIndicator[]
  }, [generatedIndicators, savedIndicators])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setUploadedFile(file)
  }

  async function readFileAsText(file: File): Promise<string> {
    // For images we just return a placeholder description - Claude can't read images via text API
    if (file.type.startsWith('image/')) {
      return `[Imagen de diagrama de flujo subida: ${file.name}]`
    }
    // For text-based files
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  async function handleGenerate() {
    if (!manualName.trim()) {
      setError('Ingresa el nombre del proceso')
      return
    }
    setIsGenerating(true)
    setError(null)
    setSuccess(null)

    await indicatorBudget.run(async () => {
      try {
        let fileContent: string | undefined
        if (uploadedFile) {
          fileContent = await readFileAsText(uploadedFile)
        }

        const result = await generateIndicators({
          name: manualName,
          description: manualDescription || undefined,
          fileContent,
        })

        const tempIndicators: TempIndicator[] = result.indicadores.map((ind, i) => ({
          id: '',
          _tempId: `temp-${i}-${Date.now()}`,
          process_id: processId || '',
          user_id: user?.id || '',
          name: ind.nombre,
          objective: ind.objetivo,
          formula: ind.formula,
          data_source: ind.fuente_datos,
          unit_of_measure: ind.unidad_medida,
          frequency: ind.frecuencia,
          target_value: ind.meta,
          threshold_green_min: ind.umbral_verde_min,
          threshold_green_max: ind.umbral_verde_max,
          threshold_yellow_min: ind.umbral_amarillo_min,
          threshold_yellow_max: ind.umbral_amarillo_max,
          threshold_red_min: ind.umbral_rojo_min,
          threshold_red_max: ind.umbral_rojo_max,
          responsible_report: ind.responsable_reporte,
          responsible_monitoring: ind.responsable_monitoreo,
          is_active: true,
          generated_by_ai: true,
          sort_order: i,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))

        setGeneratedIndicators(tempIndicators)
        setSelectedIds(new Set(tempIndicators.map((ind) => ind._tempId!)))
        setSuccess(`Se generaron ${tempIndicators.length} indicadores para "${result.nombre_proceso}"`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al generar indicadores')
      }
    })

    setIsGenerating(false)
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSelectAll() {
    setSelectedIds(new Set(allIndicators.map((ind) => ind._tempId || ind.id)))
  }

  function handleDeselectAll() {
    setSelectedIds(new Set())
  }

  const handleUpdateIndicator = useCallback((id: string, updated: Partial<ProcessIndicator>) => {
    setGeneratedIndicators((prev) =>
      prev.map((ind) => {
        const uid = ind._tempId || ind.id
        if (uid === id) return { ...ind, ...updated }
        return ind
      })
    )
  }, [])

  async function handleSaveSelected() {
    if (!user || selectedIds.size === 0) return
    setIsSaving(true)
    setError(null)

    try {
      const toSave = allIndicators
        .filter((ind) => selectedIds.has(ind._tempId || ind.id))
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ _tempId, id, created_at, updated_at, ...rest }) => ({
          ...rest,
          process_id: processId || null,
        }))

      await createMany(toSave as unknown as Parameters<typeof createMany>[0])
      setSuccess(`${toSave.length} indicadores guardados exitosamente`)
      setGeneratedIndicators([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar indicadores')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleExportExcel() {
    const toExport = allIndicators.filter((ind) => selectedIds.has(ind._tempId || ind.id))
    if (toExport.length === 0) {
      setError('Selecciona al menos un indicador para exportar')
      return
    }

    const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
      import('exceljs'),
      import('file-saver'),
    ])
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Lean Process'
    wb.created = new Date()

    const ws = wb.addWorksheet('Indicadores', {
      properties: { defaultColWidth: 20 },
    })

    // Title row
    ws.mergeCells('A1:M1')
    const titleCell = ws.getCell('A1')
    titleCell.value = `Indicadores de Proceso: ${manualName || 'Sin nombre'}`
    titleCell.font = { size: 16, bold: true, color: { argb: `FF${EXCEL_COLORS.white}` }, name: EXCEL_COLORS.font }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${EXCEL_COLORS.navyTitle}` } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 40

    // Date row
    ws.mergeCells('A2:M2')
    const dateCell = ws.getCell('A2')
    dateCell.value = `Generado: ${new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' })}`
    dateCell.font = { size: 10, italic: true, color: { argb: `FF${EXCEL_COLORS.textMuted}` }, name: EXCEL_COLORS.font }
    dateCell.alignment = { horizontal: 'center' }

    // Headers
    const headers = [
      'Nombre', 'Objetivo', 'Formula', 'Fuente de Datos', 'Unidad',
      'Frecuencia', 'Meta', 'Umbral Verde', 'Umbral Amarillo',
      'Umbral Rojo', 'Resp. Reporte', 'Resp. Monitoreo', 'Activo',
    ]

    const headerRow = ws.addRow(headers)
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: `FF${EXCEL_COLORS.white}` }, size: 10, name: EXCEL_COLORS.font }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${EXCEL_COLORS.blue}` } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: `FF${EXCEL_COLORS.borderLight}` } },
        bottom: { style: 'thin', color: { argb: `FF${EXCEL_COLORS.borderLight}` } },
        left: { style: 'thin', color: { argb: `FF${EXCEL_COLORS.borderLight}` } },
        right: { style: 'thin', color: { argb: `FF${EXCEL_COLORS.borderLight}` } },
      }
    })
    headerRow.height = 30

    // Data
    for (const ind of toExport) {
      const row = ws.addRow([
        ind.name,
        ind.objective || '',
        ind.formula || '',
        ind.data_source || '',
        ind.unit_of_measure || '',
        ind.frequency || '',
        ind.target_value || '',
        formatRange(ind.threshold_green_min, ind.threshold_green_max),
        formatRange(ind.threshold_yellow_min, ind.threshold_yellow_max),
        formatRange(ind.threshold_red_min, ind.threshold_red_max),
        ind.responsible_report || '',
        ind.responsible_monitoring || '',
        ind.is_active ? 'Si' : 'No',
      ])

      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: `FF${EXCEL_COLORS.borderLight}` } },
          bottom: { style: 'thin', color: { argb: `FF${EXCEL_COLORS.borderLight}` } },
          left: { style: 'thin', color: { argb: `FF${EXCEL_COLORS.borderLight}` } },
          right: { style: 'thin', color: { argb: `FF${EXCEL_COLORS.borderLight}` } },
        }
        cell.alignment = { vertical: 'top', wrapText: true }
        cell.font = { size: 10, color: { argb: `FF${EXCEL_COLORS.textDark}` }, name: EXCEL_COLORS.font }

        // Color thresholds
        if (colNumber === 8) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${THRESHOLD_COLORS.green.bg}` } }
          cell.font = { size: 10, color: { argb: `FF${THRESHOLD_COLORS.green.text}` }, name: EXCEL_COLORS.font }
        } else if (colNumber === 9) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${THRESHOLD_COLORS.yellow.bg}` } }
          cell.font = { size: 10, color: { argb: `FF${THRESHOLD_COLORS.yellow.text}` }, name: EXCEL_COLORS.font }
        } else if (colNumber === 10) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${THRESHOLD_COLORS.red.bg}` } }
          cell.font = { size: 10, color: { argb: `FF${THRESHOLD_COLORS.red.text}` }, name: EXCEL_COLORS.font }
        }
      })
    }

    // Auto-fit columns
    ws.columns.forEach((col) => {
      col.width = 18
    })
    if (ws.columns[0]) ws.columns[0].width = 25
    if (ws.columns[1]) ws.columns[1].width = 30
    if (ws.columns[2]) ws.columns[2].width = 30

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `indicadores_${manualName.replace(/\s+/g, '_').toLowerCase() || 'proceso'}.xlsx`)
  }

  function handleDeleteSelected() {
    setGeneratedIndicators((prev) =>
      prev.filter((ind) => !selectedIds.has(ind._tempId || ind.id))
    )
    setSelectedIds(new Set())
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Generador de Indicadores"
        subtitle="Genera indicadores KPI para tus procesos con inteligencia artificial"
      />

      {/* Error/Success */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={20} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-lg px-4 py-3">
          <Sparkles size={20} className="text-primary-600 shrink-0" />
          <p className="text-sm text-primary-600">{success}</p>
        </div>
      )}

      {/* Input section */}
      <div className="bg-gray-50 rounded-lg border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Informacion del Proceso</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Nombre del proceso *</label>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Ej: Gestion de Reclamos"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-300"
              disabled={hasProcessContext}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Descripcion (opcional)</label>
            <input
              type="text"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              placeholder="Breve descripcion del proceso"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-300"
              disabled={hasProcessContext}
            />
          </div>
        </div>

        {/* File upload */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-500 mb-1">
            Subir diagrama de flujo (opcional)
          </label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-primary-300 hover:bg-gray-50 transition-colors">
              <Upload size={18} className="text-gray-500" />
              <span className="text-sm text-gray-500">
                {uploadedFile ? uploadedFile.name : 'PDF, imagen o DOCX'}
              </span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {uploadedFile && (
              <button
                onClick={() => setUploadedFile(null)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Quitar
              </button>
            )}
          </div>
        </div>

        {/* Generate button */}
        <div className="mt-6">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || indicatorBudget.isConsuming || !manualName.trim()}
            className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg bg-primary-500 hover:bg-primary-600"
          >
            {(isGenerating || indicatorBudget.isConsuming) ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Generando indicadores...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Generar Indicadores con IA
                <TokenCostBadge operationKey="indicators" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Indicators list */}
      {(allIndicators.length > 0 || loadingSaved) && (
        <div className="bg-gray-50 rounded-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Indicadores
              {allIndicators.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">({allIndicators.length})</span>
              )}
            </h2>

            <div className="flex gap-2">
              {generatedIndicators.length > 0 && selectedIds.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1.5 px-3 py-2 border border-red-300 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={16} />
                  Eliminar ({selectedIds.size})
                </button>
              )}

              <button
                onClick={handleExportExcel}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                <Download size={16} />
                Exportar Excel
              </button>

              {generatedIndicators.length > 0 && (
                <button
                  onClick={handleSaveSelected}
                  disabled={isSaving || selectedIds.size === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors shadow-lg bg-primary-500 hover:bg-primary-600"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Guardar seleccionados
                </button>
              )}
            </div>
          </div>

          {loadingSaved ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-primary-600" />
            </div>
          ) : (
            <IndicatorsList
              indicators={allIndicators}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onUpdateIndicator={handleUpdateIndicator}
            />
          )}
        </div>
      )}

      {/* Empty state */}
      {allIndicators.length === 0 && !loadingSaved && !isGenerating && (
        <div className="bg-gray-50 rounded-lg border border-gray-100">
          <EmptyState
            icon={TrendingUp}
            title="Define KPIs para medir tus procesos"
            description="Ingresa la informacion del proceso y genera indicadores con inteligencia artificial"
            actionLabel="Ir al Mapa de Procesos"
            actionHref="/app/process-map"
          />
        </div>
      )}

      <InsufficientTokensModal
        open={indicatorBudget.showInsufficientModal}
        onClose={indicatorBudget.closeInsufficientModal}
        operationKey="indicators"
      />
    </div>
  )
}
