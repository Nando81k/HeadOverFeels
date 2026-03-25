'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, CircleNotch, Star, X } from '@phosphor-icons/react'
import { Navigation } from '@/components/layout/Navigation'
import {
  CollectionCardViewModel,
  CollectionFeaturedFilter,
  CollectionListSortBy,
  CollectionWithProducts,
  normalizeCollectionFeaturedFilter,
  normalizeCollectionListSortBy,
  toCollectionCardViewModel,
} from '@/lib/collections/public-collections'

const COLLECTION_SORT_OPTIONS: Array<{ value: CollectionListSortBy; label: string }> = [
  { value: 'curated', label: 'Curated' },
  { value: 'name', label: 'Name' },
  { value: 'productCount', label: 'Product Count' },
]

const FALLBACK_COLLECTION_IMAGE = '/placeholder-product.jpg'

function CollectionImage({
  src,
  alt,
  sizes,
  priority,
}: {
  src: string
  alt: string
  sizes: string
  priority?: boolean
}) {
  const [resolvedSrc, setResolvedSrc] = useState(src || FALLBACK_COLLECTION_IMAGE)

  useEffect(() => {
    setResolvedSrc(src || FALLBACK_COLLECTION_IMAGE)
  }, [src])

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      unoptimized
      className="object-cover"
      onError={() => {
        if (resolvedSrc !== FALLBACK_COLLECTION_IMAGE) {
          setResolvedSrc(FALLBACK_COLLECTION_IMAGE)
        }
      }}
    />
  )
}

function CollectionCommerceCard({
  collection,
}: {
  collection: CollectionCardViewModel
}) {
  return (
    <li className="group">
      <Link
        href={`/collections/${collection.slug}`}
        className="flex h-full flex-col overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_20px_40px_-32px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-32px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-neutral-200">
          <CollectionImage
            src={collection.imageUrl}
            alt={collection.name}
            sizes="(max-width: 1024px) 100vw, (max-width: 1280px) 33vw, 25vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          {collection.isFeatured ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
              <Star size={10} weight="fill" />
              Featured
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
          <h2 className="text-2xl font-black tracking-tight text-black">{collection.name}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-black/60">{collection.description}</p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">
            {collection.productCount} {collection.productCount === 1 ? 'product' : 'products'}
          </p>

          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-black/75 transition-colors group-hover:text-black">
            View collection
            <ArrowRight size={12} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </li>
  )
}

function CollectionsPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()
  const legacySearch = searchParams.get('search')?.trim() ?? ''

  const featured = normalizeCollectionFeaturedFilter(searchParams.get('featured'))
  const sortBy = normalizeCollectionListSortBy(searchParams.get('sortBy'))

  const [collections, setCollections] = useState<CollectionCardViewModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    if (!legacySearch) {
      return
    }

    const nextParams = new URLSearchParams(searchParamsString)
    nextParams.delete('search')

    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [legacySearch, pathname, router, searchParamsString])

  const replaceSearchParams = useCallback(
    (updates: {
      featured?: CollectionFeaturedFilter
      sortBy?: CollectionListSortBy
      clearAll?: boolean
    }) => {
      const nextParams = new URLSearchParams(searchParamsString)
      nextParams.delete('search')

      if (updates.clearAll) {
        nextParams.delete('featured')
        nextParams.delete('sortBy')
      } else {
        if (updates.featured !== undefined) {
          if (updates.featured === 'featured') {
            nextParams.set('featured', 'featured')
          } else {
            nextParams.delete('featured')
          }
        }

        if (updates.sortBy !== undefined) {
          if (updates.sortBy === 'curated') {
            nextParams.delete('sortBy')
          } else {
            nextParams.set('sortBy', updates.sortBy)
          }
        }
      }

      const nextQuery = nextParams.toString()
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname
      const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname

      if (nextUrl !== currentUrl) {
        router.replace(nextUrl, { scroll: false })
      }
    },
    [pathname, router, searchParamsString]
  )

  useEffect(() => {
    const controller = new AbortController()

    const loadCollections = async () => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        params.set('isActive', 'true')

        if (featured === 'featured') {
          params.set('featured', 'featured')
        }

        if (sortBy !== 'curated') {
          params.set('sortBy', sortBy)
        }

        const response = await fetch(`/api/collections?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to fetch collections')
        }

        const payload: CollectionWithProducts[] = await response.json()
        setCollections(payload.map(toCollectionCardViewModel))
      } catch (fetchError) {
        if ((fetchError as Error).name === 'AbortError') {
          return
        }
        console.error('Failed to load collections:', fetchError)
        setCollections([])
        setError('We could not load collections right now.')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadCollections()

    return () => controller.abort()
  }, [featured, refreshNonce, sortBy])

  const hasActiveFilters = featured === 'featured' || sortBy !== 'curated'

  const totalProducts = useMemo(
    () => collections.reduce((sum, collection) => sum + collection.productCount, 0),
    [collections]
  )

  const spotlightCollection = useMemo(
    () => collections.find((collection) => collection.isFeatured) ?? collections[0] ?? null,
    [collections]
  )

  const collectionGrid = useMemo(
    () =>
      spotlightCollection
        ? collections.filter((collection) => collection.id !== spotlightCollection.id)
        : collections,
    [collections, spotlightCollection]
  )

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 lg:px-8 lg:pt-28">
        <section
          className="overflow-hidden rounded-3xl border border-black/10 bg-white p-8 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.4)] sm:p-10"
          aria-labelledby="collections-title"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/45">Collections</p>
              <h1 id="collections-title" className="mt-3 text-4xl font-black tracking-tight text-black sm:text-5xl">
                Curated edits built for everyday shopping.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-black/60 sm:text-base">
                Browse collections by fit, mood, and category. Every edit is shoppable and designed for faster product discovery.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/products"
                className="inline-flex h-11 items-center justify-center rounded-full bg-black px-6 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black/85"
              >
                Shop all products
              </Link>
              <Link
                href="/drops"
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/20 bg-white px-6 text-xs font-semibold uppercase tracking-[0.12em] text-black/75 transition-colors hover:border-black/35 hover:text-black"
              >
                New drops
              </Link>
            </div>
          </div>
        </section>

        <section
          className="mt-6 rounded-3xl border border-black/10 bg-white p-4 shadow-[0_14px_30px_-24px_rgba(0,0,0,0.35)] sm:p-5"
          aria-label="Collection controls"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex h-11 items-center rounded-full border border-black/15 bg-neutral-50 p-1">
              <button
                type="button"
                onClick={() => replaceSearchParams({ featured: 'all' })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                  featured === 'all' ? 'bg-black text-white' : 'text-black/60 hover:text-black'
                }`}
                aria-pressed={featured === 'all'}
              >
                All collections
              </button>
              <button
                type="button"
                onClick={() => replaceSearchParams({ featured: 'featured' })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                  featured === 'featured' ? 'bg-black text-white' : 'text-black/60 hover:text-black'
                }`}
                aria-pressed={featured === 'featured'}
              >
                Featured
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="relative">
                <span className="sr-only">Sort collections</span>
                <select
                  value={sortBy}
                  onChange={(event) => replaceSearchParams({ sortBy: normalizeCollectionListSortBy(event.target.value) })}
                  className="h-11 min-w-[180px] rounded-full border border-black/15 bg-white px-4 pr-9 text-xs font-semibold uppercase tracking-[0.12em] text-black/70 focus:outline-none focus:ring-2 focus:ring-black/30"
                >
                  {COLLECTION_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => replaceSearchParams({ clearAll: true })}
                  className="inline-flex h-11 items-center gap-1 rounded-full border border-black/20 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black/70 transition-colors hover:border-black/35 hover:text-black"
                >
                  Clear
                  <X size={12} weight="bold" />
                </button>
              ) : null}
            </div>
          </div>

          <p className="mt-3 text-xs text-black/55">
            {loading ? 'Loading collections...' : `${collections.length} collections · ${totalProducts} products`}
          </p>
        </section>

        {!loading && !error && spotlightCollection ? (
          <section
            data-testid="collections-spotlight"
            className="mt-6 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_20px_40px_-30px_rgba(0,0,0,0.45)]"
            aria-label="Featured collection spotlight"
          >
            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
              <div className="relative min-h-[16rem] bg-neutral-200 sm:min-h-[21rem]">
                <CollectionImage
                  src={spotlightCollection.imageUrl}
                  alt={spotlightCollection.name}
                  priority
                  sizes="(max-width: 1024px) 100vw, 66vw"
                />
              </div>
              <div className="flex flex-col justify-between bg-gradient-to-br from-black to-neutral-800 p-6 text-white sm:p-8">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                    Featured collection
                  </p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight">{spotlightCollection.name}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-white/80">{spotlightCollection.description}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/65">
                    {spotlightCollection.productCount} items in this edit
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/collections/${spotlightCollection.slug}`}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-white/35 bg-white px-5 text-[11px] font-semibold uppercase tracking-[0.13em] text-black transition-colors hover:bg-white/90"
                  >
                    View collection
                  </Link>
                  <Link
                    href="/products"
                    className="inline-flex h-10 items-center justify-center rounded-full border border-white/35 px-5 text-[11px] font-semibold uppercase tracking-[0.13em] text-white transition-colors hover:bg-white/10"
                  >
                    Shop all
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-6" aria-live="polite">
          {loading ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" role="list">
              {Array.from({ length: 6 }).map((_, index) => (
                <li
                  key={index}
                  className="overflow-hidden rounded-3xl border border-black/10 bg-white"
                  aria-hidden="true"
                >
                  <div className="aspect-[4/5] animate-pulse bg-black/10" />
                  <div className="space-y-3 p-5">
                    <div className="h-7 w-44 animate-pulse rounded bg-black/10" />
                    <div className="h-4 w-full animate-pulse rounded bg-black/10" />
                    <div className="h-4 w-3/4 animate-pulse rounded bg-black/10" />
                  </div>
                </li>
              ))}
            </ul>
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="text-base font-semibold text-red-900">{error}</p>
              <p className="mt-2 text-sm text-red-700">Try reloading to fetch the latest collections.</p>
              <button
                type="button"
                onClick={() => setRefreshNonce((value) => value + 1)}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-black/85"
              >
                Reload
              </button>
            </div>
          ) : collections.length === 0 ? (
            <div className="rounded-3xl border border-black/10 bg-white p-8 text-center">
              <p className="text-xl font-semibold text-black">No collections available right now</p>
              <p className="mt-2 text-sm text-black/60">Try again in a moment or continue shopping all products.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => replaceSearchParams({ clearAll: true })}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/20 bg-white px-5 text-xs font-semibold uppercase tracking-[0.12em] text-black/75 hover:border-black/35 hover:text-black"
                >
                  Reset filters
                </button>
                <Link
                  href="/products"
                  className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-black/85"
                >
                  Shop all products
                </Link>
              </div>
            </div>
          ) : (
            <ul
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
              role="list"
              data-testid="collections-grid"
            >
              {(collectionGrid.length === 0 && spotlightCollection ? [spotlightCollection] : collectionGrid).map((collection) => (
                <CollectionCommerceCard key={collection.id} collection={collection} />
              ))}
            </ul>
          )}
        </section>

        {loading ? (
          <div className="mt-5 flex items-center justify-center text-sm text-black/45">
            <CircleNotch size={16} weight="bold" className="mr-2 animate-spin" />
            Refreshing collections
          </div>
        ) : null}
      </main>
    </div>
  )
}

function CollectionsPageFallback() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 lg:px-8 lg:pt-28">
        <section className="overflow-hidden rounded-3xl border border-black/10 bg-white p-8 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.4)] sm:p-10">
          <div className="space-y-3">
            <div className="h-3 w-28 animate-pulse rounded bg-black/10" />
            <div className="h-12 w-full max-w-3xl animate-pulse rounded bg-black/10" />
            <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-black/10" />
          </div>
        </section>
      </main>
    </div>
  )
}

export default function CollectionsPage() {
  return (
    <Suspense fallback={<CollectionsPageFallback />}>
      <CollectionsPageContent />
    </Suspense>
  )
}
