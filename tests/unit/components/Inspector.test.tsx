// tests/unit/components/Inspector.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Inspector } from '@/components/ui/Inspector'

describe('Inspector', () => {
  it('does not render content when closed', () => {
    render(
      <Inspector open={false} onClose={() => {}} title="Edit">
        <div>Inspector contents</div>
      </Inspector>,
    )
    expect(screen.queryByText('Inspector contents')).not.toBeInTheDocument()
  })

  it('renders title and content when open', () => {
    render(
      <Inspector open={true} onClose={() => {}} title="Edit Product">
        <div>Form here</div>
      </Inspector>,
    )
    expect(screen.getByText('Edit Product')).toBeInTheDocument()
    expect(screen.getByText('Form here')).toBeInTheDocument()
  })

  it('close button triggers onClose', async () => {
    const onClose = vi.fn()
    render(
      <Inspector open={true} onClose={onClose} title="X">
        <div>x</div>
      </Inspector>,
    )
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('Escape key closes', async () => {
    const onClose = vi.fn()
    render(
      <Inspector open={true} onClose={onClose}>
        <div>x</div>
      </Inspector>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
