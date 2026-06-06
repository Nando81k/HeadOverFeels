import { AdminAnalyticsV1Page } from '@/components/admin/_v1/AdminAnalyticsV1Page'

/**
 * Legacy analytics dashboard. The original /admin/analytics page content lives at
 * components/admin/_v1/AdminAnalyticsV1Page.tsx so the V1 stub at /admin/analytics
 * (rendered when NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') can link to it without
 * looping back through the dispatcher.
 */
export default function Page() {
  return <AdminAnalyticsV1Page />
}
