import { useMemo, useState } from 'react'
import { X, Download, Image as ImageIcon, FileCode, FileText, Loader2 } from 'lucide-react'
import { buildMapSvg, svgToPngCanvas, type MapData, type MapBrand, type MapMeta } from '@/utils/mapSvg'
import { useMapExportStore, MAP_PRESETS } from '@/stores/mapExportStore'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import type { InvReportRow } from '@/features/inventory/inventoryReportData'

// Pantalla de exportación del mapa: vista previa en vivo (SVG vectorial, nunca
// cortado), paleta/colores/tema/composición que se guardan (mapExportStore) y se
// pueden editar, y descargas PNG / SVG / PDF-reporte. Sin cargar nada externo.

const safe = (s: string) => (s || 'mapa').replace(/\s+/g, '_').replace(/[^\w-]/g, '')

export function MapExportModal({ data, invRows, author, country, onClose }: {
  data: MapData
  invRows: InvReportRow[]
  author: string
  country: string
  onClose: () => void
}) {
  const st = useMapExportStore()
  const [busy, setBusy] = useState<'' | 'png' | 'svg' | 'pdf'>('')
  const track = useAnalyticsStore((s) => s.trackEvent)

  const brand: MapBrand = {
    cEst: st.cEst, cPro: st.cPro, cApo: st.cApo, accent: st.accent,
    theme: st.theme, showHeader: st.showHeader, showFooter: st.showFooter, showClient: st.showClient, showNums: st.showNums,
  }
  const meta: MapMeta = useMemo(() => ({
    scope: st.scope, version: st.version, author, country,
    date: new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' }),
  }), [st.scope, st.version, author, country])

  const built = useMemo(() => buildMapSvg(data, brand, meta),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, brand.cEst, brand.cPro, brand.cApo, brand.accent, brand.theme, brand.showHeader, brand.showFooter, brand.showClient, brand.showNums, meta])
  const previewSvg = useMemo(() => built.svg.replace(/width="[\d.]+" height="[\d.]+"/, 'style="width:100%;height:auto;display:block"'), [built])

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }
  const doPng = async () => {
    setBusy('png')
    try {
      const cv = await svgToPngCanvas(built.svg, built.w, built.h, brand.theme)
      cv.toBlob((b) => { if (b) downloadBlob(b, `Mapa_Procesos_${safe(data.org)}.png`) }, 'image/png')
      track('export', 'process-map-png')
    } finally { setBusy('') }
  }
  const doSvg = () => {
    downloadBlob(new Blob([built.svg], { type: 'image/svg+xml;charset=utf-8' }), `Mapa_Procesos_${safe(data.org)}.svg`)
    track('export', 'process-map-svg')
  }
  const doPdf = async () => {
    setBusy('pdf')
    try {
      const cv = await svgToPngCanvas(built.svg, built.w, built.h, brand.theme)
      const { exportMapReportPdf } = await import('@/utils/processMapExport')
      await exportMapReportPdf(cv, invRows, { company: data.org, generatedBy: author || null })
    } finally { setBusy('') }
  }

  const seg = (on: boolean) => `flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${on ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-white/50 border border-white/10 hover:text-white/80'}`
  const colors: { key: 'cEst' | 'cPro' | 'cApo' | 'accent'; label: string; sub: string }[] = [
    { key: 'cEst', label: 'Estratégicos', sub: 'Dirigen y deciden' },
    { key: 'cPro', label: 'Productivos', sub: 'Entregan valor' },
    { key: 'cApo', label: 'Apoyo', sub: 'Proveen recursos' },
    { key: 'accent', label: 'Acento cliente', sub: 'Barras y flechas' },
  ]
  const toggles: { key: 'showHeader' | 'showFooter' | 'showClient' | 'showNums'; label: string }[] = [
    { key: 'showHeader', label: 'Encabezado (título + versión)' },
    { key: 'showFooter', label: 'Pie de firma' },
    { key: 'showClient', label: 'Barras de CLIENTE' },
    { key: 'showNums', label: 'Numerar la cadena de valor' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <h3 className="text-sm font-semibold text-white">Exportar mapa de procesos</h3>
            <p className="text-[11px] text-white/40">Vectorial y con tu marca — nunca sale cortado. La configuración se guarda.</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 p-4">
          {/* Preview */}
          <div className="min-w-0">
            <div className="rounded-xl border border-white/10 overflow-auto max-h-[60vh]" style={{ background: brand.theme === 'light' ? '#e9eff8' : '#0b1220' }}>
              <div className="p-3" dangerouslySetInnerHTML={{ __html: previewSvg }} />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={doPng} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 disabled:opacity-50">
                {busy === 'png' ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} PNG
              </button>
              <button onClick={doSvg} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25 disabled:opacity-50">
                <FileCode size={14} /> SVG vectorial
              </button>
              <button onClick={doPdf} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50">
                {busy === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} PDF: mapa + inventario
              </button>
            </div>
            <p className="text-[10px] text-white/30 mt-1.5">SVG se edita en PowerPoint/Illustrator sin perder nitidez. El PDF incluye el mapa, los gráficos y la tabla del inventario.</p>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-2">Combinaciones</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {MAP_PRESETS.map((p) => (
                  <button key={p.id} onClick={() => st.applyPreset(p.id)}
                    className={`text-left rounded-lg border p-2 transition-colors ${st.preset === p.id ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 hover:border-white/25'}`}>
                    <div className="flex gap-1 mb-1">
                      {[p.cEst, p.cPro, p.cApo, p.accent].map((c, i) => <span key={i} className="w-3.5 h-3.5 rounded-sm" style={{ background: c }} />)}
                    </div>
                    <span className="block text-[11px] font-semibold text-white/85 leading-tight">{p.name}</span>
                    <span className="block text-[9px] text-white/35">{p.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-2">Color por franja</h4>
              <div className="space-y-1.5">
                {colors.map((c) => (
                  <label key={c.key} className="flex items-center gap-2">
                    <input type="color" value={st[c.key]} onChange={(e) => st.setBrand({ [c.key]: e.target.value })} className="w-8 h-7 rounded border border-white/15 bg-transparent cursor-pointer p-0.5" />
                    <span className="flex-1 min-w-0"><span className="block text-[11px] text-white/80 leading-tight">{c.label}</span><span className="block text-[9px] text-white/35">{c.sub}</span></span>
                    <span className="text-[9px] font-mono text-white/35">{st[c.key]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-2">Fondo</h4>
              <div className="flex gap-1.5">
                <button onClick={() => st.setBrand({ theme: 'dark' })} className={seg(st.theme === 'dark')}>🌙 Presentación</button>
                <button onClick={() => st.setBrand({ theme: 'light' })} className={seg(st.theme === 'light')}>📄 Informe</button>
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-2">Composición</h4>
              <div className="space-y-1.5">
                {toggles.map((t) => (
                  <button key={t.key} onClick={() => st.setBrand({ [t.key]: !st[t.key] })}
                    className="w-full flex items-center justify-between gap-2 text-left rounded-lg border border-white/10 px-2.5 py-1.5 hover:border-white/25">
                    <span className="text-[11px] text-white/75">{t.label}</span>
                    <span className={`w-8 h-4 rounded-full relative transition-colors ${st[t.key] ? 'bg-cyan-500/70' : 'bg-white/15'}`}>
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${st[t.key] ? 'left-4' : 'left-0.5'}`} />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-2">Datos del entregable</h4>
              <div className="space-y-2">
                <label className="block">
                  <span className="block text-[10px] text-white/40 mb-0.5">Alcance (opcional)</span>
                  <input value={st.scope} onChange={(e) => st.setMeta({ scope: e.target.value })} placeholder="Toda la organización"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] text-white/85 outline-none placeholder-white/25" />
                </label>
                <label className="block">
                  <span className="block text-[10px] text-white/40 mb-0.5">Versión</span>
                  <input value={st.version} onChange={(e) => st.setMeta({ version: e.target.value })} placeholder="1.0"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] text-white/85 outline-none placeholder-white/25" />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-white/10 flex items-center justify-between">
          <span className="text-[10px] text-white/30 inline-flex items-center gap-1"><Download size={11} /> Los cambios se guardan automáticamente para la próxima vez.</span>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] text-white/60 hover:text-white/90 border border-white/10">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
