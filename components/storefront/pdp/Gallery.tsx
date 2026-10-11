'use client'

import * as React from 'react'
import Image from 'next/image'
import { Expand } from 'lucide-react'
import type { ShopImage } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { Dialog } from '@/components/storefront/ui/Dialog'
import { IconButton } from '@/components/storefront/ui/IconButton'

/** 4:5 media box, shared by the main figure, the thumbs and the zoom dialog. */
const RATIO = 'aspect-[4/5]'

export interface GalleryProps {
  images: ShopImage[]
  /** Product title — the alt fallback and the accessible name of the figure. */
  title: string
  /** Image to open on (the selected variant's image). Defaults to the first. */
  initialIndex?: number
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0
  if (!Number.isFinite(index)) return 0
  return Math.min(Math.max(0, Math.trunc(index)), length - 1)
}

/**
 * PDP gallery (spec §5.4): a thumb rail beside a 4:5 main image on md+, the
 * same strip below the image on mobile, arrow-key navigation on the figure and
 * a zoom `Dialog`.
 *
 * `'use client'`: it owns the selected index and the zoom state.
 */
export function Gallery({ images, title, initialIndex = 0 }: GalleryProps) {
  const [index, setIndex] = React.useState(() => clampIndex(initialIndex, images.length))
  const [zoomed, setZoomed] = React.useState(false)

  // A variant change re-renders the server page with a new `initialIndex`; the
  // client state has to follow it rather than pin the first choice forever.
  React.useEffect(() => {
    setIndex(clampIndex(initialIndex, images.length))
  }, [initialIndex, images.length])

  if (images.length === 0) {
    return (
      <div
        data-gallery="empty"
        aria-hidden="true"
        className={cn(RATIO, 'w-full rounded-sharp bg-line')}
      />
    )
  }

  const current = images[clampIndex(index, images.length)]
  const alt = current.altText ?? title

  const step = (delta: number) => {
    setIndex((previous) => (previous + delta + images.length) % images.length)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (images.length < 2) return
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    }
  }

  return (
    <div data-gallery="" className="grid gap-4 md:grid-cols-[4.5rem_minmax(0,1fr)]">
      <div
        className={cn(
          'order-2 flex gap-2 overflow-x-auto md:order-1 md:flex-col md:overflow-x-visible'
        )}
      >
        {images.map((image, position) => {
          const active = position === index
          return (
            <button
              key={`${image.url}-${position}`}
              type="button"
              aria-label={`Show image ${position + 1}`}
              aria-pressed={active}
              onClick={() => setIndex(position)}
              className={cn(
                RATIO,
                'relative w-18 shrink-0 overflow-hidden rounded-sharp bg-line',
                'transition-opacity duration-sf-fast ease-sf-out',
                'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
                active ? 'outline-2 outline-solid outline-ink' : 'opacity-70 hover:opacity-100'
              )}
            >
              <Image src={image.url} alt="" aria-hidden="true" fill sizes="72px" className="object-cover" />
            </button>
          )
        })}
      </div>

      <figure
        role="group"
        aria-label={`${title} gallery`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative order-1 m-0 md:order-2',
          'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
        )}
      >
        <div className={cn(RATIO, 'relative overflow-hidden rounded-sharp bg-line')}>
          <Image
            src={current.url}
            alt={alt}
            fill
            priority={index === 0}
            sizes="(min-width:1024px) 58vw, 100vw"
            className="object-cover"
          />
        </div>

        <IconButton
          label="Zoom image"
          variant="outline"
          onClick={() => setZoomed(true)}
          className="absolute right-3 top-3 bg-paper"
        >
          <Expand aria-hidden="true" className="size-4" />
        </IconButton>
      </figure>

      <Dialog open={zoomed} onOpenChange={setZoomed} size="lg" title={alt}>
        {zoomed ? (
          <div className={cn(RATIO, 'relative mx-auto w-full max-w-2xl')}>
            <Image
              src={current.url}
              alt={alt}
              fill
              sizes="(min-width:768px) 48rem, 100vw"
              className="object-contain"
            />
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}
