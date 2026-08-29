/**
 * AchievementToast
 * ────────────────
 * Slide-in toast notifications for newly unlocked achievements.
 * Renders a fixed overlay in the top-right corner with confetti animation.
 */

import { useEffect, useRef, type ComponentType } from 'react'
import {
  Footprints,
  Layers,
  Building2,
  Crown,
  GitBranch,
  Workflow,
  ShieldAlert,
  Shield,
  ShieldCheck,
  ShieldPlus,
  BookOpen,
  BookMarked,
  TrendingUp,
  BarChart3,
  Activity,
  ClipboardCheck,
  FileText,
  Flame,
  Sparkles,
  Trophy,
  Star,
  Award,
  Share2,
  Users,
  Lightbulb,
  Rocket,
  type LucideProps,
} from 'lucide-react'
import { useAchievementStore } from '@/features/gamification/achievementStore'

// ── Icon map (same as AchievementBadges) ─────────────────────────────────

const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  Footprints, Layers, Building2, Crown, GitBranch, Workflow,
  ShieldAlert, Shield, ShieldCheck, ShieldPlus,
  BookOpen, BookMarked, TrendingUp, BarChart3,
  Activity, ClipboardCheck, FileText, Flame,
  Sparkles, Trophy, Star, Award, Share2, Users,
  Lightbulb, Rocket,
}

// ── Tier border colors ───────────────────────────────────────────────────

const TIER_BORDER: Record<string, string> = {
  bronze:   'border-[#CD7F32]',
  silver:   'border-[#C0C0C0]',
  gold:     'border-[#FFD700]',
  platinum: 'border-[#E5E4E2]',
}

const TIER_TEXT: Record<string, string> = {
  bronze:   'text-[#CD7F32]',
  silver:   'text-[#C0C0C0]',
  gold:     'text-[#FFD700]',
  platinum: 'text-[#E5E4E2]',
}

const TIER_LABEL: Record<string, string> = {
  bronze: 'Bronce',
  silver: 'Plata',
  gold: 'Oro',
  platinum: 'Platino',
}

// ── Confetti CSS (injected once) ─────────────────────────────────────────

const CONFETTI_STYLE = `
@keyframes achievement-slide-in { 0% opacity: 0; transform: translateX(100%) scale(0.95); } 100%
1; translateX(0) scale(1); achievement-slide-out confetti-fall translateY(-10px) rotate(0deg);
translateY(80px) rotate(720deg); confetti-burst scale(0); 50% scale(1.2); scale(0.5)
translateY(40px); confetti-cascade translateY(-20px) rotate(0deg) translateY(40px)
rotate(540deg) scale(1.3); translateY(120px) rotate(1080deg) scale(0.5); shimmer-glow 0%,
box-shadow: 0 8px rgba(255,215,0,0.3); 20px rgba(255,215,0,0.6), 40px rgba(255,215,0,0.2);
.achievement-toast-enter animation: 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
.achievement-toast-exit 0.3s ease-in .confetti-particle position: absolute; width: 6px; height:
border-radius: 1px; 1.5s ease-out .confetti-particle-premium 8px; 2px; 2.2s .toast-shimmer
ease-in-out 3;
`

// ── Single toast item ────────────────────────────────────────────────────

function ToastItem({
  achievementId,
  onDismiss,
}: {
  achievementId: string
  onDismiss: (id: string) => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const catalog = useAchievementStore((s) => s.catalog)
  const achievement = catalog.find((a) => a.id === achievementId)

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(achievementId), 5000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [achievementId, onDismiss])

  if (!achievement) return null

  const Icon = ICON_MAP[achievement.icon] ?? Star
  const isPremiumTier = achievement.tier === 'gold' || achievement.tier === 'platinum'
  const confettiColors = isPremiumTier
    ? ['#FFD700', '#E5E4E2', '#06b6d4', '#FFD700', '#a855f6', '#10b981', '#f59e0b', '#E5E4E2', '#FFD700', '#06b6d4', '#a855f6', '#f59e0b']
    : ['#FFD700', '#06b6d4', '#10b981', '#a855f6', '#f59e0b', '#E5E4E2']

  return (
    <div
      /* Ancho fluido con techo. Era `width: 340` en estilo inline, invisible para
         Tailwind, dentro de un `fixed`: en una pantalla de 320px desbordaba y
         arrastraba scroll horizontal a TODA la aplicacion, no solo al aviso. */
      className={`achievement-toast-enter relative w-full max-w-[340px] cursor-pointer overflow-hidden rounded-lg border-2 ${TIER_BORDER[achievement.tier]} bg-white p-4 shadow-2xl ${isPremiumTier ? 'toast-shimmer' : ''}`}
      onClick={() => onDismiss(achievementId)}
      role="alert"
    >
      {/* Confetti particles — more + bigger for gold/platinum */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confettiColors.map((color, i) => (
          <div
            key={i}
            className={isPremiumTier ? 'confetti-particle-premium' : 'confetti-particle'}
            style={{
              backgroundColor: color,
              left: `${isPremiumTier ? 5 + i * 8 : 15 + i * 14}%`,
              top: isPremiumTier ? `${5 + (i % 3) * 8}%` : '10%',
              animationDelay: `${i * (isPremiumTier ? 0.1 : 0.15)}s`,
              transform: `rotate(${i * (isPremiumTier ? 30 : 60)}deg)`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex items-start gap-3">
        {/* Icon */}
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100`}>
          <Icon className={`h-6 w-6 ${TIER_TEXT[achievement.tier]}`} />
        </div>

        {/* Content */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
              Logro desbloqueado!
            </span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${TIER_TEXT[achievement.tier]} bg-gray-100`}
            >
              {TIER_LABEL[achievement.tier]}
            </span>
          </div>
          <h4 className="text-sm font-bold text-gray-900">{achievement.title}</h4>
          <p className="text-xs text-gray-400">{achievement.description}</p>
          <div className="mt-1 flex items-center gap-1">
            <Trophy className="h-3 w-3 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">
              +{achievement.points} puntos
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar auto-dismiss */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-50">
        <div
          className={`h-full ${TIER_BORDER[achievement.tier].replace('border', 'bg').replace('[', '[').replace(']', ']')}`}
          style={{
            animation: 'achievement-progress 5s linear forwards',
          }}
        />
      </div>
    </div>
  )
}

// ── Main toast container ─────────────────────────────────────────────────

export function AchievementToast() {
  const pendingNotifications = useAchievementStore((s) => s.pendingNotifications)
  const dismissNotification = useAchievementStore((s) => s.dismissNotification)

  if (pendingNotifications.length === 0) return null

  return (
    <>
      {/* Inject keyframes once */}
      <style>{CONFETTI_STYLE + `
@keyframes achievement-progress {
  0% { width: 100%; }
  100% { width: 0%; }
}
      `}</style>

      {/* Toast stack */}
      <div className="fixed right-4 left-4 sm:left-auto top-4 z-[9999] flex flex-col items-end gap-3">
        {pendingNotifications.slice(0, 3).map((id) => (
          <ToastItem
            key={id}
            achievementId={id}
            onDismiss={dismissNotification}
          />
        ))}
      </div>
    </>
  )
}
