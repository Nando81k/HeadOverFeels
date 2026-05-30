// tests/unit/components/admin/AdminHeaderV2.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AdminHeaderV2 } from '@/components/admin/v2/AdminHeaderV2'

describe('AdminHeaderV2', () => {
  it('renders title and subtitle', () => {
    render(<AdminHeaderV2 title="Products" subtitle="428 active · 12 low stock" />)
    expect(screen.getByText('Products')).toBeInTheDocument()
    expect(screen.getByText('428 active · 12 low stock')).toBeInTheDocument()
  })

  it('renders search trigger', () => {
    render(<AdminHeaderV2 title="X" />)
    expect(screen.getByText(/Search anything/)).toBeInTheDocument()
  })

  it('renders custom actions slot', () => {
    render(<AdminHeaderV2 title="X" actions={<button>+ New</button>} />)
    expect(screen.getByRole('button', { name: '+ New' })).toBeInTheDocument()
  })
})
