// tests/unit/components/TabPills.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TabPills } from '@/components/ui/TabPills'

const tabs = [
  { id: 'all', label: 'All Products', count: 428 },
  { id: 'drops', label: 'Active Drops', count: 2, variant: 'live' as const },
  { id: 'drafts', label: 'Drafts', count: 8 },
]

describe('TabPills', () => {
  it('renders all tab labels', () => {
    render(<TabPills tabs={tabs} active="all" onChange={() => {}} />)
    expect(screen.getByText('All Products')).toBeInTheDocument()
    expect(screen.getByText('Active Drops')).toBeInTheDocument()
    expect(screen.getByText('Drafts')).toBeInTheDocument()
  })

  it('renders count badges', () => {
    render(<TabPills tabs={tabs} active="all" onChange={() => {}} />)
    expect(screen.getByText('428')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('calls onChange when a tab is clicked', async () => {
    const onChange = vi.fn()
    render(<TabPills tabs={tabs} active="all" onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: /Drafts/ }))
    expect(onChange).toHaveBeenCalledWith('drafts')
  })

  it('marks the active tab with aria-selected', () => {
    render(<TabPills tabs={tabs} active="drops" onChange={() => {}} />)
    const activeTab = screen.getByRole('tab', { name: /Active Drops/ })
    expect(activeTab).toHaveAttribute('aria-selected', 'true')
  })
})
