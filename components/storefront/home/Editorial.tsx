import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'

/** Craft detail rather than a product shot — the split is about how things are made. */
export const EDITORIAL_IMAGE = {
  src: '/assets/stitching_img.png',
  alt: 'Stitching detail on a Head Over Feels garment',
} as const

export interface EditorialProps {
  /** Override the still. Defaults to `EDITORIAL_IMAGE`. */
  image?: { src: string; alt: string }
  className?: string
}

/**
 * Brand story split (design spec §5.4 row `/`). Static copy — there is no
 * Shopify page behind it in Phase 2, and it renders identically whether or not
 * the store is configured, which is what keeps the unconfigured home page from
 * being a hero and nothing else.
 */
export function Editorial({ image = EDITORIAL_IMAGE, className }: EditorialProps) {
  return (
    <Section tone="paper" aria-labelledby="home-editorial" className={className}>
      <div className="grid items-center gap-gutter lg:grid-cols-2">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sharp bg-line lg:aspect-[4/3]">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width:1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>

        <div className="flex flex-col items-start gap-5">
          <Eyebrow>About</Eyebrow>
          <Display as="h2" id="home-editorial" size="md">
            Made in small runs
          </Display>

          <p className="max-w-prose text-base text-ink-soft">
            Heavyweight fleece, honest fits, small runs. Every piece starts with the weight of the
            fabric and the shape of the cut, and nothing ships until both feel right on.
          </p>
          <p className="max-w-prose text-base text-ink-soft">
            Because the runs are small, a colourway sells through and moves on rather than sitting
            on a shelf. Earn Care Points on every order.
          </p>

          <Button asChild variant="link">
            <Link href="/about">Our story</Link>
          </Button>
        </div>
      </div>
    </Section>
  )
}
