import * as React from 'react'
import { cn } from '@/lib/storefront/cn'

/** Garment silhouettes the placeholder can draw, in hash order. */
export const PLACEHOLDER_SHAPES = ['hoodie', 'tee', 'crewneck', 'cap', 'tote'] as const
export type PlaceholderShape = (typeof PLACEHOLDER_SHAPES)[number]

/** Line art for each shape, drawn on a 400×500 (4:5) canvas. */
const SHAPE_PATHS: Record<PlaceholderShape, string[]> = {
  hoodie: [
    'M150 182 C150 118 250 118 250 182',
    'M166 190 C166 150 234 150 234 190',
    'M150 182 L108 202 L94 302 L130 312 L130 422 L270 422 L270 312 L306 302 L292 202 L250 182',
    'M160 332 H240 V392 H160 Z',
    'M190 206 V256 M210 206 V256',
  ],
  tee: [
    'M140 170 L100 200 L120 252 L146 242 L146 400 L254 400 L254 242 L280 252 L300 200 L260 170 C240 202 160 202 140 170 Z',
    'M166 170 C180 196 220 196 234 170',
  ],
  crewneck: [
    'M150 170 L96 200 L86 322 L124 328 L130 412 L270 412 L276 328 L314 322 L304 200 L250 170 C236 192 164 192 150 170 Z',
    'M130 398 H270 M124 314 L130 316 M276 314 L270 316',
    'M164 170 C178 190 222 190 236 170',
  ],
  cap: [
    'M118 282 C118 188 282 188 282 282 Z',
    'M118 282 Q200 334 330 300 Q322 282 282 282',
    'M200 198 V282 M150 214 L172 282 M250 214 L228 282',
  ],
  tote: [
    'M118 222 H282 V424 H118 Z',
    'M154 222 C154 148 246 148 246 222',
    'M164 222 C164 162 236 162 236 222',
  ],
}

/** Small, stable hash so a product always draws the same silhouette. */
export function placeholderShapeFor(seed: string): PlaceholderShape {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return PLACEHOLDER_SHAPES[hash % PLACEHOLDER_SHAPES.length]
}

/** Static copies of the same art, for places that need a URL rather than markup. */
export function placeholderImageUrl(seed: string): string {
  return `/assets/placeholders/${placeholderShapeFor(seed)}.svg`
}

export interface ProductPlaceholderProps extends React.SVGAttributes<SVGSVGElement> {
  /** Product handle or title — picks the silhouette. */
  seed: string
  /** Force a silhouette instead of hashing `seed`. */
  shape?: PlaceholderShape
  /** Paper (default) or the heritage rose tint. */
  tone?: 'paper' | 'rose'
}

/**
 * Decorative stand-in for a missing product photo (spec §5.2 "product
 * photography does the work" — until it exists, this does).
 *
 * Inline SVG rather than an `<img>`: it inherits the storefront tokens through
 * CSS variables (no hex, so the lint rule holds), costs no request, and is
 * `aria-hidden` — the surrounding card already names the product.
 */
export function ProductPlaceholder({
  seed,
  shape,
  tone = 'paper',
  className,
  ...props
}: ProductPlaceholderProps) {
  const resolved = shape ?? placeholderShapeFor(seed)
  const patternId = `sf-hatch-${resolved}`

  return (
    <svg
      aria-hidden="true"
      data-placeholder={resolved}
      viewBox="0 0 400 500"
      preserveAspectRatio="xMidYMid slice"
      className={cn(
        'absolute inset-0 size-full',
        tone === 'rose' ? 'bg-rose-tint' : 'bg-paper',
        className
      )}
      {...props}
    >
      <defs>
        <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="14" stroke="var(--color-ink)" strokeOpacity="0.07" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="400" height="500" fill={`url(#${patternId})`} />
      <g fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" strokeOpacity="0.85">
        {SHAPE_PATHS[resolved].map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <circle cx="312" cy="452" r="5" fill="var(--color-signal)" />
      <text
        x="28"
        y="462"
        fill="var(--color-ink)"
        fontFamily="var(--font-display)"
        fontWeight="900"
        fontSize="28"
        letterSpacing="-0.03em"
      >
        HOF
      </text>
    </svg>
  )
}
