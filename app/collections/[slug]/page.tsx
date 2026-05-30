'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, CircleNotch, Sparkle, X } from '@phosphor-icons/react'
import { Navigation } from '@/components/layout/Navigation'
import { Product, ProductVariant } from '@/lib/api/products'
import { ProductCard } from '@/components/products/ProductCard'
import {
  buildCollectionEditorialSections,
  COLLECTION_DETAIL_INITIAL_PRODUCTS,
  CollectionProductSortBy,
  getNextCollectionVisibleCount,
  getVisibleCollectionProducts,
  normalizeCollectionProductSortBy,
  resolveCollectionCampaignPresentation,
} from '@/lib/collections/public-collections'

const SEARCH_SYNC_DEBOUNCE_MS = 250

const DETAIL_SORT_OPTIONS: Array<{ value: CollectionProductSortBy; label: string }> = [
  { value: 'curated', label: 'Curated' },
  { value: 'newest', label: 'Newest' },
  { value: 'priceAsc', label: 'Price: Low to High' },
  { value: 'priceDesc', label: 'Price: High to Low' },
  { value: 'name', label: 'Name' },
]

interface CollectionDetailResponse {
  collection: {
    id: string
    name: string
    slug: string
    description: string | null
    image: string | null
    isFeatured: boolean
    sortOrder: number
    productCount: number
    totalAssignedCount: number
  }
  products: Array<Product & { compareAtPrice?: number | null; variants: ProductVariant[] }>
  filters: {
    search: string
    sortBy: CollectionProductSortBy
    inStock: boolean
  }
  counts: {
    totalProducts: number
    filteredProducts: number
  }
  meta: {
    requestedSlug: string
    resolvedSlug: string
    isCanonical: boolean
  }
}

function normalizeProduct(product: CollectionDetailResponse['products'][number]): Product {
  return {
    ...product,
    compareAtPrice: product.compareAtPrice ?? undefined,
  }
}

export default function CollectionDetailPage() {
  const params = useParams<{ slug: string | string[] }>()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()

  const slugParam = Array.isArray(params.slug) ? params.slug[0] : params.slug

  const search = searchParams.get('search')?.trim() ?? ''
  const sortBy = normalizeCollectionProductSortBy(searchParams.get('sortBy'))
  const inStock = searchParams.get('inStock') === 'true'

  const [searchDraft, setSearchDraft] = useState(search)
  const [detail, setDetail] = useState<CollectionDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [visibleCount, setVisibleCount] = useState(COLLECTION_DETAIL_INITIAL_PRODUCTS)

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
      sortBy?: CollectionProductSortBy
      inStock?: boolean
      clearAll?: boolean
    }) => {
      const nextParams = new URLSearchParams(searchParamsString)

      if (updates.clearAll) {
        nextParams.delete('search')
        nextParams.delete('sortBy')
        nextParams.delete('inStock')
      } else {
        if (updates.search !== undefined) {
          const value = updates.search.trim()
          if (value) {
            nextParams.set('search', value)
          } else {
            nextParams.delete('search')
          }
        }

        if (updates.sortBy !== undefined) {
          if (updates.sortBy === 'curated') {
            nextParams.delete('sortBy')
          } else {
            nextParams.set('sortBy', updates.sortBy)
          }
        }

        if (updates.inStock !== undefined) {
          if (updates.inStock) {
            nextParams.set('inStock', 'true')
          } else {
            nextParams.delete('inStock')
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
    if (!slugParam) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const controller = new AbortController()

    const loadCollection = async () => {
      setLoading(true)
      setNotFound(false)
      setError(null)

      try {
        const paramsForApi = new URLSearchParams()

        if (search) {
          paramsForApi.set('search', search)
        }

        if (sortBy !== 'curated') {
          paramsForApi.set('sortBy', sortBy)
        }

        if (inStock) {
          paramsForApi.set('inStock', 'true')
        }

        const endpoint = `/api/collections/slug/${encodeURIComponent(slugParam)}`
        const requestUrl = paramsForApi.toString()
          ? `${endpoint}?${paramsForApi.toString()}`
          : endpoint

        const response = await fetch(requestUrl, { signal: controller.signal })

        if (response.status === 404) {
          setDetail(null)
          setNotFound(true)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch collection')
        }

        const payload: CollectionDetailResponse = await response.json()

        setDetail({
          ...payload,
          products: payload.products.map(normalizeProduct),
        })

        if (payload.meta.resolvedSlug && payload.meta.resolvedSlug !== slugParam) {
          const nextUrl = searchParamsString
            ? `/collections/${payload.meta.resolvedSlug}?${searchParamsString}`
            : `/collections/${payload.meta.resolvedSlug}`
          router.replace(nextUrl, { scroll: false })
        }
      } catch (fetchError) {
        if ((fetchError as Error).name === 'AbortError') {
          return
        }
        console.error('Failed to load collection detail:', fetchError)
        setError('We could not load this collection right now.')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadCollection()

    return () => controller.abort()
  }, [inStock, refreshNonce, router, search, searchParamsString, slugParam, sortBy])

  const hasActiveFilters = Boolean(search) || sortBy !== 'curated' || inStock
  const products = detail?.products ?? []
  const visibleProducts = getVisibleCollectionProducts(products, visibleCount)
  const hasMoreProducts = visibleCount < products.length
  const totalProducts = detail?.counts.totalProducts ?? 0
  const filteredProducts = detail?.counts.filteredProducts ?? 0
  const collectionName = detail?.collection.name ?? 'Collection'
  const collectionSlug = detail?.collection.slug ?? (slugParam || 'collection')

  const campaignPresentation = useMemo(
    () => resolveCollectionCampaignPresentation(collectionSlug, 0),
    [collectionSlug]
  )

  const editorialSections = useMemo(
    () =>
      buildCollectionEditorialSections({
        name: collectionName,
        description: detail?.collection.description,
        productCount: totalProducts,
        isFeatured: detail?.collection.isFeatured ?? false,
        sampleProducts: products.slice(0, 3).map((product) => product.name),
      }),
    [collectionName, detail?.collection.description, detail?.collection.isFeatured, products, totalProducts]
  )

  useEffect(() => {
    setVisibleCount(COLLECTION_DETAIL_INITIAL_PRODUCTS)
  }, [collectionSlug, search, sortBy, inStock, filteredProducts])

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-100 via-stone-50 to-neutral-100">
        <Navigation />
        <main id="main-content" className="mx-auto max-w-4xl px-4 pb-16 pt-24 text-center sm:px-6 lg:px-8 lg:pt-28">
          <h1 className="text-3xl font-black tracking-tight text-black sm:text-4xl">Collection not found</h1>
          <p className="mt-3 text-sm text-black/60 sm:text-base">
            This collection may have moved or is no longer available.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/collections"
              className="inline-flex h-11 items-center justify-center rounded-full bg-black px-6 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-black/85"
            >
              View collections
            </Link>
            <Link
              href="/products"
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/20 bg-white px-6 text-xs font-semibold uppercase tracking-[0.12em] text-black/75 hover:border-black/35 hover:text-black"
            >
              Shop all products
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-100 via-stone-50 to-neutral-100">
      <Navigation />

      <main id="main-content" className="mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 lg:px-8 lg:pt-28">
        <section
          className="relative overflow-hidden rounded-[1.8rem] border border-black/10 bg-white shadow-[0_24px_50px_-32px_rgba(0,0,0,0.5)]"
          aria-labelledby="collection-detail-title"
        >
          <div className="grid gap-0 lg:grid-cols-[1fr_1.15fr]">
            <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
              <div>
                <Link
                  href="/collections"
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-black/60 transition-colors hover:text-black"
                >
                  Collections
                </Link>

                <span
                  className={`mt-4 inline-flex items-center gap-1 rounded-full border bg-gradient-to-r px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${campaignPresentation.accentGradientClass}`}
                >
                  <Sparkle size={10} weight="fill" />
                  {campaignPresentation.accentLabel}
                </span>

                <h1 id="collection-detail-title" className="mt-4 text-4xl font-black tracking-tight text-black sm:text-5xl">
                  {collectionName}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60 sm:text-base">
                  {detail?.collection.description || 'Explore this collection of premium pieces.'}
                </p>

                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                  {totalProducts} curated {totalProducts === 1 ? 'piece' : 'pieces'}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href="#collection-products"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-black px-6 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                >
                  Shop this collection
                </a>
                <Link
                  href="/products"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-black/20 bg-white px-6 text-xs font-semibold uppercase tracking-[0.12em] text-black/75 transition-colors hover:border-black/35 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                >
                  Shop all products
                </Link>
              </div>
            </div>

            <div className="relative min-h-[18rem] overflow-hidden bg-neutral-200 sm:min-h-[22rem] lg:min-h-full">
              {detail?.collection.image ? (
                <Image
                  src={detail.collection.image}
                  alt={detail.collection.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-300 via-neutral-200 to-stone-300" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
              <span className="absolute bottom-4 right-4 rounded-full border border-white/25 bg-black/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                Limited Collection
              </span>
            </div>
          </div>
        </section>

        <section
          className="mt-8 grid gap-4 md:grid-cols-3"
          data-testid="collection-story-sections"
          aria-label="Collection editorial story"
        >
          {editorialSections.map((section) => (
            <article
              key={section.id}
              className="rounded-[1.3rem] border border-black/10 bg-white/95 p-5 shadow-[0_14px_30px_-24px_rgba(0,0,0,0.35)]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">{section.heading}</p>
              <p className="mt-2 text-sm leading-relaxed text-black/70">{section.body}</p>
            </article>
          ))}
        </section>

        <section
          id="collection-products"
          className="mt-8 rounded-[1.6rem] border border-black/10 bg-white/95 p-5 shadow-[0_14px_30px_-24px_rgba(0,0,0,0.35)] backdrop-blur"
          aria-label="Collection product controls"
        >
          <Link
            href={`/collections/${collectionSlug}`}
            className="mb-4 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/55 transition-colors hover:text-black"
          >
            Product discovery
            <ArrowRight size={11} weight="bold" />
          </Link>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
            <label className="sr-only" htmlFor="collection-products-search">
              Search products in collection
            </label>
            <input
              id="collection-products-search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search products in this collection"
              className="h-11 rounded-full border border-black/15 bg-white px-4 text-sm text-black placeholder:text-black/35 focus:outline-none focus:ring-2 focus:ring-black/30"
            />

            <label className="relative">
              <span className="sr-only">Sort products</span>
              <select
                value={sortBy}
                onChange={(event) =>
                  replaceSearchParams({
                    sortBy: normalizeCollectionProductSortBy(event.target.value),
                  })
                }
                className="h-11 min-w-[200px] rounded-full border border-black/15 bg-white px-4 pr-9 text-xs font-semibold uppercase tracking-[0.12em] text-black/70 focus:outline-none focus:ring-2 focus:ring-black/30"
              >
                {DETAIL_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black/70">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(event) => replaceSearchParams({ inStock: event.target.checked })}
                className="h-4 w-4 rounded border-black/20 text-black focus:ring-black/30"
              />
              In stock only
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-black/55">
            <p>
              {loading
                ? 'Loading products...'
                : `${filteredProducts} of ${totalProducts} products`}
            </p>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => replaceSearchParams({ clearAll: true })}
                className="inline-flex items-center gap-1 rounded-full border border-black/20 px-3 py-1 font-semibold uppercase tracking-[0.12em] text-black/70 transition-colors hover:border-black/35 hover:text-black"
              >
                Clear filters
                <X size={12} weight="bold" />
              </button>
            ) : null}
          </div>
        </section>

        <section className="mt-8" aria-live="polite">
          {loading ? (
            <div className="rounded-2xl border border-black/10 bg-white p-8 text-center">
              <CircleNotch size={22} weight="bold" className="mx-auto animate-spin text-black/60" />
              <p className="mt-3 text-sm text-black/60">Loading collection products...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="text-base font-semibold text-red-900">{error}</p>
              <p className="mt-2 text-sm text-red-700">Try reloading to fetch the latest products.</p>
              <button
                type="button"
                onClick={() => setRefreshNonce((value) => value + 1)}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-black/85"
              >
                Reload
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-black/10 bg-white p-8 text-center">
              <p className="text-xl font-semibold text-black">No products match your filters</p>
              <p className="mt-2 text-sm text-black/60">
                Try clearing your filters or explore all products.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => replaceSearchParams({ clearAll: true })}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-black/85"
                >
                  Reset filters
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
            <>
              <div
                className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
                data-testid="collection-products-grid"
              >
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {hasMoreProducts ? (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    data-testid="collection-load-more"
                    onClick={() =>
                      setVisibleCount((current) =>
                        getNextCollectionVisibleCount({
                          currentVisibleCount: current,
                          totalProducts: products.length,
                        })
                      )
                    }
                    className="inline-flex h-11 items-center justify-center rounded-full border border-black/20 bg-white px-6 text-xs font-semibold uppercase tracking-[0.12em] text-black/75 transition-colors hover:border-black/35 hover:text-black"
                  >
                    Load more ({products.length - visibleCount} remaining)
                  </button>
                </div>
              ) : null}

              <p className="mt-4 text-center text-xs text-black/45">
                Showing {visibleProducts.length} of {products.length} products
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
