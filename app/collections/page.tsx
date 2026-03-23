'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, CircleNotch, Sparkle, Star, X } from '@phosphor-icons/react'
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

const SEARCH_SYNC_DEBOUNCE_MS = 250

const COLLECTION_SORT_OPTIONS: Array<{ value: CollectionListSortBy; label: string }> = [
  { value: 'curated', label: 'Curated' },
  { value: 'name', label: 'Name' },
  { value: 'productCount', label: 'Product Count' },
]

function CollectionCard({ collection }: { collection: CollectionCardViewModel }) {
  return (
    <li>
      <Link
        href={`/collections/${collection.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-black/25 hover:shadow-[0_18px_32px_rgba(0,0,0,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
          <Image
            src={collection.imageUrl}
            alt={collection.name}
            fill
            sizes="(max-width: 640px) 96vw, (max-width: 1024px) 48vw, 32vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          {collection.isFeatured ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
              <Star size={10} weight="fill" className="text-white" />
              Featured
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">
            {collection.productCount} {collection.productCount === 1 ? 'product' : 'products'}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-black">{collection.name}</h2>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-black/60">{collection.description}</p>

          <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-black/70 transition-colors group-hover:text-black">
            View collection
            <ArrowRight size={12} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </li>
  )
}

export default function CollectionsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()

  const search = searchParams.get('search')?.trim() ?? ''
  const featured = normalizeCollectionFeaturedFilter(searchParams.get('featured'))
  const sortBy = normalizeCollectionListSortBy(searchParams.get('sortBy'))

  const [searchDraft, setSearchDraft] = useState(search)
  const [collections, setCollections] = useState<CollectionCardViewModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSearchDraft(search)
  }, [search])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const replaceSearchParams = useCallback(
    (updates: {
      search?: string
      featured?: CollectionFeaturedFilter
      sortBy?: CollectionListSortBy
      clearAll?: boolean
    }) => {
      const nextParams = new URLSearchParams(searchParamsString)

      if (updates.clearAll) {
        nextParams.delete('search')
        nextParams.delete('featured')
        nextParams.delete('sortBy')
      } else {
        if (updates.search !== undefined) {
          const value = updates.search.trim()
          if (value) {
            nextParams.set('search', value)
          } else {
            nextParams.delete('search')
          }
        }

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
    if (searchDraft === search) {
      return
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      replaceSearchParams({ search: searchDraft })
      debounceRef.current = null
    }, SEARCH_SYNC_DEBOUNCE_MS)
  }, [replaceSearchParams, search, searchDraft])

  useEffect(() => {
    const controller = new AbortController()

    const loadCollections = async () => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        params.set('isActive', 'true')

        if (search) {
          params.set('search', search)
        }

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
  }, [featured, refreshNonce, search, sortBy])

  const hasActiveFilters = Boolean(search) || featured === 'featured' || sortBy !== 'curated'

  const totalProducts = useMemo(
    () => collections.reduce((sum, collection) => sum + collection.productCount, 0),
    [collections]
  )

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pt-28">
        <section aria-labelledby="collections-title">
          <p className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/65">
            <Sparkle size={12} weight="fill" />
            Curated Collections
          </p>

          <h1 id="collections-title" className="mt-4 text-4xl font-black tracking-tight text-black sm:text-5xl lg:text-6xl">
            Shop by collection
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60 sm:text-base">
            Browse curated edits designed for everyday wear, limited drops, and statement essentials.
          </p>
        </section>

        <section
          className="sticky top-16 z-30 mt-8 rounded-2xl border border-black/10 bg-white/95 p-4 shadow-[0_10px_18px_rgba(0,0,0,0.06)] backdrop-blur sm:top-20 sm:p-5"
          aria-label="Collection controls"
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
            <label className="sr-only" htmlFor="collections-search">
              Search collections
            </label>
            <input
              id="collections-search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search collections"
              className="h-11 rounded-full border border-black/15 bg-white px-4 text-sm text-black placeholder:text-black/35 focus:outline-none focus:ring-2 focus:ring-black/30"
            />

            <div className="inline-flex h-11 items-center rounded-full border border-black/15 bg-neutral-50 p-1">
              <button
                type="button"
                onClick={() => replaceSearchParams({ featured: 'all' })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                  featured === 'all'
                    ? 'bg-black text-white'
                    : 'text-black/60 hover:text-black'
                }`}
                aria-pressed={featured === 'all'}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => replaceSearchParams({ featured: 'featured' })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                  featured === 'featured'
                    ? 'bg-black text-white'
                    : 'text-black/60 hover:text-black'
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
                className="h-11 min-w-[170px] rounded-full border border-black/15 bg-white px-4 pr-9 text-xs font-semibold uppercase tracking-[0.12em] text-black/70 focus:outline-none focus:ring-2 focus:ring-black/30"
              >
                {COLLECTION_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-black/55">
            <p>
              {loading ? 'Loading collections...' : `${collections.length} collections · ${totalProducts} products`}
            </p>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => replaceSearchParams({ clearAll: true })}
                className="inline-flex items-center gap-1 rounded-full border border-black/20 px-3 py-1 font-semibold uppercase tracking-[0.12em] text-black/70 transition-colors hover:border-black/35 hover:text-black"
              >
                Clear all
                <X size={12} weight="bold" />
              </button>
            ) : null}
          </div>

          {hasActiveFilters ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs" data-testid="collections-active-filters">
              {search ? (
                <button
                  type="button"
                  onClick={() => replaceSearchParams({ search: '' })}
                  className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-neutral-50 px-3 py-1.5 font-semibold uppercase tracking-[0.1em] text-black/70 hover:border-black/35 hover:text-black"
                >
                  Search: {search}
                  <X size={12} weight="bold" />
                </button>
              ) : null}

              {featured === 'featured' ? (
                <button
                  type="button"
                  onClick={() => replaceSearchParams({ featured: 'all' })}
                  className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-neutral-50 px-3 py-1.5 font-semibold uppercase tracking-[0.1em] text-black/70 hover:border-black/35 hover:text-black"
                >
                  Featured only
                  <X size={12} weight="bold" />
                </button>
              ) : null}

              {sortBy !== 'curated' ? (
                <button
                  type="button"
                  onClick={() => replaceSearchParams({ sortBy: 'curated' })}
                  className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-neutral-50 px-3 py-1.5 font-semibold uppercase tracking-[0.1em] text-black/70 hover:border-black/35 hover:text-black"
                >
                  Sort: {COLLECTION_SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? 'Curated'}
                  <X size={12} weight="bold" />
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="mt-8" aria-live="polite">
          {loading ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {Array.from({ length: 6 }).map((_, index) => (
                <li
                  key={index}
                  className="overflow-hidden rounded-2xl border border-black/10 bg-white"
                  aria-hidden="true"
                >
                  <div className="aspect-[4/3] animate-pulse bg-black/10" />
                  <div className="space-y-3 p-5">
                    <div className="h-3 w-24 animate-pulse rounded bg-black/10" />
                    <div className="h-7 w-40 animate-pulse rounded bg-black/10" />
                    <div className="h-4 w-full animate-pulse rounded bg-black/10" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-black/10" />
                  </div>
                </li>
              ))}
            </ul>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
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
            <div className="rounded-2xl border border-black/10 bg-white p-8 text-center">
              <p className="text-xl font-semibold text-black">No collections match your filters</p>
              <p className="mt-2 text-sm text-black/60">Clear filters to explore everything currently available.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => replaceSearchParams({ clearAll: true })}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-black/85"
                >
                  Clear filters
                </button>
                <Link
                  href="/products"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/20 bg-white px-5 text-xs font-semibold uppercase tracking-[0.12em] text-black/75 hover:border-black/35 hover:text-black"
                >
                  Shop all products
                </Link>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list" data-testid="collections-grid">
              {collections.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} />
              ))}
            </ul>
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
