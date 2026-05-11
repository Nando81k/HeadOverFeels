/**
 * EasyPost Shipping Integration
 * 
 * Provides shipping label generation, rate quotes, and tracking
 * for the HeadOverFeels e-commerce platform.
 * 
 * @see https://www.easypost.com/docs/api
 */

import { prisma } from '@/lib/prisma'

// ===== TYPES =====

export interface ShippingAddress {
  name: string
  company?: string
  street1: string
  street2?: string
  city: string
  state: string
  zip: string
  country: string
  phone?: string
  email?: string
}

export interface ShippingParcel {
  length: number  // inches
  width: number   // inches
  height: number  // inches
  weight: number  // ounces
}

export interface ShippingRate {
  id: string
  carrier: string
  service: string
  rate: number
  currency: string
  estimatedDays: number | null
  deliveryDate: string | null
}

export interface ShipmentResult {
  success: boolean
  shipmentId?: string
  trackingNumber?: string
  trackingUrl?: string
  labelUrl?: string
  carrier?: string
  service?: string
  rate?: number
  error?: string
}

export interface ReturnLabelResult {
  success: boolean
  labelUrl?: string
  trackingNumber?: string
  trackingUrl?: string
  carrier?: string
  qrCodeUrl?: string
  expiresAt?: Date
  error?: string
}

export interface OutboundShippingRate {
  id: string
  carrier: string
  service: string
  rate: number
  currency: string
  /** EasyPost's "delivery_days" — best-effort number of days in transit. */
  deliveryDays: number | null
  /** ISO 8601 carrier-committed delivery date when present. */
  deliveryDate: string | null
}

export interface OutboundShippingRatesResult {
  success: boolean
  shipmentId?: string
  rates?: OutboundShippingRate[]
  validationErrors?: string[]
  error?: string
}

export interface OutboundLabelResult {
  success: boolean
  shipmentId?: string
  rateId?: string
  trackingNumber?: string
  trackingUrl?: string
  labelUrl?: string
  carrier?: string
  service?: string
  rate?: number
  /** ISO 8601 timestamp of the carrier's estimated delivery, when available. */
  estimatedDeliveryDate?: string | null
  validationErrors?: string[]
  error?: string
}

// ===== CONFIGURATION =====

const EASYPOST_API_KEY = process.env.EASYPOST_API_KEY
const EASYPOST_API_URL = 'https://api.easypost.com/v2'

// Store return address
const RETURN_ADDRESS: ShippingAddress = {
  name: 'Head Over Feels Returns',
  company: 'Head Over Feels LLC',
  street1: process.env.STORE_ADDRESS_STREET || '123 Fashion Ave',
  street2: process.env.STORE_ADDRESS_STREET2 || 'Suite 100',
  city: process.env.STORE_ADDRESS_CITY || 'Los Angeles',
  state: process.env.STORE_ADDRESS_STATE || 'CA',
  zip: process.env.STORE_ADDRESS_ZIP || '90001',
  country: 'US',
  phone: process.env.STORE_PHONE || '555-123-4567',
  email: 'returns@headoverfeels.com',
}

// Default parcel dimensions for clothing
const DEFAULT_PARCEL: ShippingParcel = {
  length: 12,
  width: 10,
  height: 4,
  weight: 16, // 1 lb default
}

// ===== HELPER FUNCTIONS =====

/**
 * Check if EasyPost is configured
 */
export function isEasyPostConfigured(): boolean {
  return !!EASYPOST_API_KEY
}

/**
 * Make authenticated request to EasyPost API
 */
async function easyPostRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
): Promise<T> {
  if (!EASYPOST_API_KEY) {
    throw new Error('EasyPost API key not configured')
  }

  const response = await fetch(`${EASYPOST_API_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Basic ${Buffer.from(EASYPOST_API_KEY + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || `EasyPost API error: ${response.status}`)
  }

  return response.json()
}

/**
 * Convert our address format to EasyPost format
 */
function toEasyPostAddress(address: ShippingAddress) {
  return {
    name: address.name,
    company: address.company,
    street1: address.street1,
    street2: address.street2,
    city: address.city,
    state: address.state,
    zip: address.zip,
    country: address.country,
    phone: address.phone,
    email: address.email,
  }
}

function buildCarrierTrackingUrl(carrier: string | undefined, trackingNumber: string): string {
  if (!carrier) {
    return ''
  }

  const normalized = carrier.toUpperCase()
  if (normalized === 'USPS') {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`
  }
  if (normalized === 'FEDEX') {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`
  }
  if (normalized === 'UPS') {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`
  }
  if (normalized === 'DHL') {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trackingNumber)}`
  }

  return ''
}

// ===== MAIN FUNCTIONS =====

/**
 * Create a return shipping label for a customer
 * This is a prepaid label that the customer can print or use QR code
 */
export async function createReturnLabel(
  orderId: string,
  customerAddress?: ShippingAddress
): Promise<ReturnLabelResult> {
  try {
    // 1. Get order details if customer address not provided
    let fromAddress = customerAddress
    
    if (!fromAddress) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          shippingAddress: true,
        },
      })

      if (!order || !order.shippingAddress) {
        return {
          success: false,
          error: 'Order or shipping address not found',
        }
      }

      const addr = order.shippingAddress
      fromAddress = {
        name: `${addr.firstName} ${addr.lastName}`,
        company: addr.company || undefined,
        street1: addr.address1,
        street2: addr.address2 || undefined,
        city: addr.city,
        state: addr.state,
        zip: addr.postalCode,
        country: addr.country,
        email: order.customerEmail,
        phone: order.customerPhone || undefined,
      }
    }

    // 2. Check if EasyPost is configured
    if (!isEasyPostConfigured()) {
      // Return a demo/placeholder label for development
      console.log('[Shipping] EasyPost not configured, generating demo label')
      return generateDemoReturnLabel(orderId, fromAddress)
    }

    // 3. Create EasyPost shipment (return = swap to/from addresses)
    const shipmentData = {
      shipment: {
        from_address: toEasyPostAddress(fromAddress),
        to_address: toEasyPostAddress(RETURN_ADDRESS),
        parcel: DEFAULT_PARCEL,
        is_return: true,
        options: {
          label_format: 'PDF',
          label_size: '4x6',
        },
      },
    }

    const shipment = await easyPostRequest<{
      id: string
      rates: Array<{
        id: string
        carrier: string
        service: string
        rate: string
        est_delivery_days: number | null
      }>
    }>('/shipments', 'POST', shipmentData)

    // 4. Select cheapest rate (or preferred carrier)
    const rates = shipment.rates.sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate))
    const selectedRate = rates.find(r => 
      ['USPS', 'UPS', 'FedEx'].includes(r.carrier)
    ) || rates[0]

    if (!selectedRate) {
      return {
        success: false,
        error: 'No shipping rates available for this address',
      }
    }

    // 5. Purchase the label
    const purchasedShipment = await easyPostRequest<{
      id: string
      tracking_code: string
      postage_label: { label_url: string }
      tracker: { public_url: string }
      selected_rate: { carrier: string; service: string }
      forms?: Array<{ form_url: string; form_type: string }>
    }>(`/shipments/${shipment.id}/buy`, 'POST', {
      rate: { id: selectedRate.id },
    })

    // 6. Get QR code if available (for easy returns without printing)
    const qrForm = purchasedShipment.forms?.find(f => f.form_type === 'qr_code')

    // 7. Label expires in 30 days
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    return {
      success: true,
      labelUrl: purchasedShipment.postage_label.label_url,
      trackingNumber: purchasedShipment.tracking_code,
      trackingUrl: purchasedShipment.tracker.public_url,
      carrier: purchasedShipment.selected_rate.carrier,
      qrCodeUrl: qrForm?.form_url,
      expiresAt,
    }
  } catch (error) {
    console.error('[Shipping] Error creating return label:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create return label',
    }
  }
}

/**
 * Purchase outbound shipping label for an order.
 * This creates a carrier label for fulfillment (store -> customer).
 */
/**
 * Build a shipment for the given order and return ALL available rates so the
 * operator can pick a courier + service tier. Holds onto the EasyPost
 * shipmentId so the subsequent purchase call can buy a specific rate from the
 * same shipment (rate IDs are scoped to the shipment that produced them).
 *
 * In demo mode (no API key), returns a stable set of synthetic rates whose
 * IDs match what `purchaseOutboundLabel` knows about — so the picker → buy
 * round-trip works locally without EasyPost.
 */
export async function getOutboundShippingRates(
  orderId: string,
  options?: {
    toAddress?: ShippingAddress
    parcel?: ShippingParcel
  }
): Promise<OutboundShippingRatesResult> {
  try {
    let destinationAddress = options?.toAddress

    if (!destinationAddress) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { shippingAddress: true },
      })

      if (!order?.shippingAddress) {
        return { success: false, error: 'Order or shipping address not found' }
      }

      destinationAddress = {
        name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
        company: order.shippingAddress.company || undefined,
        street1: order.shippingAddress.address1,
        street2: order.shippingAddress.address2 || undefined,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zip: order.shippingAddress.postalCode,
        country: order.shippingAddress.country || 'US',
        email: order.customerEmail,
        phone: order.customerPhone || undefined,
      }
    }

    const validation = await validateAddress(destinationAddress)
    if (!validation.valid) {
      return {
        success: false,
        error: 'Address validation failed',
        validationErrors: validation.errors,
      }
    }

    const normalizedAddress = validation.suggestions || destinationAddress

    if (!isEasyPostConfigured()) {
      return {
        success: true,
        shipmentId: `demo_shipment_${orderId}`,
        rates: getDemoOutboundRates(),
      }
    }

    const parcel = options?.parcel || DEFAULT_PARCEL
    const shipment = await easyPostRequest<{
      id: string
      rates: Array<{
        id: string
        carrier: string
        service: string
        rate: string
        currency: string
        delivery_days?: number | null
        est_delivery_days?: number | null
        delivery_date?: string | null
      }>
    }>('/shipments', 'POST', {
      shipment: {
        from_address: toEasyPostAddress(RETURN_ADDRESS),
        to_address: toEasyPostAddress(normalizedAddress),
        parcel,
        options: { label_format: 'PDF', label_size: '4x6' },
      },
    })

    const rates: OutboundShippingRate[] = shipment.rates.map((rate) => ({
      id: rate.id,
      carrier: rate.carrier,
      service: rate.service,
      rate: parseFloat(rate.rate),
      currency: rate.currency || 'USD',
      deliveryDays: rate.delivery_days ?? rate.est_delivery_days ?? null,
      deliveryDate: rate.delivery_date ?? null,
    }))

    return { success: true, shipmentId: shipment.id, rates }
  } catch (error) {
    console.error('[Shipping] Error fetching outbound rates:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch shipping rates',
    }
  }
}

function getDemoOutboundRates(): OutboundShippingRate[] {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  return [
    {
      id: 'demo_usps_overnight',
      carrier: 'USPS',
      service: 'Priority Mail Express',
      rate: 38.5,
      currency: 'USD',
      deliveryDays: 1,
      deliveryDate: new Date(now + 1 * day).toISOString(),
    },
    {
      id: 'demo_ups_next_day',
      carrier: 'UPS',
      service: 'Next Day Air',
      rate: 45.2,
      currency: 'USD',
      deliveryDays: 1,
      deliveryDate: new Date(now + 1 * day).toISOString(),
    },
    {
      id: 'demo_fedex_2day',
      carrier: 'FedEx',
      service: '2Day',
      rate: 22.5,
      currency: 'USD',
      deliveryDays: 2,
      deliveryDate: new Date(now + 2 * day).toISOString(),
    },
    {
      id: 'demo_usps_priority',
      carrier: 'USPS',
      service: 'Priority Mail',
      rate: 8.95,
      currency: 'USD',
      deliveryDays: 3,
      deliveryDate: new Date(now + 3 * day).toISOString(),
    },
    {
      id: 'demo_ups_ground',
      carrier: 'UPS',
      service: 'Ground',
      rate: 9.99,
      currency: 'USD',
      deliveryDays: 5,
      deliveryDate: new Date(now + 5 * day).toISOString(),
    },
    {
      id: 'demo_usps_ground',
      carrier: 'USPS',
      service: 'Ground Advantage',
      rate: 5.95,
      currency: 'USD',
      deliveryDays: 5,
      deliveryDate: new Date(now + 5 * day).toISOString(),
    },
  ]
}

export async function purchaseOutboundLabel(
  orderId: string,
  options?: {
    toAddress?: ShippingAddress
    parcel?: ShippingParcel
    rateId?: string
    /**
     * EasyPost shipmentId from a prior `getOutboundShippingRates` call. When
     * supplied alongside `rateId`, we skip shipment re-creation and buy the
     * exact rate the operator picked. Without it, we fall back to creating a
     * fresh shipment and auto-selecting from preferred carriers.
     */
    shipmentId?: string
    preferredCarriers?: string[]
  }
): Promise<OutboundLabelResult> {
  try {
    let destinationAddress = options?.toAddress

    if (!destinationAddress) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          shippingAddress: true,
        },
      })

      if (!order?.shippingAddress) {
        return {
          success: false,
          error: 'Order or shipping address not found',
        }
      }

      destinationAddress = {
        name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
        company: order.shippingAddress.company || undefined,
        street1: order.shippingAddress.address1,
        street2: order.shippingAddress.address2 || undefined,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zip: order.shippingAddress.postalCode,
        country: order.shippingAddress.country || 'US',
        email: order.customerEmail,
        phone: order.customerPhone || undefined,
      }
    }

    const validation = await validateAddress(destinationAddress)
    if (!validation.valid) {
      return {
        success: false,
        error: 'Address validation failed',
        validationErrors: validation.errors,
      }
    }

    const normalizedAddress = validation.suggestions || destinationAddress

    if (!isEasyPostConfigured()) {
      return generateDemoOutboundLabel(orderId, normalizedAddress, options?.rateId)
    }

    const parcel = options?.parcel || DEFAULT_PARCEL

    // If the operator already saw rates and picked one, skip shipment
    // re-creation — fetch the existing shipment by id and buy that rate.
    let shipment: {
      id: string
      rates: Array<{
        id: string
        carrier: string
        service: string
        rate: string
      }>
    }
    if (options?.shipmentId && options?.rateId) {
      shipment = await easyPostRequest<typeof shipment>(`/shipments/${options.shipmentId}`, 'GET')
    } else {
      shipment = await easyPostRequest<typeof shipment>('/shipments', 'POST', {
        shipment: {
          from_address: toEasyPostAddress(RETURN_ADDRESS),
          to_address: toEasyPostAddress(normalizedAddress),
          parcel,
          options: {
            label_format: 'PDF',
            label_size: '4x6',
          },
        },
      })
    }

    const preferredCarriers = options?.preferredCarriers ?? ['USPS', 'UPS', 'FedEx']
    const sortedRates = [...shipment.rates].sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate))
    const selectedRate =
      (options?.rateId ? sortedRates.find((rate) => rate.id === options.rateId) : undefined) ||
      sortedRates.find((rate) => preferredCarriers.includes(rate.carrier)) ||
      sortedRates[0]

    if (!selectedRate) {
      return {
        success: false,
        shipmentId: shipment.id,
        error: 'No outbound shipping rates available',
      }
    }

    const purchasedShipment = await easyPostRequest<{
      id: string
      tracking_code: string
      postage_label: { label_url: string }
      tracker?: { public_url?: string | null }
      selected_rate: {
        id: string
        carrier: string
        service: string
        rate: string
        delivery_date?: string | null
        delivery_days?: number | null
        est_delivery_days?: number | null
      }
    }>(`/shipments/${shipment.id}/buy`, 'POST', {
      rate: { id: selectedRate.id },
    })

    const fallbackTrackingUrl = buildCarrierTrackingUrl(
      purchasedShipment.selected_rate?.carrier,
      purchasedShipment.tracking_code
    )

    const rate = purchasedShipment.selected_rate
    const estimatedDeliveryDate = (() => {
      if (rate?.delivery_date) {
        const parsed = new Date(rate.delivery_date)
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
      }
      const days = rate?.delivery_days ?? rate?.est_delivery_days
      if (typeof days === 'number' && days >= 0) {
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      }
      return null
    })()

    return {
      success: true,
      shipmentId: purchasedShipment.id,
      rateId: purchasedShipment.selected_rate?.id,
      trackingNumber: purchasedShipment.tracking_code,
      trackingUrl: purchasedShipment.tracker?.public_url || fallbackTrackingUrl,
      labelUrl: purchasedShipment.postage_label.label_url,
      carrier: purchasedShipment.selected_rate?.carrier,
      service: purchasedShipment.selected_rate?.service,
      rate: parseFloat(purchasedShipment.selected_rate?.rate || selectedRate.rate),
      estimatedDeliveryDate,
    }
  } catch (error) {
    console.error('[Shipping] Error purchasing outbound label:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to purchase outbound label',
    }
  }
}

/**
 * Get shipping rates for an order
 */
export async function getShippingRates(
  toAddress: ShippingAddress,
  parcel: ShippingParcel = DEFAULT_PARCEL
): Promise<ShippingRate[]> {
  if (!isEasyPostConfigured()) {
    // Return demo rates
    return getDemoShippingRates()
  }

  try {
    const shipmentData = {
      shipment: {
        from_address: toEasyPostAddress(RETURN_ADDRESS),
        to_address: toEasyPostAddress(toAddress),
        parcel,
      },
    }

    const shipment = await easyPostRequest<{
      rates: Array<{
        id: string
        carrier: string
        service: string
        rate: string
        currency: string
        est_delivery_days: number | null
        delivery_date: string | null
      }>
    }>('/shipments', 'POST', shipmentData)

    return shipment.rates.map(rate => ({
      id: rate.id,
      carrier: rate.carrier,
      service: rate.service,
      rate: parseFloat(rate.rate),
      currency: rate.currency,
      estimatedDays: rate.est_delivery_days,
      deliveryDate: rate.delivery_date,
    }))
  } catch (error) {
    console.error('[Shipping] Error getting rates:', error)
    return getDemoShippingRates()
  }
}

/**
 * Track a shipment by tracking number
 */
export async function trackShipment(trackingNumber: string, carrier?: string): Promise<{
  status: string
  estimatedDelivery: string | null
  events: Array<{
    datetime: string
    description: string
    city: string
    state: string
  }>
} | null> {
  if (!isEasyPostConfigured()) {
    return null
  }

  try {
    const trackerData = {
      tracker: {
        tracking_code: trackingNumber,
        carrier: carrier,
      },
    }

    const tracker = await easyPostRequest<{
      status: string
      est_delivery_date: string | null
      tracking_details: Array<{
        datetime: string
        message: string
        tracking_location: { city: string; state: string }
      }>
    }>('/trackers', 'POST', trackerData)

    return {
      status: tracker.status,
      estimatedDelivery: tracker.est_delivery_date,
      events: tracker.tracking_details.map(detail => ({
        datetime: detail.datetime,
        description: detail.message,
        city: detail.tracking_location?.city || '',
        state: detail.tracking_location?.state || '',
      })),
    }
  } catch (error) {
    console.error('[Shipping] Error tracking shipment:', error)
    return null
  }
}

/**
 * Validate an address
 */
export async function validateAddress(address: ShippingAddress): Promise<{
  valid: boolean
  suggestions?: ShippingAddress
  errors?: string[]
}> {
  if (!isEasyPostConfigured()) {
    return { valid: true }
  }

  try {
    const addressData = {
      address: {
        ...toEasyPostAddress(address),
        verify: ['delivery'],
      },
    }

    const result = await easyPostRequest<{
      verifications: {
        delivery: {
          success: boolean
          errors: Array<{ message: string }>
        }
      }
      street1: string
      street2: string | null
      city: string
      state: string
      zip: string
    }>('/addresses', 'POST', addressData)

    const verification = result.verifications.delivery

    if (verification.success) {
      return {
        valid: true,
        suggestions: {
          ...address,
          street1: result.street1,
          street2: result.street2 || undefined,
          city: result.city,
          state: result.state,
          zip: result.zip,
        },
      }
    }

    return {
      valid: false,
      errors: verification.errors.map(e => e.message),
    }
  } catch (error) {
    console.error('[Shipping] Error validating address:', error)
    return { valid: true } // Fail open for UX
  }
}

// ===== DEMO/DEVELOPMENT HELPERS =====

/**
 * Generate a demo return label for development
 */
function generateDemoReturnLabel(orderId: string, fromAddress: ShippingAddress): ReturnLabelResult {
  const trackingNumber = `RET${Date.now().toString(36).toUpperCase()}`
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  // In demo mode, generate a printable PDF-like label URL
  const labelData = {
    orderId,
    tracking: trackingNumber,
    from: fromAddress,
    to: RETURN_ADDRESS,
    created: new Date().toISOString(),
  }

  // Base64 encode the label data for a "virtual" label
  const encodedLabel = Buffer.from(JSON.stringify(labelData)).toString('base64')

  return {
    success: true,
    labelUrl: `/api/shipping/label/${orderId}?data=${encodedLabel}`,
    trackingNumber,
    trackingUrl: `/orders/${orderId}/track`,
    carrier: 'USPS',
    qrCodeUrl: `/api/shipping/qr/${orderId}?tracking=${trackingNumber}`,
    expiresAt,
  }
}

function generateDemoOutboundLabel(
  orderId: string,
  destinationAddress: ShippingAddress,
  rateId?: string
): OutboundLabelResult {
  // Honor the operator's choice when present so demo mode reflects what the
  // rate picker selected. Default to standard Priority Mail otherwise.
  const allRates = getDemoOutboundRates()
  const chosen = (rateId && allRates.find((rate) => rate.id === rateId)) || allRates.find((r) => r.id === 'demo_usps_priority') || allRates[0]

  const trackingNumber = `SHIP${Date.now().toString(36).toUpperCase()}`
  const trackingUrl = buildCarrierTrackingUrl(chosen.carrier, trackingNumber)

  const labelData = {
    orderId,
    tracking: trackingNumber,
    from: RETURN_ADDRESS,
    to: destinationAddress,
    created: new Date().toISOString(),
    mode: 'outbound',
    carrier: chosen.carrier,
    service: chosen.service,
  }

  return {
    success: true,
    shipmentId: `demo_shipment_${orderId}`,
    rateId: chosen.id,
    trackingNumber,
    trackingUrl,
    labelUrl: `/api/shipping/label/${orderId}?data=${Buffer.from(JSON.stringify(labelData)).toString('base64')}`,
    carrier: chosen.carrier,
    service: chosen.service,
    rate: chosen.rate,
    estimatedDeliveryDate: chosen.deliveryDate,
  }
}

/**
 * Get demo shipping rates for development
 */
function getDemoShippingRates(): ShippingRate[] {
  return [
    {
      id: 'demo_usps_priority',
      carrier: 'USPS',
      service: 'Priority Mail',
      rate: 8.95,
      currency: 'USD',
      estimatedDays: 3,
      deliveryDate: null,
    },
    {
      id: 'demo_usps_ground',
      carrier: 'USPS',
      service: 'Ground Advantage',
      rate: 5.95,
      currency: 'USD',
      estimatedDays: 5,
      deliveryDate: null,
    },
    {
      id: 'demo_ups_ground',
      carrier: 'UPS',
      service: 'UPS Ground',
      rate: 9.99,
      currency: 'USD',
      estimatedDays: 5,
      deliveryDate: null,
    },
    {
      id: 'demo_fedex_express',
      carrier: 'FedEx',
      service: 'FedEx Express Saver',
      rate: 14.99,
      currency: 'USD',
      estimatedDays: 3,
      deliveryDate: null,
    },
  ]
}
