import * as React from 'react'
import Link from 'next/link'
import {
  ActiveFilters,
  FilterRail,
  LoadMoreGrid,
  PlpToolbar,
} from '@/components/storefront/collection'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display } from '@/components/storefront/ui/Typography'
import type { ActiveFilter, ProductFilter } from '@/lib/shopify/filters'
import type { SearchSort } from '@/lib/shopify/queries'
import type { SearchPage } from '@/lib/shopify/types'
import { SEARCH_SORT_OPTIONS, type PlpContext } from '@/lib/storefront/plp-params'

export interface SearchResultsProps {
  /** The trimmed query the page searched for. */
  q: string
  /** First page of results, already normalised by `getSearchResults`. */
  page: SearchPage
  /** Pathname + search string the toolbar and filter links build hrefs from. */
  ctx: PlpContext
  sort: SearchSort
  /** Parsed Shopify filters — handed to the load-more island, not rendered. */
  filters: ProductFilter[]
  /** Active URL filters, used to mark rail checkboxes and render the chips. */
  active: ActiveFilter[]
}

/**
 * `/search` results surface: the same toolbar / rail / grid arrangement as a
 * collection PLP, with a query-scoped heading and count.
 *
 * Server-safe — every interactive part (`PlpToolbar`, `LoadMoreGrid`) is its
 * own client island from `components/storefront/collection`.
 */
export function SearchResults({
  q,
  page,
  ctx,
  sort,
  filters,
  active,
}: SearchResultsProps) {
  const total = page.totalCount
  const hasResults = page.products.length > 0

  return (
    <Section>
      <header className="flex flex-col gap-3">
        <Display as="h1" size="lg">
          Search
        </Display>
        <p className="text-ink-soft">
          <span className="num">{total}</span> {total === 1 ? 'result' : 'results'} for{' '}
          &ldquo;{q}&rdquo;
        </p>
      </header>

      {hasResults ? (
        <>
          <div className="mt-8">
            <PlpToolbar
              total={total}
              noun="results"
              sort={sort}
              sortOptions={SEARCH_SORT_OPTIONS}
              ctx={ctx}
              filters={page.filters}
              active={active}
            />
          </div>

          <div className="mt-8 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
            <aside className="hidden lg:block">
              <FilterRail filters={page.filters} active={active} ctx={ctx} />
            </aside>
            <div>
              <ActiveFilters filters={page.filters} active={active} ctx={ctx} />
              <LoadMoreGrid
                key={ctx.search}
                initialProducts={page.products}
                initialPageInfo={page.pageInfo}
                source={{ kind: 'search', q, filters, sort }}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="mt-8 flex flex-col items-start gap-6">
          <p role="status" className="text-ink-soft">
            No results for &ldquo;{q}&rdquo;. Try another search or browse all products.
          </p>
          <Button asChild variant="outline">
            <Link href="/collections/all">Shop all</Link>
          </Button>
        </div>
      )}
    </Section>
  )
}
