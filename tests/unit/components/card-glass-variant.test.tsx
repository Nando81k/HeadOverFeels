// tests/unit/components/card-glass-variant.test.tsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card } from '@/components/ui/card'

describe('Card glass variant', () => {
  it('applies glass styling via variant prop', () => {
    const { container } = render(<Card variant="glass">content</Card>)
    const card = container.firstChild as HTMLElement
    // glass variant should include backdrop-blur and white/2 bg
    expect(card.className).toMatch(/backdrop-blur/)
  })
})
