/**
 * CommunityShareModal
 * ────────────────────
 * Modal for sharing achievements/results to the Process Masters Circle community.
 * Includes clipboard copy, Circle link, and N8N webhook info.
 */

import { useState } from 'react'
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Image,
  Send,
  Webhook,
  Users,
} from 'lucide-react'
import { useAchievementStore } from '@/features/gamification/achievementStore'

// ── Types ────────────────────────────────────────────────────────────────

export interface ShareData {
  type: 'achievement' | 'report' | 'process' | 'benchmark'
  title: string
  description: string
  metadata: Record<string, unknown>
}

interface CommunityShareModalProps {
  isOpen: boolean
  onClose: () => void
  shareData: ShareData
}

// ── Constants ────────────────────────────────────────────────────────────

const CIRCLE_URL =
  'https://process-masters.circle.so/c/automatizacion-y-herramientas/'

const TYPE_LABELS: Record<ShareData['type'], string> = {
  achievement: 'Logro',
  report: 'Reporte',
  process: 'Proceso',
  benchmark: 'Benchmark',
}

const TYPE_COLORS: Record<ShareData['type'], string> = {
  achievement: 'bg-amber-100 text-amber-700',
  report: 'bg-primary-100 text-primary-700',
  process: 'bg-emerald-100 text-emerald-700',
  benchmark: 'bg-primary-100 text-primary-700',
}

// ── Helper: build formatted text for clipboard ───────────────────────────

function buildShareText(data: ShareData): string {
  const lines = [
    `--- ${TYPE_LABELS[data.type].toUpperCase()} ---`,
    `${data.title}`,
    '',
    data.description,
    '',
  ]

  if (data.metadata && Object.keys(data.metadata).length > 0) {
    lines.push('Detalles:')
    for (const [key, value] of Object.entries(data.metadata)) {
      lines.push(`  ${key}: ${String(value)}`)
    }
    lines.push('')
  }

  lines.push('Compartido desde Lean Process App')
  lines.push(CIRCLE_URL)

  return lines.join('\n')
}

// ── Component ────────────────────────────────────────────────────────────

export function CommunityShareModal({
  isOpen,
  onClose,
  shareData,
}: CommunityShareModalProps) {
  const createCommunityPost = useAchievementStore((s) => s.createCommunityPost)
  const [copied, setCopied] = useState(false)
  const [published, setPublished] = useState(false)

  if (!isOpen) return null

  const handlePublish = () => {
    createCommunityPost({
      type: shareData.type,
      title: shareData.title,
      description: shareData.description,
      metadata: shareData.metadata,
    })
    setPublished(true)
    // Open Circle in new tab
    window.open(CIRCLE_URL, '_blank', 'noopener,noreferrer')
  }

  const handleCopy = async () => {
    const text = buildShareText(shareData)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/45"
        onClick={onClose}
      />

      {/* Modal — con `p-4` en el fondo y tope de alto: sin ellos iba de borde a borde
          y, con una descripcion larga, el boton de compartir quedaba inalcanzable. */}
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
            <Users className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Compartir en Process Masters
            </h2>
            <p className="text-xs text-gray-400">
              Publica en la comunidad y celebra con otros profesionales
            </p>
          </div>
        </div>

        {/* Preview card */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TYPE_COLORS[shareData.type]}`}
            >
              {TYPE_LABELS[shareData.type]}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">
            {shareData.title}
          </h3>
          <p className="mt-1 text-xs text-gray-400">{shareData.description}</p>
          {shareData.metadata && Object.keys(shareData.metadata).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(shareData.metadata)
                .slice(0, 4)
                .map(([key, value]) => (
                  <span
                    key={key}
                    className="rounded-md bg-gray-50 px-2 py-0.5 text-[10px] text-gray-400"
                  >
                    {key}: {String(value)}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {/* Publish button */}
          <button
            onClick={handlePublish}
            disabled={published}
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
              published
                ? 'bg-emerald-100 text-emerald-700 cursor-default'
                : 'bg-primary-500 text-white hover:bg-primary-600 active:scale-[0.98]'
            }`}
          >
            {published ? (
              <>
                <Check className="h-4 w-4" />
                Publicado - Abriendo Circle...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Publicar en Process Masters
                <ExternalLink className="h-3 w-3 opacity-60" />
              </>
            )}
          </button>

          {/* Secondary actions row */}
          <div className="flex gap-3">
            {/* Copy to clipboard */}
            <button
              onClick={handleCopy}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-100"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar al portapapeles
                </>
              )}
            </button>

            {/* Export image placeholder */}
            <button
              disabled
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5 text-xs font-medium text-gray-600 cursor-not-allowed"
              title="Proximamente"
            >
              <Image className="h-3.5 w-3.5" />
              Exportar imagen
              <span className="rounded-md bg-gray-50 px-1 py-0.5 text-[9px]">
                Pronto
              </span>
            </button>
          </div>
        </div>

        {/* N8N webhook info */}
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
          <Webhook className="h-3.5 w-3.5 shrink-0 text-primary-600" />
          <span className="text-[10px] text-gray-500">
            Integracion N8N: Los eventos se registran automaticamente para
            sincronizacion
          </span>
        </div>
      </div>
    </div>
  )
}
