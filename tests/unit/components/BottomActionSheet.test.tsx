// tests/unit/components/BottomActionSheet.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'

describe('BottomActionSheet', () => {
  it('does not render when closed', () => {
    render(
      <BottomActionSheet open={false} count={0} actions={[]} onCancel={() => {}} />,
    )
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
  })

  it('renders selection count when open', () => {
    render(
      <BottomActionSheet
        open={true}
        count={3}
        actions={[{ label: 'Archive', onClick: () => {} }]}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByText(/3 selected/)).toBeInTheDocument()
  })

  it('cancel triggers onCancel', async () => {
    const onCancel = vi.fn()
    render(
      <BottomActionSheet open={true} count={1} actions={[]} onCancel={onCancel} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
