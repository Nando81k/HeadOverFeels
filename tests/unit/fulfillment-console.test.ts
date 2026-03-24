import { describe, expect, it } from 'vitest'
import {
  deriveActiveRecordHeader,
  deriveWorkspaceAvailability,
  getDefaultDrawerTabForQueueItem,
  isConsoleTabDisabled,
} from '@/lib/fulfillment/console'

describe('fulfillment console helpers', () => {
  it('derives active record header for empty selection', () => {
    const header = deriveActiveRecordHeader(null, 'Queue')

    expect(header.primaryLabel).toBe('No active record')
    expect(header.secondaryLabel).toBe('Select a row from Queue Grid')
  })

  it('derives active record header for selected order', () => {
    const header = deriveActiveRecordHeader(
      {
        orderNumber: '#10021',
        ticketNumber: null,
        customerName: 'Taylor M',
        queueType: 'FULFILL_ORDER',
      },
      'Fulfill'
    )

    expect(header.primaryLabel).toContain('#10021')
    expect(header.primaryLabel).toContain('Taylor M')
    expect(header.secondaryLabel).toBe('Fulfill')
  })

  it('locks tabs based on record context availability', () => {
    const availability = deriveWorkspaceAvailability({
      hasOrder: true,
      hasTicket: false,
      hasCustomer: true,
    })

    expect(isConsoleTabDisabled('order', availability)).toBe(false)
    expect(isConsoleTabDisabled('fulfillment', availability)).toBe(false)
    expect(isConsoleTabDisabled('customer', availability)).toBe(false)
    expect(isConsoleTabDisabled('ticket', availability)).toBe(true)
    expect(isConsoleTabDisabled('activity', availability)).toBe(false)
  })

  it('picks drawer tab by row context', () => {
    expect(getDefaultDrawerTabForQueueItem({ orderId: 'order-1', ticketId: null })).toBe('fulfillment')
    expect(getDefaultDrawerTabForQueueItem({ orderId: 'order-1', ticketId: 'ticket-1' })).toBe('ticket')
    expect(getDefaultDrawerTabForQueueItem(null)).toBe('summary')
  })
})
