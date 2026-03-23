import type { Product, ProductVariant } from '@/lib/api/products'

export interface ProductManagementFinancial {
  marginPercent: number
  revenue: number
  unitsSold: number
}

export type ProductManagementStatusFilter = 'all' | 'active' | 'draft'
export type ProductManagementStockFilter = 'all' | 'low' | 'out' | 'inStock'
export type ProductManagementMarginFilter = 'all' | 'low' | 'healthy' | 'high'
export type ProductManagementSortField = 'name' | 'price' | 'inventory' | 'revenue' | 'margin' | 'unitsSold'
export type ProductManagementSortDirection = 'asc' | 'desc'
export type ProductQuickFilter = 'all' | 'active' | 'draft' | 'lowStock' | 'outOfStock'

export interface ProductManagementFilterState {
  search: string
  status: ProductManagementStatusFilter
  stock: ProductManagementStockFilter
  margin: ProductManagementMarginFilter
}

export interface ProductManagementActiveChip {
  key: 'search' | 'status' | 'stock' | 'margin'
  label: string
}

export function getProductInventory(product: Product): number {
  return product.variants.reduce((sum, variant) => sum + variant.inventory, 0)
}

export function getProductPrimaryImage(product: Product): string {
  try {
    const images = typeof product.images === 'string' ? JSON.parse(product.images) : product.images

    if (Array.isArray(images) && images.length > 0) {
      const firstImage = images[0]
      if (typeof firstImage === 'string') {
        return firstImage
      }
      if (firstImage && typeof firstImage === 'object' && 'url' in firstImage) {
        return String(firstImage.url || '/placeholder-product.jpg')
      }
    }
  } catch {
    return '/placeholder-product.jpg'
  }

  return '/placeholder-product.jpg'
}

export function filterProducts(
  products: Product[],
  financials: ReadonlyMap<string, ProductManagementFinancial>,
  filters: ProductManagementFilterState
): Product[] {
  const query = filters.search.trim().toLowerCase()

  return products.filter((product) => {
    if (query) {
      const matchesQuery = product.name.toLowerCase().includes(query) || product.slug.toLowerCase().includes(query)
      if (!matchesQuery) {
        return false
      }
    }

    if (filters.status === 'active' && !product.isActive) {
      return false
    }
    if (filters.status === 'draft' && product.isActive) {
      return false
    }

    const totalInventory = getProductInventory(product)
    if (filters.stock === 'out' && totalInventory > 0) {
      return false
    }
    if (filters.stock === 'low' && (totalInventory === 0 || totalInventory > 10)) {
      return false
    }
    if (filters.stock === 'inStock' && totalInventory <= 10) {
      return false
    }

    const financial = financials.get(product.id)
    if (filters.margin !== 'all' && financial) {
      const margin = financial.marginPercent
      if (filters.margin === 'low' && margin >= 20) {
        return false
      }
      if (filters.margin === 'healthy' && (margin < 20 || margin >= 40)) {
        return false
      }
      if (filters.margin === 'high' && margin < 40) {
        return false
      }
    }

    return true
  })
}

export function sortProducts(
  products: Product[],
  financials: ReadonlyMap<string, ProductManagementFinancial>,
  sortField: ProductManagementSortField,
  sortDirection: ProductManagementSortDirection
): Product[] {
  const direction = sortDirection === 'asc' ? 1 : -1

  return [...products].sort((a, b) => {
    const financialA = financials.get(a.id)
    const financialB = financials.get(b.id)

    switch (sortField) {
      case 'name':
        return direction * a.name.localeCompare(b.name)
      case 'price':
        return direction * (a.price - b.price)
      case 'inventory':
        return direction * (getProductInventory(a) - getProductInventory(b))
      case 'revenue':
        return direction * ((financialA?.revenue || 0) - (financialB?.revenue || 0))
      case 'margin':
        return direction * ((financialA?.marginPercent || 0) - (financialB?.marginPercent || 0))
      case 'unitsSold':
        return direction * ((financialA?.unitsSold || 0) - (financialB?.unitsSold || 0))
      default:
        return 0
    }
  })
}

export function getActiveFilterChips(filters: ProductManagementFilterState): ProductManagementActiveChip[] {
  const chips: ProductManagementActiveChip[] = []

  if (filters.search.trim()) {
    chips.push({ key: 'search', label: `Search: ${filters.search.trim()}` })
  }
  if (filters.status !== 'all') {
    chips.push({ key: 'status', label: `Status: ${filters.status}` })
  }
  if (filters.stock !== 'all') {
    chips.push({ key: 'stock', label: `Stock: ${filters.stock}` })
  }
  if (filters.margin !== 'all') {
    chips.push({ key: 'margin', label: `Margin: ${filters.margin}` })
  }

  return chips
}

export function getQuickFilterFromState(
  status: ProductManagementStatusFilter,
  stock: ProductManagementStockFilter
): ProductQuickFilter {
  if (status === 'active' && stock === 'all') {
    return 'active'
  }
  if (status === 'draft' && stock === 'all') {
    return 'draft'
  }
  if (status === 'all' && stock === 'low') {
    return 'lowStock'
  }
  if (status === 'all' && stock === 'out') {
    return 'outOfStock'
  }
  return 'all'
}

export function getStateFromQuickFilter(quickFilter: ProductQuickFilter): Pick<ProductManagementFilterState, 'status' | 'stock'> {
  switch (quickFilter) {
    case 'active':
      return { status: 'active', stock: 'all' }
    case 'draft':
      return { status: 'draft', stock: 'all' }
    case 'lowStock':
      return { status: 'all', stock: 'low' }
    case 'outOfStock':
      return { status: 'all', stock: 'out' }
    default:
      return { status: 'all', stock: 'all' }
  }
}

export function buildVariantInventoryUpdatePayload(
  variants: ProductVariant[],
  variantId: string,
  inventory: number
): ProductVariant[] {
  return variants.map((variant) =>
    variant.id === variantId
      ? {
          ...variant,
          inventory,
        }
      : variant
  )
}

export function formatVariantLabel(variant: ProductVariant): string {
  return [variant.size, variant.color].filter(Boolean).join(' / ') || 'Default'
}
