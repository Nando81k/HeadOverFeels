import { describe, expect, it } from 'vitest'
import {
  buildProductPlaceholderImages,
  buildVariantPlaceholderImages,
  getContrastTextHex,
  getPrimaryImageWithFallback,
  isPlaceholderLikeImageUrl,
  normalizeHexColor,
  parseImageList,
  resolveColorHex,
  rewritePlaceholderLikeImages,
} from '@/lib/commerce/product-placeholders'

describe('product placeholder utilities', () => {
  it('normalizes and resolves hex colors', () => {
    expect(normalizeHexColor('#abc')).toBe('#AABBCC')
    expect(normalizeHexColor('90aed7')).toBe('#90AED7')
    expect(normalizeHexColor('bad-value')).toBeNull()

    expect(resolveColorHex('#1d2e4f', 'Navy')).toBe('#1D2E4F')
    expect(resolveColorHex(null, 'Heather Grey')).toBe('#9ca3af')
    expect(resolveColorHex(null, null)).toBeNull()
  })

  it('selects readable contrast text color', () => {
    expect(getContrastTextHex('#F2EBDD')).toBe('#111111')
    expect(getContrastTextHex('#1D2E4F')).toBe('#FFFFFF')
  })

  it('builds deterministic product placeholders', () => {
    const first = buildProductPlaceholderImages({
      productName: 'Calm Hoodie',
      productSlug: 'calm-hoodie',
    })
    const second = buildProductPlaceholderImages({
      productName: 'Calm Hoodie',
      productSlug: 'calm-hoodie',
    })

    expect(first).toEqual(second)
    expect(first).toHaveLength(3)
    expect(first[0]).toContain('placehold.co')
    expect(first[0]).toContain('/png?text=')
  })

  it('builds color-aware variant placeholders', () => {
    const images = buildVariantPlaceholderImages({
      productName: 'Calm Hoodie',
      productSlug: 'calm-hoodie',
      color: 'Navy',
      colorHex: '#1D2E4F',
      size: 'L',
    })

    expect(images).toHaveLength(3)
    expect(images[0]).toContain('/1D2E4F/')
    expect(images[0]).toContain('/png?text=')
    expect(images[0]).toContain('NAVY')
    expect(images[0]).toContain('L')
  })

  it('detects placeholder-like hosts and preserves real URLs', () => {
    expect(isPlaceholderLikeImageUrl('/placeholder-product.jpg')).toBe(true)
    expect(isPlaceholderLikeImageUrl('https://placehold.co/800x1000/111111/FFFFFF?text=Test')).toBe(true)
    expect(isPlaceholderLikeImageUrl('https://via.placeholder.com/800x1000.png?text=Test')).toBe(true)
    expect(isPlaceholderLikeImageUrl('https://cdn.headoverfeels.com/products/calm-hoodie-1.jpg')).toBe(true)
    expect(isPlaceholderLikeImageUrl('https://res.cloudinary.com/demo/image/upload/v1/product.jpg')).toBe(false)
  })

  it('rewrites only placeholder-like image entries', () => {
    const current = [
      'https://cdn.headoverfeels.com/products/old-1.jpg',
      'https://res.cloudinary.com/demo/image/upload/v1/real.jpg',
      '/placeholder-product.jpg',
    ]
    const replacements = buildProductPlaceholderImages({
      productName: 'Calm Hoodie',
      productSlug: 'calm-hoodie',
    })

    const rewritten = rewritePlaceholderLikeImages(current, replacements)
    expect(rewritten.replacedCount).toBe(2)
    expect(rewritten.images[1]).toBe('https://res.cloudinary.com/demo/image/upload/v1/real.jpg')
    expect(rewritten.images[0]).toContain('placehold.co')
    expect(rewritten.images[2]).toContain('placehold.co')
  })

  it('parses image payloads and computes fallback images', () => {
    expect(parseImageList('[{"url":"/a.jpg"},"/b.jpg"]')).toEqual(['/a.jpg', '/b.jpg'])
    expect(parseImageList('/single.jpg')).toEqual(['/single.jpg'])
    expect(parseImageList('[{"broken"]')).toEqual([])

    const fallback = getPrimaryImageWithFallback({
      images: '',
      productName: 'Calm Hoodie',
      productSlug: 'calm-hoodie',
      color: 'Cream',
      colorHex: '#F2EBDD',
      size: 'M',
    })

    expect(fallback).toContain('placehold.co')
    expect(fallback).toContain('/F2EBDD/')
  })
})
