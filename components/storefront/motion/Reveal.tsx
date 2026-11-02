'use client'

import * as React from 'react'
import { cn } from '@/lib/storefront/cn'

export type RevealVariant = 'up' | 'left' | 'right' | 'zoom' | 'fade'
export type RevealTag = 'div' | 'section' | 'li' | 'ul' | 'span' | 'article' | 'figure' | 'header'

export interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  /** Element to render. Defaults to `div`. */
  as?: RevealTag
  /** Direction the content arrives from. Defaults to `up`. */
  variant?: RevealVariant
  /** Extra delay in ms — stagger siblings with `index * 60`. */
  delay?: number
  /** How much of the element must be visible before it reveals (0–1). */
  threshold?: number
  /** Reveal once and stay (default), or hide again when scrolled out. */
  once?: boolean
}

/** Trailing-edge margin: start the reveal a little before the element enters. */
const ROOT_MARGIN = '0px 0px -8% 0px'

/**
 * Viewport reveal (motion.css, "reveals").
 *
 * Renders its children immediately — on the server, without JS, and in jsdom
 * — and only *hides* them via CSS scoped to `@media (scripting: enabled)`.
 * After mount an `IntersectionObserver` flips `data-inview`, which motion.css
 * transitions to the resting state. Users with `prefers-reduced-motion` never
 * see the hidden state at all (the CSS is inside a `no-preference` block).
 *
 * Where `IntersectionObserver` is missing it reveals on mount, so nothing is
 * ever stranded invisible.
 */
export function Reveal({
  as: Tag = 'div',
  variant = 'up',
  delay = 0,
  threshold = 0.12,
  once = true,
  className,
  style,
  children,
  ...props
}: RevealProps) {
  const ref = React.useRef<HTMLElement>(null)
  const [inView, setInView] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver !== 'function') {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true)
            if (once) observer.disconnect()
          } else if (!once) {
            setInView(false)
          }
        }
      },
      { threshold, rootMargin: ROOT_MARGIN }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, once])

  const mergedStyle =
    delay > 0 ? ({ ...style, '--sf-delay': `${delay}ms` } as React.CSSProperties) : style

  return (
    <Tag
      // The ref type is widened per tag; React 19 accepts the object ref directly.
      ref={ref as React.Ref<never>}
      data-reveal={variant}
      data-inview={inView ? '' : undefined}
      className={cn(className)}
      style={mergedStyle}
      {...props}
    >
      {children}
    </Tag>
  )
}
