'use client'

import * as React from 'react'

export interface CountUpProps {
  /** Display value such as "10K+", "4.9", "2025" or "100%". */
  value: string
  /** Animation length in ms. */
  duration?: number
  className?: string
}

/** Splits "10K+" into prefix "", number 10, suffix "K+" (null when no number). */
export function parseCountUp(value: string): { prefix: string; number: number; decimals: number; suffix: string } | null {
  const match = /^([^\d]*)(\d[\d,]*)(\.\d+)?(.*)$/.exec(value.trim())
  if (!match) return null
  const [, prefix, whole, fraction = '', suffix] = match
  const number = Number(`${whole.replace(/,/g, '')}${fraction}`)
  if (!Number.isFinite(number)) return null
  return { prefix, number, decimals: fraction ? fraction.length - 1 : 0, suffix }
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * A number that counts up from zero the first time it scrolls into view.
 *
 * Server render, no-JS, jsdom and `prefers-reduced-motion` all show the final
 * value as plain text — the count is a client-only flourish layered on top.
 * Years (four digits, no suffix) are left static: "2025" counting from zero
 * reads as a glitch, not a flourish.
 */
export function CountUp({ value, duration = 1200, className }: CountUpProps) {
  const parsed = React.useMemo(() => parseCountUp(value), [value])
  const isYear = parsed !== null && /^\d{4}$/.test(value.trim())
  const animatable = parsed !== null && !isYear
  const ref = React.useRef<HTMLSpanElement>(null)
  const [shown, setShown] = React.useState<string>(value)

  React.useEffect(() => {
    const node = ref.current
    if (!node || !animatable || !parsed) return
    if (typeof IntersectionObserver !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const run = () => {
      const start = performance.now()
      const format = (n: number) =>
        `${parsed.prefix}${n.toLocaleString('en-US', {
          minimumFractionDigits: parsed.decimals,
          maximumFractionDigits: parsed.decimals,
        })}${parsed.suffix}`
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        setShown(format(parsed.number * easeOut(t)))
        if (t < 1) frame = requestAnimationFrame(tick)
        else setShown(value)
      }
      setShown(format(0))
      frame = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          run()
        }
      },
      { threshold: 0.4 }
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [animatable, parsed, duration, value])

  return (
    <span ref={ref} data-count-up={animatable ? '' : undefined} className={className}>
      {shown}
    </span>
  )
}
