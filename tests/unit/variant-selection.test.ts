import { describe, expect, it } from 'vitest'
import { ProductVariant } from '@/lib/api/products'
import {
  clampQuantity,
  getAvailableColorsForSize,
  getAvailableSizesForColor,
  getQuantityCap,
  isColorAvailableForSelection,
  isSizeAvailableForSelection,
  resolveVariantForSelection,
} from '@/components/products/variant-selection'

const variants: ProductVariant[] = [
  {
    id: 'v-red-s',
    sku: 'SKU-RED-S',
    size: 'S',
    color: 'Red',
    colorHex: '#FF0000',
    inventory: 4,
    isActive: true,
  },
  {
    id: 'v-red-m',
    sku: 'SKU-RED-M',
    size: 'M',
    color: 'Red',
    colorHex: '#FF0000',
    inventory: 0,
    isActive: true,
  },
  {
    id: 'v-cream-s',
    sku: 'SKU-CREAM-S',
    size: 'S',
    color: 'Cream',
    colorHex: '#F2E9DC',
    inventory: 2,
    isActive: true,
  },
  {
    id: 'v-cream-m',
    sku: 'SKU-CREAM-M',
    size: 'M',
    color: 'Cream',
    colorHex: '#F2E9DC',
    inventory: 6,
    isActive: true,
  },
]

describe('variant-selection helper', () => {
  it('resolves an in-stock variant for partial selections', () => {
    const byColor = resolveVariantForSelection(variants, { color: 'Cream', size: null })
    const bySize = resolveVariantForSelection(variants, { color: null, size: 'M' })

    expect(byColor?.id).toBe('v-cream-s')
    expect(bySize?.id).toBe('v-cream-m')
  })

  it('tracks availability by selected option without false positives', () => {
    const redSizes = getAvailableSizesForColor(variants, 'Red')
    const mediumColors = getAvailableColorsForSize(variants, 'M')

    expect(redSizes.has('S')).toBe(true)
    expect(redSizes.has('M')).toBe(false)
    expect(mediumColors.has('Cream')).toBe(true)
    expect(mediumColors.has('Red')).toBe(false)

    expect(isSizeAvailableForSelection(variants, 'M', 'Red')).toBe(false)
    expect(isSizeAvailableForSelection(variants, 'S', 'Red')).toBe(true)
    expect(isColorAvailableForSelection(variants, 'Red', 'M')).toBe(false)
    expect(isColorAvailableForSelection(variants, 'Cream', 'M')).toBe(true)
  })

  it('caps and clamps quantity by inventory and product max quantity', () => {
    const highInventoryVariant: ProductVariant = {
      id: 'v-high',
      sku: 'SKU-HIGH',
      inventory: 10,
      isActive: true,
    }
    const lowInventoryVariant: ProductVariant = {
      id: 'v-low',
      sku: 'SKU-LOW',
      inventory: 2,
      isActive: true,
    }

    expect(getQuantityCap(highInventoryVariant, 3)).toBe(3)
    expect(getQuantityCap(lowInventoryVariant, 5)).toBe(2)
    expect(getQuantityCap(null, 5)).toBe(0)
    expect(getQuantityCap(lowInventoryVariant, null)).toBe(2)

    expect(clampQuantity(4, 3)).toBe(3)
    expect(clampQuantity(0, 3)).toBe(1)
    expect(clampQuantity(5, 0)).toBe(1)
  })
})
