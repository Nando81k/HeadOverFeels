import * as React from 'react'
import { Container, type ContainerSize } from '@/components/storefront/ui/Container'
import { cn } from '@/lib/storefront/cn'

const SECTION_TONE = {
  bone: 'bg-bone text-ink',
  paper: 'bg-paper text-ink',
  ink: 'bg-ink text-bone',
} as const

export type SectionTone = keyof typeof SECTION_TONE
export type SectionTag = 'section' | 'div' | 'article' | 'aside' | 'header' | 'footer'

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Element to render. Defaults to `section`. */
  as?: SectionTag
  /** Surface colour. Defaults to `bone` (the page background). */
  tone?: SectionTone
  /** Width of the inner `Container`. Ignored when `bleed` is set. */
  size?: ContainerSize
  /** Skip the inner `Container` — for full-bleed media, marquees and grids. */
  bleed?: boolean
}

/**
 * Vertical page rhythm (spec §5.3): every page is a stack of `Section`s, each
 * one `--spacing-section` tall and carrying its own surface tone. Children are
 * wrapped in a `Container` unless `bleed` is set.
 *
 * `id`, `aria-labelledby` and any other attribute land on the outer element.
 */
export function Section({
  as: Tag = 'section',
  tone = 'bone',
  size = 'shop',
  bleed = false,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <Tag className={cn('py-section', SECTION_TONE[tone], className)} {...props}>
      {bleed ? children : <Container size={size}>{children}</Container>}
    </Tag>
  )
}
