// tests/unit/storefront/motion.test.tsx
import * as React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CountUp, parseCountUp } from '@/components/storefront/motion/CountUp'
import { Reveal } from '@/components/storefront/motion/Reveal'
import { CatalogUnavailable } from '@/components/storefront/CatalogUnavailable'
import {
  PLACEHOLDER_SHAPES,
  ProductPlaceholder,
  placeholderImageUrl,
  placeholderShapeFor,
} from '@/components/storefront/ui/ProductPlaceholder'

afterEach(cleanup)

describe('Reveal', () => {
  it('renders its children immediately with the reveal hooks on the element', () => {
    const { container } = render(
      <Reveal as="li" variant="left" delay={120} className="tile">
        Hello
      </Reveal>
    )
    const node = container.querySelector('li')!
    expect(node).toHaveTextContent('Hello')
    expect(node).toHaveAttribute('data-reveal', 'left')
    // The content is in the DOM from the first render; only CSS (scoped to
    // scripting-enabled, motion-ok browsers) holds it back until it is observed.
    expect(node).not.toHaveAttribute('data-inview')
    expect(node.style.getPropertyValue('--sf-delay')).toBe('120ms')
    expect(node).toHaveClass('tile')
  })
})

describe('CountUp', () => {
  it('parses display values into prefix, number and suffix', () => {
    expect(parseCountUp('10K+')).toEqual({ prefix: '', number: 10, decimals: 0, suffix: 'K+' })
    expect(parseCountUp('4.9')).toEqual({ prefix: '', number: 4.9, decimals: 1, suffix: '' })
    expect(parseCountUp('$1,200')).toEqual({ prefix: '$', number: 1200, decimals: 0, suffix: '' })
    expect(parseCountUp('n/a')).toBeNull()
  })

  it('renders the final value as text (SSR / no observer / reduced motion)', () => {
    render(<CountUp value="10K+" />)
    expect(screen.getByText('10K+')).toBeInTheDocument()
  })

  it('leaves years static', () => {
    const { container } = render(<CountUp value="2025" />)
    expect(container.querySelector('[data-count-up]')).toBeNull()
    expect(screen.getByText('2025')).toBeInTheDocument()
  })
})

describe('ProductPlaceholder', () => {
  it('picks a stable silhouette per seed and a matching static asset', () => {
    const shape = placeholderShapeFor('core-hoodie')
    expect(PLACEHOLDER_SHAPES).toContain(shape)
    expect(placeholderShapeFor('core-hoodie')).toBe(shape)
    expect(placeholderImageUrl('core-hoodie')).toBe(`/assets/placeholders/${shape}.svg`)
  })

  it('is decorative inline SVG, never an <img>', () => {
    const { container } = render(
      <div style={{ position: 'relative' }}>
        <ProductPlaceholder seed="tee" shape="tee" />
      </div>
    )
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('data-placeholder', 'tee')
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('CatalogUnavailable preview', () => {
  it('shows a decorative placeholder lookbook that is not catalog content', () => {
    const { container } = render(<CatalogUnavailable />)
    expect(container.querySelector('[data-catalog="unconfigured"]')).not.toBeNull()
    const preview = container.querySelector('[data-catalog-preview]')!
    expect(preview).toHaveAttribute('aria-hidden', 'true')
    expect(preview.querySelectorAll('svg[data-placeholder]')).toHaveLength(5)
    expect(container.querySelectorAll('[data-product-handle]')).toHaveLength(0)
    expect(container.querySelectorAll('article')).toHaveLength(0)
  })

  it('can be rendered without the preview strip', () => {
    const { container } = render(<CatalogUnavailable preview={false} />)
    expect(container.querySelector('[data-catalog-preview]')).toBeNull()
  })
})
