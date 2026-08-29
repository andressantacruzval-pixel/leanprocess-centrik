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
        iconClass="bg-amber-50 border border-amber-200"
        iconColor="text-amber-600"
        title="Logros"
        subtitle="Tu progreso documentando y analizando procesos"
      />
      <AchievementBadges />
    </div>
  )
}
