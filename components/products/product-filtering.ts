import { Product, ProductVariant } from '@/lib/api/products'

export type ProductSortBy = 'newest' | 'price-asc' | 'price-desc' | 'name'

export interface FilterState {
  search: string
  priceRange: [number, number]
  sizes: string[]
  colors: string[]
  inStockOnly: boolean
  sortBy: ProductSortBy
}

export interface PriceBounds {
  min: number
  max: number
}

export interface ColorOption {
  key: string
  label: string
  hex: string | null
  count: number
}

const MANAGED_QUERY_KEYS = [
  'search',
  'sizes',
  'colors',
  'minPrice',
  'maxPrice',
  'inStock',
  'sortBy',
]

const SORT_OPTIONS: ProductSortBy[] = ['newest', 'price-asc', 'price-desc', 'name']
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normalizeSize(size: string): string {
  return size.trim().toUpperCase()
}

function normalizeColorToken(token: string): string {
  return token.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseCsvParam(value: string | null): string[] {
  if (!value) {
    return []
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function sortSizes(a: string, b: string): number {
  const aIndex = SIZE_ORDER.indexOf(a)
  const bIndex = SIZE_ORDER.indexOf(b)

  if (aIndex !== -1 && bIndex !== -1) {
    return aIndex - bIndex
  }
  if (aIndex !== -1) {
    return -1
  }
  if (bIndex !== -1) {
    return 1
  }
  return a.localeCompare(b)
}

function getColorKeyFromVariant(variant: ProductVariant): string | null {
  if (variant.color && variant.color.trim()) {
    return normalizeColorToken(variant.color)
  }
  if (variant.colorHex && variant.colorHex.trim()) {
    return normalizeColorToken(variant.colorHex)
  }
  return null
}

function getVariantSizeKey(variant: ProductVariant): string | null {
  if (!variant.size || !variant.size.trim()) {
    return null
  }
  return normalizeSize(variant.size)
}

function isVariantInStock(variant: ProductVariant): boolean {
  return variant.inventory > 0
}

function variantMatchesFacetFilters(
  variant: ProductVariant,
  selectedSizeSet: Set<string>,
  selectedColorSet: Set<string>,
  inStockOnly: boolean
): boolean {
  const sizeKey = getVariantSizeKey(variant)
  const colorKey = getColorKeyFromVariant(variant)

  const sizeMatches =
    selectedSizeSet.size === 0 || (sizeKey !== null && selectedSizeSet.has(sizeKey))
  const colorMatches =
    selectedColorSet.size === 0 || (colorKey !== null && selectedColorSet.has(colorKey))
  const stockMatches = !inStockOnly || isVariantInStock(variant)

  return sizeMatches && colorMatches && stockMatches
}

export function getPriceBounds(products: Product[]): PriceBounds {
  const prices = products
    .map((product) => product.price)
    .filter((price) => Number.isFinite(price))

  if (prices.length === 0) {
    return { min: 0, max: 500 }
  }

  const min = Math.floor(Math.min(...prices))
  const max = Math.ceil(Math.max(...prices))
  if (min === max) {
    return { min: Math.max(0, min - 10), max: max + 10 }
  }
  return { min, max }
}

export function getDefaultFilterState(bounds: PriceBounds): FilterState {
  return {
    search: '',
    priceRange: [bounds.min, bounds.max],
    sizes: [],
    colors: [],
    inStockOnly: false,
    sortBy: 'newest',
  }
}

export function parseFilterStateFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'>,
  bounds: PriceBounds
): FilterState {
  const defaultState = getDefaultFilterState(bounds)

  const rawSearch = searchParams.get('search') || ''
  const parsedSearch = rawSearch.trim()

  const parsedSizes = parseCsvParam(searchParams.get('sizes'))
    .map(normalizeSize)
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort(sortSizes)

  const parsedColors = parseCsvParam(searchParams.get('colors'))
    .map(normalizeColorToken)
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b))

  const minPriceParam = searchParams.get('minPrice')
  const maxPriceParam = searchParams.get('maxPrice')
  const rawMinPrice = minPriceParam === null ? NaN : Number(minPriceParam)
  const rawMaxPrice = maxPriceParam === null ? NaN : Number(maxPriceParam)

  const hasValidMin = Number.isFinite(rawMinPrice)
  const hasValidMax = Number.isFinite(rawMaxPrice)
  const parsedMin = hasValidMin ? clamp(rawMinPrice, bounds.min, bounds.max) : bounds.min
  const parsedMax = hasValidMax ? clamp(rawMaxPrice, bounds.min, bounds.max) : bounds.max

  const rangeMin = Math.min(parsedMin, parsedMax)
  const rangeMax = Math.max(parsedMin, parsedMax)

  const rawSort = (searchParams.get('sortBy') || '').trim() as ProductSortBy
  const sortBy = SORT_OPTIONS.includes(rawSort) ? rawSort : defaultState.sortBy

  return {
    search: parsedSearch,
    priceRange: [rangeMin, rangeMax],
    sizes: parsedSizes,
    colors: parsedColors,
    inStockOnly: searchParams.get('inStock') === 'true',
    sortBy,
  }
}

export function serializeFilterStateToSearchParams(
  existingSearchParams: URLSearchParams,
  filters: FilterState,
  bounds: PriceBounds
): URLSearchParams {
  const next = new URLSearchParams(existingSearchParams.toString())
  const defaults = getDefaultFilterState(bounds)

  MANAGED_QUERY_KEYS.forEach((key) => next.delete(key))

  const trimmedSearch = filters.search.trim()
  if (trimmedSearch) {
    next.set('search', trimmedSearch)
  }

  if (filters.sizes.length > 0) {
    next.set(
      'sizes',
      [...new Set(filters.sizes.map(normalizeSize))]
        .sort(sortSizes)
        .join(',')
    )
  }

  if (filters.colors.length > 0) {
    next.set(
      'colors',
      [...new Set(filters.colors.map(normalizeColorToken))]
        .sort((a, b) => a.localeCompare(b))
        .join(',')
    )
  }

  const [minPrice, maxPrice] = filters.priceRange
  if (minPrice > defaults.priceRange[0]) {
    next.set('minPrice', String(minPrice))
  }
  if (maxPrice < defaults.priceRange[1]) {
    next.set('maxPrice', String(maxPrice))
  }

  if (filters.inStockOnly) {
    next.set('inStock', 'true')
  }

  if (filters.sortBy !== defaults.sortBy) {
    next.set('sortBy', filters.sortBy)
  }

  return next
}

export function deriveAvailableSizes(products: Product[]): string[] {
  const seenSizes = new Set<string>()

  products.forEach((product) => {
    product.variants.forEach((variant) => {
      if (variant.isActive === false) {
        return
      }
      const sizeKey = getVariantSizeKey(variant)
      if (sizeKey) {
        seenSizes.add(sizeKey)
      }
    })
  })

  return Array.from(seenSizes).sort(sortSizes)
}

export function deriveAvailableColors(products: Product[]): ColorOption[] {
  const options = new Map<string, ColorOption>()

  products.forEach((product) => {
    const productColorKeys = new Set<string>()

    product.variants.forEach((variant) => {
      if (variant.isActive === false) {
        return
      }

      const key = getColorKeyFromVariant(variant)
      if (!key || productColorKeys.has(key)) {
        return
      }

      productColorKeys.add(key)

      const existing = options.get(key)
      if (existing) {
        existing.count += 1
        if (!existing.hex && variant.colorHex) {
          existing.hex = variant.colorHex
        }
        if (!existing.label && variant.color) {
          existing.label = variant.color
        }
      } else {
        options.set(key, {
          key,
          label: variant.color?.trim() || key.toUpperCase(),
          hex: variant.colorHex || null,
          count: 1,
        })
      }
    })
  })

  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export function applyProductFilters(
  products: Product[],
  filters: FilterState,
  categorySlug?: string
): Product[] {
  const selectedSizeSet = new Set(filters.sizes.map(normalizeSize))
  const selectedColorSet = new Set(filters.colors.map(normalizeColorToken))
  const normalizedSearch = filters.search.trim().toLowerCase()

  const filtered = products.filter((product) => {
    if (categorySlug && product.category?.slug !== categorySlug) {
      return false
    }

    if (normalizedSearch) {
      const nameMatch = product.name.toLowerCase().includes(normalizedSearch)
      const descriptionMatch = product.description?.toLowerCase().includes(normalizedSearch) ?? false
      if (!nameMatch && !descriptionMatch) {
        return false
      }
    }

    const [minPrice, maxPrice] = filters.priceRange
    if (product.price < minPrice || product.price > maxPrice) {
      return false
    }

    const activeVariants = product.variants.filter((variant) => variant.isActive !== false)
    const hasVariantFacetSelection = selectedSizeSet.size > 0 || selectedColorSet.size > 0

    if (hasVariantFacetSelection) {
      if (!activeVariants.some((variant) =>
        variantMatchesFacetFilters(
          variant,
          selectedSizeSet,
          selectedColorSet,
          filters.inStockOnly
        )
      )) {
        return false
      }
    } else if (filters.inStockOnly) {
      if (!activeVariants.some(isVariantInStock)) {
        return false
      }
    }

    return true
  })

  switch (filters.sortBy) {
    case 'price-asc':
      filtered.sort((a, b) => a.price - b.price)
      break
    case 'price-desc':
      filtered.sort((a, b) => b.price - a.price)
      break
    case 'name':
      filtered.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'newest':
    default:
      filtered.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      break
  }

  return filtered
}

export function isDefaultPriceRange(
  priceRange: [number, number],
  bounds: PriceBounds
): boolean {
  return priceRange[0] <= bounds.min && priceRange[1] >= bounds.max
}

export function countActiveFilters(filters: FilterState, bounds: PriceBounds): number {
  const activeFilters = [
    filters.search.trim().length > 0,
    filters.sizes.length > 0,
    filters.colors.length > 0,
    filters.inStockOnly,
    !isDefaultPriceRange(filters.priceRange, bounds),
    filters.sortBy !== 'newest',
  ]

  return activeFilters.filter(Boolean).length
}
