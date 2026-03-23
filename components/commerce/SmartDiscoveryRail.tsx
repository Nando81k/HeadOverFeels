'use client'

import { Product } from '@/lib/api/products'
import { ProductCard } from '@/components/products/ProductCard'

interface SmartDiscoveryRailProps {
  title: string
  description?: string
  products: Product[]
  loading?: boolean
}

export function SmartDiscoveryRail({
  title,
  description,
  products,
  loading = false,
}: SmartDiscoveryRailProps) {
  if (!loading && products.length === 0) {
    return null
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">Discover</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-black sm:text-3xl">{title}</h2>
          {description ? <p className="mt-2 text-sm text-black/60">{description}</p> : null}
        </div>
      </div>

      {loading ? (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[280px] animate-pulse rounded-2xl border border-black/10 bg-black/[0.03]" />
          ))}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  )
}
