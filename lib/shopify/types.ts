// Shared contracts — copied verbatim from
// docs/superpowers/plans/2026-09-06-storefront-rebuild-phase1-foundation.md ("Shared contracts").
// This file is the source of truth for every lib/shopify normaliser and storefront component.

export type Money = { amount: string; currencyCode: string }           // amount stays a decimal string
export type ShopImage = { url: string; altText: string | null; width: number | null; height: number | null }

export type ProductCardData = {
  id: string; handle: string; title: string
  availableForSale: boolean
  image: ShopImage | null
  hoverImage: ShopImage | null
  price: Money; compareAtPrice: Money | null   // compareAt only when > price
  swatches: { name: string; color: string | null }[]   // from Color option swatch or custom.color_hex
  badges: ('sale' | 'drop' | 'new' | 'soldout')[]
}

export type ProductOption = { id: string; name: string; values: { id: string; name: string; swatchColor: string | null }[] }
export type ProductVariant = {
  id: string; title: string; sku: string | null; availableForSale: boolean; quantityAvailable: number | null
  price: Money; compareAtPrice: Money | null
  selectedOptions: { name: string; value: string }[]
  image: ShopImage | null; colorHex: string | null
}
export type ProductDetail = ProductCardData & {
  descriptionHtml: string; vendor: string; productType: string; tags: string[]
  seo: { title: string | null; description: string | null }
  images: ShopImage[]; options: ProductOption[]; variants: ProductVariant[]
  materials: string | null; careGuide: string | null            // rich_text JSON → HTML via lib/shopify/rich-text.ts (Phase 2)
  drop: { start: string | null; end: string | null; maxPerOrder: number | null } | null   // null unless tags includes 'drop'
}

export type CollectionSummary = { id: string; handle: string; title: string; image: ShopImage | null; description: string | null; featured: boolean; productCount?: number }
export type FilterValue = { id: string; label: string; count: number; input: string }
export type Filter = { id: string; label: string; type: 'LIST' | 'PRICE_RANGE' | 'BOOLEAN'; values: FilterValue[] }
export type CollectionPage = {
  collection: CollectionSummary & { descriptionHtml: string }
  products: ProductCardData[]; filters: Filter[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

export type MenuItem = { id: string; title: string; url: string; items: MenuItem[] }   // url rewritten to relative path
export type ShopLayoutData = {
  name: string; description: string | null
  menu: MenuItem[]
  policies: { handle: string; title: string }[]
}
export type Policy = { handle: string; title: string; body: string }

export type SearchSuggestion = { products: ProductCardData[]; collections: CollectionSummary[] }

// Phase 2 additions
export type SearchPage = {
  products: ProductCardData[]; filters: Filter[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
  totalCount: number
}
export type SitemapEntry = { handle: string; updatedAt: string }
export type SitemapEntries = { products: SitemapEntry[]; collections: SitemapEntry[] }
