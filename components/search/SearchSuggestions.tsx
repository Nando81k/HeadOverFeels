'use client'

import ProductImage from '@/components/ui/ProductImage'
import { Product } from '@/lib/api/products'
import { ArrowUpRight, Clock, Fire, LinkSimple, TrendUp, X } from '@phosphor-icons/react'

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

function getFirstImage(images: string): string {
  try {
    const parsed = JSON.parse(images)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0]
      return (typeof first === 'string' ? first : first?.url) || '/placeholder-product.jpg'
    }
  } catch {
    // Fall back below
  }
  return images || '/placeholder-product.jpg'
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
    <div className="space-y-5" data-testid="search-suggestions">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-white p-3">
          <div className="mb-2 flex items-center gap-2">
            <LinkSimple size={14} weight="bold" className="text-black/35" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">Quick Links</p>
          </div>
          <div className="space-y-1">
            {quickLinks.map((link) => {
              const itemKey = `quick:${link.href}`
              const isActive = activeItemKey === itemKey
              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => onQuickLinkClick(link.href)}
                  onMouseEnter={() => onItemHover(itemKey)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? 'border-black bg-black text-white'
                      : 'border-black/10 text-black hover:border-black/20 hover:bg-black/[0.03]'
                  }`}
                >
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-[0.12em] ${isActive ? 'text-white' : 'text-black'}`}>
                      {link.label}
                    </p>
                    <p className={`mt-0.5 text-[11px] ${isActive ? 'text-white/70' : 'text-black/50'}`}>
                      {link.description}
                    </p>
                  </div>
                  <ArrowUpRight size={14} weight="bold" className={isActive ? 'text-white' : 'text-black/35'} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} weight="bold" className="text-black/35" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">Recent</p>
            </div>
            {recentSearches.length > 0 && (
              <button
                type="button"
                onClick={onClearRecent}
                className="text-[11px] font-semibold text-black/45 hover:text-black"
              >
                Clear all
              </button>
            )}
          </div>
          {recentSearches.length === 0 ? (
            <p className="rounded-lg border border-dashed border-black/15 px-3 py-4 text-xs text-black/45">
              Your recent searches will appear here.
            </p>
          ) : (
            <div className="space-y-1">
              {recentSearches.map((search) => {
                const itemKey = `recent:${search.toLowerCase()}`
                const isActive = activeItemKey === itemKey
                return (
                  <div key={search} className="group flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSearchClick(search)}
                      onMouseEnter={() => onItemHover(itemKey)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? 'border-black bg-black text-white'
                          : 'border-black/10 text-black/75 hover:border-black/20 hover:bg-black/[0.03] hover:text-black'
                      }`}
                    >
                      {search}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveRecent(search)}
                      className="rounded-md p-1.5 text-black/30 transition-colors hover:bg-black/5 hover:text-black"
                      aria-label={`Remove ${search} from recent searches`}
                    >
                      <X size={12} weight="bold" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-3">
        <div className="mb-2 flex items-center gap-2">
          <TrendUp size={14} weight="bold" className="text-black/35" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">Trending</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {trendingSearches.map((search) => {
            const itemKey = `trending:${search.toLowerCase()}`
            const isActive = activeItemKey === itemKey
            return (
              <button
                key={search}
                type="button"
                onClick={() => onSearchClick(search)}
                onMouseEnter={() => onItemHover(itemKey)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] transition-colors ${
                  isActive
                    ? 'border-black bg-black text-white'
                    : 'border-black/15 bg-black/[0.02] text-black/60 hover:border-black/30 hover:text-black'
                }`}
              >
                {search}
              </button>
            )
          })}
        </div>
      </div>

      {featuredProducts.length > 0 && (
        <div className="rounded-xl border border-black/10 bg-white p-3">
          <div className="mb-2 flex items-center gap-2">
            <Fire size={14} weight="fill" className="text-orange-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">Popular Products</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {featuredProducts.map((product) => {
              const itemKey = `featured:${product.id}`
              const isActive = activeItemKey === itemKey
              const swatches = getColorSwatches(product)
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onProductClick(product.slug)}
                  onMouseEnter={() => onItemHover(itemKey)}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? 'border-black bg-black text-white'
                      : 'border-black/10 text-black hover:border-black/20 hover:bg-black/[0.03]'
                  }`}
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-black/5">
                    <ProductImage
                      src={getFirstImage(product.images)}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-xs font-semibold ${isActive ? 'text-white' : 'text-black'}`}>
                      {product.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className={`text-xs tabular-nums ${isActive ? 'text-white/75' : 'text-black/50'}`}>
                        ${getDisplayPrice(product).toFixed(2)}
                      </p>
                      {swatches.length > 0 && (
                        <div className="flex items-center gap-1">
                          {swatches.slice(0, 3).map((swatch) => (
                            <span
                              key={`${product.id}-${swatch.hex}`}
                              className={`h-2.5 w-2.5 rounded-full border ${isActive ? 'border-white/40' : 'border-black/25'}`}
                              style={{ backgroundColor: swatch.hex }}
                              title={swatch.name}
                            />
                          ))}
                          {swatches.length > 3 && (
                            <span className={`text-[10px] ${isActive ? 'text-white/70' : 'text-black/45'}`}>
                              +{swatches.length - 3}
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
        </div>
      )}
    </div>
  )
}
