import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import type { HomeCategoryCard } from '@/components/home/types'

interface HomeCategoryDiscoveryProps {
  categories: HomeCategoryCard[]
}

export function HomeCategoryDiscovery({ categories }: HomeCategoryDiscoveryProps) {
  return (
    <section
      id="home-categories"
      data-testid="home-categories"
      aria-labelledby="home-categories-title"
      className="border-b border-black/10 bg-neutral-50"
    >
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">Shop by category</p>
            <h2 id="home-categories-title" className="mt-2 text-3xl font-black tracking-tight text-black sm:text-4xl">
              Discover your next favorite fit.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/60 sm:text-base">
              Explore curated categories built around everyday layering, statement pieces, and finishing touches.
            </p>
          </div>
          <Link
            href="/collections"
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-black/65 transition-colors hover:text-black"
          >
            View collections
            <ArrowRight size={12} weight="bold" />
          </Link>
        </div>

        {categories.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-black/10 bg-white px-6 py-10 text-center">
            <p className="text-sm text-black/65">Categories are being refreshed. Browse all available products for now.</p>
            <Link
              href="/products"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-black/70 hover:text-black"
            >
              Shop all products
              <ArrowRight size={12} weight="bold" />
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" role="list">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={category.href}
                  className="group relative block overflow-hidden rounded-2xl border border-black/10 bg-white"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
                    <Image
                      src={category.imageUrl}
                      alt={category.name}
                      fill
                      sizes="(max-width: 640px) 94vw, (max-width: 1280px) 45vw, 32vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="text-lg font-black tracking-tight">{category.name}</p>
                    <div className="mt-1 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-white/80">
                      <span>{category.productCount} styles</span>
                      <span className="inline-flex items-center gap-1 text-white">
                        Shop
                        <ArrowRight size={12} weight="bold" />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
