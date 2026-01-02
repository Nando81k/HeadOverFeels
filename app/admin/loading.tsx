import { AdminLayout } from '@/components/admin/AdminLayout'
import DashboardLoading from '@/components/admin/DashboardLoading'

export default function Loading() {
  return (
    <AdminLayout 
      title="Dashboard" 
      subtitle="Loading dashboard data..."
    >
      <DashboardLoading />
    </AdminLayout>
  )
}
