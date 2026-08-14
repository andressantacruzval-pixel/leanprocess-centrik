/**
 * usePageTracker
 * ──────────────
 * Tracks page views, sessions, and streak activity automatically.
 * Place in MainLayout or App root.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { useStreakStore } from '@/features/gamification/streakStore'

export function usePageTracker() {
  const location = useLocation()
  const trackPageView = useAnalyticsStore((s) => s.trackPageView)
  const startSession = useAnalyticsStore((s) => s.startSession)
  const endSession = useAnalyticsStore((s) => s.endSession)
  const recordActivity = useStreakStore((s) => s.recordActivity)

  // Start session on mount
  useEffect(() => {
    startSession()
    recordActivity()
    return () => { endSession() }
  }, [startSession, recordActivity, endSession])

  // Track page views
  useEffect(() => {
    trackPageView(location.pathname)
  }, [location.pathname, trackPageView])
}
