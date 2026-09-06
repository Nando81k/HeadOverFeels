import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Display, Eyebrow, Prose } from '@/components/storefront/ui/Typography'
import { Container } from '@/components/storefront/ui/Container'
import { Section } from '@/components/storefront/ui/Section'

afterEach(cleanup)

describe('Display', () => {
  it('renders an <h1> by default', () => {
    render(<Display>Head Over Feels</Display>)
    const el = screen.getByRole('heading', { level: 1, name: 'Head Over Feels' })
    expect(el.tagName).toBe('H1')
  })

  it('applies the display type classes', () => {
    render(<Display>Drop 01</Display>)
    const cls = screen.getByRole('heading', { name: 'Drop 01' }).className
    expect(cls).toContain('font-display')
    expect(cls).toContain('uppercase')
    expect(cls).toContain('tracking-display')
    expect(cls).toContain('font-black')
  })

  it('applies the condensed Archivo width', () => {
    render(<Display>Condensed</Display>)
    expect(screen.getByRole('heading', { name: 'Condensed' }).className).toContain(
      '[font-stretch:80%]'
    )
  })

  it('defaults to size "xl"', () => {
    render(<Display>Big</Display>)
    expect(screen.getByRole('heading', { name: 'Big' }).className).toContain('text-display-xl')
  })

  it('maps size "lg" and "md" to the matching token utility', () => {
    const { rerender } = render(<Display size="lg">Sized</Display>)
    let cls = screen.getByRole('heading', { name: 'Sized' }).className
    expect(cls).toContain('text-display-lg')
    expect(cls).not.toContain('text-display-xl')

    rerender(<Display size="md">Sized</Display>)
    cls = screen.getByRole('heading', { name: 'Sized' }).className
    expect(cls).toContain('text-display-md')
    expect(cls).not.toContain('text-display-lg')
  })

  it('renders the element named by `as`, keeping the display classes', () => {
    render(<Display as="h2">Section title</Display>)
    const el = screen.getByRole('heading', { level: 2, name: 'Section title' })
    expect(el.tagName).toBe('H2')
    expect(el.className).toContain('font-display')
    expect(el.className).toContain('text-display-xl')
  })

  it('supports non-heading elements', () => {
    const { container } = render(<Display as="span">Inline</Display>)
    expect(container.querySelector('span')?.textContent).toBe('Inline')
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('merges a custom className and forwards attributes', () => {
    render(
      <Display className="text-center" id="hero-title">
        Merged
      </Display>
    )
    const el = screen.getByRole('heading', { name: 'Merged' })
    expect(el.className).toContain('text-center')
    expect(el).toHaveAttribute('id', 'hero-title')
  })
})

describe('Eyebrow', () => {
  it('renders a <p> with the eyebrow type classes', () => {
    const { container } = render(<Eyebrow>New in</Eyebrow>)
    const el = container.querySelector('p')
    expect(el).not.toBeNull()
    expect(el?.textContent).toBe('New in')
    expect(el?.className).toContain('tracking-eyebrow')
    expect(el?.className).toContain('uppercase')
    expect(el?.className).toContain('text-ink-mute')
    expect(el?.className).toContain('font-semibold')
  })

  it('renders the element named by `as`', () => {
    const { container } = render(<Eyebrow as="span">Drop</Eyebrow>)
    expect(container.querySelector('p')).toBeNull()
    const el = container.querySelector('span')
    expect(el?.className).toContain('tracking-eyebrow')
  })

  it('merges a custom className and forwards attributes', () => {
    const { container } = render(
      <Eyebrow className="mb-2" data-testid="eyebrow">
        Label
      </Eyebrow>
    )
    const el = container.querySelector('[data-testid="eyebrow"]')
    expect(el?.className).toContain('mb-2')
  })
})

describe('Prose', () => {
  it('renders the html prop as markup', () => {
    const { container } = render(
      <Prose html="<p>Made in <strong>Los Angeles</strong>.</p><ul><li>Cotton</li></ul>" />
    )
    expect(container.querySelector('strong')?.textContent).toBe('Los Angeles')
    expect(container.querySelectorAll('li')).toHaveLength(1)
    expect(screen.getByText('Cotton')).toBeInTheDocument()
  })

  it('renders children when no html is given', () => {
    render(
      <Prose>
        <p>Hand written copy</p>
      </Prose>
    )
    expect(screen.getByText('Hand written copy')).toBeInTheDocument()
  })

  it('renders a <div> carrying the prose spacing classes', () => {
    const { container } = render(<Prose html="<p>Body</p>" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.tagName).toBe('DIV')
    expect(el.className).toContain('prose-sf')
    expect(el.className).toContain('[&_p]:mb-4')
    expect(el.className).toContain('[&_p:last-child]:mb-0')
    expect(el.className).toContain('[&_a]:underline')
    expect(el.className).toContain('[&_ul]:list-disc')
    expect(el.className).toContain('text-ink-soft')
  })

  it('merges a custom className', () => {
    const { container } = render(<Prose className="max-w-prose" html="<p>Body</p>" />)
    expect((container.firstElementChild as HTMLElement).className).toContain('max-w-prose')
  })
})

describe('Container', () => {
  it('renders a <div> with the shop width and gutter', () => {
    const { container } = render(<Container>Inside</Container>)
    const el = container.firstElementChild as HTMLElement
    expect(el.tagName).toBe('DIV')
    expect(el.className).toContain('max-w-shop')
    expect(el.className).toContain('px-gutter')
    expect(el.className).toContain('mx-auto')
    expect(el.textContent).toBe('Inside')
  })

  it('size "narrow" swaps in the narrow max width', () => {
    const { container } = render(<Container size="narrow">Inside</Container>)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('max-w-3xl')
    expect(el.className).not.toContain('max-w-shop')
    expect(el.className).toContain('px-gutter')
  })

  it('renders the element named by `as` and forwards attributes', () => {
    const { container } = render(
      <Container as="main" id="main-content">
        Inside
      </Container>
    )
    const el = container.querySelector('main')
    expect(el).not.toBeNull()
    expect(el).toHaveAttribute('id', 'main-content')
  })

  it('merges a custom className', () => {
    const { container } = render(<Container className="py-4">Inside</Container>)
    expect((container.firstElementChild as HTMLElement).className).toContain('py-4')
  })
})

describe('Section', () => {
  it('renders a <section> with section rhythm and the default bone tone', () => {
    const { container } = render(<Section>Body</Section>)
    const section = container.querySelector('section')
    expect(section).not.toBeNull()
    expect(section?.className).toContain('py-section')
    expect(section?.className).toContain('bg-bone')
    expect(section?.className).toContain('text-ink')
  })

  it('tone "ink" inverts to ink background with bone text', () => {
    const { container } = render(<Section tone="ink">Body</Section>)
    const section = container.querySelector('section')
    expect(section?.className).toContain('bg-ink')
    expect(section?.className).toContain('text-bone')
    expect(section?.className).toContain('py-section')
    expect(section?.className).not.toContain('bg-bone')
  })

  it('tone "paper" uses the paper background', () => {
    const { container } = render(<Section tone="paper">Body</Section>)
    const section = container.querySelector('section')
    expect(section?.className).toContain('bg-paper')
    expect(section?.className).toContain('text-ink')
  })

  it('wraps children in a Container by default', () => {
    const { container } = render(
      <Section>
        <p data-testid="child">Body</p>
      </Section>
    )
    const child = container.querySelector('[data-testid="child"]')
    const parent = child?.parentElement as HTMLElement
    expect(parent.className).toContain('max-w-shop')
    expect(parent.className).toContain('px-gutter')
    expect(parent.parentElement?.tagName).toBe('SECTION')
  })

  it('passes the container size through', () => {
    const { container } = render(
      <Section size="narrow">
        <p data-testid="child">Body</p>
      </Section>
    )
    const parent = container.querySelector('[data-testid="child"]')?.parentElement as HTMLElement
    expect(parent.className).toContain('max-w-3xl')
  })

  it('bleed renders children directly, with no inner container', () => {
    const { container } = render(
      <Section bleed>
        <p data-testid="child">Body</p>
      </Section>
    )
    const child = container.querySelector('[data-testid="child"]')
    expect(child?.parentElement?.tagName).toBe('SECTION')
    expect(container.querySelector('.max-w-shop')).toBeNull()
  })

  it('renders the element named by `as` and forwards id / aria attributes', () => {
    const { container } = render(
      <Section as="div" id="drops" aria-labelledby="drops-title">
        Body
      </Section>
    )
    expect(container.querySelector('section')).toBeNull()
    const el = container.firstElementChild as HTMLElement
    expect(el.tagName).toBe('DIV')
    expect(el).toHaveAttribute('id', 'drops')
    expect(el).toHaveAttribute('aria-labelledby', 'drops-title')
  })

  it('merges a custom className onto the section, not the container', () => {
    const { container } = render(<Section className="border-t border-line">Body</Section>)
    const section = container.querySelector('section') as HTMLElement
    expect(section.className).toContain('border-line')
  })
})
