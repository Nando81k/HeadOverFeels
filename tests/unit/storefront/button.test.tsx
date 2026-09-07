import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/storefront/ui/Button'
import { IconButton } from '@/components/storefront/ui/IconButton'
import { Badge } from '@/components/storefront/ui/Badge'

afterEach(cleanup)

describe('Button', () => {
  it('renders a <button type="button"> by default', () => {
    render(<Button>Add to bag</Button>)
    const btn = screen.getByRole('button', { name: 'Add to bag' })
    expect(btn.tagName).toBe('BUTTON')
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('allows the type to be overridden', () => {
    render(<Button type="submit">Submit</Button>)
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit')
  })

  it('applies the default ink variant classes', () => {
    render(<Button>Shop</Button>)
    const btn = screen.getByRole('button', { name: 'Shop' })
    expect(btn.className).toContain('bg-ink')
    expect(btn.className).toContain('text-bone')
    expect(btn.className).toContain('rounded-sharp')
  })

  it('includes the token focus ring', () => {
    render(<Button>Focus</Button>)
    expect(screen.getByRole('button', { name: 'Focus' }).className).toContain(
      'focus-visible:outline-signal'
    )
  })

  it('variant "signal" includes bg-signal', () => {
    render(<Button variant="signal">Buy</Button>)
    expect(screen.getByRole('button', { name: 'Buy' }).className).toContain('bg-signal')
  })

  it('variant "outline" includes a border and transparent background', () => {
    render(<Button variant="outline">Outline</Button>)
    const cls = screen.getByRole('button', { name: 'Outline' }).className
    expect(cls).toContain('border-ink')
    expect(cls).toContain('bg-transparent')
  })

  it('variant "link" underlines and drops padding/height', () => {
    render(<Button variant="link">Link</Button>)
    const cls = screen.getByRole('button', { name: 'Link' }).className
    expect(cls).toContain('hover:underline')
    expect(cls).toContain('p-0')
    expect(cls).not.toContain('h-11')
  })

  it('size "lg" includes the 48px min height class', () => {
    render(<Button size="lg">Large</Button>)
    const cls = screen.getByRole('button', { name: 'Large' }).className
    expect(cls).toContain('min-h-12')
    expect(cls).toContain('h-12')
  })

  it('size "sm" includes h-9', () => {
    render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button', { name: 'Small' }).className).toContain('h-9')
  })

  it('asChild renders the child element carrying the button classes', () => {
    render(
      <Button asChild variant="signal">
        <a href="https://shop.example.com/collections/all">Shop all</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Shop all' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', 'https://shop.example.com/collections/all')
    expect(link.className).toContain('bg-signal')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('loading sets aria-busy, disables the button and renders a hidden spinner', () => {
    const { container } = render(<Button loading>Adding</Button>)
    const btn = screen.getByRole('button', { name: 'Adding' })
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn).toBeDisabled()
    const spinner = container.querySelector('svg')
    expect(spinner).not.toBeNull()
    expect(spinner).toHaveAttribute('aria-hidden', 'true')
  })

  it('is not aria-busy when not loading', () => {
    render(<Button>Idle</Button>)
    expect(screen.getByRole('button', { name: 'Idle' })).not.toHaveAttribute('aria-busy', 'true')
  })

  it('does not fire onClick while loading', async () => {
    const onClick = vi.fn<() => void>()
    render(
      <Button loading onClick={onClick}>
        Adding
      </Button>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Adding' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('fires onClick when enabled', async () => {
    const onClick = vi.fn<() => void>()
    render(<Button onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('merges a custom className', () => {
    render(<Button className="w-full">Wide</Button>)
    expect(screen.getByRole('button', { name: 'Wide' }).className).toContain('w-full')
  })
})

describe('IconButton', () => {
  it('sets aria-label from the required label prop', () => {
    render(
      <IconButton label="Open cart">
        <svg aria-hidden="true" />
      </IconButton>
    )
    const btn = screen.getByRole('button', { name: 'Open cart' })
    expect(btn).toHaveAttribute('aria-label', 'Open cart')
  })

  it('has a 44px minimum hit target', () => {
    render(
      <IconButton label="Search">
        <svg aria-hidden="true" />
      </IconButton>
    )
    const cls = screen.getByRole('button', { name: 'Search' }).className
    expect(cls).toContain('min-h-11')
    expect(cls).toContain('min-w-11')
    expect(cls).toContain('rounded-sharp')
  })

  it('defaults to type="button" and the ghost variant', () => {
    render(
      <IconButton label="Menu">
        <svg aria-hidden="true" />
      </IconButton>
    )
    const btn = screen.getByRole('button', { name: 'Menu' })
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn.className).toContain('hover:bg-rose-tint')
  })

  it('supports the ink and outline variants', () => {
    const { rerender } = render(
      <IconButton label="Ink" variant="ink">
        <svg aria-hidden="true" />
      </IconButton>
    )
    expect(screen.getByRole('button', { name: 'Ink' }).className).toContain('bg-ink')
    rerender(
      <IconButton label="Ink" variant="outline">
        <svg aria-hidden="true" />
      </IconButton>
    )
    expect(screen.getByRole('button', { name: 'Ink' }).className).toContain('border-ink')
  })

  it('renders its icon child', () => {
    const { container } = render(
      <IconButton label="Close">
        <svg data-testid="icon" aria-hidden="true" />
      </IconButton>
    )
    expect(container.querySelector('[data-testid="icon"]')).not.toBeNull()
  })
})

describe('Badge', () => {
  it('variant "soldout" renders "Sold out" in uppercase eyebrow type', () => {
    render(<Badge variant="soldout" />)
    const badge = screen.getByText('Sold out')
    expect(badge.className).toContain('uppercase')
    expect(badge.className).toContain('tracking-eyebrow')
    expect(badge.className).toContain('bg-ink-mute')
    expect(badge.className).toContain('text-bone')
  })

  it('renders the default label per variant', () => {
    const { rerender } = render(<Badge variant="sale" />)
    expect(screen.getByText('Sale').className).toContain('bg-signal')
    rerender(<Badge variant="drop" />)
    expect(screen.getByText('Drop').className).toContain('bg-ink')
    rerender(<Badge variant="new" />)
    expect(screen.getByText('New').className).toContain('bg-paper')
  })

  it('renders nothing for the neutral variant with no children', () => {
    const { container } = render(<Badge variant="neutral" />)
    expect(container.textContent).toBe('')
  })

  it('children override the default label', () => {
    render(<Badge variant="sale">-40%</Badge>)
    expect(screen.getByText('-40%')).toBeInTheDocument()
    expect(screen.queryByText('Sale')).toBeNull()
  })

  it('defaults to the neutral variant and merges className', () => {
    render(<Badge className="ml-2">Members only</Badge>)
    const badge = screen.getByText('Members only')
    expect(badge.className).toContain('bg-rose-tint')
    expect(badge.className).toContain('ml-2')
    expect(badge.className).toContain('rounded-sharp')
  })
})
