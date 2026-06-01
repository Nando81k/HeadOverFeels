import { AdminFulfillmentV1 } from '@/components/admin/_v1/AdminFulfillmentV1'
import { AdminFulfillmentV2 } from '@/components/admin/dashboard/AdminFulfillmentV2'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function AdminFulfillmentPage({ searchParams }: PageProps) {
  const params = await searchParams
  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED === 'true') {
    return <AdminFulfillmentV2 searchParams={params} />
  }
  return <AdminFulfillmentV1 />
}
