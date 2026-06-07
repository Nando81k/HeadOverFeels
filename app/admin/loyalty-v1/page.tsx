import { AdminLoyaltyV1Page } from '@/components/admin/_v1/AdminLoyaltyV1Page'

/**
 * Legacy loyalty dashboard. The original /admin/loyalty page content lives at
 * components/admin/_v1/AdminLoyaltyV1Page.tsx so the V1 stub at /admin/loyalty
 * (rendered when NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') can link to it without
 * looping back through the dispatcher.
 */
export default function Page() {
  return <AdminLoyaltyV1Page />
}
