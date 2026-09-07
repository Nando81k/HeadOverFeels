'use client'

import * as React from 'react'
import type { ProductCardData } from '@/lib/shopify/types'
import type { ProductFilter } from '@/lib/shopify/filters'
import type { CollectionSort } from '@/lib/shopify/queries/collection'
import type { SearchSort } from '@/lib/shopify/queries/search'
import {
  loadMoreCollectionProducts,
  loadMoreSearchResults,
} from '@/app/(storefront)/_actions/catalog'
import { ProductGrid, type ProductGridColumns } from '@/components/storefront/product/ProductGrid'
import { Button } from '@/components/storefront/ui/Button'
import { cn } from '@/lib/storefront/cn'

export type LoadMorePageInfo = { hasNextPage: boolean; endCursor: string | null }
export type LoadMoreSlice = { products: ProductCardData[]; pageInfo: LoadMorePageInfo }

export type LoadMoreSource =
  | { kind: 'collection'; handle: string; filters: ProductFilter[]; sort?: CollectionSort }
  | { kind: 'search'; q: string; filters: ProductFilter[]; sort?: SearchSort }

export interface LoadMoreGridProps {
  initialProducts: ProductCardData[]
  initialPageInfo: LoadMorePageInfo
  columns?: ProductGridColumns
  /** Which server action to call, and with what. */
  source: LoadMoreSource
  /** Injected fetcher; defaults to the server action matching `source.kind`. */
  loader?: (after: string) => Promise<LoadMoreSlice>
  emptyMessage?: React.ReactNode
  className?: string
}

/**
 * The product grid plus its cursor-paginated "Load more" button.
 *
 * State is intentionally local and *not* re-synced from props: the page renders
 * this keyed by `ctx.search` (`<LoadMoreGrid key={ctx.search} … />`) so any
 * filter/sort navigation remounts it with a fresh first page instead of
 * appending the new results onto the old ones.
 *
 * `loader` exists so `/search` (and tests) can supply their own fetcher; when
 * it is absent the matching server action from `_actions/catalog` is used.
 */
export function LoadMoreGrid({
  initialProducts,
  initialPageInfo,
  columns = 4,
  source,
  loader,
  emptyMessage,
  className,
}: LoadMoreGridProps) {
  const [products, setProducts] = React.useState<ProductCardData[]>(initialProducts)
  const [pageInfo, setPageInfo] = React.useState<LoadMorePageInfo>(initialPageInfo)
  const [pending, startTransition] = React.useTransition()

  const fetchSlice = React.useCallback(
    async (after: string): Promise<LoadMoreSlice> => {
      if (loader) return loader(after)
      if (source.kind === 'collection') {
        return loadMoreCollectionProducts({
          handle: source.handle,
          after,
          filters: source.filters,
          sort: source.sort,
        })
      }
      return loadMoreSearchResults({
        q: source.q,
        after,
        filters: source.filters,
        sort: source.sort,
      })
    },
    [loader, source]
  )

  const onLoadMore = () => {
    const after = pageInfo.endCursor
    if (!after || pending) return

    startTransition(async () => {
      const slice = await fetchSlice(after)
      setProducts((current) => {
        const seen = new Set(current.map((product) => product.id))
        return [...current, ...slice.products.filter((product) => !seen.has(product.id))]
      })
      setPageInfo(slice.pageInfo)
    })
  }

  return (
    <div className={cn('flex flex-col gap-10', className)}>
      <ProductGrid products={products} columns={columns} emptyMessage={emptyMessage} />

      {products.length > 0 ? (
        <div className="flex flex-col items-center gap-4">
          <p className="num text-xs uppercase tracking-eyebrow text-ink-mute">
            Showing {products.length}
          </p>
          {pageInfo.hasNextPage ? (
            <Button variant="outline" onClick={onLoadMore} loading={pending}>
              Load more
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
