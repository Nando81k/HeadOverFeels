import * as React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { addCartLineForm } from '@/app/(storefront)/_actions/cart'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getProduct } from '@/lib/shopify/queries/product'
import { getRecommendations } from '@/lib/shopify/queries/recommendations'
import { dropState, isDropOpen, lockedButtonLabel } from '@/lib/storefront/drops'
import { getReviewSummary, listReviews } from '@/lib/storefront/reviews'
import { siteUrl, stripHtml, truncate } from '@/lib/storefront/seo'
import { selectVariant } from '@/lib/storefront/variants'
import { CatalogUnavailable } from '@/components/storefront/CatalogUnavailable'
import { DropStatus } from '@/components/storefront/drops/DropStatus'
import { EarlyAccessGate } from '@/components/storefront/drops/EarlyAccessGate'
import { AddToCartPanel } from '@/components/storefront/pdp/AddToCartPanel'
import { DetailsAccordion } from '@/components/storefront/pdp/DetailsAccordion'
import { Gallery } from '@/components/storefront/pdp/Gallery'
import { ProductJsonLd } from '@/components/storefront/pdp/ProductJsonLd'
import { RecommendationsRail } from '@/components/storefront/pdp/RecommendationsRail'
import { ReviewsSection, REVIEWS_SECTION_ID } from '@/components/storefront/reviews/ReviewsSection'
import { Stars } from '@/components/storefront/reviews/Stars'
import { StickyBuyBar } from '@/components/storefront/pdp/StickyBuyBar'
import { ViewItem } from '@/components/storefront/pdp/ViewItem'
import { VariantSelector } from '@/components/storefront/pdp/VariantSelector'
import { Container } from '@/components/storefront/ui/Container'
import { Badge } from '@/components/storefront/ui/Badge'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'

/** Catalog pages are ISR'd for five minutes (plan, route map). */
export const revalidate = 300

/** Meta descriptions are cut at the length Google renders. */
const DESCRIPTION_LENGTH = 160

/** Id of the buy-box form; the sticky mobile bar submits it. */
const BUY_BOX_ID = 'buy-box'

/**
 * No-JS fallback for the buy box: a plain form post adds the line through the
 * same action the cart provider uses. With JS the provider intercepts the
 * submit (`AddToCartPanel`), so this only runs before hydration or without JS.
 */
async function addCartLineFormAction(formData: FormData) {
  'use server'
  await addCartLineForm(null, formData)
  // No-JS fallback: without the provider there is no drawer to open, so the
  // cart page is the confirmation (it also surfaces a failed add as an empty cart).
  redirect('/cart')
}

type SearchParams = Record<string, string | string[] | undefined>

export type ProductPageProps = {
  params: Promise<{ handle: string }>
  searchParams: Promise<SearchParams>
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
 * `/drops/[handle]` re-exports this component. A product tagged `drop` carries
 * the drop state machine (Phase 5, `lib/storefront/drops.ts`): the page renders
 * the **time-based** state from the request clock (this route is ISR, so it
 * cannot know who is looking), and while the drop is upcoming the buy box sits
 * inside `EarlyAccessGate`, which unlocks after mount for a signed-in customer
 * with early access. `addCartLine` re-checks on the server either way.
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
  const [recommendations, reviewSummary, reviewPage] = await Promise.all([
    getRecommendations(handle).catch(() => []),
    // Reviews live in Postgres, not Shopify; both reads degrade to "none".
    getReviewSummary(product.handle),
    listReviews(product.handle),
  ])

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
  const drop = dropState(product.drop, new Date(), false)
  const locked = drop && !isDropOpen(drop) ? { label: lockedButtonLabel(drop) } : null
  const price = selected?.price ?? product.price

  const buyBox = (lock: { label: string } | null) => (
    <>
      <AddToCartPanel
        product={product}
        selected={selected}
        complete={complete}
        action={addCartLineFormAction}
        id={BUY_BOX_ID}
        locked={lock}
      />
      <StickyBuyBar
        title={product.title}
        price={price}
        compareAt={selected?.compareAtPrice ?? null}
        soldOut={Boolean(selected && !selected.availableForSale)}
        disabled={!complete || !selected}
        targetId={BUY_BOX_ID}
        locked={lock}
      />
    </>
  )

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
          <div className="sf-fade">
            <Gallery images={product.images} title={product.title} initialIndex={galleryIndex} />
          </div>

          <div className="sf-stagger flex flex-col gap-6 lg:sticky lg:top-24">
            <div className="flex flex-col gap-3">
              <Eyebrow>{`${product.productType || 'Shop'} · ${product.vendor}`}</Eyebrow>
              <Display as="h1" size="lg">
                {product.title}
              </Display>
              {product.badges.filter((badge) => !drop || badge !== 'drop').length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {product.badges
                    .filter((badge) => !drop || badge !== 'drop')
                    .map((badge) => (
                      <Badge key={badge} variant={badge} />
                    ))}
                </div>
              ) : null}
              {reviewSummary.count > 0 ? (
                <Link
                  href={`#${REVIEWS_SECTION_ID}`}
                  data-rating-link=""
                  className="inline-flex items-center gap-2 text-xs text-ink-soft hover:text-ink"
                >
                  <Stars rating={reviewSummary.average} size="sm" />
                  <span>
                    <span className="num">{reviewSummary.average.toFixed(1)}</span>
                    {' ('}
                    <span className="num">{reviewSummary.count}</span>
                    {')'}
                  </span>
                </Link>
              ) : null}
              {drop ? <DropStatus view={drop} /> : null}
            </div>

            <VariantSelector
              product={product}
              selectedOptions={selectedOptions}
              pathname={pathname}
            />

            {drop?.state === 'upcoming' ? (
              <EarlyAccessGate handle={product.handle} returnTo={pathname}>
                {(isLocked) => buyBox(isLocked ? locked : null)}
              </EarlyAccessGate>
            ) : (
              buyBox(locked)
            )}

            <DetailsAccordion product={product} />
          </div>
        </div>
      </Section>

      <ReviewsSection
        handle={product.handle}
        productTitle={product.title}
        summary={reviewSummary}
        page={reviewPage}
      />

      <RecommendationsRail products={recommendations} />

      <ViewItem
        handle={product.handle}
        title={product.title}
        price={price}
        variantId={selected?.id ?? null}
        dropState={drop?.state ?? null}
      />

      <ProductJsonLd product={product} selected={selected} breadcrumbs={breadcrumbs} rating={reviewSummary} />
    </>
  )
}
