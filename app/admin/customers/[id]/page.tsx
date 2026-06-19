import { AdminCustomersV1DetailPage } from '@/components/admin/_v1/AdminCustomersV1DetailPage'
import { AdminCustomerDetailV2 } from '@/components/admin/dashboard/AdminCustomerDetailV2'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminCustomerDetailPage({ params }: PageProps) {
  const { id } = await params

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    return <AdminCustomersV1DetailPage customerId={id} />
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

  return <AdminCustomerDetailV2 customerId={id} isSuperAdmin={isSuperAdmin} />
}
