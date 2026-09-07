import * as React from 'react'
import Link from 'next/link'
import { richTextToHtml } from '@/lib/shopify/rich-text'
import type { ProductDetail } from '@/lib/shopify/types'
import { Accordion, AccordionItem } from '@/components/storefront/ui/Accordion'
import { Prose } from '@/components/storefront/ui/Typography'

export interface DetailsAccordionProps {
  product: ProductDetail
}

/**
 * PDP details rows (spec §5.4): description, the two rich-text metafields when
 * the merchandiser filled them in, and the shipping/returns pointer at the
 * Shopify policies.
 *
 * Server-safe — `Accordion` is `<details>`, so no client state is involved.
 */
export function DetailsAccordion({ product }: DetailsAccordionProps) {
  const materials = richTextToHtml(product.materials)
  const care = richTextToHtml(product.careGuide)

  return (
    <Accordion>
      <AccordionItem title="Description" defaultOpen>
        <Prose html={product.descriptionHtml} />
      </AccordionItem>

      {materials ? (
        <AccordionItem title="Materials">
          <Prose html={materials} />
        </AccordionItem>
      ) : null}

      {care ? (
        <AccordionItem title="Care">
          <Prose html={care} />
        </AccordionItem>
      ) : null}

      <AccordionItem title="Shipping & returns">
        <Prose>
          <p>
            Orders ship from the US within 1–2 business days. Free standard shipping over $75;
            tracking follows by email as soon as the label prints.
          </p>
          <p>
            Unworn pieces can go back within 30 days. See{' '}
            <Link href="/policies/shipping-policy">shipping policy</Link> and{' '}
            <Link href="/policies/refund-policy">refund policy</Link>.
          </p>
        </Prose>
      </AccordionItem>
    </Accordion>
  )
}
