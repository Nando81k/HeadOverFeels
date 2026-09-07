import { cn } from '@/lib/storefront/cn'

const DOT_SIZE = {
  sm: 'size-2',
  md: 'size-2.5',
} as const

export type SwatchDotSize = keyof typeof DOT_SIZE

export interface SwatchDotsProps {
  /** Colour options from `ProductCardData['swatches']`; `color` is a CSS colour. */
  swatches: { name: string; color: string | null }[]
  /** Dots rendered before the "+N" overflow item. */
  max?: number
  size?: SwatchDotSize
  className?: string
}

/**
 * Colour swatch dots for a product card (design spec §5.2).
 *
 * The dot colour is merchandiser data, not a design token, so it arrives as an
 * inline `background-color`; a value with no admin swatch falls back to the
 * neutral `bg-line` token rather than rendering an invisible dot.
 */
export function SwatchDots({ swatches, max = 4, size = 'md', className }: SwatchDotsProps) {
  if (swatches.length === 0) return null

  const shown = swatches.slice(0, max)
  const overflow = swatches.length - shown.length

  return (
    <ul aria-label="Colours" className={cn('flex items-center gap-1.5', className)}>
      {shown.map((swatch) => (
        <li
          key={swatch.name}
          title={swatch.name}
          className={cn(
            DOT_SIZE[size],
            'rounded-pill border border-line-strong',
            swatch.color ? null : 'bg-line'
          )}
          style={{ backgroundColor: swatch.color ?? undefined }}
        />
      ))}
      {overflow > 0 ? <li className="text-[10px] text-ink-mute">+{overflow}</li> : null}
    </ul>
  )
}
