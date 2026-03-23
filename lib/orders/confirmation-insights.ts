export interface ConfirmationSavingsInput {
  subtotal: number
  discount?: number | null
  shipping: number
  tax: number
  taxRate?: number
  standardShippingRate?: number
}

export interface ConfirmationSavings {
  discountSavings: number
  shippingSavings: number
  taxSavings: number
  totalSavings: number
}

export type ConfirmationStatusTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface ConfirmationStatusDescriptor {
  label: string
  description: string
  tone: ConfirmationStatusTone
}

export interface ConfirmationEtaInput {
  status: string
  estimatedDelivery?: string | null
  shippedAt?: string | null
  createdAt?: string | null
}

function toSafeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback
  }
  return value
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getConfirmationStatusDescriptor(status: string): ConfirmationStatusDescriptor {
  switch (status) {
    case 'DELIVERED':
      return {
        label: 'Delivered',
        description: 'This order has been delivered.',
        tone: 'success',
      }
    case 'SHIPPED':
      return {
        label: 'Shipped',
        description: 'Your package is in transit.',
        tone: 'success',
      }
    case 'PROCESSING':
      return {
        label: 'Processing',
        description: 'Your order is being prepared for shipment.',
        tone: 'warning',
      }
    case 'CONFIRMED':
      return {
        label: 'Confirmed',
        description: 'Payment received. We are preparing your order.',
        tone: 'warning',
      }
    case 'PENDING':
      return {
        label: 'Pending',
        description: 'Order received and waiting for final processing.',
        tone: 'neutral',
      }
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        description: 'This order has been cancelled.',
        tone: 'danger',
      }
    default:
      return {
        label: status || 'Unknown',
        description: 'Status information is currently unavailable.',
        tone: 'neutral',
      }
  }
}

export function getConfirmationEtaText(input: ConfirmationEtaInput): string {
  const status = input.status || 'PENDING'
  const estimatedDeliveryLabel = formatDate(input.estimatedDelivery)
  const shippedAtLabel = formatDate(input.shippedAt)
  const createdAtLabel = formatDate(input.createdAt)

  if (status === 'CANCELLED') {
    return 'Order cancelled'
  }

  if (status === 'DELIVERED') {
    return estimatedDeliveryLabel ? `Delivered on ${estimatedDeliveryLabel}` : 'Delivered'
  }

  if (estimatedDeliveryLabel) {
    return `Estimated delivery ${estimatedDeliveryLabel}`
  }

  if (status === 'SHIPPED') {
    return shippedAtLabel ? `Shipped on ${shippedAtLabel}` : 'Shipment in transit'
  }

  if (status === 'PROCESSING' || status === 'CONFIRMED' || status === 'PENDING') {
    return createdAtLabel
      ? `Preparing shipment since ${createdAtLabel}`
      : 'Preparing shipment'
  }

  return 'Delivery estimate unavailable'
}

export function calculateConfirmationSavings(input: ConfirmationSavingsInput): ConfirmationSavings {
  const subtotal = Math.max(0, toSafeNumber(input.subtotal))
  const discount = Math.max(0, toSafeNumber(input.discount ?? 0))
  const shipping = Math.max(0, toSafeNumber(input.shipping))
  const tax = Math.max(0, toSafeNumber(input.tax))
  const taxRate = Math.max(0, toSafeNumber(input.taxRate, 0.08))
  const standardShippingRate = Math.max(0, toSafeNumber(input.standardShippingRate, 10))

  const shippingSavings = shipping === 0 ? standardShippingRate : 0
  const taxWithoutDiscount = subtotal * taxRate
  const taxSavings = Math.max(0, taxWithoutDiscount - tax)
  const totalSavings = discount + shippingSavings + taxSavings

  return {
    discountSavings: roundMoney(discount),
    shippingSavings: roundMoney(shippingSavings),
    taxSavings: roundMoney(taxSavings),
    totalSavings: roundMoney(totalSavings),
  }
}

export function getConfirmationOfferSummary(order: {
  couponCode?: string | null
  discount?: number | null
  shipping: number
}): string | null {
  const parts: string[] = []

  if (order.couponCode && order.couponCode.trim().length > 0) {
    parts.push(order.couponCode.trim().toUpperCase())
  }

  if ((order.discount ?? 0) > 0) {
    parts.push('Discount applied')
  }

  if (order.shipping === 0) {
    parts.push('Free shipping')
  }

  return parts.length > 0 ? parts.join(' • ') : null
}
