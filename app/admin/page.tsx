import { AdminDashboardV1 } from '@/components/admin/_v1/AdminDashboardV1'
import { AdminDashboardV2 } from '@/components/admin/dashboard/AdminDashboardV2'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ range?: string }>
}

export default async function AdminPage({ searchParams }: PageProps) {
  const params = await searchParams
  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED === 'true') {
    return <AdminDashboardV2 searchParams={params} />
  }
  return <AdminDashboardV1 />
}
