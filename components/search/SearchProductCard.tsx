'use client'

import { useState, useMemo } from 'react'
import { Check } from '@phosphor-icons/react'
import { Product } from '@/lib/api/products'
import ProductImage from '@/components/ui/ProductImage'
import { getPrimaryImageWithFallback, parseImageList } from '@/lib/commerce/product-placeholders'

function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5
}

interface SearchProductCardProps {
  product: Product
  itemKey: string
  isActive: boolean
  onProductClick: (slug: string) => void
  onItemHover: (itemKey: string) => void
}

export function SearchProductCard({
  product,
  itemKey,
  isActive,
  onProductClick,
  onItemHover,
}: SearchProductCardProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [previewColor, setPreviewColor] = useState<string | null>(null)
  const activeColor = previewColor ?? selectedColor

  const price = useMemo(() => {
    const variantPrices = product.variants
      .map((v) => v.price)
      .filter((p): p is number => typeof p === 'number')
    return variantPrices.length > 0 ? Math.min(...variantPrices) : product.price
  }, [product])

  const colorVariants = useMemo(() => {
    const seen = new Set<string>()
    return product.variants.filter((v) => {
      if (v.color && v.colorHex && !seen.has(v.color)) {
        seen.add(v.color)
        return true
      }
      return false
    })
  }, [product.variants])

  const currentImage = useMemo(() => {
    if (activeColor) {
      const variant = colorVariants.find((v) => v.color === activeColor)
      if (variant) {
        const variantImages = parseImageList(variant.images)
        if (variantImages.length > 0) return variantImages[0]
        return getPrimaryImageWithFallback({
          images: '',
          productName: product.name,
          productSlug: product.slug,
          color: variant.color,
          colorHex: variant.colorHex,
        })
      }
    }
    return getPrimaryImageWithFallback({
      images: product.images,
      productName: product.name,
      productSlug: product.slug,
    })
  }, [activeColor, colorVariants, product])

  const activeVariant = activeColor ? colorVariants.find((v) => v.color === activeColor) : null
  const totalStock = product.variants.reduce((sum, v) => sum + (v.inventory ?? 0), 0)
  const inStock = totalStock > 0
  const onSale = !!product.compareAtPrice && product.compareAtPrice > price

  return (
    <article
      onMouseEnter={() => onItemHover(itemKey)}
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-300 ${
        isActive
          ? '-translate-y-0.5 border-black/30 shadow-[0_10px_20px_rgba(0,0,0,0.08)]'
          : 'border-black/10 hover:-translate-y-0.5 hover:border-black/30 hover:shadow-[0_10px_20px_rgba(0,0,0,0.08)]'
      }`}
    >
        {/* Image */}
        <div className="relative aspect-5/6 overflow-hidden bg-black/2">
          <ProductImage
            src={currentImage}
            alt={product.name}
            productSlug={product.slug}
            color={activeVariant?.color}
            colorHex={activeVariant?.colorHex}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 1280px) 18vw, 230px"
          />

          <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1">
            {onSale && (
              <span className="rounded-full bg-black px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white">
                Save {Math.round(((product.compareAtPrice! - price) / product.compareAtPrice!) * 100)}%
              </span>
            )}
            {!inStock && (
              <span className="rounded-full border border-black/15 bg-white/95 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-black/70">
                Sold Out
              </span>
            )}
          </div>

          {product.category && (
            <div className="absolute right-2.5 top-2.5 z-10">
              <span className="rounded-full border border-black/10 bg-white/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-black/65">
                {product.category.name}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col p-3">
          <h3 className="line-clamp-2 min-h-[2.45rem] text-sm font-semibold leading-tight text-black">
            {product.name}
          </h3>

          {colorVariants.length > 1 && (
            <div className="relative z-10 mt-2 flex flex-wrap gap-1.5">
              {colorVariants.slice(0, 5).map((variant) => {
                const isSelected = activeColor === variant.color
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedColor(isSelected ? null : variant.color || null)
                    }}
                    onMouseEnter={(e) => {
                      e.stopPropagation()
                      setPreviewColor(variant.color || null)
                    }}
                    onMouseLeave={() => setPreviewColor(null)}
                    title={variant.color || undefined}
                    aria-label={`Preview ${variant.color}`}
                    className={`relative h-5 w-5 shrink-0 rounded-full border-2 transition-all active:scale-90 focus-visible:outline-none ${
                      isSelected
                        ? 'border-black ring-2 ring-black/35 ring-offset-1'
                        : 'border-black/20 hover:border-black/45'
                    }`}
                    style={{ backgroundColor: variant.colorHex || '#ccc' }}
                  >
                    {isSelected && variant.colorHex && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Check
                          className="h-3 w-3"
                          weight="bold"
                          style={{ color: isLightColor(variant.colorHex) ? '#000' : '#fff' }}
                        />
                      </span>
                    )}
                  </button>
                )
              })}
              {colorVariants.length > 5 && (
                <span className="self-center text-[10px] text-black/35">+{colorVariants.length - 5}</span>
              )}
            </div>
          )}

          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-base font-black text-black">${price.toFixed(2)}</span>
            {onSale && product.compareAtPrice && (
              <span className="text-xs font-medium text-black/40 line-through">
                ${product.compareAtPrice.toFixed(2)}
              </span>
            )}
          </div>

          <div className="mt-auto pt-2">
            <p className="text-[11px] font-medium text-black/45">
              {!inStock
                ? 'Currently unavailable'
                : totalStock <= 5
                  ? `Only ${totalStock} left`
                  : 'In stock'}
            </p>
          </div>
        </div>

        {/* Click overlay — invisible button covering the card. Sits in DOM
            after the static content so it stacks above it for click capture,
            but the swatches are positioned with z-10 to sit on top. */}
        <button
          type="button"
          onClick={() => onProductClick(product.slug)}
          aria-label={`View ${product.name}`}
          className="absolute inset-0 z-0 rounded-2xl text-left"
        />
      </article>
  )
}
