// tests/unit/storefront/loyalty-ledger.test.tsx — LedgerTable filters + load more (Task 6)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('server-only', () => ({}))

const { actions } = vi.hoisted(() => ({
  actions: {
    getLoyaltyOverviewAction: vi.fn(),
    redeemRewardAction: vi.fn(),
    loadLedgerAction: vi.fn(),
  },
}))
vi.mock('@/app/(storefront)/_actions/loyalty', () => actions)

import { LedgerTable } from '@/components/storefront/loyalty'
import { LEDGER_PAGE, LEDGER_ROWS } from './loyalty-fixture'

beforeEach(() => vi.clearAllMocks())
afterEach(() => cleanup())

describe('LedgerTable', () => {
  it('renders the server page with signed points, dates and references', () => {
    render(<LedgerTable initialPage={LEDGER_PAGE} />)
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('+96').className).toContain('num')
    expect(within(rows[0]).getByText('Points from your purchase')).toBeInTheDocument()
    expect(within(rows[0]).getByRole('link', { name: '#1042' })).toBeInTheDocument()
    expect(within(rows[1]).getByText('−500')).toBeInTheDocument()
    expect(within(rows[1]).getByText('HOF-DISC-4K2M9Q')).toBeInTheDocument()
    expect(within(rows[0]).getByText(/Oct \d{1,2}, 2026/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Filter history/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reloads from the first page when a filter chip is pressed', async () => {
    const user = userEvent.setup()
    actions.loadLedgerAction.mockResolvedValue({
      ok: true,
      data: { rows: [LEDGER_ROWS[1]], nextCursor: null },
    })
    render(<LedgerTable initialPage={LEDGER_PAGE} />)
    await user.click(screen.getByRole('button', { name: 'Redeemed' }))
    expect(actions.loadLedgerAction).toHaveBeenCalledWith({ filter: 'redeemed', cursor: null })
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2))
    expect(screen.getByRole('button', { name: 'Redeemed' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('appends the next page on Load more and hides the button at the end', async () => {
    const user = userEvent.setup()
    actions.loadLedgerAction.mockResolvedValue({
      ok: true,
      data: {
        rows: [{ ...LEDGER_ROWS[2], id: 'tx-4', label: 'Birthday points', points: 50 }],
        nextCursor: null,
      },
    })
    render(<LedgerTable initialPage={LEDGER_PAGE} />)
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(actions.loadLedgerAction).toHaveBeenCalledWith({ filter: 'all', cursor: 'tx-3' })
    await waitFor(() => expect(screen.getByText('Birthday points')).toBeInTheDocument())
    expect(screen.getAllByRole('row')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('shows the action error inline and keeps the rows', async () => {
    const user = userEvent.setup()
    actions.loadLedgerAction.mockResolvedValue({ ok: false, error: 'That history page could not be loaded.' })
    render(<LedgerTable initialPage={LEDGER_PAGE} />)
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That history page could not be loaded.')
    expect(screen.getAllByRole('row')).toHaveLength(4)
  })

  it('renders an empty state when there is nothing yet', () => {
    render(<LedgerTable initialPage={{ rows: [], nextCursor: null }} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText(/No activity yet/)).toBeInTheDocument()
  })
})
