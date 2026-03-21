import { ProductVariant } from '@/lib/api/products'

export interface SelectionState {
  size: string | null
  color: string | null
}

export interface ColorOption {
  color: string
  colorHex: string | null
}

const sizeOrder: Record<string, number> = {
  XXS: 0,
  XS: 1,
  S: 2,
  M: 3,
  L: 4,
  XL: 5,
  XXL: 6,
  '2XL': 6,
  XXXL: 7,
  '3XL': 7,
  'ONE SIZE': 100,
  OS: 100,
  ONESIZE: 100,
}

function toSet<T>(values: T[]): Set<T> {
  return new Set(values)
}

export function sortSizes(a: string, b: string): number {
  const upperA = a.toUpperCase()
  const upperB = b.toUpperCase()
  const orderA = sizeOrder[upperA]
  const orderB = sizeOrder[upperB]

  if (orderA !== undefined && orderB !== undefined) return orderA - orderB
  if (orderA !== undefined) return -1
  if (orderB !== undefined) return 1

  const numA = parseFloat(a)
  const numB = parseFloat(b)
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB

  return a.localeCompare(b)
}

export function getSortedSizes(variants: ProductVariant[]): string[] {
  const sizes = variants
    .map((variant) => variant.size)
    .filter((size): size is string => Boolean(size))

  return [...toSet(sizes)].sort(sortSizes)
}

export function getColorOptions(variants: ProductVariant[]): ColorOption[] {
  const colorMap = new Map<string, string | null>()

  for (const variant of variants) {
    if (!variant.color) continue
    if (!colorMap.has(variant.color)) {
      colorMap.set(variant.color, variant.colorHex || null)
    }
  }

  return [...colorMap.entries()].map(([color, colorHex]) => ({ color, colorHex }))
}

export function getSelectionFromVariant(variant: ProductVariant | null): SelectionState {
  return {
    size: variant?.size || null,
    color: variant?.color || null,
  }
}

function matchesSelection(variant: ProductVariant, selection: SelectionState): boolean {
  if (selection.size && variant.size !== selection.size) return false
  if (selection.color && variant.color !== selection.color) return false
  return true
}

function firstInStock(variants: ProductVariant[]): ProductVariant | null {
  return variants.find((variant) => variant.inventory > 0) || null
}

export function getDefaultVariant(variants: ProductVariant[]): ProductVariant | null {
  if (!variants.length) return null
  return firstInStock(variants) || variants[0]
}

export function resolveVariantForSelection(
  variants: ProductVariant[],
  selection: SelectionState
): ProductVariant | null {
  if (!variants.length) return null

  const exactMatches = variants.filter((variant) => matchesSelection(variant, selection))
  const inStockExactMatch = firstInStock(exactMatches)
  if (inStockExactMatch) return inStockExactMatch
  if (exactMatches.length > 0) return exactMatches[0]

  if (selection.size) {
    const sizeMatches = variants.filter((variant) => variant.size === selection.size)
    const inStockSizeMatch = firstInStock(sizeMatches)
    if (inStockSizeMatch) return inStockSizeMatch
    if (sizeMatches.length > 0) return sizeMatches[0]
  }

  if (selection.color) {
    const colorMatches = variants.filter((variant) => variant.color === selection.color)
    const inStockColorMatch = firstInStock(colorMatches)
    if (inStockColorMatch) return inStockColorMatch
    if (colorMatches.length > 0) return colorMatches[0]
  }

  return getDefaultVariant(variants)
}

export function getAvailableSizesForColor(
  variants: ProductVariant[],
  selectedColor: string | null
): Set<string> {
  const availableSizes = variants
    .filter((variant) => variant.inventory > 0)
    .filter((variant) => !selectedColor || variant.color === selectedColor)
    .map((variant) => variant.size)
    .filter((size): size is string => Boolean(size))

  return toSet(availableSizes)
}

export function getAvailableColorsForSize(
  variants: ProductVariant[],
  selectedSize: string | null
): Set<string> {
  const availableColors = variants
    .filter((variant) => variant.inventory > 0)
    .filter((variant) => !selectedSize || variant.size === selectedSize)
    .map((variant) => variant.color)
    .filter((color): color is string => Boolean(color))

  return toSet(availableColors)
}

export function isSizeAvailableForSelection(
  variants: ProductVariant[],
  size: string,
  selectedColor: string | null
): boolean {
  return variants.some((variant) => {
    const colorMatches = !selectedColor || variant.color === selectedColor
    return variant.inventory > 0 && variant.size === size && colorMatches
  })
}

export function isColorAvailableForSelection(
  variants: ProductVariant[],
  color: string,
  selectedSize: string | null
): boolean {
  return variants.some((variant) => {
    const sizeMatches = !selectedSize || variant.size === selectedSize
    return variant.inventory > 0 && variant.color === color && sizeMatches
  })
}

export function getQuantityCap(
  selectedVariant: ProductVariant | null,
  productMaxQuantity: number | null | undefined
): number {
  if (!selectedVariant || selectedVariant.inventory <= 0) return 0
  if (typeof productMaxQuantity === 'number' && productMaxQuantity > 0) {
    return Math.min(selectedVariant.inventory, productMaxQuantity)
  }
  return selectedVariant.inventory
}

export function clampQuantity(quantity: number, quantityCap: number): number {
  if (quantityCap <= 0) return 1
  return Math.max(1, Math.min(quantity, quantityCap))
}
