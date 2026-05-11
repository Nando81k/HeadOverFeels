'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Bag,
  Lock,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { Navigation } from '@/components/layout/Navigation'
import { useCartStore, type CartItem as StoreCartItem } from '@/lib/store/cart'
import { useAuth } from '@/lib/auth/context'
import { useTierAccent } from '@/lib/loyalty/use-tier-accent'
import { CouponInput } from '@/components/checkout/CouponInput'
import { FreeShippingProgress } from '@/components/cart/FreeShippingProgress'
import { ExpressCheckout } from '@/components/checkout/ExpressCheckout'
import { CommerceEmptyState } from '@/components/commerce/CommerceEmptyState'
import { SmartDiscoveryRail } from '@/components/commerce/SmartDiscoveryRail'
import { fetchSmartDiscoveryProducts } from '@/lib/commerce/smart-discovery'
import {
  getCartLineValidation,
  hasCartBlockingIssues,
  type CartLineValidationStatus,
} from '@/lib/cart/cart-validation'
import { getPrimaryImageWithFallback } from '@/lib/commerce/product-placeholders'
import type { Product } from '@/lib/api/products'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function getVariantUnitPrice(item: StoreCartItem): number {
  return item.variant.price || item.product.price
}

interface CartLineItemProps {
  item: StoreCartItem
  validation: CartLineValidationStatus
  onSetQuantity: (item: StoreCartItem, nextQty: number) => void
  onRemove: (item: StoreCartItem) => void
}

function CartLineItem({ item, validation, onSetQuantity, onRemove }: CartLineItemProps) {
  const price = getVariantUnitPrice(item)
  const subtotal = price * item.quantity
  const imageUrl = getPrimaryImageWithFallback({
    images: item.variant.images || item.product.images,
    productName: item.product.name,
    productSlug: item.product.slug,
    color: item.variant.color,
    colorHex: item.variant.colorHex,
    size: item.variant.size,
  })
  const quantityDisabled = validation.isOutOfStock

  return (
    <article className="border-b border-black/10 py-5 first:border-t">
      <div className="flex gap-4 sm:gap-5">
        <Link href={`/products/${item.product.slug}`} className="relative h-28 w-24 shrink-0 overflow-hidden bg-black/[0.04]">
          {imageUrl ? (
            <Image src={imageUrl} alt={item.product.name} fill className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-black/30">
              <Package size={20} weight="bold" />
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/products/${item.product.slug}`}
                className="line-clamp-2 text-sm font-black uppercase tracking-widest text-black hover:text-black/70"
              >
                {item.product.name}
              </Link>
              <p className="mt-1.5 text-[11px] uppercase tracking-widest text-black/55">
                {[item.variant.color, item.variant.size].filter(Boolean).join(' · ') || '—'}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-black/35">SKU {item.variant.sku}</p>
            </div>

            <button
              type="button"
              onClick={() => onRemove(item)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-black/45 transition-colors hover:text-black active:scale-90"
              aria-label="Remove item"
            >
              <Trash size={14} weight="bold" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div className="inline-flex items-center border border-black/15">
              <button
                type="button"
                onClick={() => onSetQuantity(item, item.quantity - 1)}
                className="inline-flex h-9 w-9 items-center justify-center text-black/65 transition-colors hover:bg-black/5 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={quantityDisabled}
                aria-label="Decrease quantity"
              >
                <Minus size={12} weight="bold" />
              </button>
              <span className="inline-flex min-w-[2.5rem] items-center justify-center px-2 text-xs font-bold tabular-nums text-black">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onSetQuantity(item, item.quantity + 1)}
                className="inline-flex h-9 w-9 items-center justify-center text-black/65 transition-colors hover:bg-black/5 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={quantityDisabled || validation.isAtCap}
                aria-label="Increase quantity"
              >
                <Plus size={12} weight="bold" />
              </button>
            </div>

            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.12em] text-black/45">{formatCurrency(price)} ea</p>
              <p className="text-base font-black tabular-nums text-black">{formatCurrency(subtotal)}</p>
            </div>
          </div>

          {validation.isOutOfStock ? (
            <p className="mt-3 inline-flex items-center gap-1.5 border-l-2 border-[#FF3131] bg-[#FF3131]/4 py-1.5 pl-2.5 text-[11px] font-medium text-[#FF3131]">
              <WarningCircle size={13} weight="fill" />
              Unavailable for checkout. Remove this item to continue.
            </p>
          ) : null}

          {!validation.isOutOfStock && validation.isAtCap ? (
            <p className="mt-3 text-[11px] font-medium text-black/60">Max {validation.maxQuantity} for this selection</p>
          ) : null}

          {!validation.isOutOfStock && validation.isOverCap ? (
            <p className="mt-3 text-[11px] font-medium text-black/60">Over the allowed max. Quantity will be clamped to {validation.maxQuantity}.</p>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default function CartPage() {
  const router = useRouter()
  const { user } = useAuth()
  const tierAccent = useTierAccent()
  const { items, updateQuantity, removeItem, getTotalItems, getTotalPrice, getFinalTotal, clearCart } = useCartStore()

  const [mounted, setMounted] = useState(false)
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    let active = true

    const loadSuggestions = async () => {
      setSuggestionsLoading(true)
      try {
        const excludedIds = items.map((item) => item.product.id)
        const next = await fetchSmartDiscoveryProducts(excludedIds, 8)
        if (active) {
          setSuggestions(next)
        }
      } catch {
        if (active) {
          setSuggestions([])
        }
      } finally {
        if (active) {
          setSuggestionsLoading(false)
        }
      }
    }

    loadSuggestions()
    return () => {
      active = false
    }
  }, [items])

  const validations = useMemo(
    () => items.map((item) => ({ key: `${item.product.id}:${item.variant.id}`, item, validation: getCartLineValidation(item) })),
    [items]
  )

  useEffect(() => {
    if (!mounted) {
      return
    }

    validations.forEach(({ item, validation }) => {
      if (validation.isOutOfStock) {
        return
      }
      if (validation.currentQuantity !== validation.normalizedQuantity) {
        updateQuantity(item.product.id, item.variant.id, validation.normalizedQuantity)
      }
    })
  }, [mounted, validations, updateQuantity])

  const totalItems = getTotalItems()
  const subtotal = getTotalPrice()
  const isAdmin = user?.isAdmin === true
  const hasTierFreeShipping = user?.loyaltyTier?.freeShipping === true
  const baseShipping = isAdmin || hasTierFreeShipping || subtotal >= 100 ? 0 : 10
  const totals = getFinalTotal(baseShipping, 0.08)
  const hasBlockingIssues = hasCartBlockingIssues(validations.map((entry) => entry.validation))

  const handleSetQuantity = useCallback(
    (item: StoreCartItem, nextQty: number) => {
      if (nextQty <= 0) {
        removeItem(item.product.id, item.variant.id)
        return
      }

      const validation = getCartLineValidation(item)
      if (validation.isOutOfStock) {
        return
      }

      const bounded = Math.min(nextQty, validation.maxQuantity)
      updateQuantity(item.product.id, item.variant.id, bounded)
    },
    [removeItem, updateQuantity]
  )

  const handleCheckout = useCallback(() => {
    if (hasBlockingIssues) {
      return
    }
    router.push('/checkout')
  }, [hasBlockingIssues, router])

  if (!mounted) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-[#fafafa] pt-24">
          <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-20">
            <div className="h-12 w-12 animate-pulse rounded-full border border-black/10 bg-white" />
          </div>
        </div>
      </>
    )
  }

  const checkoutButtonStyle: React.CSSProperties = hasBlockingIssues
    ? {}
    : { backgroundColor: tierAccent.accent }
  const checkoutButtonClass = hasBlockingIssues
    ? 'bg-black/20 text-black/50 cursor-not-allowed'
    : 'text-white hover:brightness-90'

  if (items.length === 0) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-[#fafafa] pb-16 pt-24">
          <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
            <CommerceEmptyState
              icon={Bag}
              eyebrow="Cart"
              title="Your cart is empty"
              description="Add a few pieces to get started. We’ll keep them ready while you check out."
              primaryAction={{ label: 'Shop All Products', href: '/products' }}
              secondaryAction={{ label: 'View New Drops', href: '/drops' }}
            />

            <SmartDiscoveryRail
              title="Trending picks"
              description="Popular products ready to ship now."
              products={suggestions}
              loading={suggestionsLoading}
            />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-white pb-28 pt-24 lg:pb-16 lg:pt-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Link
                href="/products"
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-black/55 hover:text-black"
              >
                <ArrowLeft size={12} weight="bold" />
                Continue Shopping
              </Link>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-black sm:text-4xl">BAG</h1>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-black/50">
                {totalItems} {totalItems === 1 ? 'Item' : 'Items'}
                {tierAccent.isTier ? (
                  <>
                    <span className="mx-2 text-black/20">·</span>
                    <span style={{ color: tierAccent.accentDark }}>{tierAccent.tierName}</span>
                  </>
                ) : null}
              </p>
            </div>
          </header>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
            <section>
              {validations.map(({ key, item, validation }) => (
                <CartLineItem
                  key={key}
                  item={item}
                  validation={validation}
                  onSetQuantity={handleSetQuantity}
                  onRemove={(lineItem) => removeItem(lineItem.product.id, lineItem.variant.id)}
                />
              ))}
            </section>

            <aside className="h-fit border-t border-black/10 pt-5 lg:sticky lg:top-28 lg:border-t-0 lg:pt-0">
              <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">Order Summary</h2>

              <div className="mt-4">
                <CouponInput />
              </div>

              <div className="mt-5 border-t border-black/5 pt-4">
                <FreeShippingProgress subtotal={totals.subtotal} accentColor={tierAccent.accent} />
              </div>

              <dl className="mt-5 space-y-2.5 border-t border-black/5 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-black/60">Subtotal</dt>
                  <dd className="font-semibold tabular-nums text-black">{formatCurrency(totals.subtotal)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-black/60">Shipping</dt>
                  <dd className="font-semibold tabular-nums text-black">{totals.shipping === 0 ? 'FREE' : formatCurrency(totals.shipping)}</dd>
                </div>
                {totals.discount > 0 ? (
                  <div className="flex items-center justify-between">
                    <dt className="text-black/60">Discount</dt>
                    <dd className="font-semibold tabular-nums text-black">-{formatCurrency(totals.discount)}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <dt className="text-black/60">Tax</dt>
                  <dd className="font-semibold tabular-nums text-black">{formatCurrency(totals.tax)}</dd>
                </div>
              </dl>

              <div className="mt-4 border-t border-black/10 pt-4">
                <div className="flex items-end justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">Total</p>
                  <p className="text-2xl font-black tabular-nums text-black">{formatCurrency(totals.total)}</p>
                </div>
              </div>

              {!hasBlockingIssues && items.length > 0 && (
                <div className="mt-5">
                  <ExpressCheckout
                    items={items}
                    subtotal={subtotal}
                    onSuccess={(orderId) => {
                      clearCart()
                      router.push(`/order/confirmation?orderId=${orderId}&success=true`)
                    }}
                  />
                </div>
              )}

              {hasBlockingIssues ? (
                <p className="mt-4 border-l-2 border-[#FF3131] bg-[#FF3131]/4 px-3 py-2 text-xs font-medium text-[#FF3131]">
                  Resolve unavailable cart items before checkout.
                </p>
              ) : null}

              <button
                type="button"
                onClick={handleCheckout}
                disabled={hasBlockingIssues}
                style={checkoutButtonStyle}
                className={`mt-5 inline-flex h-12 w-full items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.16em] transition-all active:scale-[0.97] ${checkoutButtonClass}`}
              >
                Proceed to Checkout
                <ArrowRight size={14} weight="bold" />
              </button>

              <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-black/45">
                <Lock size={12} weight="bold" />
                Secure SSL checkout
              </div>
            </aside>
          </div>

          <div className="mt-12">
            <SmartDiscoveryRail
              title="You may also like"
              description="Based on what shoppers are buying right now."
              products={suggestions}
              loading={suggestionsLoading}
            />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-1">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/45">
              Total
            </p>
            <p className="truncate text-base font-black tabular-nums text-black">{formatCurrency(totals.total)}</p>
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={hasBlockingIssues}
            style={checkoutButtonStyle}
            className={`inline-flex h-11 min-w-[170px] items-center justify-center gap-2 px-5 text-[11px] font-black uppercase tracking-[0.16em] transition-all ${checkoutButtonClass}`}
          >
            <ShoppingCart size={14} weight="bold" />
            Checkout
          </button>
        </div>
      </div>
    </>
  )
}
