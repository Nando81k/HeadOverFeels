import type { Product } from '@/lib/api/products'

function normalizeProductsPayload(payload: unknown): Product[] {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const maybePaginated = payload as { data?: unknown; products?: unknown }

  if (Array.isArray(maybePaginated.data)) {
    return maybePaginated.data as Product[]
  }

  if (Array.isArray(maybePaginated.products)) {
    return maybePaginated.products as Product[]
  }

  return []
}

async function fetchProductsFromQuery(query: string): Promise<Product[]> {
  const response = await fetch(`/api/products?${query}`)
  if (!response.ok) {
    return []
  }

  const payload = await response.json().catch(() => null)
  return normalizeProductsPayload(payload)
}

export async function fetchSmartDiscoveryProducts(
  excludeProductIds: string[],
  limit = 8
): Promise<Product[]> {
  const excluded = new Set(excludeProductIds)
  const featured = await fetchProductsFromQuery('isActive=true&isFeatured=true&limit=16')

  const deduped: Product[] = []
  const seen = new Set<string>()

  const pushIfEligible = (product: Product) => {
    if (!product?.id || !product.isActive) {
      return
    }

    if (excluded.has(product.id) || seen.has(product.id)) {
      return
    }

    seen.add(product.id)
    deduped.push(product)
  }

  featured.forEach(pushIfEligible)

  if (deduped.length < limit) {
    const fallback = await fetchProductsFromQuery('isActive=true&limit=24')
    fallback.forEach(pushIfEligible)
  }

  return deduped.slice(0, limit)
}
