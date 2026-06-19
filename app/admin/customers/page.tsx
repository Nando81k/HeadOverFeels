import { AdminCustomersV1 } from '@/components/admin/_v1/AdminCustomersV1'
import { AdminCustomersV2 } from '@/components/admin/dashboard/AdminCustomersV2'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ tab?: string; range?: string }>
}

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const params = await searchParams

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    return <AdminCustomersV1 />
  }

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
    isSuperAdmin = false
  }

  return <AdminCustomersV2 searchParams={params} isSuperAdmin={isSuperAdmin} />
}
