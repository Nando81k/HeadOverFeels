// components/admin/_v1/AdminOrderDetailV1.tsx
//
// V1 has NO standalone order-detail page. The V1 fulfillment workbench
// (app/admin/fulfillment via AdminFulfillmentV1) uses an in-page drawer
// (FulfillmentCaseDrawer) to surface order detail.
//
// This stub renders only when the detail URL (/admin/fulfillment/[orderId])
// is hit with NEXT_PUBLIC_ADMIN_V2_ENABLED=false. It simply points the
// operator back to the queue page where the drawer experience lives.
'use client'

import Link from 'next/link'

interface Props {
  orderId: string
}

export function AdminOrderDetailV1({ orderId }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="text-center space-y-3 max-w-md">
        <h1 className="text-lg font-semibold">V1 has no standalone order detail page</h1>
        <p className="text-sm text-white/60">
          The V1 fulfillment workbench uses an in-page drawer. Open the order from{' '}
          <Link
            href="/admin/fulfillment"
            className="text-sky-300 underline hover:text-sky-200"
          >
            /admin/fulfillment
          </Link>
          .
        </p>
        <p className="text-[11px] text-white/40 font-mono">{orderId}</p>
        <Link
          href="/admin/fulfillment"
          className="inline-flex items-center gap-2 rounded-md bg-red-500/15 px-4 py-2 text-sm text-red-300 hover:bg-red-500/25 transition-colors"
        >
          Open fulfillment queue
        </Link>
      </div>
    </div>
  )
}
