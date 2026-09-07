import * as React from 'react'
import Image from 'next/image'
import type { ShopImage } from '@/lib/shopify/types'
import { Display, Eyebrow, Prose } from '@/components/storefront/ui/Typography'
import { cn } from '@/lib/storefront/cn'

export interface CollectionHeaderProps {
  title: string
  /** Shopify `descriptionHtml`; rendered through `Prose` when non-empty. */
  descriptionHtml?: string | null
  /** Collection banner. Rendered 3:1 above the copy when present. */
  image?: ShopImage | null
  /** Small kicker above the title. Omitted when absent. */
  eyebrow?: string
  className?: string
}

/** Sizes hint for the full-bleed collection banner. */
const BANNER_SIZES = '(min-width:1440px) 1440px, 100vw'

/**
 * Title block at the top of a collection (spec §5.4 `/collections/[handle]`):
 * optional banner, optional eyebrow, `Display` title, description.
 */
export function CollectionHeader({
  title,
  descriptionHtml,
  image,
  eyebrow,
  className,
}: CollectionHeaderProps) {
  const description = descriptionHtml?.trim() ? descriptionHtml : null

  return (
    <header data-collection-header="" className={cn('flex flex-col gap-6', className)}>
      {image ? (
        <div className="relative aspect-[3/1] w-full overflow-hidden rounded-sharp bg-rose-tint">
          <Image
            src={image.url}
            alt={image.altText ?? title}
            fill
            sizes={BANNER_SIZES}
            priority
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="flex max-w-3xl flex-col gap-4">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Display as="h1" size="lg">
          {title}
        </Display>
        {description ? <Prose html={description} /> : null}
      </div>
    </header>
  )
}
