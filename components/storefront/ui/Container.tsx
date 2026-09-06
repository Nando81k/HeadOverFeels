import * as React from 'react'
import { cn } from '@/lib/storefront/cn'

const CONTAINER_SIZE = {
  /** Full shop width, `--container-shop` (1440px). */
  shop: 'max-w-shop',
  /** Reading width for policies, editorial and forms. */
  narrow: 'max-w-3xl',
} as const

export type ContainerSize = keyof typeof CONTAINER_SIZE
export type ContainerTag = 'div' | 'section' | 'article' | 'main' | 'header' | 'footer' | 'nav'

export interface ContainerProps extends React.HTMLAttributes<HTMLElement> {
  /** Element to render. Defaults to `div`. */
  as?: ContainerTag
  /** Max width. Defaults to `shop`. */
  size?: ContainerSize
}

/**
 * Horizontal rhythm for every storefront page (spec §5.3): one max width and
 * the `--spacing-gutter` inline padding. Pages never set margins by hand.
 *
 * Only one `max-w-*` is emitted — `tailwind-merge` cannot resolve
 * `max-w-shop` against `max-w-3xl` (the token width is not in its config), so
 * both would survive and the narrower one would win by cascade accident.
 */
export function Container({
  as: Tag = 'div',
  size = 'shop',
  className,
  children,
  ...props
}: ContainerProps) {
  return (
    <Tag className={cn('mx-auto w-full px-gutter', CONTAINER_SIZE[size], className)} {...props}>
      {children}
    </Tag>
  )
}
