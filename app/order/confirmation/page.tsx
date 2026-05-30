'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  Coins,
  EnvelopeSimple,
  MapPin,
  Package,
  Receipt,
  Star,
  Truck,
  WarningCircle,
} from '@phosphor-icons/react'
import { Navigation } from '@/components/layout/Navigation'
import { useAuth } from '@/lib/auth/context'
import {
  calculateConfirmationSavings,
  getConfirmationEtaText,
  getConfirmationOfferSummary,
  getConfirmationStatusDescriptor,
  type ConfirmationStatusTone,
} from '@/lib/orders/confirmation-insights'
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps'
import { useTierAccent } from '@/lib/loyalty/use-tier-accent'

interface OrderItem {
  id: string
  productName: string
  productImage: string | null
  quantity: number
  price: number
  variantDetails: string | null
  product?: {
    id: string
    name: string
    slug: string
    images: string | string[]
  } | null
  productVariant?: {
    id: string
    size: string | null
    color: string | null
  } | null
}

interface Order {
  id: string
  orderNumber: string
  customerEmail: string
  couponCode?: string | null
  total: number
  subtotal: number
  shipping: number
  tax: number
  discount?: number | null
  status: string
  items: OrderItem[]
  shippingAddress: {
    firstName: string
    lastName: string
    address1: string
    address2: string | null
    city: string
    state: string
    postalCode: string
  }
  createdAt: string
  trackingNumber?: string | null
  carrier?: string | null
  trackingUrl?: string | null
  shippedAt?: string | null
  estimatedDelivery?: string | null
  pointsEarned?: number
}

const LOYALTY_PENDING_ANIMATION_KEY = 'hof_loyalty_pending_animation'
const STANDARD_SHIPPING_BASELINE = 10

type ResendState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

function getToneClasses(tone: ConfirmationStatusTone) {
  switch (tone) {
    case 'success':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300'
    case 'warning':
      return 'bg-amber-100 text-amber-900 border-amber-300'
    case 'danger':
      return 'bg-red-100 text-red-900 border-red-300'
    default:
      return 'bg-white/15 text-white border-white/30'
  }
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`
}

function formatLongDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Unknown date'
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function parseVariantSummary(item: OrderItem): string | null {
  if (item.variantDetails) {
    try {
      const parsed = JSON.parse(item.variantDetails) as { size?: string; color?: string }
      const parts = [parsed.size, parsed.color].filter(Boolean)
      if (parts.length > 0) return parts.join(' • ')
    } catch {
      // ignore malformed snapshot data
    }
  }

  const parts = [item.productVariant?.size, item.productVariant?.color].filter(Boolean)
  if (parts.length > 0) {
    return parts.join(' • ')
  }

  return null
}

function resolveItemImage(item: OrderItem): string | null {
  if (item.productImage && item.productImage.trim().length > 0) {
    return item.productImage
  }

  const images = item.product?.images
  if (!images) return null

  if (Array.isArray(images)) {
    const first = images[0]
    return typeof first === 'string' ? first : null
  }

  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0]
        if (typeof first === 'string') return first
        if (first && typeof first === 'object' && 'url' in first && typeof first.url === 'string') {
          return first.url
        }
      }
    } catch {
      if (images.startsWith('http')) return images
    }
  }

  return null
}

function ConfirmationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, refreshUser } = useAuth()
  const tierAccent = useTierAccent()

  const success = searchParams.get('success')
  const orderId = searchParams.get('orderId')

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendState, setResendState] = useState<ResendState>({
    status: 'idle',
    message: '',
  })
  const initializedOrderIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!success || !orderId) {
      router.push('/products')
      return
    }

    if (initializedOrderIdRef.current === orderId) {
      return
    }
    initializedOrderIdRef.current = orderId

    const fetchOrder = async () => {
      let fallbackPointsEarned = 0
      let loyaltyUpdated = false

      try {
        const confirmResponse = await fetch(`/api/orders/${orderId}/confirm-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId: null }),
        })

        if (confirmResponse.ok) {
          const confirmData = await confirmResponse.json()
          fallbackPointsEarned = Number(confirmData.pointsEarned || 0)
          loyaltyUpdated = Boolean(
            confirmData.pointsEarned ||
            confirmData.tierUpgrade ||
            confirmData.recoveredLoyalty
          )
        }
      } catch (confirmError) {
        console.error('Failed to run payment confirmation fallback:', confirmError)
      }

      try {
        const response = await fetch(`/api/orders/${orderId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch order details')
        }

        const payload = await response.json()
        const fetchedOrder = payload.data as Order
        setOrder(fetchedOrder)

        const resolvedPointsEarned = Number(fetchedOrder.pointsEarned || fallbackPointsEarned || 0)

        if (resolvedPointsEarned > 0) {
          try {
            localStorage.setItem(
              LOYALTY_PENDING_ANIMATION_KEY,
              JSON.stringify({
                orderId: fetchedOrder.id,
                customerId: user?.id || null,
                pointsEarned: resolvedPointsEarned,
                createdAt: Date.now(),
              })
            )
          } catch {
            // Ignore local storage access errors
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('hof:loyalty-updated', {
                detail: {
                  orderId: fetchedOrder.id,
                  pointsEarned: resolvedPointsEarned,
                },
              })
            )
          }
        }

        if (user && (resolvedPointsEarned > 0 || loyaltyUpdated)) {
          await refreshUser()
        }
      } catch (fetchError) {
        console.error('Error fetching confirmation order:', fetchError)
        setError('Failed to load order confirmation details.')
      } finally {
        setLoading(false)
      }
    }

    void fetchOrder()
  }, [success, orderId, router, refreshUser, user])

  const handleResendConfirmation = async () => {
    if (!order || resendLoading) return

    setResendLoading(true)
    setResendState({ status: 'idle', message: '' })

    try {
      const response = await fetch(`/api/orders/${order.id}/send-confirmation`, {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to resend confirmation email.')
      }

      setResendState({
        status: 'success',
        message: 'Confirmation email sent. Check your inbox.',
      })
    } catch (resendError) {
      setResendState({
        status: 'error',
        message: resendError instanceof Error ? resendError.message : 'Failed to resend confirmation email.',
      })
    } finally {
      setResendLoading(false)
    }
  }

  if (!success || !orderId) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f3f0]">
        <Navigation />
        <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center px-4 pt-28">
          <div className="flex items-center gap-3 text-black/60">
            <CircleNotch size={22} weight="bold" className="animate-spin" />
            <span className="text-sm font-semibold uppercase tracking-wide">Loading order confirmation</span>
          </div>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#f6f3f0]">
        <Navigation />
        <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center px-4 pt-28">
          <div className="w-full max-w-md rounded-xl border border-black/10 bg-white p-8 text-center">
            <WarningCircle size={40} weight="duotone" className="mx-auto mb-4 text-black/40" />
            <h1 className="text-2xl font-black uppercase tracking-tight text-black">Order not found</h1>
            <p className="mt-2 text-sm text-black/60">{error || 'Unable to load this order.'}</p>
            <Link
              href="/products"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-black px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white hover:bg-black/85"
            >
              Continue Shopping
              <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const statusDescriptor = getConfirmationStatusDescriptor(order.status)
  const etaText = getConfirmationEtaText({
    status: order.status,
    estimatedDelivery: order.estimatedDelivery,
    shippedAt: order.shippedAt,
    createdAt: order.createdAt,
  })
  const savings = calculateConfirmationSavings({
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shipping,
    tax: order.tax,
    standardShippingRate: STANDARD_SHIPPING_BASELINE,
  })
  const activeOffer = getConfirmationOfferSummary({
    couponCode: order.couponCode,
    discount: order.discount,
    shipping: order.shipping,
  })
  const hasTracking = Boolean(order.trackingNumber)
  const primaryActionHref = hasTracking ? `/orders/${order.id}/track` : '/orders'
  const primaryActionLabel = hasTracking ? 'Track Order' : 'View Orders'
  const pointsEarned = Number(order.pointsEarned || 0)
  const potentialGuestPoints = Math.max(0, Math.floor(order.total))

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Tier-color sweep at the very top — a quiet 4px brand-personal cue
          that this confirmation belongs to *this* customer. Pure black for
          guests, tier color for signed-in customers. */}
      <div
        aria-hidden="true"
        className="h-1 w-full"
        style={{ background: tierAccent.gradient }}
      />

      <main id="main-content" className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <section className="border-b border-black/10 pb-8" data-testid="confirmation-summary-card">
          <div className="mb-6 sm:mb-8">
            <CheckoutSteps current="done" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-black">
              <CheckCircle size={16} weight="fill" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Order Confirmed</span>
            </div>
            <span
              className={`border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${getToneClasses(
                statusDescriptor.tone
              )}`}
            >
              {statusDescriptor.label}
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">Order</p>
              <h1 className="mt-1 text-3xl sm:text-4xl font-black tracking-tight text-black">{order.orderNumber}</h1>
              <p className="mt-2 text-sm text-black/60">
                Placed {formatLongDate(order.createdAt)} · {etaText}
              </p>
            </div>
            <div className="md:text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">Total</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-black">{formatCurrency(order.total)}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={primaryActionHref}
              style={{ backgroundColor: tierAccent.accent }}
              className="inline-flex items-center gap-2 px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white transition-all hover:brightness-90"
            >
              {primaryActionLabel}
              <ArrowRight size={14} weight="bold" />
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 border border-black px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-black transition-colors hover:bg-black hover:text-white"
            >
              Continue Shopping
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="border border-black/10 p-5" data-testid="delivery-card">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-black/60">
              <Truck size={15} weight="bold" />
              Delivery
            </h2>
            <p className="mt-3 text-sm font-semibold text-black">{statusDescriptor.description}</p>
            <p className="mt-1 text-sm text-black/60">{etaText}</p>
            {order.trackingNumber ? (
              <div className="mt-4 space-y-1 text-sm text-black/70">
                <p className="font-medium">Tracking #{order.trackingNumber}</p>
                {order.carrier ? <p>{order.carrier}</p> : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-black/60">Tracking details will appear here once your label is created.</p>
            )}
            {order.trackingUrl ? (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-black underline underline-offset-2 hover:text-black/70"
              >
                Open carrier tracking
                <ArrowSquareOut size={13} weight="bold" />
              </a>
            ) : null}
          </article>

          <article className="border border-black/10 p-5" data-testid="financial-card">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-black/60">
              <Receipt size={15} weight="bold" />
              Financial Recap
            </h2>
            <div className="mt-3 space-y-2 text-sm text-black/70">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="font-medium tabular-nums">{formatCurrency(order.subtotal)}</span>
              </div>
              {order.discount && order.discount > 0 ? (
                <div className="flex items-center justify-between">
                  <span>Discount</span>
                  <span className="font-medium tabular-nums text-emerald-700">-{formatCurrency(order.discount)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span>Shipping</span>
                <span className="font-medium tabular-nums">
                  {order.shipping === 0 ? 'FREE' : formatCurrency(order.shipping)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tax</span>
                <span className="font-medium tabular-nums">{formatCurrency(order.tax)}</span>
              </div>
              {activeOffer ? (
                <div className="flex items-center justify-between">
                  <span>Active Offer</span>
                  <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-black">{activeOffer}</span>
                </div>
              ) : null}
              {savings.totalSavings > 0 ? (
                <div className="flex items-center justify-between">
                  <span>You Saved</span>
                  <span className="font-semibold tabular-nums text-emerald-700">{formatCurrency(savings.totalSavings)}</span>
                </div>
              ) : null}
            </div>
            <div className="mt-4 border-t border-black/10 pt-3">
              <div className="flex items-center justify-between text-base font-black text-black">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </article>

          <article className="border border-black/10 p-5" data-testid="shipping-card">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-black/60">
              <MapPin size={15} weight="bold" />
              Ship To
            </h2>
            <div className="mt-3 text-sm leading-6 text-black/70">
              <p className="font-semibold text-black">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
              </p>
              <p>{order.shippingAddress.address1}</p>
              {order.shippingAddress.address2 ? <p>{order.shippingAddress.address2}</p> : null}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
              </p>
            </div>
          </article>

          <article className="border border-black/10 p-5" data-testid="order-meta-card">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-black/60">
              <EnvelopeSimple size={15} weight="bold" />
              Order Info
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-black/55">Confirmation Email</dt>
                <dd className="truncate font-medium text-black">{order.customerEmail}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-black/55">Order Date</dt>
                <dd className="font-medium text-black">{formatLongDate(order.createdAt)}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resendLoading}
              className="mt-4 inline-flex items-center gap-2 border border-black/20 px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resendLoading ? (
                <>
                  <CircleNotch size={14} weight="bold" className="animate-spin" />
                  Sending
                </>
              ) : (
                <>Resend Confirmation Email</>
              )}
            </button>

            {resendState.status !== 'idle' ? (
              <p
                className={`mt-2 text-xs ${
                  resendState.status === 'success' ? 'text-emerald-700' : 'text-red-700'
                }`}
                role="status"
              >
                {resendState.message}
              </p>
            ) : null}
          </article>
        </section>

        {user ? (
          <section
            className="mt-5 border-l-2 border-y border-r border-black/10 p-5"
            style={{ borderLeftColor: tierAccent.accent }}
            data-testid="signed-in-loyalty-card"
          >
            <h2
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em]"
              style={{ color: tierAccent.accentDark }}
            >
              <Coins size={14} weight="bold" />
              {pointsEarned > 0 ? `+${pointsEarned.toLocaleString()} Points Earned` : 'Loyalty Outcome'}
            </h2>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p
                  className="text-4xl font-black tabular-nums"
                  style={{ color: tierAccent.accent }}
                >
                  +{pointsEarned.toLocaleString()}
                </p>
                <p className="text-sm text-black/60">Care Points from this order</p>
              </div>
              <div className="text-sm text-black/70">
                <p>
                  Current Tier:{' '}
                  <span className="font-black" style={{ color: tierAccent.accentDark }}>
                    {user.loyaltyTier?.name || 'Newcomer'}
                  </span>
                </p>
                <p>
                  Current Balance:{' '}
                  <span className="font-semibold text-black">{(user.currentPoints || 0).toLocaleString()} pts</span>
                </p>
              </div>
              <Link
                href="/profile#rewards"
                style={{ backgroundColor: tierAccent.accent }}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition-all hover:brightness-90"
              >
                View Rewards
                <ArrowRight size={14} weight="bold" />
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-5 border border-black/10 p-5" data-testid="guest-loyalty-card">
            <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/55">
              <Coins size={14} weight="bold" />
              Earn Care Points Next Time
            </h2>
            <p className="mt-3 text-sm text-black/70">
              You could have earned about <span className="font-black text-black">{potentialGuestPoints} points</span>{' '}
              on this purchase.
            </p>
            <Link
              href={`/signin?tab=signup&email=${encodeURIComponent(order.customerEmail)}&redirect=${encodeURIComponent('/profile#rewards')}`}
              className="mt-4 inline-flex items-center gap-2 bg-black px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white hover:bg-black/85"
            >
              Create Account
              <ArrowRight size={14} weight="bold" />
            </Link>
          </section>
        )}

        <section className="mt-5 border border-black/10 p-5" data-testid="order-items-card">
          <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/55">
            <Package size={14} weight="bold" />
            Order Items
          </h2>

          <div className="mt-4">
            {order.items.map((item) => {
              const imageUrl = resolveItemImage(item)
              const variantSummary = parseVariantSummary(item)
              const productSlug = item.product?.slug?.trim() || ''
              const reviewHref = productSlug
                ? `/products/${productSlug}?writeReview=true&orderId=${order.id}`
                : ''

              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 border-b border-black/5 py-3 last:border-b-0"
                >
                  <div className="relative h-14 w-14 overflow-hidden bg-black/5">
                    {imageUrl ? (
                      <Image src={imageUrl} alt={item.productName} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package size={16} weight="bold" className="text-black/35" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-[180px] flex-1">
                    <p className="text-sm font-semibold text-black">{item.productName}</p>
                    {variantSummary ? (
                      <p className="text-[11px] uppercase tracking-wide text-black/50">{variantSummary}</p>
                    ) : null}
                    <p className="text-[11px] text-black/55">Qty {item.quantity}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-black">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                    {productSlug ? (
                      <Link
                        href={reviewHref}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-black underline underline-offset-2 hover:text-black/70"
                      >
                        <Star size={11} weight="fill" />
                        Write Review
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-black/30"
                        title="Product link unavailable for this item"
                      >
                        Review unavailable
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/products"
            style={{ backgroundColor: tierAccent.accent }}
            className="inline-flex items-center gap-2 px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white transition-all hover:brightness-90"
          >
            Continue Shopping
            <ArrowRight size={14} weight="bold" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 border border-black px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-black hover:bg-black hover:text-white transition-colors"
          >
            Back to Home
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 border border-black/20 px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-black hover:bg-black/5"
          >
            Contact Support
          </Link>
        </div>
      </main>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f6f3f0] flex items-center justify-center">
          <CircleNotch size={24} weight="bold" className="animate-spin text-black/60" />
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  )
}
