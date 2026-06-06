import { AdminAnalyticsV1 } from '@/components/admin/_v1/AdminAnalyticsV1'
import { AdminAnalyticsV2 } from '@/components/admin/dashboard/AdminAnalyticsV2'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ tab?: string; range?: string }>
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    return <AdminAnalyticsV1 />
  }

  // Resolve isSuperAdmin once at the server boundary so ExpensesTab can gate
  // privileged affordances without doing its own auth lookup.
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
    // Treat any auth/db error as "not super admin" — the page still renders.
    isSuperAdmin = false
  }

  return <AdminAnalyticsV2 searchParams={params} isSuperAdmin={isSuperAdmin} />
}
