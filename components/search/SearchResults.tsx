'use client'

import ProductImage from '@/components/ui/ProductImage'
import { Product } from '@/lib/api/products'
import { getPrimaryImageWithFallback } from '@/lib/commerce/product-placeholders'
import { ArrowRight, MagnifyingGlass } from '@phosphor-icons/react'

interface SearchResultsProps {
  results: Product[]
  query: string
  isLoading: boolean
  activeItemKey: string | null
  autocompleteSuggestions?: string[]
  autocompleteTestId?: string
  onProductClick: (slug: string) => void
  onViewAll: () => void
  onSuggestionClick?: (suggestion: string) => void
  onItemHover: (itemKey: string) => void
}

function getDisplayPrice(product: Product): number {
  const variantPrices = product.variants
    .map((v) => v.price)
    .filter((p): p is number => typeof p === 'number')
  return variantPrices.length > 0 ? Math.min(...variantPrices) : product.price
}

function getColorSwatches(product: Product): Array<{ hex: string; name: string }> {
  const swatches: Array<{ hex: string; name: string }> = []
  product.variants.forEach((v) => {
    if (!v.colorHex) return
    if (swatches.some((s) => s.hex.toLowerCase() === v.colorHex?.toLowerCase())) return
    swatches.push({ hex: v.colorHex, name: v.color || v.colorHex })
  })
  return swatches
}

function getPrimaryColorVariant(product: Product): { color?: string; colorHex?: string } | null {
  const withHex = product.variants.find((v) => v.colorHex)
  if (withHex) return { color: withHex.color, colorHex: withHex.colorHex }
  const withLabel = product.variants.find((v) => v.color)
  if (withLabel) return { color: withLabel.color }
  return null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightMatch(text: string, query: string) {
  const trimmed = query.trim()
  if (!trimmed) return text
  const matcher = new RegExp(`(${escapeRegExp(trimmed)})`, 'ig')
  const parts = text.split(matcher)
  return parts.map((part, i) => {
    const isMatch = part.toLowerCase() === trimmed.toLowerCase()
    if (!isMatch) return <span key={`${part}-${i}`}>{part}</span>
    return (
      <mark key={`${part}-${i}`} className="rounded-sm bg-black px-0.5 text-white">
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
  autocompleteSuggestions = [],
  autocompleteTestId = 'nav-search-autocomplete',
  onProductClick,
  onViewAll,
  onSuggestionClick,
  onItemHover,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="py-2" data-testid="search-results-loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-black/6" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-2/3 animate-pulse rounded bg-black/6" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-black/5" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (query.trim().length >= 2 && results.length === 0 && autocompleteSuggestions.length === 0) {
    return (
      <div className="px-4 py-10 text-center" data-testid="search-results-empty">
        <p className="text-sm font-semibold text-black">No results for &ldquo;{query}&rdquo;</p>
        <p className="mt-1 text-xs text-black/45">Try a different keyword or browse all products.</p>
      </div>
    )
  }

  if (query.trim().length < 2) return null

  return (
    <div data-testid="search-results-list">
      {/* Autocomplete suggestions */}
      {autocompleteSuggestions.length > 0 && (
        <div className="border-b border-black/6 py-1" data-testid={autocompleteTestId}>
          {autocompleteSuggestions.slice(0, 4).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestionClick?.(suggestion)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/3"
            >
              <MagnifyingGlass size={14} weight="bold" className="shrink-0 text-black/30" />
              <span className="text-sm text-black/70">{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {/* Product rows */}
      {results.length > 0 && (
        <div className="py-1">
          <p className="px-4 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/30">
            Products
          </p>
          {results.map((product) => {
            const itemKey = `product:${product.id}`
            const isActive = activeItemKey === itemKey
            const swatches = getColorSwatches(product)
            const colorContext = getPrimaryColorVariant(product)
            const price = getDisplayPrice(product)

            return (
              <button
                key={product.id}
                type="button"
                onClick={() => onProductClick(product.slug)}
                onMouseEnter={() => onItemHover(itemKey)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-black/4' : 'hover:bg-black/3'
                }`}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/5">
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
                    sizes="40px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-black">
                    {highlightMatch(product.name, query)}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs tabular-nums text-black/45">${price.toFixed(2)}</span>
                    {swatches.length > 0 && (
                      <div className="flex items-center gap-1">
                        {swatches.slice(0, 4).map((s) => (
                          <span
                            key={`${product.id}-${s.hex}`}
                            className="h-2 w-2 rounded-full border border-black/15"
                            style={{ backgroundColor: s.hex }}
                            title={s.name}
                          />
                        ))}
                        {swatches.length > 4 && (
                          <span className="text-[10px] text-black/35">+{swatches.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <ArrowRight size={14} className="shrink-0 text-black/20" />
              </button>
            )
          })}
        </div>
      )}

      {/* View all */}
      <div className="border-t border-black/6 px-4 py-3">
        <button
          type="button"
          onClick={onViewAll}
          onMouseEnter={() => onItemHover('action:view-all')}
          className={`w-full rounded-full border py-2.5 text-xs font-black uppercase tracking-[0.14em] transition-colors ${
            activeItemKey === 'action:view-all'
              ? 'border-black bg-black text-white'
              : 'border-black/12 text-black/60 hover:border-black/25 hover:text-black'
          }`}
        >
          View all results for &ldquo;{query.trim()}&rdquo;
        </button>
      </div>
    </div>
  )
}
