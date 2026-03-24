'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  MapPin,
  Package,
  Printer,
  Truck,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import ShippingLabel from '@/components/admin/ShippingLabel'
import { TrackingMap } from '@/components/orders/TrackingMap'
import type { TrackingResult } from '@/lib/shipping/tracking'
import { toast } from '@/lib/toast'

type ProductVariant = {
  id: string
  sku?: string | null
  size?: string | null
  color?: string | null
}

type Product = {
  id: string
  name: string
  slug: string
  images?: unknown
}

type OrderItem = {
  id: string
  quantity: number
  price: number
  productVariant?: ProductVariant | null
  product: Product
}

type Address = {
  firstName: string
  lastName: string
  address1?: string
  address2?: string
  addressLine1?: string
  addressLine2?: string
  city: string
  state: string
  zipCode: string
  country: string
}

type Customer = {
  email: string
  phone?: string
}

type Order = {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  subtotal: number
  shipping: number
  tax: number
  total: number
  createdAt: string
  updatedAt: string
  shippedAt?: string
  deliveredAt?: string
  trackingNumber?: string
  carrier?: string
  estimatedDelivery?: string
  shippingMethod?: string
  notes?: string
  internalNotes?: string
  items: OrderItem[]
  customer: Customer
  shippingAddress: Address
  billingAddress: Address
}

const STATUS_OPTIONS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const

function formatDate(dateString?: string) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function getStatusBadgeColor(status: string) {
  const colors: Record<string, string> = {
    PENDING: 'bg-amber-500/20 text-amber-400',
    CONFIRMED: 'bg-blue-500/20 text-blue-400',
    PROCESSING: 'bg-purple-500/20 text-purple-400',
    SHIPPED: 'bg-indigo-500/20 text-indigo-400',
    DELIVERED: 'bg-emerald-500/20 text-emerald-400',
    CANCELLED: 'bg-red-500/20 text-red-400',
    REFUNDED: 'bg-white/10 text-white/70',
  }
  return colors[status] || 'bg-white/10 text-white/70'
}

function getPaymentStatusBadgeColor(status: string) {
  const colors: Record<string, string> = {
    PENDING: 'bg-amber-500/20 text-amber-400',
    PAID: 'bg-emerald-500/20 text-emerald-400',
    FAILED: 'bg-red-500/20 text-red-400',
    REFUNDED: 'bg-white/10 text-white/70',
  }
  return colors[status] || 'bg-white/10 text-white/70'
}

function resolveProductImage(images: unknown): string | null {
  if (!images) {
    return null
  }

  if (Array.isArray(images) && images.length > 0) {
    const first = images[0]
    if (typeof first === 'string') {
      return first
    }
    if (first && typeof first === 'object' && 'url' in first && typeof first.url === 'string') {
      return first.url
    }
    return null
  }

  if (typeof images === 'string') {
    const trimmed = images.trim()
    if (trimmed.startsWith('http') || trimmed.startsWith('/')) {
      return trimmed
    }

    try {
      return resolveProductImage(JSON.parse(trimmed))
    } catch {
      return null
    }
  }

  return null
}

function resolveAddressLine1(address: Address): string {
  return address.address1 || address.addressLine1 || ''
}

function resolveAddressLine2(address: Address): string | undefined {
  return address.address2 || address.addressLine2
}

export default function AdminOrderDetailPage() {
  const params = useParams()
  const orderId = params.id as string
  const printRef = useRef<HTMLDivElement>(null)

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [buyingLabel, setBuyingLabel] = useState(false)

  const [status, setStatus] = useState('')
  const [shippingMethod, setShippingMethod] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState('USPS')
  const [estimatedDelivery, setEstimatedDelivery] = useState('')
  const [sendTrackingEmail, setSendTrackingEmail] = useState(true)
  const [internalNotes, setInternalNotes] = useState('')

  const [trackingData, setTrackingData] = useState<TrackingResult | null>(null)
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [trackingHistoryExpanded, setTrackingHistoryExpanded] = useState(false)

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/orders/${orderId}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('Order not found')
          return
        }
        setError(`Failed to fetch order (${response.status})`)
        return
      }

      const result = await response.json()
      setOrder(result.data || null)
      setError(null)
    } catch (fetchError) {
      console.error('Failed to fetch order:', fetchError)
      setError('Failed to fetch order')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  const fetchTrackingData = useCallback(async () => {
    if (!orderId || !order?.trackingNumber) {
      setTrackingData(null)
      return
    }

    try {
      setTrackingLoading(true)
      const response = await fetch(`/api/orders/${orderId}/tracking/live`)
      if (!response.ok) {
        setTrackingData(null)
        return
      }

      const result = await response.json()
      if (result.hasTracking && result.data) {
        setTrackingData(result.data)
      } else {
        setTrackingData(null)
      }
    } catch (trackingError) {
      console.error('Failed to fetch tracking data:', trackingError)
      setTrackingData(null)
    } finally {
      setTrackingLoading(false)
    }
  }, [orderId, order?.trackingNumber])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  useEffect(() => {
    if (!order) {
      return
    }
    setStatus(order.status)
    setShippingMethod(order.shippingMethod || '')
    setTrackingNumber(order.trackingNumber || '')
    setCarrier(order.carrier || 'USPS')
    setEstimatedDelivery(order.estimatedDelivery ? new Date(order.estimatedDelivery).toISOString().split('T')[0] : '')
    setInternalNotes(order.internalNotes || '')
  }, [order])

  useEffect(() => {
    fetchTrackingData()
  }, [fetchTrackingData])

  const itemCount = useMemo(() => {
    return (order?.items ?? []).reduce((total, item) => total + item.quantity, 0)
  }, [order?.items])

  const submitFulfillmentUpdate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!order) {
      return
    }

    setSaving(true)
    setError(null)
    const loadingToast = toast.loading('Saving fulfillment changes...')

    try {
      const normalizedTracking = trackingNumber.trim()
      const trackingChanged =
        normalizedTracking !== (order.trackingNumber || '') ||
        carrier !== (order.carrier || 'USPS') ||
        (estimatedDelivery || '') !== (order.estimatedDelivery ? new Date(order.estimatedDelivery).toISOString().split('T')[0] : '')

      if (normalizedTracking && trackingChanged) {
        const trackingResponse = await fetch(`/api/orders/${orderId}/tracking`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackingNumber: normalizedTracking,
            carrier,
            estimatedDelivery: estimatedDelivery || undefined,
            sendEmail: sendTrackingEmail,
          }),
        })

        if (!trackingResponse.ok) {
          const message = await trackingResponse.text()
          throw new Error(message || 'Failed to update tracking')
        }
      }

      const orderResponse = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          trackingNumber: normalizedTracking || undefined,
          shippingMethod: shippingMethod || undefined,
          carrier: carrier || undefined,
          internalNotes: internalNotes || undefined,
        }),
      })

      if (!orderResponse.ok) {
        const message = await orderResponse.text()
        throw new Error(message || 'Failed to update order')
      }

      const updated = await orderResponse.json()
      if (updated?.data?.items) {
        setOrder(updated.data)
      } else {
        await fetchOrder()
      }
      toast.dismiss(loadingToast)
      toast.success('Order updated', 'Fulfillment details saved')
      fetchTrackingData()
    } catch (updateError) {
      console.error('Failed to save order:', updateError)
      const message = updateError instanceof Error ? updateError.message : 'Failed to update order'
      setError(message)
      toast.dismiss(loadingToast)
      toast.error('Update failed', message)
    } finally {
      setSaving(false)
    }
  }

  const handlePurchaseCarrierLabel = async () => {
    if (!order) {
      return
    }

    setBuyingLabel(true)
    const loadingToast = toast.loading('Purchasing carrier label...')

    try {
      const response = await fetch(`/api/admin/fulfillment/orders/${order.id}/label/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result.error || 'Failed to purchase label')
      }

      if (result.order) {
        setOrder(result.order)
        setStatus(result.order.status || status)
        setTrackingNumber(result.order.trackingNumber || '')
        setCarrier(result.order.carrier || carrier)
      } else {
        await fetchOrder()
      }

      if (result.label?.labelUrl) {
        window.open(result.label.labelUrl, '_blank', 'noopener,noreferrer')
      }

      toast.dismiss(loadingToast)
      toast.success('Carrier label purchased', 'Tracking details were synced')
      fetchTrackingData()
    } catch (labelError) {
      console.error('Failed to purchase carrier label:', labelError)
      toast.dismiss(loadingToast)
      toast.error(
        'Label purchase failed',
        labelError instanceof Error ? labelError.message : 'Could not purchase label'
      )
    } finally {
      setBuyingLabel(false)
    }
  }

  const applyStatusQuickAction = (nextStatus: (typeof STATUS_OPTIONS)[number]) => {
    setStatus(nextStatus)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-b-2 border-[#FF3131] animate-spin" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <AdminLayout title="Order Not Found" subtitle="The requested order could not be loaded">
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error || 'Order not found'}</p>
          <Link href="/admin/orders" className="text-[#FF3131] hover:text-[#ff5f5f]">
            Back to Orders
          </Link>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title={`Order ${order.orderNumber}`}
      subtitle={`Placed on ${formatDate(order.createdAt)}`}
      headerActions={
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-xs font-semibold rounded ${getStatusBadgeColor(order.status)}`}>
            {order.status}
          </span>
          <span className={`px-3 py-1 text-xs font-semibold rounded ${getPaymentStatusBadgeColor(order.paymentStatus)}`}>
            {order.paymentStatus}
          </span>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 text-xs uppercase tracking-[0.12em]"
          >
            <ArrowLeft size={14} weight="bold" />
            Back
          </Link>
          <Link
            href={`/admin/fulfillment?orderId=${order.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 text-xs uppercase tracking-[0.12em]"
          >
            <Truck size={14} weight="bold" />
            Fulfillment
          </Link>
        </div>
      }
    >
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
            <header className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.16em] text-white/70">Order Items</h2>
              <span className="text-xs text-white/45">{itemCount} items</span>
            </header>
            <div className="p-5 space-y-3">
              {(order.items ?? []).map((item) => {
                const imageSrc = resolveProductImage(item.product.images)
                return (
                  <div key={item.id} className="grid grid-cols-[68px_minmax(0,1fr)_auto] gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                    <div className="h-[68px] w-[68px] rounded-lg overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
                      {imageSrc ? (
                        <img src={imageSrc} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={18} className="text-white/30" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{item.product.name}</p>
                      <div className="text-xs text-white/50 mt-1 flex items-center gap-2 flex-wrap">
                        {item.productVariant?.sku ? <span>SKU: {item.productVariant.sku}</span> : <span>SKU: N/A</span>}
                        {item.productVariant?.size ? <span className="px-1.5 py-0.5 rounded bg-white/10">{item.productVariant.size}</span> : null}
                        {item.productVariant?.color ? <span className="px-1.5 py-0.5 rounded bg-white/10">{item.productVariant.color}</span> : null}
                      </div>
                      <p className="text-xs text-white/45 mt-1">{item.quantity} x {formatCurrency(item.price)}</p>
                    </div>
                    <div className="text-sm font-semibold text-white">{formatCurrency(item.price * item.quantity)}</div>
                  </div>
                )
              })}

              <div className="pt-3 border-t border-white/10 space-y-2 text-sm">
                <div className="flex justify-between text-white/60">
                  <span>Subtotal</span>
                  <span className="text-white">{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Shipping</span>
                  <span className={order.shipping === 0 ? 'text-emerald-400' : 'text-white'}>
                    {order.shipping === 0 ? 'FREE' : formatCurrency(order.shipping)}
                  </span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Tax</span>
                  <span className="text-white">{formatCurrency(order.tax)}</span>
                </div>
                <div className="pt-2 border-t border-white/10 flex justify-between text-base font-semibold">
                  <span className="text-white">Total</span>
                  <span className="text-[#FF3131]">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
            <header className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
              <Clock size={16} className="text-white/50" />
              <h2 className="text-sm uppercase tracking-[0.16em] text-white/70">Timeline</h2>
            </header>
            <div className="p-5 space-y-4">
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle size={14} weight="fill" />
                </div>
                <div>
                  <p className="text-sm text-white font-medium">Order Placed</p>
                  <p className="text-xs text-white/45">{formatDate(order.createdAt)}</p>
                </div>
              </div>
              {order.shippedAt && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Truck size={14} weight="fill" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Shipped</p>
                    <p className="text-xs text-white/45">{formatDate(order.shippedAt)}</p>
                  </div>
                </div>
              )}
              {order.deliveredAt && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Package size={14} weight="fill" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Delivered</p>
                    <p className="text-xs text-white/45">{formatDate(order.deliveredAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {order.trackingNumber && (
            <section className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
              <header className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-sm uppercase tracking-[0.16em] text-white/70 flex items-center gap-2">
                  <MapPin size={16} className="text-white/50" />
                  Shipment Tracking
                </h2>
                {trackingData && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400">
                    {trackingData.statusDescription}
                  </span>
                )}
              </header>
              <div className="h-[280px] border-b border-white/10">
                {trackingLoading ? (
                  <div className="h-full flex items-center justify-center bg-slate-900">
                    <div className="h-8 w-8 rounded-full border-b-2 border-[#FF3131] animate-spin" />
                  </div>
                ) : trackingData ? (
                  <TrackingMap
                    origin={trackingData.originLocation}
                    destination={trackingData.destinationLocation}
                    currentLocation={trackingData.currentLocation}
                    events={trackingData.events}
                    status={trackingData.status}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-slate-900 text-white/45 text-sm">
                    Tracking data unavailable
                  </div>
                )}
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40 mb-1">Tracking Number</p>
                    <p className="text-sm font-mono text-white">{order.trackingNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40 mb-1">Carrier</p>
                    <p className="text-sm text-white">{order.carrier || 'N/A'}</p>
                  </div>
                </div>

                {trackingData?.events?.length ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => setTrackingHistoryExpanded((prev) => !prev)}
                      className="w-full flex items-center justify-between text-sm text-white/65 hover:text-white"
                    >
                      <span>Tracking History ({trackingData.events.length})</span>
                      {trackingHistoryExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                    </button>
                    {trackingHistoryExpanded && (
                      <div className="mt-3 space-y-3 max-h-[220px] overflow-y-auto pr-1">
                        {trackingData.events.map((event, index) => (
                          <div key={`${event.timestamp}-${index}`} className="pl-4 border-l border-white/10">
                            <p className="text-sm text-white">{event.description}</p>
                            <p className="text-xs text-white/50">{event.location.city}, {event.location.state}</p>
                            <p className="text-xs text-white/40">{new Date(event.timestamp).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
            <header className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm uppercase tracking-[0.16em] text-white/70">Customer & Shipping</h2>
            </header>
            <div className="p-5 text-sm space-y-4">
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-[0.14em] mb-1">Contact</p>
                <p className="text-white">{order.customer.email}</p>
                {order.customer.phone ? <p className="text-white/65">{order.customer.phone}</p> : null}
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-[0.14em] mb-1">Address</p>
                <p className="text-white">{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
                <p className="text-white/70">{resolveAddressLine1(order.shippingAddress)}</p>
                {resolveAddressLine2(order.shippingAddress) ? (
                  <p className="text-white/70">{resolveAddressLine2(order.shippingAddress)}</p>
                ) : null}
                <p className="text-white/70">
                  {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                </p>
                <p className="text-white/60">{order.shippingAddress.country}</p>
              </div>
            </div>
          </section>

          <section className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
            <header className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.16em] text-white/70">Fulfillment</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePurchaseCarrierLabel}
                  disabled={buyingLabel}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded border border-white/10 bg-white/5 text-[11px] text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-60"
                >
                  <Truck size={13} />
                  {buyingLabel ? 'Buying...' : 'Buy Carrier Label'}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 text-xs text-white/65 hover:text-white"
                >
                  <Printer size={14} />
                  Print Label
                </button>
              </div>
            </header>
            <form onSubmit={submitFulfillmentUpdate} className="p-5 space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:border-white/25"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option} className="bg-neutral-900">{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">Shipping Method</label>
                <input
                  value={shippingMethod}
                  onChange={(event) => setShippingMethod(event.target.value)}
                  placeholder="USPS Priority Mail"
                  className="w-full h-9 px-3 rounded-md border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">Tracking Number</label>
                <input
                  value={trackingNumber}
                  onChange={(event) => setTrackingNumber(event.target.value)}
                  placeholder="1Z999..."
                  className="w-full h-9 px-3 rounded-md border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">Carrier</label>
                  <select
                    value={carrier}
                    onChange={(event) => setCarrier(event.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:border-white/25"
                  >
                    <option value="USPS" className="bg-neutral-900">USPS</option>
                    <option value="UPS" className="bg-neutral-900">UPS</option>
                    <option value="FedEx" className="bg-neutral-900">FedEx</option>
                    <option value="DHL" className="bg-neutral-900">DHL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">Est. Delivery</label>
                  <input
                    type="date"
                    value={estimatedDelivery}
                    onChange={(event) => setEstimatedDelivery(event.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:border-white/25 [color-scheme:dark]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-white/65">
                <input
                  type="checkbox"
                  checked={sendTrackingEmail}
                  onChange={(event) => setSendTrackingEmail(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]"
                />
                Send tracking email to customer when tracking changes
              </label>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">Internal Notes</label>
                <textarea
                  rows={4}
                  value={internalNotes}
                  onChange={(event) => setInternalNotes(event.target.value)}
                  placeholder="Fulfillment notes for internal team..."
                  className="w-full px-3 py-2 rounded-md border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/25 resize-none"
                />
              </div>

              {error ? <div className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 rounded p-2.5">{error}</div> : null}

              <button
                type="submit"
                disabled={saving}
                className="w-full h-10 rounded-md bg-[#FF3131] text-white font-medium hover:bg-[#ff4646] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Fulfillment'}
              </button>
            </form>
          </section>

          <section className="bg-neutral-900 border border-white/10 rounded-xl p-4">
            <h3 className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-3">Quick Status Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => applyStatusQuickAction('PROCESSING')}
                className="h-8 rounded border border-purple-500/30 bg-purple-500/15 text-purple-300 text-xs uppercase tracking-[0.12em]"
              >
                Processing
              </button>
              <button
                type="button"
                onClick={() => applyStatusQuickAction('SHIPPED')}
                className="h-8 rounded border border-blue-500/30 bg-blue-500/15 text-blue-300 text-xs uppercase tracking-[0.12em]"
              >
                Shipped
              </button>
              <button
                type="button"
                onClick={() => applyStatusQuickAction('DELIVERED')}
                className="h-8 rounded border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 text-xs uppercase tracking-[0.12em]"
              >
                Delivered
              </button>
              <button
                type="button"
                onClick={() => applyStatusQuickAction('CANCELLED')}
                className="h-8 rounded border border-red-500/30 bg-red-500/15 text-red-300 text-xs uppercase tracking-[0.12em]"
              >
                Cancelled
              </button>
            </div>
          </section>
        </aside>
      </div>

      <div className="hidden print:block" ref={printRef}>
        <ShippingLabel
          order={{
            ...order,
            shippingAddress: {
              ...order.shippingAddress,
              address1: resolveAddressLine1(order.shippingAddress),
              address2: resolveAddressLine2(order.shippingAddress),
            },
            items: order.items.map((item) => ({
              ...item,
              product: {
                ...item.product,
              },
            })),
          }}
        />
      </div>
    </AdminLayout>
  )
}
