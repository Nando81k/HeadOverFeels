import * as React from 'react'
import Link from 'next/link'
import { Reveal } from '@/components/storefront/motion/Reveal'
import { Button } from '@/components/storefront/ui/Button'
import {
  PLACEHOLDER_SHAPES,
  ProductPlaceholder,
} from '@/components/storefront/ui/ProductPlaceholder'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { cn } from '@/lib/storefront/cn'

/** Default headline — kept exported so pages and e2e can assert on it. */
export const CATALOG_UNAVAILABLE_TITLE = 'The shop is warming up'
export const CATALOG_UNAVAILABLE_MESSAGE =
  'Products will appear here as soon as the Shopify connection is live.'

/** Captions under the preview tiles — the catalog's shape before it has products. */
const PREVIEW_TILES = [
  { shape: 'hoodie', label: 'Heavyweight hoodie' },
  { shape: 'tee', label: 'Boxy tee' },
  { shape: 'crewneck', label: 'Crewneck' },
  { shape: 'cap', label: 'Six-panel cap' },
  { shape: 'tote', label: 'Canvas tote' },
] as const satisfies readonly { shape: (typeof PLACEHOLDER_SHAPES)[number]; label: string }[]

export interface CatalogUnavailableProps {
  /** Override the headline (e.g. "No drops scheduled"). */
  title?: string
  /** One-line explanation under the headline. */
  message?: string
  /** Show the placeholder lookbook strip under the notice. Defaults to on. */
  preview?: boolean
  className?: string
}

/**
 * What every catalog route renders when the store has no Storefront
 * credentials (`hasShopifyEnv()` false): a calm, HTTP-200 notice instead of a
 * thrown `ShopifyError` (Phase 2 plan, cross-cutting note 5).
 *
 * Server-safe — no state, no handlers — so it costs nothing in the client
 * bundle. `data-catalog="unconfigured"` is the hook e2e uses to accept a page
 * that has chrome but no products.
 */
export function CatalogUnavailable({
  title = CATALOG_UNAVAILABLE_TITLE,
  message = CATALOG_UNAVAILABLE_MESSAGE,
  preview = true,
  className,
}: CatalogUnavailableProps) {
  return (
    <Section tone="bone">
      <div
        data-catalog="unconfigured"
        role="status"
        className={cn('sf-stagger flex max-w-[42rem] flex-col items-start gap-4', className)}
      >
        <Eyebrow>Catalog</Eyebrow>
        <Display size="md">{title}</Display>
        <p className="text-sm text-ink-soft">{message}</p>
        <Button asChild variant="outline">
          <Link href="/loyalty">Explore loyalty</Link>
        </Button>
      </div>

      {preview ? (
        // Placeholder lookbook: the silhouettes products will take, so an
        // unconfigured preview still shows the page's rhythm. Decorative —
        // no links, no product markup, so e2e never mistakes it for catalog.
        <ul
          data-catalog-preview=""
          aria-hidden="true"
          className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-5"
        >
          {PREVIEW_TILES.map((tile, index) => (
            <Reveal as="li" key={tile.shape} delay={index * 70} className="group flex flex-col gap-3">
              <div className="relative aspect-[4/5] overflow-hidden rounded-sharp border border-line transition-transform duration-sf-slow ease-sf-out motion-safe:group-hover:-translate-y-1">
                <ProductPlaceholder
                  seed={tile.shape}
                  shape={tile.shape}
                  tone={index % 2 ? 'rose' : 'paper'}
                  className="transition-transform duration-[900ms] ease-sf-out motion-safe:group-hover:scale-[1.06]"
                />
              </div>
              <span className="text-sm font-medium text-ink">{tile.label}</span>
              <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-ink-mute">
                Coming soon
              </span>
            </Reveal>
          ))}
        </ul>
      ) : null}
    </Section>
  )
}
