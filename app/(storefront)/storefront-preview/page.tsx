import { notFound } from 'next/navigation'
import { Heart, Search, ShoppingBag } from 'lucide-react'
import { ProductGrid } from '@/components/storefront/product/ProductGrid'
import { Accordion, AccordionItem } from '@/components/storefront/ui/Accordion'
import { Badge } from '@/components/storefront/ui/Badge'
import { Button } from '@/components/storefront/ui/Button'
import { Checkbox } from '@/components/storefront/ui/Checkbox'
import { IconButton } from '@/components/storefront/ui/IconButton'
import { Input } from '@/components/storefront/ui/Input'
import { Marquee } from '@/components/storefront/ui/Marquee'
import { Price } from '@/components/storefront/ui/Price'
import { Section } from '@/components/storefront/ui/Section'
import { Select } from '@/components/storefront/ui/Select'
import { Skeleton, SkeletonText } from '@/components/storefront/ui/Skeleton'
import { Display, Eyebrow, Prose } from '@/components/storefront/ui/Typography'
import { getCollectionProducts } from '@/lib/shopify/queries/collection'
import type { Money } from '@/lib/shopify/types'
import { PreviewDialog, PreviewDrawer, PreviewStepper } from './_islands'

/**
 * Kitchen-sink QA route for the storefront primitives (Phase 1, Task 14).
 *
 * Lives at `/storefront-preview`, not the plan's `_preview`: Next treats a
 * `_`-prefixed folder as private, so that path is unroutable. Phase 2 deletes
 * this route.
 *
 * It fetches Shopify per request, so it must never be prerendered at build time
 * (there are no store credentials in CI).
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Storefront preview — Head Over Feels',
  robots: { index: false, follow: false },
}

const PRICE: Money = { amount: '48.00', currencyCode: 'USD' }
const SALE_PRICE: Money = { amount: '36.00', currencyCode: 'USD' }
const COMPARE_AT: Money = { amount: '48.00', currencyCode: 'USD' }

function Swatch({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`h-16 rounded-sharp border border-line ${className}`} />
      <span className="text-[11px] tracking-eyebrow uppercase text-ink-mute">{label}</span>
    </div>
  )
}

export default async function StorefrontPreviewPage() {
  if (process.env.NODE_ENV === 'production' && process.env.STOREFRONT_PREVIEW !== '1') {
    notFound()
  }

  const page = await getCollectionProducts({ handle: 'all', first: 8 }).catch(() => null)

  return (
    <>
      <Marquee tone="signal" speed="normal">
        <span>Drop 01 — Sep 20 · Limited run · Early access for Gold</span>
      </Marquee>

      <Section tone="bone">
        <Eyebrow>Phase 1 · Task 14</Eyebrow>
        <Display size="xl" className="mt-4">
          Storefront preview
        </Display>
        <Prose className="mt-6 max-w-2xl">
          <p>
            Every primitive in <code>components/storefront/ui</code>, the product grid, and the
            header/footer shell around them. Nothing here ships to customers — Phase 2 replaces this
            route with the real catalog pages.
          </p>
        </Prose>
      </Section>

      <Section tone="paper" aria-labelledby="preview-type">
        <Eyebrow id="preview-type">Typography</Eyebrow>
        <div className="mt-6 flex flex-col gap-6">
          <Display as="h2" size="lg">
            Display large
          </Display>
          <Display as="h3" size="md">
            Display medium
          </Display>
          <Prose className="max-w-2xl">
            <p>
              Body copy in Inter. <strong>Strong</strong> and <a href="#preview-type">a link</a>{' '}
              inside a paragraph, then a list:
            </p>
            <ul>
              <li>Heavyweight cotton, garment dyed</li>
              <li>Boxy fit, dropped shoulder</li>
            </ul>
          </Prose>
        </div>
      </Section>

      <Section tone="bone" aria-labelledby="preview-colour">
        <Eyebrow id="preview-colour">Colour</Eyebrow>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          <Swatch label="ink" className="bg-ink" />
          <Swatch label="ink-soft" className="bg-ink-soft" />
          <Swatch label="ink-mute" className="bg-ink-mute" />
          <Swatch label="bone" className="bg-bone" />
          <Swatch label="paper" className="bg-paper" />
          <Swatch label="signal" className="bg-signal" />
          <Swatch label="rose" className="bg-rose" />
        </div>
      </Section>

      <Section tone="paper" aria-labelledby="preview-buttons">
        <Eyebrow id="preview-buttons">Buttons</Eyebrow>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="ink">Ink</Button>
          <Button variant="signal">Signal</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <IconButton label="Search preview">
            <Search aria-hidden="true" className="size-5" />
          </IconButton>
          <IconButton label="Save to wishlist" variant="outline">
            <Heart aria-hidden="true" className="size-5" />
          </IconButton>
          <IconButton label="Open bag" variant="ink">
            <ShoppingBag aria-hidden="true" className="size-5" />
          </IconButton>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PreviewDrawer />
          <PreviewDialog />
        </div>
      </Section>

      <Section tone="bone" aria-labelledby="preview-merch">
        <Eyebrow id="preview-merch">Badges & price</Eyebrow>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Badge variant="sale" />
          <Badge variant="drop" />
          <Badge variant="new" />
          <Badge variant="soldout" />
          <Badge variant="neutral">Restocked</Badge>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-8">
          <Price amount={PRICE} size="lg" />
          <Price amount={SALE_PRICE} compareAt={COMPARE_AT} size="lg" />
        </div>
      </Section>

      <Section tone="paper" aria-labelledby="preview-forms">
        <Eyebrow id="preview-forms">Forms</Eyebrow>
        <div className="mt-6 grid max-w-3xl gap-6 sm:grid-cols-2">
          <Input label="Email" type="email" name="preview-email" placeholder="you@example.com" />
          <Input
            label="Postcode"
            name="preview-postcode"
            defaultValue="0000"
            error="Enter a valid US ZIP code."
          />
          <Select
            label="Size"
            name="preview-size"
            defaultValue="m"
            options={[
              { value: 's', label: 'Small' },
              { value: 'm', label: 'Medium' },
              { value: 'l', label: 'Large' },
              { value: 'xl', label: 'X-Large — sold out', disabled: true },
            ]}
          />
          <div className="flex flex-col justify-end gap-4">
            <Checkbox label="Email me when this drops" name="preview-notify" />
            <PreviewStepper />
          </div>
        </div>
      </Section>

      <Section tone="bone" aria-labelledby="preview-accordion">
        <Eyebrow id="preview-accordion">Accordion</Eyebrow>
        <div className="mt-6 max-w-2xl">
          <Accordion name="preview-accordion-group">
            <AccordionItem title="Materials" defaultOpen>
              <p>14oz cotton fleece, garment dyed in small batches.</p>
            </AccordionItem>
            <AccordionItem title="Care">
              <p>Cold wash inside out. Hang dry. Do not tumble.</p>
            </AccordionItem>
            <AccordionItem title="Shipping & returns">
              <p>Free US shipping over $75. 30-day returns on unworn items.</p>
            </AccordionItem>
          </Accordion>
        </div>
      </Section>

      <Section tone="paper" aria-labelledby="preview-skeletons">
        <Eyebrow id="preview-skeletons">Skeletons</Eyebrow>
        <div className="mt-6 grid max-w-3xl gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Skeleton className="aspect-[4/5] w-full" />
            <SkeletonText lines={2} />
          </div>
          <SkeletonText lines={5} />
        </div>
      </Section>

      <Section tone="bone" aria-labelledby="preview-grid">
        <Eyebrow id="preview-grid">Product grid</Eyebrow>
        <Display as="h2" size="md" className="mt-3">
          All products
        </Display>
        <div className="mt-8">
          <ProductGrid
            products={page?.products ?? []}
            columns={4}
            emptyMessage={
              page
                ? 'The `all` collection came back empty.'
                : 'Shopify is unreachable from this environment — grid rendered empty.'
            }
          />
        </div>
      </Section>
    </>
  )
}
