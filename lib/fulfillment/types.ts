import type {
  LoyaltyTier,
  Order,
  OrderItem,
  PointsTransaction,
  SupportMessage,
  SupportTicket,
} from '@prisma/client'

export type FulfillmentWorkbenchMode = 'order' | 'ticket' | 'customer' | 'liveChat'

export type FulfillmentSelectionState = {
  activeQueueItemId: string | null
  selectedOrderIds: Set<string>
  activeMode: FulfillmentWorkbenchMode
}

export type FulfillmentActionResult = {
  success: boolean
  message: string
}

export type FulfillmentOrderViewModel = Pick<
  Order,
  | 'id'
  | 'orderNumber'
  | 'status'
  | 'paymentStatus'
  | 'subtotal'
  | 'discount'
  | 'shipping'
  | 'tax'
  | 'total'
  | 'couponCode'
  | 'paymentMethod'
  | 'shippingMethod'
  | 'trackingNumber'
  | 'trackingUrl'
  | 'carrier'
  | 'notes'
  | 'internalNotes'
  | 'createdAt'
  | 'estimatedDelivery'
  | 'deliveredAt'
  | 'shippedAt'
> & {
  items: Array<
    Pick<OrderItem, 'id' | 'quantity' | 'price' | 'productName' | 'productImage' | 'variantDetails'> & {
      product: {
        id: string
        name: string
        slug: string
      } | null
      productVariant: {
        id: string
        sku: string
        size: string | null
        color: string | null
      } | null
    }
  >
  shippingAddress: {
    firstName: string
    lastName: string
    address1: string
    address2: string | null
    city: string
    state: string
    postalCode: string
    country: string
  } | null
  billingAddress: {
    firstName: string
    lastName: string
    address1: string
    address2: string | null
    city: string
    state: string
    postalCode: string
    country: string
  } | null
}

export type FulfillmentTicketThreadViewModel = Pick<
  SupportTicket,
  | 'id'
  | 'ticketNumber'
  | 'subject'
  | 'type'
  | 'status'
  | 'priority'
  | 'returnRequested'
  | 'returnApproved'
  | 'returnLabel'
  | 'refundAmount'
  | 'refundReason'
  | 'resolution'
  | 'createdAt'
  | 'updatedAt'
> & {
  messages: Array<
    Pick<
      SupportMessage,
      'id' | 'message' | 'senderType' | 'senderId' | 'senderName' | 'isInternal' | 'createdAt'
    >
  >
}

export type FulfillmentCustomerOpsViewModel = {
  id: string
  email: string
  name: string | null
  phone: string | null
  birthday: string | null
  newsletter: boolean
  smsOptIn: boolean
  totalSpent: number
  totalOrders: number
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
  loyaltyTier: {
    id: string
    name: string
    pointMultiplier: number
  } | null
  notes: Array<{
    id: string
    content: string
    isImportant: boolean
    authorName: string
    createdAt: string
    updatedAt: string
  }>
  recentPointsTransactions: Array<{
    id: string
    points: number
    type: PointsTransaction['type']
    description: string
    createdAt: string
  }>
}

export type FulfillmentCustomerTierOption = Pick<LoyaltyTier, 'id' | 'name' | 'pointMultiplier' | 'sortOrder'>

export type FulfillmentLiveChatViewModel = {
  waiting: Array<{
    id: string
    sessionId: string
    customerName: string
    customerEmail: string
    requestedAt: string
    waitTimeFormatted: string
    ticket: {
      ticketNumber: string
      subject: string
      type: string
      priority: string
    } | null
  }>
  active: Array<{
    id: string
    sessionId: string
    customerName: string
    customerEmail: string
    acceptedAt: string | null
    ticket: {
      ticketNumber: string
      subject: string
      type: string
      priority: string
    } | null
  }>
}
