'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { CollectionCardViewModel } from '@/lib/collections/public-collections'

interface CollectionCardImageProps {
  collection: CollectionCardViewModel
  /**
   * Tailwind classes for the outer wrapper. Default keeps the image inline
   * with `relative aspect-square`. Pass `absolute inset-0 overflow-hidden`
   * when the image should fill an absolutely-positioned parent (featured
   * variant) — do NOT combine `relative` with `absolute` here.
   */
  wrapperClassName?: string
  /** `next/image` `sizes` prop forwarded to all rendered images. */
  sizes?: string
  /** Adds the lift/scale-on-group-hover behavior. Parent needs `group` class. */
  withHoverScale?: boolean
}

const PASTEL_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ['#fce7f3', '#fae8ff'], // pink → fuchsia
  ['#dbeafe', '#e0e7ff'], // blue → indigo
  ['#dcfce7', '#d1fae5'], // green → emerald
  ['#fef3c7', '#fed7aa'], // amber → orange
  ['#f3e8ff', '#e9d5ff'], // purple
  ['#fef9c3', '#fef3c7'], // yellow
  ['#cffafe', '#dbeafe'], // cyan → blue
  ['#ffe4e6', '#fce7f3'], // rose
]

function hashToIndex(value: string, modulo: number): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % Math.max(1, modulo)
}

function getCollectionInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '·'
  const parts = trimmed.split(/\s+/).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join('')
}

const DEFAULT_WRAPPER = 'relative aspect-square overflow-hidden bg-black/5'

export function CollectionCardImage({
  collection,
  wrapperClassName = DEFAULT_WRAPPER,
  sizes,
  withHoverScale = true,
}: CollectionCardImageProps) {
  const [primaryImageFailed, setPrimaryImageFailed] = useState(false)
  const hoverClass = withHoverScale ? 'transition-transform duration-500 group-hover:scale-105' : ''

  // Tier 1 — real cover image (collection.image set on the record)
  if (collection.imageUrl && !primaryImageFailed) {
    return (
      <div className={wrapperClassName}>
        <Image
          src={collection.imageUrl}
          alt={collection.name}
          fill
          unoptimized
          sizes={sizes ?? '(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw'}
          className={`object-cover ${hoverClass}`}
          onError={() => setPrimaryImageFailed(true)}
        />
      </div>
    )
  }

  // Tier 2 — 2×2 composite when we have plenty of product imagery
  if (collection.previewImages.length >= 4) {
    const tiles = collection.previewImages.slice(0, 4)
    return (
      <div className={wrapperClassName}>
        <div className={`absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px ${hoverClass}`}>
          {tiles.map((src, i) => (
            <div key={`${collection.id}-tile-${i}`} className="relative overflow-hidden bg-white">
              <Image
                src={src}
                alt={`${collection.name} product preview`}
                fill
                unoptimized
                sizes={sizes ?? '(max-width: 640px) 25vw, (max-width: 1280px) 17vw, 13vw'}
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Tier 3 — single product image as cover when we have 1–3 product images.
  // Better than the gradient when imagery exists but isn't enough for a clean composite.
  if (collection.previewImages.length >= 1) {
    return (
      <div className={wrapperClassName}>
        <Image
          src={collection.previewImages[0]}
          alt={collection.name}
          fill
          unoptimized
          sizes={sizes ?? '(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw'}
          className={`object-cover ${hoverClass}`}
        />
      </div>
    )
  }

  // Tier 4 — pastel gradient with collection initials (truly no imagery available)
  const [from, to] = PASTEL_PALETTE[hashToIndex(collection.slug || collection.name, PASTEL_PALETTE.length)]
  return (
    <div className={wrapperClassName}>
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-black tracking-tight text-black/35 text-5xl md:text-6xl xl:text-7xl select-none">
          {getCollectionInitials(collection.name)}
        </span>
      </div>
    </div>
  )
}
