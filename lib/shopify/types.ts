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

// Phase 3 additions — copied verbatim from
// docs/superpowers/plans/2026-09-06-storefront-rebuild-phase3-cart.md ("Shared contracts").
export type CartLine = {
  id: string; quantity: number
  merchandise: {
    id: string; title: string; sku: string | null; availableForSale: boolean; quantityAvailable: number | null
    price: Money; compareAtPrice: Money | null
    selectedOptions: { name: string; value: string }[]
    image: ShopImage | null
    product: { id: string; handle: string; title: string; tags: string[]; featuredImage: ShopImage | null; maxPerOrder: number | null }
  }
  cost: { total: Money; perUnit: Money; compareAtPerUnit: Money | null }
  discount: Money | null                         // sum of line discountAllocations, null when none
  attributes: { key: string; value: string }[]
}
export type Cart = {
  id: string; checkoutUrl: string; totalQuantity: number; note: string | null
  lines: CartLine[]
  discountCodes: { code: string; applicable: boolean }[]
  cost: { subtotal: Money; total: Money; discount: Money | null }   // discount = sum of cart-level discountAllocations
  buyer: { email: string | null; customerId: string | null }
}
export type CartActionResult =
  | { ok: true; cart: Cart; warning?: string }
  | { ok: false; error: string; code?: string; cart?: Cart }

// Phase 4 additions — copied verbatim from
// docs/superpowers/plans/2026-09-06-storefront-rebuild-phase4-accounts.md ("Shared contracts").
export type CustomerSummary = { id: string; email: string; firstName: string | null; lastName: string | null; displayName: string; phone: string | null; defaultAddress: CustomerAddress | null }
export type CustomerAddress = { id: string; firstName: string | null; lastName: string | null; company: string | null; address1: string | null; address2: string | null; city: string | null; zoneCode: string | null; territoryCode: string | null; zip: string | null; phone: string | null; formatted: string[]; isDefault: boolean }
export type CustomerAddressInput = Omit<CustomerAddress, 'id' | 'formatted' | 'isDefault'> & { defaultAddress?: boolean }
export type CustomerOrderCard = { id: string; name: string; number: number; processedAt: string; financialStatus: string | null; fulfillmentStatus: 'UNFULFILLED' | 'IN_PROGRESS' | 'FULFILLED' | 'CANCELLED' | 'UNKNOWN'; total: Money; lineItems: { id: string; title: string; quantity: number; image: ShopImage | null }[]; statusPageUrl: string | null }
export type CustomerOrder = CustomerOrderCard & { subtotal: Money | null; shipping: Money | null; tax: Money | null; cancelledAt: string | null; shippingAddress: string[] | null; discounts: { amount: Money | null; percentage: number | null }[]; lines: { id: string; title: string; variantTitle: string | null; quantity: number; image: ShopImage | null; unitPrice: Money | null; total: Money | null }[]; fulfillments: { id: string; status: string; createdAt: string; tracking: { number: string | null; company: string | null; url: string | null }[] }[] }
export type CustomerOrdersPage = { orders: CustomerOrderCard[]; hasNextPage: boolean; endCursor: string | null }
export type AccountActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code?: string }
export type LoyaltyActionResult<T = undefined> = AccountActionResult<T>
export type WishlistActionResult = { ok: true; entries: WishlistEntry[] } | { ok: false; error: string }
export type WishlistEntry = { variantId: string; productHandle: string; addedAt: string }
