import type { Metadata } from 'next'
import { CatalogUnavailable } from '@/components/storefront/CatalogUnavailable'
import { CollectionTiles } from '@/components/storefront/home/CollectionTiles'
import { DropSpotlight } from '@/components/storefront/home/DropSpotlight'
import { Editorial } from '@/components/storefront/home/Editorial'
import { Hero } from '@/components/storefront/home/Hero'
import { NewsletterSection } from '@/components/storefront/home/NewsletterSection'
import { ProductRail } from '@/components/storefront/home/ProductRail'
import { Marquee } from '@/components/storefront/ui/Marquee'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { dropState, formatDropDate, groupDrops } from '@/lib/storefront/drops'
import { getHomeData } from '@/lib/storefront/home-data'
import { FREE_SHIPPING_COPY } from '@/lib/storefront/shipping'

/** Catalog freshness for the home page (Phase 2 plan, route map row `/`). */
export const revalidate = 300

export const metadata: Metadata = {
  // `absolute` opts out of the layout's `%s · Head Over Feels` template — the
  // home title carries the brand itself.
  title: { absolute: 'Head Over Feels — Premium streetwear' },
  description:
    'Heavyweight fleece, honest fits, small runs. Shop new arrivals, drops and best sellers, and earn Care Points on every order.',
}

/** Promo ticker copy. Exported so the tests and e2e assert on one source. */
export const HOME_MARQUEE_DEFAULT = `${FREE_SHIPPING_COPY} · Earn Care Points on every order`
export const HOME_MARQUEE_DROP = 'Drop live — shop now'
/** Marquee copy while the next drop is still counting down. */
export const homeMarqueeUpcoming = (start: Date | null) =>
  start ? `Drop opens ${formatDropDate(start)} — early access for members` : 'Drop coming soon'

/**
 * Storefront home (design spec §5.4 row `/`).
 *
 * Two shapes, one page: with no Storefront credentials it is hero → promo →
 * `CatalogUnavailable` → brand story → newsletter, HTTP 200 and no fetch at all
 * (Phase 2 plan, cross-cutting note 5); with credentials the merchandising
 * blocks slot in between, each one rendering nothing when its collection came
 * back empty.
 */
export default async function HomePage() {
  if (!hasShopifyEnv()) {
    return (
      <>
        <Hero />
        <Marquee>
          <span>{HOME_MARQUEE_DEFAULT}</span>
        </Marquee>
        <CatalogUnavailable />
        <Editorial />
        <NewsletterSection />
      </>
    )
  }

  const data = await getHomeData()

  // The spotlight shows the live drop, else the next upcoming one (Phase 5).
  const now = new Date()
  const groups = groupDrops(data.drops, now)
  const spotlight = groups.live.length > 0 ? groups.live : groups.upcoming
  const spotlightView = spotlight[0] ? dropState(spotlight[0].drop ?? null, now) : null
  const liveDrop = groups.live.length > 0
  const marquee = liveDrop
    ? HOME_MARQUEE_DROP
    : spotlightView?.state === 'upcoming'
      ? homeMarqueeUpcoming(spotlightView.start)
      : HOME_MARQUEE_DEFAULT

  return (
    <>
      <Hero />

      <Marquee>
        <span>{marquee}</span>
      </Marquee>

      <CollectionTiles collections={data.featuredCollections} />

      <ProductRail
        title="New in"
        href="/collections/all?sort=newest"
        eyebrow="Just landed"
        products={data.newIn}
      />

      <DropSpotlight products={spotlight} view={spotlightView} />

      <ProductRail title="Best sellers" href="/collections/best-sellers" products={data.bestSellers} />

      <Editorial />

      <NewsletterSection />
    </>
  )
}
