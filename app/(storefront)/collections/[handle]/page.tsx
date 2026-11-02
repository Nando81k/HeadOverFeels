import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getCollectionProducts } from '@/lib/shopify/queries'
import { CatalogUnavailable } from '@/components/storefront/CatalogUnavailable'
import {
  ActiveFilters,
  CollectionHeader,
  FilterRail,
  LoadMoreGrid,
  PlpToolbar,
} from '@/components/storefront/collection'
import { Section } from '@/components/storefront/ui/Section'
import { SORT_OPTIONS, parsePlpParams, toSearchString } from '@/lib/storefront/plp-params'
import type { SearchParamsLike } from '@/lib/storefront/plp-params'

/** Matches the collections index; catalog data is cached for five minutes. */
export const revalidate = 300

/** First page size — the "load more" steps use the same number. */
const PAGE_SIZE = 24

/** Meta descriptions are truncated to the length Google actually renders. */
const META_DESCRIPTION_LENGTH = 160

type CollectionPageProps = {
  params: Promise<{ handle: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Shopify `descriptionHtml` → a plain one-liner for `<meta name="description">`. */
function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { handle } = await params
  if (!hasShopifyEnv()) return { title: 'Collection' }

  // One product is enough: only the collection envelope is read here.
  const page = await getCollectionProducts({ handle, first: 1 })
  if (!page) return { title: 'Collection' }

  const description = stripHtml(page.collection.descriptionHtml).slice(0, META_DESCRIPTION_LENGTH)
  return {
    title: page.collection.title,
    ...(description ? { description } : {}),
  }
}

export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  const { handle } = await params
  const sp = await searchParams

  if (!hasShopifyEnv()) return <CatalogUnavailable />

  const { sort, after, filters, active } = parsePlpParams(sp)
  const page = await getCollectionProducts({ handle, first: PAGE_SIZE, after, filters, sort })
  if (!page) notFound()

  const ctx = {
    pathname: `/collections/${handle}`,
    search: toSearchString(sp as SearchParamsLike),
  }

  return (
    <Section>
      <div className="flex flex-col gap-8">
        <CollectionHeader
          title={page.collection.title}
          descriptionHtml={page.collection.descriptionHtml}
          image={page.collection.image}
          eyebrow="Collection"
        />

        <PlpToolbar
          sort={sort}
          sortOptions={SORT_OPTIONS}
          ctx={ctx}
          filters={page.filters}
          active={active}
        />

        <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
          <aside aria-label="Filters" className="hidden lg:block">
            <FilterRail filters={page.filters} active={active} ctx={ctx} />
          </aside>

          <div className="flex flex-col gap-6">
            <ActiveFilters filters={page.filters} active={active} ctx={ctx} />
            {/* Keyed by the query string: a filter/sort change must reset the
                accumulated pages rather than append to them. */}
            <LoadMoreGrid
              key={ctx.search}
              initialProducts={page.products}
              initialPageInfo={page.pageInfo}
              source={{ kind: 'collection', handle, filters, sort }}
              emptyMessage="Nothing matches those filters."
            />
          </div>
        </div>
      </div>
    </Section>
  )
}
