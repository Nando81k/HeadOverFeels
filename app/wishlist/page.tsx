'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Heart,
  ShoppingCart,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { Navigation } from '@/components/layout/Navigation'
import { useWishlistStore } from '@/lib/store/wishlist'
import { toast } from '@/lib/toast'
import { CommerceEmptyState } from '@/components/commerce/CommerceEmptyState'
import { SmartDiscoveryRail } from '@/components/commerce/SmartDiscoveryRail'
import { fetchSmartDiscoveryProducts } from '@/lib/commerce/smart-discovery'
import type { Product } from '@/lib/api/products'
import { getPrimaryImageWithFallback } from '@/lib/commerce/product-placeholders'

interface WishlistItem {
  id: string
  productId: string
  notes?: string | null
  createdAt: string
  product: {
    id: string
    name: string
    slug: string
    price: number
    images: string
    isActive: boolean
    compareAtPrice?: number | null
  }
  productVariant?: {
    id: string
    sku: string
    size?: string | null
    color?: string | null
    colorHex?: string | null
    images?: string | null
    price?: number | null
    inventory: number
    isActive: boolean
  } | null
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export default function WishlistPage() {
  const router = useRouter()
  const { syncWithServer, removeFromWishlist: removeFromStore } = useWishlistStore()

  const [isLoading, setIsLoading] = useState(true)
  const [items, setItems] = useState<WishlistItem[]>([])
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)

  const fetchWishlist = useCallback(async () => {
    try {
      setIsLoading(true)
      await syncWithServer()
      const response = await fetch('/api/wishlist')
      const payload = await response.json().catch(() => null)
      setItems(Array.isArray(payload?.data) ? payload.data : [])
    } catch (error) {
      console.error('Error fetching wishlist:', error)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [syncWithServer])

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])

  useEffect(() => {
    let active = true

    const loadSuggestions = async () => {
      setSuggestionsLoading(true)
      try {
        const excluded = items.map((item) => item.product.id)
        const next = await fetchSmartDiscoveryProducts(excluded, 8)
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

  const removeItem = useCallback(
    async (item: WishlistItem) => {
      setRemovingId(item.id)
      try {
        const removed = await removeFromStore(item.productId, item.productVariant?.id || undefined)
        if (!removed) {
          throw new Error('Failed to remove item')
        }

        setItems((current) => current.filter((entry) => entry.id !== item.id))
      } catch {
        toast.error('Could not remove item')
      } finally {
        setRemovingId(null)
      }
    },
    [removeFromStore]
  )

  // The Shopify cart (Phase 3) is filled from the product page, so "add" here
  // means "go choose a size": quick add opens the item's PDP and the bulk
  // action starts with the first item that is still available.
  const openProduct = useCallback(
    (item: WishlistItem) => {
      router.push(`/products/${item.product.slug}`)
    },
    [router]
  )

  const activeItems = useMemo(
    () =>
      items.filter(
        (item) => item.product.isActive && (!item.productVariant || (item.productVariant.isActive && item.productVariant.inventory > 0))
      ),
    [items]
  )

  const firstAvailable = activeItems[0] ?? null

  if (isLoading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-[#fafafa] pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="h-28 animate-pulse rounded-2xl border border-black/10 bg-white" />
          </div>
        </div>
      </>
    )
  }

  if (items.length === 0) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-[#fafafa] pb-16 pt-24">
          <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
            <CommerceEmptyState
              icon={Heart}
              eyebrow="Wishlist"
              title="Your wishlist is empty"
              description="Save products you love so you can come back, compare options, and add them later."
              primaryAction={{ label: 'Browse Products', href: '/products' }}
              secondaryAction={{ label: 'Explore Drops', href: '/drops' }}
            />

            <SmartDiscoveryRail
              title="Recommended for you"
              description="Trending styles shoppers are adding right now."
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
      <div className="min-h-screen bg-[#fafafa] pb-16 pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">Wishlist</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-black sm:text-4xl">Saved Items</h1>
              <p className="mt-2 text-sm text-black/60">
                {items.length} {items.length === 1 ? 'item' : 'items'} saved
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (firstAvailable) openProduct(firstAvailable)
                }}
                disabled={!firstAvailable}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-black/15 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black/75 transition-colors hover:border-black/35 hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ShoppingCart size={13} weight="bold" />
                Shop Available
              </button>

              <Link
                href="/products"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black/85"
              >
                Shop More
                <ArrowRight size={12} weight="bold" />
              </Link>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => {
              const imageUrl = getPrimaryImageWithFallback({
                images: item.productVariant?.images || item.product.images,
                productName: item.product.name,
                productSlug: item.product.slug,
                color: item.productVariant?.color,
                colorHex: item.productVariant?.colorHex,
                size: item.productVariant?.size,
              })
              const price = item.productVariant?.price || item.product.price
              const isUnavailable =
                !item.product.isActive ||
                (item.productVariant ? !item.productVariant.isActive || item.productVariant.inventory <= 0 : false)

              return (
                <article key={item.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white">
                  <div className="relative aspect-[4/5] overflow-hidden bg-black/[0.03]">
                    <Link href={`/products/${item.product.slug}`} className="block h-full">
                      <Image src={imageUrl} alt={item.product.name} fill className="object-cover" />
                    </Link>

                    {isUnavailable ? (
                      <span className="absolute left-3 top-3 rounded-full border border-red-300/70 bg-red-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-700">
                        Unavailable
                      </span>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => removeItem(item)}
                      disabled={removingId === item.id}
                      className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/15 bg-white/90 text-black/70 transition-colors hover:border-black/35 hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                      aria-label="Remove from wishlist"
                    >
                      <Trash size={14} weight="bold" />
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col p-3">
                    <Link href={`/products/${item.product.slug}`} className="line-clamp-2 text-sm font-semibold text-black hover:text-black/70">
                      {item.product.name}
                    </Link>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.productVariant?.color ? (
                        <span className="rounded-full border border-black/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-black/60">
                          {item.productVariant.color}
                        </span>
                      ) : null}
                      {item.productVariant?.size ? (
                        <span className="rounded-full border border-black/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-black/60">
                          {item.productVariant.size}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-3 text-base font-black tabular-nums text-black">{formatCurrency(price)}</p>

                    {item.notes ? <p className="mt-2 line-clamp-2 text-xs text-black/50">{item.notes}</p> : null}

                    <div className="mt-auto pt-3">
                      {isUnavailable ? (
                        <p className="mb-2 inline-flex items-center gap-1 text-[11px] font-medium text-red-700">
                          <WarningCircle size={12} weight="fill" />
                          Out of stock
                        </p>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => openProduct(item)}
                        disabled={isUnavailable}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-3 text-xs font-semibold uppercase tracking-[0.12em] text-black/80 transition-colors hover:border-black/35 hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <ShoppingCart size={13} weight="bold" />
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </section>

          <div className="mt-8">
            <SmartDiscoveryRail
              title="You may also like"
              description="More items aligned with what you saved."
              products={suggestions}
              loading={suggestionsLoading}
            />
          </div>

          <div className="mt-6 flex justify-center">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-black/60 transition-colors hover:text-black"
            >
              Continue shopping
              <ArrowRight size={12} weight="bold" />
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
