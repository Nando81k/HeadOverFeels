import * as React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getProduct } from '@/lib/shopify/queries/product'
import { getRecommendations } from '@/lib/shopify/queries/recommendations'
import type { ProductDetail } from '@/lib/shopify/types'
import { siteUrl, stripHtml, truncate } from '@/lib/storefront/seo'
import { selectVariant } from '@/lib/storefront/variants'
import { CatalogUnavailable } from '@/components/storefront/CatalogUnavailable'
import { AddToCartPanel } from '@/components/storefront/pdp/AddToCartPanel'
import { DetailsAccordion } from '@/components/storefront/pdp/DetailsAccordion'
import { Gallery } from '@/components/storefront/pdp/Gallery'
import { ProductJsonLd } from '@/components/storefront/pdp/ProductJsonLd'
import { RecommendationsRail } from '@/components/storefront/pdp/RecommendationsRail'
import { StickyBuyBar } from '@/components/storefront/pdp/StickyBuyBar'
import { VariantSelector } from '@/components/storefront/pdp/VariantSelector'
import { Container } from '@/components/storefront/ui/Container'
import { Badge } from '@/components/storefront/ui/Badge'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'

/** Catalog pages are ISR'd for five minutes (plan, route map). */
export const revalidate = 300

/** Meta descriptions are cut at the length Google renders. */
const DESCRIPTION_LENGTH = 160

/** Id of the buy-box form; the sticky mobile bar jumps to it. */
const BUY_BOX_ID = 'buy-box'

type SearchParams = Record<string, string | string[] | undefined>

export type ProductPageProps = {
  params: Promise<{ handle: string }>
  searchParams: Promise<SearchParams>
}

const DROP_DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function toDate(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "Sep 6 – Sep 12" / "From Sep 6" / "Until Sep 12"; Phase 5 adds the countdown. */
function dropWindow(drop: ProductDetail['drop']): string | null {
  if (!drop) return null
  const start = toDate(drop.start)
  const end = toDate(drop.end)

  if (start && end) return `${DROP_DATE_FORMAT.format(start)} – ${DROP_DATE_FORMAT.format(end)}`
  if (start) return `From ${DROP_DATE_FORMAT.format(start)}`
  if (end) return `Until ${DROP_DATE_FORMAT.format(end)}`
  return null
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { handle } = await params
  // No tokens: never call Shopify from metadata either — the page renders the
  // "catalog unavailable" notice, and this keeps it a 200.
  if (!hasShopifyEnv()) return { title: 'Shop' }

  const product = await getProduct(handle)
  if (!product) return { title: 'Not found' }

  const title = product.seo.title ?? product.title
  const description =
    product.seo.description ?? truncate(stripHtml(product.descriptionHtml), DESCRIPTION_LENGTH)
  const canonical = siteUrl(`/products/${handle}`)
  const image = product.images[0] ?? product.image

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title,
      description,
      url: canonical,
      images: image
        ? [
            {
              url: image.url,
              alt: image.altText ?? product.title,
              width: image.width ?? undefined,
              height: image.height ?? undefined,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image.url] : undefined,
    },
  }
}

/**
 * Product detail page (spec §5.4). Variant state is the URL
 * (`?<OptionName>=<value>`), so every option control is a link and the page
 * stays a Server Component; the only client islands are the gallery, the
 * quantity/add-to-cart form and the sticky mobile bar.
 *
 * `/drops/[handle]` re-exports this component (Phase 5 adds the drop state
 * machine on top).
 */
export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { handle } = await params
  const sp = await searchParams

  if (!hasShopifyEnv()) return <CatalogUnavailable />

  const product = await getProduct(handle)
  if (!product) notFound()

  const { selected, selectedOptions, complete } = selectVariant(product, sp)

  // Recommendations are merchandising garnish and Shopify returns them only
  // once the store has order history: a failure here must not take the PDP
  // down (the exception to cross-cutting note 5).
  const recommendations = await getRecommendations(handle).catch(() => [])

  const pathname = `/products/${product.handle}`
  const canonical = siteUrl(pathname)
  const breadcrumbs = [
    { name: 'Home', url: siteUrl('/') },
    { name: 'Shop', url: siteUrl('/collections/all') },
    { name: product.title, url: canonical },
  ]

  const galleryIndex = Math.max(
    0,
    product.images.findIndex((image) => image.url === selected?.image?.url)
  )
  const dropText = dropWindow(product.drop)
  const price = selected?.price ?? product.price

  return (
    <>
      <nav aria-label="Breadcrumb" className="border-b border-line">
        <Container>
          <ol className="flex flex-wrap items-center gap-2 py-4 text-xs text-ink-mute">
            <li>
              <Link href="/" className="hover:text-ink">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/collections/all" className="hover:text-ink">
                Shop
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-ink">
              {product.title}
            </li>
          </ol>
        </Container>
      </nav>

      <Section>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <Gallery images={product.images} title={product.title} initialIndex={galleryIndex} />

          <div className="flex flex-col gap-6 lg:sticky lg:top-24">
            <div className="flex flex-col gap-3">
              <Eyebrow>{`${product.productType || 'Shop'} · ${product.vendor}`}</Eyebrow>
              <Display as="h1" size="lg">
                {product.title}
              </Display>
              {product.badges.length > 0 || dropText ? (
                <div className="flex flex-wrap items-center gap-2">
                  {product.badges.map((badge) => (
                    <Badge key={badge} variant={badge} />
                  ))}
                  {dropText ? <span className="text-xs text-ink-mute">{dropText}</span> : null}
                </div>
              ) : null}
            </div>

            <VariantSelector
              product={product}
              selectedOptions={selectedOptions}
              pathname={pathname}
            />

            <AddToCartPanel
              product={product}
              selected={selected}
              complete={complete}
              id={BUY_BOX_ID}
            />

            <DetailsAccordion product={product} />
          </div>
        </div>
      </Section>

      <RecommendationsRail products={recommendations} />

      <StickyBuyBar
        title={product.title}
        price={price}
        compareAt={selected?.compareAtPrice ?? null}
        soldOut={Boolean(selected && !selected.availableForSale)}
        disabled
        targetId={BUY_BOX_ID}
      />

      <ProductJsonLd product={product} selected={selected} breadcrumbs={breadcrumbs} />
    </>
  )
}
