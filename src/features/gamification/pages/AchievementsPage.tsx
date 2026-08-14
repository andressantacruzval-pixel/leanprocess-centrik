import { Award } from 'lucide-react'
import { AchievementBadges } from '@/features/gamification/components/AchievementBadges'
import { useAchievementTracker } from '@/hooks/useAchievementTracker'
import { PageHeader } from '@/components/ui/PageHeader'

export default function AchievementsPage() {
  useAchievementTracker()
  // Era la unica pantalla del dashboard sin titulo: se entraba desde el menu lateral
  // y no habia nada que dijera donde estabas.
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Award}
        iconClass="bg-amber-500/10 border border-amber-500/20"
        iconColor="text-amber-400"
        title="Logros"
        subtitle="Tu progreso documentando y analizando procesos"
      />
      <AchievementBadges />
    </div>
  )
}
