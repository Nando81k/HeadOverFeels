import { prisma } from '@/lib/prisma'
import { AdminLayout } from '@/components/admin/AdminLayout'
import AccountingDashboard from './AccountingDashboard'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default async function FinancialPage() {
  const pendingOrdersCount = await prisma.order.count({ 
    where: { status: 'PENDING' } 
  })

  return (
    <AdminLayout
      title="Accounting Suite"
      subtitle="Complete financial management: expenses, invoices, budgets, tax planning & reports"
      pendingOrders={pendingOrdersCount}
    >
      <AccountingDashboard />
    </AdminLayout>
  )
}
