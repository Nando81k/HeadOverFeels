import * as React from 'react'
import { cn } from '@/lib/storefront/cn'

/* ------------------------------------------------------------------ Display */

const DISPLAY_SIZE = {
  xl: 'text-display-xl',
  lg: 'text-display-lg',
  md: 'text-display-md',
} as const

export type DisplaySize = keyof typeof DISPLAY_SIZE
export type DisplayTag = 'h1' | 'h2' | 'h3' | 'p' | 'span'

/**
 * Condensed Archivo width. Written as a Tailwind arbitrary property because
 * `font-stretch` has no theme namespace; the Archivo variable font is loaded
 * with the `wdth` axis (see `lib/storefront/fonts.ts`).
 */
const DISPLAY_BASE =
  'font-display font-black uppercase tracking-display leading-[0.9] [font-stretch:80%]'

export interface DisplayProps extends React.HTMLAttributes<HTMLElement> {
  /** Element to render. Defaults to `h1`; use `h2`/`h3` for in-page headings. */
  as?: DisplayTag
  /** Type scale from the tokens (`--text-display-*`). Defaults to `xl`. */
  size?: DisplaySize
}

/**
 * Oversized editorial headline (spec §5.2 / §5.1 type scale).
 *
 * Colour is inherited, not set: `[data-surface="storefront"]` already paints
 * ink on bone, and `Section tone="ink"` flips its subtree to bone — a hard
 * `text-ink` here would fight that. (It would also be dropped by
 * `tailwind-merge`, which groups `text-display-*` with the text-colour
 * utilities.) Pass `className="text-signal"` when a headline needs a colour.
 */
export function Display({
  as: Tag = 'h1',
  size = 'xl',
  className,
  children,
  ...props
}: DisplayProps) {
  return (
    <Tag className={cn(DISPLAY_BASE, DISPLAY_SIZE[size], className)} {...props}>
      {children}
    </Tag>
  )
}

/* ------------------------------------------------------------------ Eyebrow */

export type EyebrowTag = 'p' | 'span' | 'div' | 'h2' | 'h3'

export interface EyebrowProps extends React.HTMLAttributes<HTMLElement> {
  /** Element to render. Defaults to `p`. */
  as?: EyebrowTag
}

/** Small uppercase kicker above a `Display` or section (spec §5.2). */
export function Eyebrow({ as: Tag = 'p', className, children, ...props }: EyebrowProps) {
  return (
    <Tag
      className={cn(
        'm-0 text-[11px] font-semibold uppercase tracking-eyebrow text-ink-mute',
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

/* -------------------------------------------------------------------- Prose */

/**
 * Rhythm for long-form copy (Shopify `descriptionHtml`, policies, editorial).
 * Arbitrary variants instead of the typography plugin, which is not a
 * dependency and would drag in its own colour palette.
 */
const PROSE_BASE = [
  'prose-sf',
  'text-ink-soft leading-relaxed',
  '[&_p]:mb-4 [&_p:last-child]:mb-0',
  '[&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-line-strong hover:[&_a]:text-ink',
  '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:mb-1',
  '[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-lg [&_h2]:uppercase [&_h2]:tracking-display [&_h2]:text-ink',
  '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-eyebrow [&_h3]:text-ink',
  '[&_strong]:font-semibold [&_strong]:text-ink',
  '[&_img]:my-6 [&_img]:w-full',
  '[&_hr]:my-8 [&_hr]:border-line',
].join(' ')

type ProseOwnProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children' | 'dangerouslySetInnerHTML'
>

/**
 * Either `children` or `html` — never both, so a caller can't accidentally
 * have React content silently discarded by `dangerouslySetInnerHTML`.
 */
export type ProseProps = ProseOwnProps &
  (
    | { html: string; children?: never }
    | { html?: undefined; children?: React.ReactNode }
  )

/**
 * Long-form copy wrapper (spec §5.2). `html` takes trusted markup from
 * Shopify (`descriptionHtml`, policy bodies); anything user-generated must be
 * sanitised before it gets here.
 */
export function Prose({ className, html, children, ...props }: ProseProps) {
  if (html !== undefined) {
    return (
      <div
        className={cn(PROSE_BASE, className)}
        dangerouslySetInnerHTML={{ __html: html }}
        {...props}
      />
    )
  }

  return (
    <div className={cn(PROSE_BASE, className)} {...props}>
      {children}
    </div>
  )
}
