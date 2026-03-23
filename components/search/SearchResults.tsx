'use client'

import ProductImage from '@/components/ui/ProductImage'
import { Product } from '@/lib/api/products'
import { getPrimaryImageWithFallback } from '@/lib/commerce/product-placeholders'
import { MagnifyingGlass } from '@phosphor-icons/react'

interface SearchResultsProps {
  results: Product[]
  query: string
  isLoading: boolean
  activeItemKey: string | null
  onProductClick: (slug: string) => void
  onViewAll: () => void
  onItemHover: (itemKey: string) => void
}

function getDisplayPrice(product: Product): number {
  const variantPrices = product.variants
    .map((variant) => variant.price)
    .filter((price): price is number => typeof price === 'number')

  return variantPrices.length > 0 ? Math.min(...variantPrices) : product.price
}

function getColorSwatches(product: Product): Array<{ hex: string; name: string }> {
  const swatches: Array<{ hex: string; name: string }> = []

  product.variants.forEach((variant) => {
    if (!variant.colorHex) {
      return
    }

    if (swatches.some((swatch) => swatch.hex.toLowerCase() === variant.colorHex?.toLowerCase())) {
      return
    }

    swatches.push({
      hex: variant.colorHex,
      name: variant.color || variant.colorHex,
    })
  })

  return swatches
}

function getPrimaryColorVariant(product: Product): { color?: string; colorHex?: string } | null {
  const withHex = product.variants.find((variant) => variant.colorHex)
  if (withHex) {
    return {
      color: withHex.color,
      colorHex: withHex.colorHex,
    }
  }

  const withLabel = product.variants.find((variant) => variant.color)
  if (withLabel) {
    return {
      color: withLabel.color,
    }
  }

  return null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightMatch(text: string, query: string) {
  const trimmed = query.trim()
  if (!trimmed) {
    return text
  }

  const matcher = new RegExp(`(${escapeRegExp(trimmed)})`, 'ig')
  const parts = text.split(matcher)

  return parts.map((part, index) => {
    const isMatch = part.toLowerCase() === trimmed.toLowerCase()
    if (!isMatch) {
      return <span key={`${part}-${index}`}>{part}</span>
    }

    return (
      <mark
        key={`${part}-${index}`}
        className="bg-black text-white px-1 py-0.5 rounded-sm"
      >
        {part}
      </mark>
    )
  })
}

export function SearchResults({
  results,
  query,
  isLoading,
  activeItemKey,
  onProductClick,
  onViewAll,
  onItemHover,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="search-results-loading">
        {[1, 2, 3, 4, 5, 6].map((row) => (
          <div
            key={row}
            className="h-72 rounded-2xl border border-black/10 bg-black/[0.03] animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    )
  }

  if (query.trim().length >= 2 && results.length === 0) {
    return (
      <div className="rounded-xl border border-black/10 bg-black/[0.02] px-5 py-12 text-center" data-testid="search-results-empty">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/5">
          <MagnifyingGlass size={18} weight="bold" className="text-black/35" />
        </div>
        <p className="text-sm font-semibold text-black">No results for &ldquo;{query}&rdquo;</p>
        <p className="mt-1 text-xs text-black/50">Try another keyword or browse all products.</p>
      </div>
    )
  }

  if (query.trim().length < 2) {
    return null
  }

  return (
    <div className="space-y-4" data-testid="search-results-list">
      <div className="flex items-center justify-between">
        <p className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-black/35">
          Products
        </p>
        <p className="text-xs font-semibold text-black/45">{results.length} results</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {results.map((product) => {
          const itemKey = `product:${product.id}`
          const isActive = activeItemKey === itemKey
          const swatches = getColorSwatches(product)
          const colorContext = getPrimaryColorVariant(product)

          return (
            <button
              key={product.id}
              type="button"
              onClick={() => onProductClick(product.slug)}
              onMouseEnter={() => onItemHover(itemKey)}
              className={`overflow-hidden rounded-2xl border text-left transition-all ${
                isActive
                  ? 'border-black bg-black text-white'
                  : 'border-black/10 bg-white text-black hover:-translate-y-0.5 hover:border-black/25 hover:shadow-lg'
              }`}
            >
              <div className={`relative aspect-[4/5] w-full ${isActive ? 'bg-white/10' : 'bg-black/[0.04]'}`}>
                <ProductImage
                  src={getPrimaryImageWithFallback({
                    images: product.images,
                    productName: product.name,
                    productSlug: product.slug,
                    color: colorContext?.color,
                    colorHex: colorContext?.colorHex,
                  })}
                  alt={product.name}
                  productSlug={product.slug}
                  color={colorContext?.color}
                  colorHex={colorContext?.colorHex}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1280px) 50vw, 20vw"
                />
              </div>
              <div className="p-3">
                <p className={`truncate text-sm font-semibold ${isActive ? 'text-white' : 'text-black'}`}>
                  {highlightMatch(product.name, query)}
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className={`text-xs font-semibold tabular-nums ${isActive ? 'text-white/75' : 'text-black/55'}`}>
                    ${getDisplayPrice(product).toFixed(2)}
                  </p>
                  {swatches.length > 0 && (
                    <div className="flex items-center gap-1">
                      {swatches.slice(0, 4).map((swatch) => (
                        <span
                          key={`${product.id}-${swatch.hex}`}
                          className={`h-3 w-3 rounded-full border ${isActive ? 'border-white/40' : 'border-black/20'}`}
                          style={{ backgroundColor: swatch.hex }}
                          title={swatch.name}
                        />
                      ))}
                      {swatches.length > 4 && (
                        <span className={`text-[10px] ${isActive ? 'text-white/70' : 'text-black/40'}`}>
                          +{swatches.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onViewAll}
        onMouseEnter={() => onItemHover('action:view-all')}
        className={`w-full rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-[0.16em] transition-colors ${
          activeItemKey === 'action:view-all'
            ? 'border-black bg-black text-white'
            : 'border-black/15 text-black/70 hover:border-black/30 hover:bg-black/[0.03] hover:text-black'
        }`}
      >
        View all results for &ldquo;{query.trim()}&rdquo;
      </button>
    </div>
  )
}
