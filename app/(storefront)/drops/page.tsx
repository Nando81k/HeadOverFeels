import type { Metadata } from 'next'
import Link from 'next/link'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getCollectionProducts } from '@/lib/shopify/queries'
import type { ProductCardData } from '@/lib/shopify/types'
import { dropState, groupDrops } from '@/lib/storefront/drops'
import { CatalogUnavailable } from '@/components/storefront/CatalogUnavailable'
import { DropStatus } from '@/components/storefront/drops/DropStatus'
import { ProductGrid } from '@/components/storefront/product/ProductGrid'
import { Accordion, AccordionItem } from '@/components/storefront/ui/Accordion'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'

/** Same cadence as the rest of the catalog. */
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Drops',
  description: 'Limited runs from Head Over Feels. When they are gone, they are gone.',
}

/** The Shopify collection every drop product belongs to. */
const DROPS_HANDLE = 'drops'

/** Enough for a season of drops in one page. */
const DROPS_PAGE_SIZE = 48

/**
 * Shown both when the `drops` collection is empty and when Shopify does not
 * have one at all — an unknown handle here is a merchandising state, not a 404
 * (Phase 2 plan, route map row `/drops`).
 */
function NoDrops() {
  return (
    <div className="flex max-w-xl flex-col items-start gap-6">
      <p role="status" className="text-ink-soft">
        No drops scheduled. Join the newsletter to hear first.
      </p>
      <Button asChild variant="outline">
        <Link href="/#newsletter">Join the newsletter</Link>
      </Button>
    </div>
  )
}

function DropGroup({
  id,
  eyebrow,
  title,
  products,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  products: ProductCardData[]
  children?: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} data-drop-group={id} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        <Display as="h2" id={id} size="md">
          {title}
        </Display>
        {children}
      </div>
      <ProductGrid products={products} />
    </section>
  )
}

/**
 * The drops index (spec §5.4 row `/drops`), grouped by the state machine in
 * `lib/storefront/drops.ts`: what is live now, what is coming (with the nearest
 * countdown), and past drops folded away. Rendered from the request clock and
 * ISR-cached like the rest of the catalog; the countdown refreshes the route
 * when the next window opens.
 */
export default async function DropsPage() {
  const configured = hasShopifyEnv()
  const page = configured
    ? await getCollectionProducts({ handle: DROPS_HANDLE, first: DROPS_PAGE_SIZE })
    : null
  const products = page?.products ?? []
  const now = new Date()
  const groups = groupDrops(products, now)
  const nextUp = groups.upcoming[0] ? dropState(groups.upcoming[0].drop ?? null, now) : null

  return (
    <>
      <Section tone="ink">
        <div className="flex max-w-3xl flex-col gap-4">
          <Eyebrow className="text-bone/70">Limited runs</Eyebrow>
          <Display as="h1" size="lg">
            Drops
          </Display>
          <p className="text-bone/80">
            Small batches, made once. Sign up to get the window before it opens.
          </p>
        </div>
      </Section>

      {!configured ? (
        <CatalogUnavailable />
      ) : products.length === 0 ? (
        <Section>
          <NoDrops />
        </Section>
      ) : (
        <Section className="flex flex-col gap-16">
          {groups.live.length > 0 ? (
            <DropGroup id="drops-live" eyebrow="Live now" title="Open now" products={groups.live} />
          ) : null}

          {groups.upcoming.length > 0 ? (
            <DropGroup id="drops-upcoming" eyebrow="Coming up" title="Next drops" products={groups.upcoming}>
              {nextUp ? <DropStatus view={nextUp} className="mt-2" /> : null}
            </DropGroup>
          ) : null}

          {groups.ended.length > 0 ? (
            <Accordion>
              <AccordionItem
                title={
                  <span className="flex items-baseline gap-3">
                    <Eyebrow as="span">Archive</Eyebrow>
                    <span>Past drops ({groups.ended.length})</span>
                  </span>
                }
              >
                <div data-drop-group="drops-ended" className="pt-4">
                  <ProductGrid products={groups.ended} />
                </div>
              </AccordionItem>
            </Accordion>
          ) : null}
        </Section>
      )}
    </>
  )
}
