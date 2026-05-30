'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CircleNotch } from '@phosphor-icons/react'
import { Navigation } from '@/components/layout/Navigation'
import { CollectionCard } from '@/components/collections/CollectionCard'
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

// Number of leading featured collections that get the bigger "featured" tile.
// Beyond this, featured collections render as regular tiles to avoid a wall of mega-tiles.
const MAX_FEATURED_TILES = 2

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

  // Decide which collections render as the bigger "featured" tile in the mosaic.
  // First MAX_FEATURED_TILES isFeatured collections get the spotlight.
  const featuredTileIds = useMemo(() => {
    const ids = new Set<string>()
    let taken = 0
    for (const c of collections) {
      if (taken >= MAX_FEATURED_TILES) break
      if (c.isFeatured) {
        ids.add(c.id)
        taken += 1
      }
    }
    return ids
  }, [collections])

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <main id="main-content" className="mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 lg:px-8 lg:pt-24">

        {/* Slim editorial header */}
        <header className="text-center mb-8 md:mb-10">
          <div className="inline-flex items-center gap-3 mb-3 md:mb-4">
            <span className="inline-block w-6 h-px bg-black/30" />
            <p className="text-[10px] md:text-[11px] font-bold tracking-[0.22em] text-black/55 uppercase">
              Collections
            </p>
            <span className="inline-block w-6 h-px bg-black/30" />
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-black tracking-tight leading-[0.95]">
            Curated edits
          </h1>
          <p className="mt-3 text-xs md:text-sm font-semibold uppercase tracking-[0.18em] text-black/45">
            {loading
              ? 'Loading…'
              : `${collections.length} ${collections.length === 1 ? 'edit' : 'edits'}`}
          </p>
        </header>

        {/* Compact filter bar */}
        <section
          className="mb-6 md:mb-8 flex flex-wrap items-center justify-between gap-3"
          aria-label="Collection controls"
        >
          <div className="inline-flex items-center rounded-full border border-black/10 bg-black/3 p-1">
            <button
              type="button"
              onClick={() => replaceSearchParams({ featured: 'all' })}
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                featured === 'all' ? 'bg-black text-white shadow-sm' : 'text-black/55 hover:text-black'
              }`}
              aria-pressed={featured === 'all'}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => replaceSearchParams({ featured: 'featured' })}
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                featured === 'featured' ? 'bg-black text-white shadow-sm' : 'text-black/55 hover:text-black'
              }`}
              aria-pressed={featured === 'featured'}
            >
              Featured
            </button>
          </div>

          <label className="relative">
            <span className="sr-only">Sort collections</span>
            <select
              value={sortBy}
              onChange={(event) =>
                replaceSearchParams({ sortBy: normalizeCollectionListSortBy(event.target.value) })
              }
              className="h-10 min-w-40 rounded-full border border-black/10 bg-white px-4 pr-9 text-[11px] font-bold uppercase tracking-wider text-black/65 cursor-pointer hover:text-black hover:border-black/25 transition-colors focus:outline-none focus:ring-2 focus:ring-black/30"
            >
              {COLLECTION_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Sort: {option.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* Mosaic grid */}
        <section aria-live="polite">
          {loading ? (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 grid-flow-row-dense gap-3 md:gap-4 lg:gap-5"
              aria-hidden="true"
            >
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className={`overflow-hidden rounded-2xl border border-black/8 bg-white ${
                    index === 0 ? 'col-span-2 row-span-2 sm:col-span-2 xl:col-span-2 xl:row-span-2' : ''
                  }`}
                >
                  <div className="aspect-square animate-pulse bg-black/5" />
                  <div className="p-3 md:p-4 space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-black/10" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-black/8" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="text-base font-semibold text-red-900">{error}</p>
              <p className="mt-2 text-sm text-red-700">Try reloading to fetch the latest collections.</p>
              <button
                type="button"
                onClick={() => setRefreshNonce((value) => value + 1)}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-xs font-bold uppercase tracking-wider text-white hover:bg-black/85"
              >
                Reload
              </button>
            </div>
          ) : collections.length === 0 ? (
            <div className="rounded-2xl border border-black/10 bg-white p-12 text-center">
              <p className="text-xl font-black text-black">No collections available</p>
              <p className="mt-2 text-sm text-black/55">Try again in a moment or continue shopping all products.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => replaceSearchParams({ clearAll: true })}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/15 bg-white px-5 text-xs font-bold uppercase tracking-wider text-black/70 hover:border-black/35 hover:text-black"
                >
                  Reset filters
                </button>
                <Link
                  href="/products"
                  className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-xs font-bold uppercase tracking-wider text-white hover:bg-black/85"
                >
                  Shop all products
                </Link>
              </div>
            </div>
          ) : (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 grid-flow-row-dense gap-3 md:gap-4 lg:gap-5"
              data-testid="collections-grid"
            >
              {collections.map((collection) => {
                const isFeaturedTile = featuredTileIds.has(collection.id)
                const spanClass = isFeaturedTile
                  ? 'col-span-2 sm:col-span-2 xl:col-span-2 xl:row-span-2'
                  : ''
                return (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    variant={isFeaturedTile ? 'featured' : 'regular'}
                    className={spanClass}
                  />
                )
              })}
            </div>
          )}
        </section>

        {loading ? (
          <div className="mt-6 flex items-center justify-center text-sm text-black/45">
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
    <div className="min-h-screen bg-white">
      <Navigation />
      <main id="main-content" className="mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 lg:px-8 lg:pt-24">
        <header className="text-center mb-8 md:mb-10">
          <div className="inline-flex items-center gap-3 mb-3 md:mb-4">
            <span className="inline-block w-6 h-px bg-black/30" />
            <p className="text-[10px] md:text-[11px] font-bold tracking-[0.22em] text-black/55 uppercase">
              Collections
            </p>
            <span className="inline-block w-6 h-px bg-black/30" />
          </div>
          <div className="mx-auto h-12 md:h-16 w-72 md:w-96 animate-pulse rounded bg-black/5" />
        </header>
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
