'use client'

import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react'
import type { CollectionCardViewModel } from '@/lib/collections/public-collections'
import { CollectionCardImage } from './CollectionCardImage'

interface CollectionCardProps {
  collection: CollectionCardViewModel
  variant?: 'regular' | 'featured'
  /** Tailwind grid-span utilities applied by the parent grid (col-span-2, row-span-2, etc.). */
  className?: string
}

export function CollectionCard({ collection, variant = 'regular', className = '' }: CollectionCardProps) {
  if (variant === 'featured') {
    return (
      <Link
        href={`/collections/${collection.slug}`}
        className={`group relative block overflow-hidden rounded-2xl bg-white transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10 ${className}`}
      >
        <CollectionCardImage
          collection={collection}
          wrapperClassName="absolute inset-0 overflow-hidden bg-black/5"
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 67vw, 50vw"
        />

        {/* Bottom gradient for text legibility */}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

        {/* Featured caption — overlaid */}
        <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6 lg:p-8 text-white pointer-events-none">
          <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.22em] text-white/70 mb-2">
            Featured collection
          </p>
          <h3 className="text-2xl md:text-3xl xl:text-4xl font-black tracking-tight leading-[1.05] mb-1">
            {collection.name}
          </h3>
          <div className="flex items-center justify-between gap-3 mt-3">
            <p className="text-xs md:text-sm text-white/80">
              {collection.productCount} {collection.productCount === 1 ? 'piece' : 'pieces'}
            </p>
            <span className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-white text-black text-[10px] md:text-[11px] font-bold uppercase tracking-wider transition-transform group-hover:translate-x-0.5">
              View collection
              <ArrowRight size={11} weight="bold" />
            </span>
          </div>
        </div>

        {/* Aspect spacer — keeps the card square at any grid span size */}
        <div className="aspect-square" aria-hidden />
      </Link>
    )
  }

  // Regular variant — image inline, then title block beneath
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-black/8 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-black/20 hover:shadow-lg hover:shadow-black/5 ${className}`}
    >
      <CollectionCardImage
        collection={collection}
        sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
      />

      <div className="flex flex-col gap-1 p-3 md:p-4">
        <h3 className="text-sm md:text-base font-black text-black tracking-tight leading-tight line-clamp-1">
          {collection.name}
        </h3>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] md:text-xs text-black/45">
            {collection.productCount} {collection.productCount === 1 ? 'piece' : 'pieces'}
          </p>
          <ArrowRight
            size={12}
            weight="bold"
            className="text-black/30 transition-all group-hover:translate-x-0.5 group-hover:text-black/70"
          />
        </div>
      </div>
    </Link>
  )
}
