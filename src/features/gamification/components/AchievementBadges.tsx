/**
 * AchievementBadges
 * ─────────────────
 * Grid display of all achievements (unlocked and locked) with category filters.
 */

import { useState, useMemo, type ComponentType } from 'react'
import {
  Trophy,
  Lock,
  Share2,
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
  Star,
  Award,
  Users,
  Lightbulb,
  Rocket,
  Database,
  Boxes,
  MonitorSmartphone,
  Network,
  Zap,
  type LucideProps,
} from 'lucide-react'
import {
  useAchievementStore,
  type Achievement,
} from '@/features/gamification/achievementStore'
import { useAchievementProgress } from '@/hooks/useAchievementProgress'

// ── Icon map ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
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
  Database,
  Boxes,
  MonitorSmartphone,
  Network,
  Zap,
}

// ── Tier colors ──────────────────────────────────────────────────────────

const TIER_COLORS: Record<Achievement['tier'], { border: string; glow: string; label: string }> = {
  bronze:   { border: 'border-[#CD7F32]', glow: 'shadow-[0_0_12px_rgba(205,127,50,0.35)]',  label: 'Bronce' },
  silver:   { border: 'border-[#C0C0C0]', glow: 'shadow-[0_0_12px_rgba(192,192,192,0.35)]', label: 'Plata' },
  gold:     { border: 'border-[#FFD700]', glow: 'shadow-[0_0_12px_rgba(255,215,0,0.35)]',   label: 'Oro' },
  platinum: { border: 'border-[#E5E4E2]', glow: 'shadow-[0_0_12px_rgba(229,228,226,0.45)]', label: 'Platino' },
}

const TIER_TEXT: Record<Achievement['tier'], string> = {
  bronze:   'text-[#CD7F32]',
  silver:   'text-[#C0C0C0]',
  gold:     'text-[#FFD700]',
  platinum: 'text-[#E5E4E2]',
}

// ── Category tabs ────────────────────────────────────────────────────────

type CategoryFilter = 'all' | Achievement['category']

const CATEGORIES: { key: CategoryFilter; label: string }[] = [
  { key: 'all',            label: 'Todos' },
  { key: 'procesos',      label: 'Procesos' },
  { key: 'riesgos',       label: 'Riesgos' },
  { key: 'documentacion', label: 'Documentacion' },
  { key: 'analisis',      label: 'Analisis' },
  { key: 'maestria',      label: 'Maestria' },
  { key: 'comunidad',     label: 'Comunidad' },
]

// ── Component ────────────────────────────────────────────────────────────

interface AchievementBadgesProps {
  onShare?: (achievement: Achievement) => void
}

export function AchievementBadges({ onShare }: AchievementBadgesProps) {
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const totalPoints = useAchievementStore((s) => s.totalPoints)
  const unlockedAchievements = useAchievementStore((s) => s.unlockedAchievements)
  const catalog = useAchievementStore((s) => s.catalog)
  const progress = useAchievementProgress()

  // Merge all achievements with unlock status
  const allAchievements = useMemo(() => {
    return catalog.map((a) => {
      const unlocked = unlockedAchievements.find((u) => u.achievementId === a.id)
      return { ...a, unlocked: !!unlocked, unlockedAt: unlocked?.unlockedAt, sharedToCommunity: unlocked?.sharedToCommunity }
    }).filter((a) => filter === 'all' || a.category === filter)
  }, [catalog, unlockedAchievements, filter])

  return (
    <div className="flex flex-col gap-6">
      {/* Header: total points */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 ring-1 ring-amber-500/30">
          <Trophy className="h-6 w-6 text-amber-400" />
          <span className="text-2xl font-bold text-amber-300">{totalPoints}</span>
          <span className="text-sm text-amber-400/70">puntos</span>
        </div>
        <span className="text-sm text-gray-400">
          {unlockedAchievements.length} / {catalog.length} logros desbloqueados
        </span>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setFilter(cat.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === cat.key
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Achievements grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allAchievements.map((achievement) => {
          const Icon = ICON_MAP[achievement.icon] ?? Star
          const tier = TIER_COLORS[achievement.tier]
          const isUnlocked = achievement.unlocked

          return (
            <div
              key={achievement.id}
              className={`relative flex flex-col gap-3 rounded-xl border p-4 transition-all ${
                isUnlocked
                  ? `${tier.border} ${tier.glow} bg-white/5`
                  : 'border-white/5 bg-white/[0.02] opacity-50 grayscale'
              }`}
            >
              {/* Icon + tier badge */}
              <div className="flex items-start justify-between">
                <div className="relative">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                      isUnlocked ? 'bg-white/10' : 'bg-white/5'
                    }`}
                  >
                    <Icon
                      className={`h-6 w-6 ${
                        isUnlocked ? TIER_TEXT[achievement.tier] : 'text-gray-600'
                      }`}
                    />
                  </div>
                  {!isUnlocked && (
                    <div className="absolute -bottom-1 -right-1 rounded-full bg-gray-800 p-0.5">
                      <Lock className="h-3 w-3 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      isUnlocked
                        ? `${TIER_TEXT[achievement.tier]} bg-white/10`
                        : 'bg-white/5 text-gray-600'
                    }`}
                  >
                    {TIER_COLORS[achievement.tier].label}
                  </span>
                  <span className="text-xs font-bold text-amber-400/80">
                    +{achievement.points}
                  </span>
                </div>
              </div>

              {/* Title + description */}
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {achievement.title}
                </h3>
                <p className="mt-0.5 text-xs text-gray-400">
                  {achievement.description}
                </p>
              </div>

              {/* Criteria or unlock date */}
              {isUnlocked ? (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">
                    {achievement.unlockedAt
                      ? new Date(achievement.unlockedAt).toLocaleDateString('es-EC')
                      : ''}
                  </span>
                  {onShare && (
                    <button
                      onClick={() => onShare(achievement)}
                      className="flex items-center gap-1 rounded-md bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
                    >
                      <Share2 className="h-3 w-3" />
                      Compartir
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-auto rounded-md bg-white/5 px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">
                      {achievement.criteria}
                    </span>
                    {progress[achievement.id] && (
                      <span className="text-[10px] font-medium text-cyan-400">
                        {progress[achievement.id].current}/{progress[achievement.id].target}
                      </span>
                    )}
                  </div>
                  {progress[achievement.id] && (
                    <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-cyan-500 transition-all"
                        style={{
                          width: `${Math.min(
                            (progress[achievement.id].current / progress[achievement.id].target) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
