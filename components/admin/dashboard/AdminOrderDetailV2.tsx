// components/admin/dashboard/AdminOrderDetailV2.tsx
//
// Server component that composes the seven Wave 7 order-detail widgets onto
// the standalone /admin/fulfillment/[orderId] page. Loads the order detail
// via loadOrderDetail() and renders 404 (notFound) when the order doesn't
// exist. RefundDialog is mounted internally by OrderPaymentPanel.
import { notFound } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { loadOrderDetail } from '@/lib/admin/fulfillment'
import { OrderHeader } from '@/components/admin/fulfillment/detail/OrderHeader'
import { OrderLineItems } from '@/components/admin/fulfillment/detail/OrderLineItems'
import { OrderShippingPanel } from '@/components/admin/fulfillment/detail/OrderShippingPanel'
import { OrderPaymentPanel } from '@/components/admin/fulfillment/detail/OrderPaymentPanel'
import { OrderTimeline } from '@/components/admin/fulfillment/detail/OrderTimeline'
import { OrderNotesPanel } from '@/components/admin/fulfillment/detail/OrderNotesPanel'
import { OrderReturnsPanel } from '@/components/admin/fulfillment/detail/OrderReturnsPanel'

interface Props {
  orderId: string
}

export async function AdminOrderDetailV2({ orderId }: Props) {
  const detail = await loadOrderDetail(orderId)
  if (!detail) notFound()

  return (
    <AdminLayout
      title={`Order ${detail.orderNumber}`}
      subtitle="Order detail"
    >
      <div className="space-y-4">
        <OrderHeader detail={detail} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column: line items, returns, timeline (primary content) */}
          <div className="lg:col-span-2 space-y-4">
            <OrderLineItems items={detail.items} />
            <OrderReturnsPanel detail={detail} />
            <OrderTimeline detail={detail} />
          </div>

          {/* Right column: shipping, payment, notes (sidebar panels) */}
          <div className="space-y-4">
            <OrderShippingPanel detail={detail} />
            <OrderPaymentPanel detail={detail} />
            <OrderNotesPanel detail={detail} />
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
