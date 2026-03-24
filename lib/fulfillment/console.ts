import type { FulfillmentQueueItem } from '@/lib/fulfillment/queue'

export type FulfillmentConsoleTab = 'order' | 'fulfillment' | 'ticket' | 'customer' | 'activity'
export type FulfillmentDrawerTab = 'summary' | 'fulfillment' | 'ticket' | 'customer'

export type FulfillmentInspectorSection = 'order' | 'fulfillment' | 'ticket' | 'customer' | 'activity'

export type FulfillmentImpactDiff = {
  label: string
  before: string
  after: string
}

export type FulfillmentActionDraft =
  | {
      type: 'order_update'
      title: string
      description: string
      impact: FulfillmentImpactDiff[]
      blockers: string[]
    }
  | {
      type: 'label_purchase'
      title: string
      description: string
      impact: FulfillmentImpactDiff[]
      blockers: string[]
      orderId: string
    }
  | {
      type: 'batch_label_purchase'
      title: string
      description: string
      impact: FulfillmentImpactDiff[]
      blockers: string[]
    }
  | {
      type: 'ticket_status'
      title: string
      description: string
      impact: FulfillmentImpactDiff[]
      blockers: string[]
      status: string
    }
  | {
      type: 'ticket_reply'
      title: string
      description: string
      impact: FulfillmentImpactDiff[]
      blockers: string[]
    }
  | {
      type: 'ticket_decision'
      title: string
      description: string
      impact: FulfillmentImpactDiff[]
      blockers: string[]
      action:
        | 'approve_return'
        | 'deny_return'
        | 'mark_refund_requested'
        | 'approve_refund'
        | 'complete_refund'
        | 'deny_refund'
      generateLabel?: boolean
    }
  | {
      type: 'customer_update'
      title: string
      description: string
      impact: FulfillmentImpactDiff[]
      blockers: string[]
    }
  | {
      type: 'customer_points'
      title: string
      description: string
      impact: FulfillmentImpactDiff[]
      blockers: string[]
    }
  | {
      type: 'customer_tier'
      title: string
      description: string
      impact: FulfillmentImpactDiff[]
      blockers: string[]
    }
  | {
      type: 'customer_note_add'
      title: string
      description: string
      impact: FulfillmentImpactDiff[]
      blockers: string[]
    }
  | {
      type: 'customer_note_delete'
      title: string
      description: string
      impact: FulfillmentImpactDiff[]
      blockers: string[]
      noteId: string
    }

export type FulfillmentConfirmState = {
  isOpen: boolean
  submitting: boolean
  draft: FulfillmentActionDraft | null
}

export type FulfillmentImpactPreviewItem = {
  id: string
  scope: 'order' | 'ticket' | 'customer' | 'loyalty' | 'note'
  label: string
  from?: string
  to: string
}

export type FulfillmentImpactPreview = {
  items: FulfillmentImpactPreviewItem[]
  blockers: string[]
}

export type FulfillmentConsoleLayoutState = {
  utilityCollapsed: boolean
  showSnapshot: boolean
  showHistory: boolean
  chatExpanded: boolean
}

export type FulfillmentActiveRecordHeader = {
  primaryLabel: string
  secondaryLabel: string
}

export type FulfillmentRecordContext = {
  hasOrder: boolean
  hasTicket: boolean
  hasCustomer: boolean
}

export type FulfillmentWorkspaceAvailability = {
  order: boolean
  fulfillment: boolean
  ticket: boolean
  customer: boolean
  activity: boolean
}

export type FulfillmentQueueRowViewModel = {
  id: string
  laneLabel: string
  queueType: string
  orderNumber: string | null
  ticketNumber: string | null
  ticketSubject: string | null
  customerName: string
  customerEmail: string
  orderStatus: string | null
  ticketStatus: string | null
  paymentStatus: string | null
  ageHours: number
  slaBucket: string
  slaRisk: string
  total: number | null
  trackingNumber: string | null
  carrier: string | null
  orderId: string | null
  ticketId: string | null
  assignedToName: string | null
  canPurchaseLabel: boolean
  labelEligible: boolean
  isReadyToShip: boolean
  blockers: FulfillmentQueueItem['blockers']
  nextAction: FulfillmentQueueItem['nextAction']
}

export function toQueueRowViewModel(
  item: FulfillmentQueueItem,
  laneLabel: string
): FulfillmentQueueRowViewModel {
  return {
    id: item.id,
    laneLabel,
    queueType: item.queueType,
    orderNumber: item.orderNumber,
    ticketNumber: item.ticketNumber,
    ticketSubject: item.ticketSubject,
    customerName: item.customerName,
    customerEmail: item.customerEmail,
    orderStatus: item.orderStatus,
    ticketStatus: item.ticketStatus,
    paymentStatus: item.paymentStatus,
    ageHours: item.ageHours,
    slaBucket: item.slaBucket,
    slaRisk: item.slaRisk,
    total: item.total,
    trackingNumber: item.trackingNumber,
    carrier: item.carrier,
    orderId: item.orderId,
    ticketId: item.ticketId,
    assignedToName: item.assignedToName,
    canPurchaseLabel: item.canPurchaseLabel,
    labelEligible: item.labelEligible,
    isReadyToShip: item.isReadyToShip,
    blockers: item.blockers,
    nextAction: item.nextAction,
  }
}

export function deriveRecordContext(
  queueItem: Pick<FulfillmentQueueItem, 'orderId' | 'ticketId' | 'customerId'> | null,
  context: {
    order?: unknown
    selectedTicket?: unknown
    relatedTickets?: unknown
    customer?: unknown
  } | null
): FulfillmentRecordContext {
  const hasRelatedTickets =
    Array.isArray(context?.relatedTickets) && context.relatedTickets.length > 0

  return {
    hasOrder: Boolean(queueItem?.orderId || context?.order),
    hasTicket: Boolean(queueItem?.ticketId || context?.selectedTicket || hasRelatedTickets),
    hasCustomer: Boolean(queueItem?.customerId || context?.customer),
  }
}

export function deriveWorkspaceAvailability(
  recordContext: FulfillmentRecordContext
): FulfillmentWorkspaceAvailability {
  return {
    order: recordContext.hasOrder,
    fulfillment: recordContext.hasOrder,
    ticket: recordContext.hasTicket,
    customer: recordContext.hasTicket || recordContext.hasCustomer,
    activity: true,
  }
}

export function deriveActiveRecordHeader(
  queueItem: Pick<FulfillmentQueueItem, 'orderNumber' | 'ticketNumber' | 'customerName' | 'queueType'> | null,
  queueLabel: string
): FulfillmentActiveRecordHeader {
  if (!queueItem) {
    return {
      primaryLabel: 'No active record',
      secondaryLabel: 'Select a row from Queue Grid',
    }
  }

  const recordId = queueItem.orderNumber || queueItem.ticketNumber || 'Record'
  return {
    primaryLabel: `${recordId} • ${queueItem.customerName}`,
    secondaryLabel: queueLabel,
  }
}

export function isConsoleTabDisabled(
  tab: FulfillmentConsoleTab,
  availability: FulfillmentWorkspaceAvailability
): boolean {
  return !availability[tab]
}

export function getDefaultConsoleTab(
  availability: FulfillmentWorkspaceAvailability
): FulfillmentConsoleTab {
  if (availability.ticket) return 'ticket'
  if (availability.order) return 'order'
  if (availability.customer) return 'customer'
  return 'activity'
}

export function getDefaultDrawerTabForQueueItem(
  queueItem: Pick<FulfillmentQueueItem, 'orderId' | 'ticketId'> | null
): FulfillmentDrawerTab {
  if (!queueItem) return 'summary'
  if (queueItem.ticketId) return 'ticket'
  if (queueItem.orderId) return 'fulfillment'
  return 'summary'
}
