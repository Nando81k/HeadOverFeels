import * as React from 'react'
import type { ProductDetail, ProductVariant } from '@/lib/shopify/types'
import { breadcrumbJsonLd, jsonLdScriptProps, productJsonLd } from '@/lib/storefront/seo'

export interface ProductJsonLdProps {
  product: ProductDetail
  /** The variant the URL resolves to; its price and availability go in the Offer. */
  selected: ProductVariant | null
  /** Absolute breadcrumb trail, ending at this product. */
  breadcrumbs: { name: string; url: string }[]
}

/**
 * Structured data for the PDP: `Product` (with the selected `Offer`) and the
 * `BreadcrumbList`. Server-safe; the payloads are escaped in `jsonLdScriptProps`.
 */
export function ProductJsonLd({ product, selected, breadcrumbs }: ProductJsonLdProps) {
  return (
    <>
      <script {...jsonLdScriptProps(productJsonLd(product, selected))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd(breadcrumbs))} />
    </>
  )
}
