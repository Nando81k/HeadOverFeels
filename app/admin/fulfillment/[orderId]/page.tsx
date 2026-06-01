// app/admin/fulfillment/[orderId]/page.tsx
//
// Dispatcher for the standalone order-detail URL. Routes to V2 when the
// NEXT_PUBLIC_ADMIN_V2_ENABLED flag is true; otherwise renders the V1 stub
// (V1 has no real detail page — operators use the in-page drawer on the
// /admin/fulfillment queue).
import { AdminOrderDetailV1 } from '@/components/admin/_v1/AdminOrderDetailV1'
import { AdminOrderDetailV2 } from '@/components/admin/dashboard/AdminOrderDetailV2'

export const revalidate = 60

interface PageProps {
  params: Promise<{ orderId: string }>
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { orderId } = await params
  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED === 'true') {
    return <AdminOrderDetailV2 orderId={orderId} />
  }
  return <AdminOrderDetailV1 orderId={orderId} />
}
