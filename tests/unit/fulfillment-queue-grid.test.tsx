import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FulfillmentQueueGrid } from '@/components/admin/fulfillment/FulfillmentQueueGrid'
import type { FulfillmentQueueRowViewModel } from '@/lib/fulfillment/console'

const baseRow: FulfillmentQueueRowViewModel = {
  id: 'row-1',
  laneLabel: 'Ready to Ship',
  queueType: 'FULFILL_ORDER',
  orderNumber: '#1001',
  ticketNumber: null,
  ticketSubject: null,
  customerName: 'Alex Customer',
  customerEmail: 'alex@example.com',
  orderStatus: 'CONFIRMED',
  ticketStatus: null,
  paymentStatus: 'PAID',
  ageHours: 5,
  slaBucket: 'NORMAL',
  slaRisk: 'NORMAL',
  total: 129.99,
  trackingNumber: null,
  carrier: null,
  orderId: 'order-1',
  ticketId: null,
  assignedToName: null,
  canPurchaseLabel: true,
  labelEligible: true,
  isReadyToShip: true,
  blockers: [],
  nextAction: 'BUY_LABEL',
}

describe('FulfillmentQueueGrid', () => {
  it('opens selected row when clicked', () => {
    const onSelectRow = vi.fn()

    render(
      <FulfillmentQueueGrid
        loading={false}
        rows={[baseRow]}
        activeRowId={null}
        onSelectRow={onSelectRow}
        selectedOrderIds={new Set()}
        allRowsSelected={false}
        onToggleSelectAll={vi.fn()}
        onToggleSelectOrder={vi.fn()}
        onPurchaseSingleLabel={vi.fn()}
        onRunNextAction={vi.fn()}
        pagination={{ page: 1, pages: 1, total: 1 }}
        onPrevPage={vi.fn()}
        onNextPage={vi.fn()}
        queueLabels={{
          FULFILL_ORDER: 'Ready to Ship',
          PAYMENT_EXCEPTION: 'Payment',
          SHIPPING_EXCEPTION: 'Shipping',
          RETURN_REVIEW: 'Return',
          REFUND_REVIEW: 'Refund',
        }}
        nextActionLabels={{
          BUY_LABEL: 'Buy Label',
          FIX_ADDRESS: 'Fix Address',
          REQUEST_PAYMENT: 'Request Payment',
          REVIEW_HOLD: 'Review Hold',
          RESOLVE_TICKET: 'Resolve Ticket',
          MARK_SHIPPED: 'Mark Shipped',
          SEND_TRACKING_UPDATE: 'Send Tracking Update',
          OPEN_CASE: 'Open Case',
        }}
        blockerLabels={{
          ADDRESS_ISSUE: 'Address Issue',
          MISSING_CARRIER: 'Missing Carrier',
          INVENTORY_RISK: 'Inventory Risk',
          HIGH_VALUE_HOLD: 'High-value Hold',
        }}
        statusClassName={() => 'bg-slate-100 text-slate-700 border-slate-300'}
        formatCurrency={(value) => `$${(value || 0).toFixed(2)}`}
        dense
      />
    )

    expect(screen.getByText('Fulfillment Queue')).toBeTruthy()

    // The grid renders both a mobile card list and a desktop table (CSS decides
    // which is visible), so scope row assertions to the table.
    const table = within(screen.getByRole('table'))
    expect(table.getByText('Ready to Ship')).toBeTruthy()
    expect(table.getByText('Buy Label')).toBeTruthy()

    fireEvent.click(table.getByText('#1001'))
    expect(onSelectRow).toHaveBeenCalledTimes(1)
    expect(onSelectRow).toHaveBeenCalledWith(baseRow)
  })

  it('renders table rows with internal scroll container', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      ...baseRow,
      id: `row-${index + 1}`,
      orderNumber: `#10${index + 1}`,
      orderId: `order-${index + 1}`,
    }))

    const { container } = render(
      <FulfillmentQueueGrid
        loading={false}
        rows={rows}
        activeRowId={null}
        onSelectRow={vi.fn()}
        selectedOrderIds={new Set()}
        allRowsSelected={false}
        onToggleSelectAll={vi.fn()}
        onToggleSelectOrder={vi.fn()}
        onPurchaseSingleLabel={vi.fn()}
        onRunNextAction={vi.fn()}
        pagination={{ page: 1, pages: 2, total: 12 }}
        onPrevPage={vi.fn()}
        onNextPage={vi.fn()}
        queueLabels={{
          FULFILL_ORDER: 'Ready to Ship',
          PAYMENT_EXCEPTION: 'Payment',
          SHIPPING_EXCEPTION: 'Shipping',
          RETURN_REVIEW: 'Return',
          REFUND_REVIEW: 'Refund',
        }}
        nextActionLabels={{
          BUY_LABEL: 'Buy Label',
          FIX_ADDRESS: 'Fix Address',
          REQUEST_PAYMENT: 'Request Payment',
          REVIEW_HOLD: 'Review Hold',
          RESOLVE_TICKET: 'Resolve Ticket',
          MARK_SHIPPED: 'Mark Shipped',
          SEND_TRACKING_UPDATE: 'Send Tracking Update',
          OPEN_CASE: 'Open Case',
        }}
        blockerLabels={{
          ADDRESS_ISSUE: 'Address Issue',
          MISSING_CARRIER: 'Missing Carrier',
          INVENTORY_RISK: 'Inventory Risk',
          HIGH_VALUE_HOLD: 'High-value Hold',
        }}
        statusClassName={() => 'bg-slate-100 text-slate-700 border-slate-300'}
        formatCurrency={(value) => `$${(value || 0).toFixed(2)}`}
        dense
      />
    )

    expect(within(screen.getByRole('table')).getByText('#1011')).toBeTruthy()
    expect(container.querySelector('.overflow-auto')).toBeTruthy()
  })
})
