import type { Metadata } from 'next'
import { CatalogUnavailable } from '@/components/storefront/CatalogUnavailable'
import { SearchResults } from '@/components/storefront/search/SearchResults'
import { Button } from '@/components/storefront/ui/Button'
import { Input } from '@/components/storefront/ui/Input'
import { Section } from '@/components/storefront/ui/Section'
import { Display } from '@/components/storefront/ui/Typography'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getSearchResults } from '@/lib/shopify/queries'
import { parseSearchParams, toSearchString } from '@/lib/storefront/plp-params'

/** Next 16 hands pages their query string as a promise. */
type SearchParams = Record<string, string | string[] | undefined>
type SearchPageProps = { searchParams: Promise<SearchParams> }

/** Results depend entirely on `?q=`, so nothing here is worth prerendering. */
export const dynamic = 'force-dynamic'

/** Page size of the first, server-rendered page (`LoadMoreGrid` continues it). */
const PAGE_SIZE = 24

function queryOf(searchParams: SearchParams): string {
  const raw = searchParams.q
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Search result pages are never indexed (thin, infinite, query-shaped URLs) but
 * their links are still followed.
 */
export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const q = queryOf(await searchParams)
  return {
    title: q ? `Search: ${q}` : 'Search',
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams
  const { q, sort, after, filters, active } = parseSearchParams(sp)

  // No query yet: prompt rather than fetch. A plain GET form keeps this working
  // without JavaScript and reuses the same `?q=` contract as the header dialog.
  // It renders even when the store is unconfigured — submitting then shows the
  // catalog notice below.
  if (!q) {
    return (
      <Section>
        <div className="flex max-w-xl flex-col gap-6">
          <Display as="h1" size="lg">
            Search
          </Display>
          <form role="search" method="get" action="/search" className="flex items-end gap-3">
            <Input
              label="Search products"
              name="q"
              type="search"
              autoFocus
              autoComplete="off"
              placeholder="Search products and collections"
              wrapperClassName="flex-1"
            />
            <Button type="submit">Search</Button>
          </form>
        </div>
      </Section>
    )
  }

  if (!hasShopifyEnv()) {
    return <CatalogUnavailable />
  }

  const page = await getSearchResults({ q, first: PAGE_SIZE, after, filters, sort })

  return (
    <SearchResults
      q={q}
      page={page}
      ctx={{ pathname: '/search', search: toSearchString(sp) }}
      sort={sort}
      filters={filters}
      active={active}
    />
  )
}
