'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import type { HomeProductCard } from '@/components/home/types'
import { getPrimaryImageWithFallback } from '@/lib/commerce/product-placeholders'

interface HomeProductRailProps {
  sectionId: string
  testId: string
  title: string
  eyebrow?: string
  description?: string
  products: HomeProductCard[]
  viewAllHref?: string
  viewAllLabel?: string
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function getDiscountPercentage(compareAtPrice: number | null, price: number): number | null {
  if (!compareAtPrice || compareAtPrice <= price) {
    return null
  }

  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
}

function HomeProductRailCard({ product }: { product: HomeProductCard }) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [previewColor, setPreviewColor] = useState<string | null>(null)
  const discountPercentage = getDiscountPercentage(product.compareAtPrice, product.price)
  const activeColor = previewColor ?? selectedColor

  const activeImage = useMemo(() => {
    const match = activeColor ? product.colorCues.find((cue) => cue.label === activeColor) : null

    return getPrimaryImageWithFallback({
      images: match?.previewImageUrl || product.imageUrl,
      productName: product.name,
      productSlug: product.slug,
      color: match?.label || activeColor,
      colorHex: match?.hex,
    })
  }, [activeColor, product.colorCues, product.imageUrl, product.name, product.slug])

  return (
    <li>
      <Link
        href={`/products/${product.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-black/30 hover:shadow-[0_14px_24px_rgba(0,0,0,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
          <Image
            src={activeImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 280px"
            className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
          />

          {discountPercentage !== null && (
            <span className="absolute left-3 top-3 rounded-full bg-black px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">
              Save {discountPercentage}%
            </span>
          )}

          {product.isSoldOut && (
            <span className="absolute right-3 top-3 rounded-full border border-black/20 bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/70">
              Sold out
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          {product.categoryName && (
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-black/50">{product.categoryName}</p>
          )}

          <h3 className="mt-1.5 line-clamp-2 min-h-[2.6rem] text-sm font-semibold text-black">
            {product.name}
          </h3>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-base font-black text-black">{formatUsd(product.price)}</span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-xs font-medium text-black/40 line-through">
                {formatUsd(product.compareAtPrice)}
              </span>
            )}
          </div>

          {product.colorCues.length > 0 && (
            <div
              className="mt-3 flex items-center gap-1.5"
              aria-label={`Available colors: ${product.colorCues.map((cue) => cue.label).join(', ')}`}
            >
              {product.colorCues.map((cue) => (
                <button
                  key={`${product.id}-${cue.label}-${cue.hex}`}
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setSelectedColor((current) => (current === cue.label ? null : cue.label))
                  }}
                  onMouseEnter={() => setPreviewColor(cue.label)}
                  onMouseLeave={() => setPreviewColor(null)}
                  onFocus={() => setPreviewColor(cue.label)}
                  onBlur={() => setPreviewColor(null)}
                  className={`h-3.5 w-3.5 rounded-full border transition-all ${
                    activeColor === cue.label
                      ? 'scale-110 border-black ring-1 ring-black/40 ring-offset-1'
                      : 'border-black/20 hover:border-black/45'
                  }`}
                  style={{ backgroundColor: cue.hex }}
                  title={`${cue.label}${cue.previewImageUrl ? '' : ' (color preview only)'}`}
                  aria-label={`Preview ${cue.label}`}
                />
              ))}
            </div>
          )}

          <div className="mt-auto pt-3">
            {product.lowStockLabel && !product.isSoldOut && (
              <p className="text-[11px] font-medium text-black/55">{product.lowStockLabel}</p>
            )}

            {!product.lowStockLabel && !product.isSoldOut && (
              <p className="text-[11px] font-medium text-black/45">In stock</p>
            )}

            {product.isSoldOut && (
              <p className="text-[11px] font-medium text-black/45">Currently unavailable</p>
            )}

            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/65 transition-colors group-hover:text-black">
              View product
              <ArrowRight size={12} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </li>
  )
}

export function HomeProductRail({
  sectionId,
  testId,
  title,
  eyebrow,
  description,
  products,
  viewAllHref = '/products',
  viewAllLabel = 'View all products',
}: HomeProductRailProps) {
  if (products.length === 0) {
    return null
  }

  const headingId = `${sectionId}-title`

  return (
    <section id={sectionId} data-testid={testId} aria-labelledby={headingId} className="border-b border-black/10 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">{eyebrow}</p>
            )}
            <h2 id={headingId} className="mt-2 text-3xl font-black tracking-tight text-black sm:text-4xl">
              {title}
            </h2>
            {description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/60 sm:text-base">{description}</p>
            )}
          </div>

          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-black/65 transition-colors hover:text-black"
          >
            {viewAllLabel}
            <ArrowRight size={12} weight="bold" />
          </Link>
        </div>

        <ul
          className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
          role="list"
          aria-label={`${title} products`}
        >
          {products.map((product) => (
            <HomeProductRailCard key={product.id} product={product} />
          ))}
        </ul>
      </div>
    </section>
  )
}
