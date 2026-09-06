import type { ReactNode } from 'react'
import type { ProductCardData } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { ProductCard, ProductCardSkeleton } from './ProductCard'

const COLUMN_CLASS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4',
} as const

export type ProductGridColumns = 2 | 3 | 4

export interface ProductGridProps {
  products: ProductCardData[]
  columns?: ProductGridColumns
  /** Renders `skeletonCount` placeholders instead of products. */
  loading?: boolean
  skeletonCount?: number
  /** Forwarded to every in-stock card; passing it makes the grid client-side. */
  onQuickAdd?: (productId: string) => void
  emptyMessage?: ReactNode
  className?: string
}

/**
 * Responsive product grid (design spec §5.2).
 *
 * Server-safe: no `'use client'`, no hooks. A server component renders it
 * without `onQuickAdd`; a client component may pass the handler through.
 */
export function ProductGrid({
  products,
  columns = 4,
  loading = false,
  skeletonCount = 8,
  onQuickAdd,
  emptyMessage = 'Nothing here yet.',
  className,
}: ProductGridProps) {
  const isEmpty = !loading && products.length === 0

  return (
    <div
      className={cn(
        'grid gap-x-3 gap-y-8 md:gap-x-4 md:gap-y-10',
        COLUMN_CLASS[columns],
        className
      )}
    >
      {loading
        ? Array.from({ length: Math.max(0, skeletonCount) }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))
        : null}

      {isEmpty ? (
        <p role="status" className="col-span-full text-ink-mute">
          {emptyMessage}
        </p>
      ) : null}

      {!loading
        ? products.map((product) => (
            <ProductCard key={product.id} product={product} onQuickAdd={onQuickAdd} />
          ))
        : null}
    </div>
  )
}
