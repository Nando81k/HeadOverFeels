// tests/unit/components/BottomSheet.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BottomSheet } from '@/components/ui/BottomSheet'

describe('BottomSheet', () => {
  it('does not render content when closed', () => {
    render(
      <BottomSheet open={false} onClose={() => {}} title="Menu">
        <div>Sheet contents</div>
      </BottomSheet>,
    )
    expect(screen.queryByText('Sheet contents')).not.toBeInTheDocument()
  })

  it('renders title and content when open', () => {
    render(
      <BottomSheet open={true} onClose={() => {}} title="Menu">
        <div>Sheet contents</div>
      </BottomSheet>,
    )
    expect(screen.getByText('Menu')).toBeInTheDocument()
    expect(screen.getByText('Sheet contents')).toBeInTheDocument()
  })

  it('calls onClose when backdrop clicked', async () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open={true} onClose={onClose}>
        <div>X</div>
      </BottomSheet>,
    )
    await userEvent.click(screen.getByTestId('bottom-sheet-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })
})
