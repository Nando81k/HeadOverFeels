import { AdminProductsV1 } from '@/components/admin/_v1/AdminProductsV1'
import { AdminProductsV2 } from '@/components/admin/dashboard/AdminProductsV2'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const params = await searchParams
  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED === 'true') {
    return <AdminProductsV2 searchParams={params} />
  }
  return <AdminProductsV1 />
}
