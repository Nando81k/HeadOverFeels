import { AdminMarketingV1 } from '@/components/admin/_v1/AdminMarketingV1'
import { AdminMarketingV2 } from '@/components/admin/dashboard/AdminMarketingV2'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function AdminMarketingPage({ searchParams }: PageProps) {
  const params = await searchParams

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    return <AdminMarketingV1 />
  }

  // Resolve isSuperAdmin once at the server boundary so SubscribersListView
  // can gate the PII Delete affordance without doing its own auth lookup.
  let isSuperAdmin = false
  try {
    const session = await getSession()
    if (session?.userId) {
      const customer = await prisma.customer.findUnique({
        where: { id: session.userId },
        select: { adminRole: true },
      })
      isSuperAdmin = customer?.adminRole === 'SUPER_ADMIN'
    }
  } catch {
    // Treat any auth/db error as "not super admin" — the SubscribersListView still renders.
    isSuperAdmin = false
  }

  return <AdminMarketingV2 searchParams={params} isSuperAdmin={isSuperAdmin} />
}
