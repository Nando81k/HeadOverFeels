import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { cn } from '@/lib/storefront/cn'

/** Default headline — kept exported so pages and e2e can assert on it. */
export const CATALOG_UNAVAILABLE_TITLE = 'The shop is warming up'
export const CATALOG_UNAVAILABLE_MESSAGE =
  'Products will appear here as soon as the Shopify connection is live.'

export interface CatalogUnavailableProps {
  /** Override the headline (e.g. "No drops scheduled"). */
  title?: string
  /** One-line explanation under the headline. */
  message?: string
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
  className,
}: CatalogUnavailableProps) {
  return (
    <Section tone="bone">
      <div
        data-catalog="unconfigured"
        role="status"
        className={cn('flex max-w-[42rem] flex-col items-start gap-4', className)}
      >
        <Eyebrow>Catalog</Eyebrow>
        <Display size="md">{title}</Display>
        <p className="text-sm text-ink-soft">{message}</p>
        <Button asChild variant="outline">
          <Link href="/loyalty">Explore loyalty</Link>
        </Button>
      </div>
    </Section>
  )
}
