import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/storefront/ui/Badge'
import { Button } from '@/components/storefront/ui/Button'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { cn } from '@/lib/storefront/cn'

/**
 * Default hero art. A local asset rather than a Shopify image: the home page
 * must render its above-the-fold LCP frame even with no store credentials
 * (Phase 2 plan, cross-cutting note 5).
 */
export const HERO_IMAGE = {
  src: '/assets/Sweatshirt_hoodie_collection.png',
  alt: 'Head Over Feels heavyweight fleece hoodie',
} as const

export interface HeroProps {
  /** Override the still. Defaults to `HERO_IMAGE`. */
  image?: { src: string; alt: string }
  className?: string
}

/**
 * Home hero (design spec §5.4 row `/`): one full-bleed still, one oversized
 * condensed headline with a single signal word, one signal CTA.
 *
 * A plain `<section>` rather than `Section`: the media half must run to the
 * viewport edge and the copy half carries its own gutter, which the shared
 * `Container` padding would double up. Server-safe — no state, no handlers.
 */
export function Hero({ image = HERO_IMAGE, className }: HeroProps) {
  return (
    <section
      data-home-hero=""
      aria-labelledby="home-hero-title"
      className={cn('bg-bone text-ink', className)}
    >
      <div className="grid min-h-[calc(100svh-4rem)] grid-cols-1 lg:grid-cols-2">
        <div className="relative aspect-[4/5] w-full lg:aspect-auto lg:h-full">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            priority
            sizes="(min-width:1024px) 50vw, 100vw"
            className="object-cover"
          />
          <Badge variant="drop" className="absolute bottom-4 left-4">
            Heavyweight fleece
          </Badge>
        </div>

        <div className="flex flex-col justify-center gap-6 px-gutter py-section">
          <Eyebrow>Fall / Winter 26</Eyebrow>

          <Display id="home-hero-title" size="xl" className="max-w-[12ch]">
            Wear what you <span className="text-signal">feel.</span>
          </Display>

          <p className="max-w-md text-base text-ink-soft">
            Heavyweight fleece, honest fits, small runs. Earn Care Points on every order.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="signal" size="lg">
              <Link href="/collections/all">Shop new arrivals</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/drops">Drop 01</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
