'use client'

import ProductImage from '@/components/ui/ProductImage'
import { Product } from '@/lib/api/products'
import { getPrimaryImageWithFallback } from '@/lib/commerce/product-placeholders'
import { ArrowRight, ArrowUpRight, Clock, TrendUp, X } from '@phosphor-icons/react'

export interface QuickLink {
  label: string
  href: string
  description: string
}

interface SearchSuggestionsProps {
  recentSearches: string[]
  trendingSearches: string[]
  quickLinks: QuickLink[]
  featuredProducts: Product[]
  activeItemKey: string | null
  onSearchClick: (search: string) => void
  onQuickLinkClick: (href: string) => void
  onProductClick: (slug: string) => void
  onRemoveRecent: (search: string) => void
  onClearRecent: () => void
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

export function SearchSuggestions({
  recentSearches,
  trendingSearches,
  quickLinks,
  featuredProducts,
  activeItemKey,
  onSearchClick,
  onQuickLinkClick,
  onProductClick,
  onRemoveRecent,
  onClearRecent,
  onItemHover,
}: SearchSuggestionsProps) {
  return (
    <div data-testid="search-suggestions">
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div className="border-b border-black/6 py-1">
          <div className="flex items-center justify-between px-4 pb-1 pt-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/30">Recent</p>
            <button
              type="button"
              onClick={onClearRecent}
              className="text-[11px] text-black/35 transition-colors hover:text-black"
            >
              Clear all
            </button>
          </div>
          {recentSearches.map((search) => {
            const itemKey = `recent:${search.toLowerCase()}`
            const isActive = activeItemKey === itemKey
            return (
              <div key={search} className="group flex items-center px-4">
                <button
                  type="button"
                  onClick={() => onSearchClick(search)}
                  onMouseEnter={() => onItemHover(itemKey)}
                  className={`flex flex-1 items-center gap-3 py-2.5 text-left transition-colors ${
                    isActive ? 'text-black' : 'text-black/60'
                  }`}
                >
                  <Clock
                    size={14}
                    weight="bold"
                    className={`shrink-0 ${isActive ? 'text-black/50' : 'text-black/25'}`}
                  />
                  <span className="text-sm">{search}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveRecent(search)}
                  className="ml-2 rounded-md p-1 text-black/25 opacity-0 transition-all hover:text-black group-hover:opacity-100"
                  aria-label={`Remove ${search} from recent searches`}
                >
                  <X size={12} weight="bold" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Trending */}
      {trendingSearches.length > 0 && (
        <div className="border-b border-black/6 px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <TrendUp size={13} weight="bold" className="text-black/30" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/30">Trending</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trendingSearches.map((search) => {
              const itemKey = `trending:${search.toLowerCase()}`
              const isActive = activeItemKey === itemKey
              return (
                <button
                  key={search}
                  type="button"
                  onClick={() => onSearchClick(search)}
                  onMouseEnter={() => onItemHover(itemKey)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'border-black bg-black text-white'
                      : 'border-black/12 bg-black/2 text-black/60 hover:border-black/25 hover:text-black'
                  }`}
                >
                  {search}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Browse / Quick Links */}
      <div className="border-b border-black/6 py-1">
        <p className="px-4 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/30">Quick Links</p>
        {quickLinks.map((link) => {
          const itemKey = `quick:${link.href}`
          const isActive = activeItemKey === itemKey
          return (
            <button
              key={link.href}
              type="button"
              onClick={() => onQuickLinkClick(link.href)}
              onMouseEnter={() => onItemHover(itemKey)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                isActive ? 'bg-black/4' : 'hover:bg-black/3'
              }`}
            >
              <ArrowUpRight
                size={14}
                weight="bold"
                className={`shrink-0 ${isActive ? 'text-black/60' : 'text-black/25'}`}
              />
              <span className={`text-sm ${isActive ? 'font-semibold text-black' : 'text-black/65'}`}>
                {link.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Popular Products */}
      {featuredProducts.length > 0 && (
        <div className="py-1">
          <p className="px-4 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/30">
            Popular Products
          </p>
          {featuredProducts.map((product) => {
            const itemKey = `featured:${product.id}`
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
                  <p className="truncate text-sm font-semibold text-black">{product.name}</p>
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
    </div>
  )
}
