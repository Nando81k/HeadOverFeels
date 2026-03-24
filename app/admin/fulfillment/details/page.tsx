'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  Printer,
  Truck,
} from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import type { TrackingResult } from '@/lib/shipping/tracking'
import { toast } from '@/lib/toast'

type FulfillmentDetailsTab = 'order' | 'fulfillment' | 'ticket' | 'customer' | 'activity'

type ContextResponse = {
  order: {
    id: string
    orderNumber: string
    status: string
    paymentStatus: string
    subtotal: number
    discount: number
    shipping: number
    tax: number
    total: number
    couponCode: string | null
    paymentMethod: string | null
    shippingMethod: string | null
    trackingNumber: string | null
    trackingUrl: string | null
    carrier: string | null
    notes: string | null
    internalNotes: string | null
    estimatedDelivery: string | null
    deliveredAt: string | null
    shippedAt: string | null
    createdAt: string
    updatedAt: string
    customerId: string | null
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
    items: Array<{
      id: string
      quantity: number
      price: number
      productName: string
      productImage: string | null
      variantDetails: string | null
      product: {
        id: string
        name: string
        slug: string
        images: unknown
      } | null
      productVariant: {
        id: string
        sku: string
        size: string | null
        color: string | null
      } | null
    }>
  } | null
  selectedTicket: {
    id: string
    ticketNumber: string
    type: string
    status: string
    priority: string
    subject: string
    returnRequested: boolean
    returnApproved: boolean | null
    returnLabel: string | null
    refundAmount: number | null
    refundReason: string | null
    resolution: string | null
    orderId: string | null
    orderNumber: string | null
    createdAt: string
    updatedAt: string
    assignedTo: {
      id: string
      name: string
      email: string
    } | null
    messages: Array<{
      id: string
      message: string
      senderType: string
      senderName: string
      isInternal: boolean
      createdAt: string
    }>
  } | null
  relatedTickets: Array<{
    id: string
    ticketNumber: string
    type: string
    status: string
    subject: string
    returnRequested: boolean
    returnApproved: boolean | null
    returnLabel: string | null
    refundAmount: number | null
    createdAt: string
    _count: {
      messages: number
    }
  }>
  customer: {
    id: string
    name: string | null
    email: string
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
      authorName: string
      isImportant: boolean
      createdAt: string
      updatedAt: string
    }>
    pointsTransactions: Array<{
      id: string
      points: number
      type: string
      description: string
      createdAt: string
    }>
    _count: {
      orders: number
      supportTickets: number
      notes: number
    }
  } | null
  recentOrders: Array<{
    id: string
    orderNumber: string
    status: string
    paymentStatus: string
    total: number
    createdAt: string
  }>
  recentTickets: Array<{
    id: string
    ticketNumber: string
    type: string
    status: string
    subject: string
    createdAt: string
  }>
  loyaltyTiers: Array<{
    id: string
    name: string
    pointMultiplier: number
    sortOrder: number
  }>
}

type CustomerDetailPayload = {
  customer: {
    totalSpent: number
    totalOrders: number
    avgOrderValue: number
    lastOrderDate: string | null
    currentPoints: number
    lifetimePoints: number
    annualPointsEarned: number
    expiringPoints: number
    expiringDate: string | null
    currentTier: {
      id: string
      name: string
      pointMultiplier: number
    } | null
    nextTier: {
      id: string
      name: string
      pointMultiplier: number
      minAnnualPoints: number
    } | null
  }
  orders: Array<{
    id: string
    orderNumber: string
    status: string
    total: number
    pointsEarned: number
    createdAt: string
  }>
  pointsTransactions: Array<{
    id: string
    points: number
    type: string
    description: string | null
    createdAt: string
  }>
}

type ConfirmState = {
  isOpen: boolean
  submitting: boolean
  title: string
  description: string
  impact: string[]
  run: null | (() => Promise<void>)
}

const TABS: Array<{ key: FulfillmentDetailsTab; label: string }> = [
  { key: 'order', label: 'Order' },
  { key: 'fulfillment', label: 'Fulfillment' },
  { key: 'ticket', label: 'Ticket' },
  { key: 'customer', label: 'Customer' },
  { key: 'activity', label: 'Activity' },
]

function formatCurrency(amount: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeImage(images: unknown): string | null {
  if (!images) return null
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && 'url' in first && typeof first.url === 'string') {
      return first.url
    }
  }
  if (typeof images === 'string') {
    const trimmed = images.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('http') || trimmed.startsWith('/')) return trimmed
    try {
      return normalizeImage(JSON.parse(trimmed))
    } catch {
      return null
    }
  }
  return null
}

function statusClass(status: string | null | undefined) {
  if (!status) return 'bg-white/10 text-white/75 border-white/20'
  const normalized = status.toUpperCase()
  if (normalized.includes('FAIL') || normalized.includes('ESCALATED') || normalized.includes('CANCEL')) {
    return 'bg-rose-500/20 text-rose-300 border-rose-400/30'
  }
  if (normalized.includes('DELIVERED') || normalized.includes('PAID') || normalized.includes('RESOLVED')) {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
  }
  if (normalized.includes('SHIP') || normalized.includes('OPEN') || normalized.includes('CONFIRMED')) {
    return 'bg-blue-500/20 text-blue-300 border-blue-400/30'
  }
  if (normalized.includes('PROGRESS') || normalized.includes('PENDING')) {
    return 'bg-amber-500/20 text-amber-300 border-amber-400/30'
  }
  return 'bg-white/10 text-white/75 border-white/20'
}

function parseTab(value: string | null): FulfillmentDetailsTab {
  if (value === 'order' || value === 'fulfillment' || value === 'ticket' || value === 'customer' || value === 'activity') {
    return value
  }
  return 'order'
}

function buildQueueHref(orderId: string | null | undefined, ticketId: string | null | undefined) {
  const params = new URLSearchParams()
  if (orderId) params.set('orderId', orderId)
  if (ticketId) params.set('ticketId', ticketId)
  return `/admin/fulfillment${params.toString() ? `?${params.toString()}` : ''}`
}

function formatAddressLines(
  address:
    | {
        firstName: string
        lastName: string
        address1: string
        address2: string | null
        city: string
        state: string
        postalCode: string
        country: string
      }
    | null
) {
  if (!address) return ['No address on file']
  return [
    `${address.firstName} ${address.lastName}`,
    address.address1,
    address.address2 || '',
    `${address.city}, ${address.state} ${address.postalCode}`,
    address.country,
  ].filter((line) => line.trim().length > 0)
}

export default function FulfillmentDetailsPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  const ticketId = searchParams.get('ticketId')
  const initialTab = parseTab(searchParams.get('tab'))

  const [activeTab, setActiveTab] = useState<FulfillmentDetailsTab>(initialTab)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState<ContextResponse | null>(null)
  const [trackingData, setTrackingData] = useState<TrackingResult | null>(null)
  const [customerDeepData, setCustomerDeepData] = useState<CustomerDetailPayload | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [orderDraft, setOrderDraft] = useState({
    status: '',
    paymentStatus: '',
    trackingNumber: '',
    carrier: '',
    trackingUrl: '',
    internalNotes: '',
  })
  const [ticketStatusDraft, setTicketStatusDraft] = useState('')
  const [externalReference, setExternalReference] = useState('')
  const [ticketReplyMessage, setTicketReplyMessage] = useState('')
  const [ticketReplyInternal, setTicketReplyInternal] = useState(true)
  const [ticketNote, setTicketNote] = useState('')
  const [customerDraft, setCustomerDraft] = useState({
    name: '',
    phone: '',
    birthday: '',
    newsletter: false,
    smsOptIn: false,
  })
  const [customerPointsDelta, setCustomerPointsDelta] = useState('')
  const [customerPointsReason, setCustomerPointsReason] = useState('')
  const [customerTierDraft, setCustomerTierDraft] = useState('')
  const [customerNoteDraft, setCustomerNoteDraft] = useState('')
  const [customerNoteImportant, setCustomerNoteImportant] = useState(false)

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    submitting: false,
    title: '',
    description: '',
    impact: [],
    run: null,
  })

  const loadContext = useCallback(async () => {
    if (!orderId && !ticketId) {
      setError('Provide orderId or ticketId in the URL.')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (orderId) params.set('orderId', orderId)
      if (ticketId) params.set('ticketId', ticketId)

      const response = await fetch(`/api/admin/fulfillment/context?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch fulfillment details')
      }
      const payload: ContextResponse = await response.json()
      setContext(payload)
      setError(null)
    } catch (fetchError) {
      console.error(fetchError)
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch fulfillment details')
    } finally {
      setLoading(false)
    }
  }, [orderId, ticketId])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    loadContext()
  }, [loadContext])

  useEffect(() => {
    if (!context?.order) return
    setOrderDraft({
      status: context.order.status || '',
      paymentStatus: context.order.paymentStatus || '',
      trackingNumber: context.order.trackingNumber || '',
      carrier: context.order.carrier || '',
      trackingUrl: context.order.trackingUrl || '',
      internalNotes: context.order.internalNotes || '',
    })
  }, [context?.order])

  useEffect(() => {
    if (!context?.selectedTicket) return
    setTicketStatusDraft(context.selectedTicket.status || '')
  }, [context?.selectedTicket])

  useEffect(() => {
    if (!context?.customer) return
    setCustomerDraft({
      name: context.customer.name || '',
      phone: context.customer.phone || '',
      birthday: context.customer.birthday ? context.customer.birthday.slice(0, 10) : '',
      newsletter: context.customer.newsletter,
      smsOptIn: context.customer.smsOptIn,
    })
    setCustomerTierDraft(context.customer.loyaltyTier?.id || '')
  }, [context?.customer])

  useEffect(() => {
    const loadTracking = async () => {
      if (!context?.order?.id || !context.order.trackingNumber) {
        setTrackingData(null)
        return
      }

      try {
        const response = await fetch(`/api/orders/${context.order.id}/tracking/live`)
        if (!response.ok) {
          throw new Error('Failed to load tracking')
        }
        const payload = await response.json()
        setTrackingData(payload.data || null)
      } catch (trackingError) {
        console.error('Failed to load tracking details:', trackingError)
        setTrackingData(null)
      }
    }

    loadTracking()
  }, [context?.order?.id, context?.order?.trackingNumber])

  useEffect(() => {
    const loadCustomerDeepData = async () => {
      if (!context?.customer?.id) {
        setCustomerDeepData(null)
        return
      }

      try {
        const response = await fetch(`/api/admin/customers/${context.customer.id}`)
        if (!response.ok) {
          throw new Error('Failed to load customer detail profile')
        }
        const payload: CustomerDetailPayload = await response.json()
        setCustomerDeepData(payload)
      } catch (customerError) {
        console.error('Failed to load expanded customer details:', customerError)
        setCustomerDeepData(null)
      }
    }

    loadCustomerDeepData()
  }, [context?.customer?.id])

  const openConfirm = useCallback((title: string, description: string, impact: string[], run: () => Promise<void>) => {
    setConfirmState({
      isOpen: true,
      submitting: false,
      title,
      description,
      impact,
      run,
    })
  }, [])

  const closeConfirm = useCallback(() => {
    if (confirmState.submitting) return
    setConfirmState((previous) => ({ ...previous, isOpen: false, run: null }))
  }, [confirmState.submitting])

  const executeConfirm = useCallback(async () => {
    if (!confirmState.run) return
    setConfirmState((previous) => ({ ...previous, submitting: true }))
    try {
      await confirmState.run()
      setConfirmState((previous) => ({ ...previous, isOpen: false, submitting: false, run: null }))
      await loadContext()
    } catch (actionError) {
      console.error(actionError)
      setConfirmState((previous) => ({ ...previous, submitting: false }))
    }
  }, [confirmState.run, loadContext])

  const runOrderUpdate = useCallback(async () => {
    if (!context?.order?.id) return
    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/fulfillment/orders/${context.order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: orderDraft.status,
          paymentStatus: orderDraft.paymentStatus,
          trackingNumber: orderDraft.trackingNumber,
          carrier: orderDraft.carrier,
          trackingUrl: orderDraft.trackingUrl,
          internalNotes: orderDraft.internalNotes,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Failed to update order')
      toast.success('Order updated')
    } catch (actionError) {
      toast.error('Order update failed', actionError instanceof Error ? actionError.message : 'Unknown error')
      throw actionError
    } finally {
      setActionLoading(false)
    }
  }, [context?.order?.id, orderDraft])

  const runLabelPurchase = useCallback(async () => {
    if (!context?.order?.id) return
    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/fulfillment/orders/${context.order.id}/label/purchase`, {
        method: 'POST',
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Failed to purchase label')
      const labelUrl = payload?.label?.labelUrl as string | undefined
      if (labelUrl) {
        window.open(labelUrl, '_blank', 'noopener,noreferrer')
      }
      toast.success('Label purchased')
    } catch (actionError) {
      toast.error('Label purchase failed', actionError instanceof Error ? actionError.message : 'Unknown error')
      throw actionError
    } finally {
      setActionLoading(false)
    }
  }, [context?.order?.id])

  const runTicketStatusUpdate = useCallback(async () => {
    if (!context?.selectedTicket?.id || !ticketStatusDraft) return
    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/fulfillment/tickets/${context.selectedTicket.id}/decision`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_status',
          status: ticketStatusDraft,
          note: ticketNote || undefined,
          externalReference: externalReference || undefined,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Failed to update ticket')
      toast.success('Ticket updated')
    } catch (actionError) {
      toast.error('Ticket update failed', actionError instanceof Error ? actionError.message : 'Unknown error')
      throw actionError
    } finally {
      setActionLoading(false)
    }
  }, [context?.selectedTicket?.id, externalReference, ticketNote, ticketStatusDraft])

  const runTicketMessage = useCallback(async () => {
    if (!context?.selectedTicket?.id || !ticketReplyMessage.trim()) return
    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/fulfillment/tickets/${context.selectedTicket.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: ticketReplyMessage.trim(),
          isInternal: ticketReplyInternal,
          nextStatus: ticketStatusDraft || undefined,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Failed to send message')
      setTicketReplyMessage('')
      toast.success(ticketReplyInternal ? 'Internal note added' : 'Customer reply sent')
    } catch (actionError) {
      toast.error('Message failed', actionError instanceof Error ? actionError.message : 'Unknown error')
      throw actionError
    } finally {
      setActionLoading(false)
    }
  }, [context?.selectedTicket?.id, ticketReplyMessage, ticketReplyInternal, ticketStatusDraft])

  const runTicketDecision = useCallback(
    async (
      action: 'approve_return' | 'deny_return' | 'mark_refund_requested' | 'approve_refund' | 'complete_refund' | 'deny_refund'
    ) => {
      if (!context?.selectedTicket?.id) return
      setActionLoading(true)
      try {
        const response = await fetch(`/api/admin/fulfillment/tickets/${context.selectedTicket.id}/decision`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action,
            note: ticketNote || undefined,
            externalReference: externalReference || undefined,
            generateLabel: action === 'approve_return',
          }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error || 'Failed to apply decision')
        toast.success('Decision applied')
      } catch (actionError) {
        toast.error('Decision failed', actionError instanceof Error ? actionError.message : 'Unknown error')
        throw actionError
      } finally {
        setActionLoading(false)
      }
    },
    [context?.selectedTicket?.id, externalReference, ticketNote]
  )

  const runCustomerUpdate = useCallback(async () => {
    if (!context?.customer?.id) return
    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/fulfillment/customers/${context.customer.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: customerDraft.name.trim() || null,
          phone: customerDraft.phone.trim() || null,
          birthday: customerDraft.birthday || null,
          newsletter: customerDraft.newsletter,
          smsOptIn: customerDraft.smsOptIn,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Failed to update customer')
      toast.success('Customer profile updated')
    } catch (actionError) {
      toast.error('Profile update failed', actionError instanceof Error ? actionError.message : 'Unknown error')
      throw actionError
    } finally {
      setActionLoading(false)
    }
  }, [context?.customer?.id, customerDraft])

  const runPointsAdjust = useCallback(async () => {
    if (!context?.customer?.id) return
    const delta = Number(customerPointsDelta)
    if (!Number.isFinite(delta) || delta === 0) {
      throw new Error('Enter a non-zero points adjustment')
    }
    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/fulfillment/customers/${context.customer.id}/loyalty`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'adjustPoints',
          points: delta,
          reason: customerPointsReason || 'Fulfillment detail adjustment',
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Failed to adjust points')
      setCustomerPointsDelta('')
      setCustomerPointsReason('')
      toast.success('Points adjusted')
    } catch (actionError) {
      toast.error('Points update failed', actionError instanceof Error ? actionError.message : 'Unknown error')
      throw actionError
    } finally {
      setActionLoading(false)
    }
  }, [context?.customer?.id, customerPointsDelta, customerPointsReason])

  const runTierChange = useCallback(async () => {
    if (!context?.customer?.id || !customerTierDraft) {
      throw new Error('Select a loyalty tier')
    }
    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/fulfillment/customers/${context.customer.id}/loyalty`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'changeTier',
          tierId: customerTierDraft,
          reason: 'Fulfillment detail tier update',
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Failed to change tier')
      toast.success('Tier updated')
    } catch (actionError) {
      toast.error('Tier update failed', actionError instanceof Error ? actionError.message : 'Unknown error')
      throw actionError
    } finally {
      setActionLoading(false)
    }
  }, [context?.customer?.id, customerTierDraft])

  const runAddCustomerNote = useCallback(async () => {
    if (!context?.customer?.id || !customerNoteDraft.trim()) {
      throw new Error('Enter a note before saving')
    }
    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/fulfillment/customers/${context.customer.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: customerNoteDraft.trim(),
          isImportant: customerNoteImportant,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Failed to add note')
      setCustomerNoteDraft('')
      setCustomerNoteImportant(false)
      toast.success('Note added')
    } catch (actionError) {
      toast.error('Note add failed', actionError instanceof Error ? actionError.message : 'Unknown error')
      throw actionError
    } finally {
      setActionLoading(false)
    }
  }, [context?.customer?.id, customerNoteDraft, customerNoteImportant])

  const runDeleteCustomerNote = useCallback(
    async (noteId: string) => {
      if (!context?.customer?.id) return
      setActionLoading(true)
      try {
        const response = await fetch(
          `/api/admin/fulfillment/customers/${context.customer.id}/notes?noteId=${encodeURIComponent(noteId)}`,
          {
            method: 'DELETE',
          }
        )
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error || 'Failed to delete note')
        toast.success('Note deleted')
      } catch (actionError) {
        toast.error('Note delete failed', actionError instanceof Error ? actionError.message : 'Unknown error')
        throw actionError
      } finally {
        setActionLoading(false)
      }
    },
    [context?.customer?.id]
  )

  const queueHref = useMemo(() => buildQueueHref(context?.order?.id || orderId, context?.selectedTicket?.id || ticketId), [context?.order?.id, context?.selectedTicket?.id, orderId, ticketId])

  const currentTabLabel = useMemo(() => TABS.find((tab) => tab.key === activeTab)?.label || 'Details', [activeTab])

  return (
    <AdminLayout
      title="Fulfillment Details"
      subtitle={`${currentTabLabel} view • Full context for fulfillment operations`}
      headerActions={
        <div className="flex items-center gap-2">
          <Link
            href={queueHref}
            className="h-8 px-2.5 rounded-md border border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back To Queue
          </Link>
          {context?.order?.id ? (
            <Link
              href={`/admin/orders/${context.order.id}`}
              className="h-8 px-2.5 rounded-md border border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center gap-1"
            >
              <ArrowSquareOut className="h-3.5 w-3.5" />
              Legacy Order
            </Link>
          ) : null}
          {context?.selectedTicket?.id ? (
            <Link
              href={`/admin/support/tickets/${context.selectedTicket.id}`}
              className="h-8 px-2.5 rounded-md border border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center gap-1"
            >
              <ArrowSquareOut className="h-3.5 w-3.5" />
              Legacy Ticket
            </Link>
          ) : null}
          {context?.customer?.id ? (
            <Link
              href={`/admin/customers/${context.customer.id}`}
              className="h-8 px-2.5 rounded-md border border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center gap-1"
            >
              <ArrowSquareOut className="h-3.5 w-3.5" />
              Legacy Customer
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="space-y-3 text-white">
        <section className="rounded-xl border border-white/10 bg-neutral-900/80 p-2">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`h-8 px-3 rounded-md border text-xs uppercase tracking-[0.12em] ${
                  activeTab === tab.key
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <section className="rounded-xl border border-white/10 bg-neutral-900 p-8 text-center text-white/55">
            Loading fulfillment details...
          </section>
        ) : error ? (
          <section className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-8 text-center text-rose-200">
            {error}
          </section>
        ) : !context ? (
          <section className="rounded-xl border border-white/10 bg-neutral-900 p-8 text-center text-white/55">
            No context found.
          </section>
        ) : (
          <section className="rounded-xl border border-white/10 bg-neutral-900 p-4 space-y-4">
            {activeTab === 'order' ? (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Order Summary</p>
                    <p className="text-sm font-semibold text-white">{context.order?.orderNumber || '-'}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {context.order?.status ? (
                        <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] ${statusClass(context.order.status)}`}>
                          {context.order.status}
                        </span>
                      ) : null}
                      {context.order?.paymentStatus ? (
                        <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] ${statusClass(context.order.paymentStatus)}`}>
                          {context.order.paymentStatus}
                        </span>
                      ) : null}
                      {context.selectedTicket?.status ? (
                        <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] ${statusClass(context.selectedTicket.status)}`}>
                          Ticket: {context.selectedTicket.status}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-white/60">Created {formatDate(context.order?.createdAt)}</p>
                    <p className="text-xs text-white/60">Updated {formatDate(context.order?.updatedAt)}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-1 text-sm">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-1">Financial Breakdown</p>
                    <div className="flex items-center justify-between text-white/70"><span>Subtotal</span><span>{formatCurrency(context.order?.subtotal)}</span></div>
                    <div className="flex items-center justify-between text-emerald-300"><span>Discount</span><span>{formatCurrency(context.order?.discount)}</span></div>
                    <div className="flex items-center justify-between text-white/70"><span>Shipping</span><span>{formatCurrency(context.order?.shipping)}</span></div>
                    <div className="flex items-center justify-between text-white/70"><span>Tax</span><span>{formatCurrency(context.order?.tax)}</span></div>
                    <div className="pt-1 border-t border-white/10 flex items-center justify-between font-semibold text-white"><span>Total</span><span>{formatCurrency(context.order?.total)}</span></div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-1">Shipping Address</p>
                    {formatAddressLines(context.order?.shippingAddress || null).map((line) => (
                      <p key={`ship-${line}`} className="text-sm text-white/80">{line}</p>
                    ))}
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-1">Billing Address</p>
                    {formatAddressLines(context.order?.billingAddress || null).map((line) => (
                      <p key={`bill-${line}`} className="text-sm text-white/80">{line}</p>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-2">Order Items</p>
                  <div className="space-y-2">
                    {(context.order?.items || []).map((item) => {
                      const image = item.productImage || normalizeImage(item.product?.images)
                      return (
                        <div key={item.id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] gap-2 rounded-md border border-white/10 bg-neutral-900 p-2">
                          <div className="h-14 w-14 rounded-md border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                            {image ? <img src={image} alt={item.productName} className="w-full h-full object-cover" /> : <span className="text-[10px] text-white/40">No Img</span>}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{item.product?.name || item.productName}</p>
                            <p className="text-xs text-white/55 truncate">{item.variantDetails || `${item.productVariant?.size || 'Default'} • ${item.productVariant?.color || ''}`}</p>
                            <p className="text-xs text-white/45">Qty {item.quantity}</p>
                          </div>
                          <p className="text-sm font-medium text-white">{formatCurrency(item.price * item.quantity)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : null}

            {activeTab === 'fulfillment' ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-xs text-white/55">
                    <span className="block mb-1 uppercase tracking-[0.12em]">Order Status</span>
                    <select
                      value={orderDraft.status}
                      onChange={(event) => setOrderDraft((previous) => ({ ...previous, status: event.target.value }))}
                      className="w-full h-9 px-2 rounded-md border border-white/10 bg-white/5 text-white"
                    >
                      {['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].map((status) => (
                        <option key={status} value={status} className="bg-neutral-900">{status}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-white/55">
                    <span className="block mb-1 uppercase tracking-[0.12em]">Payment Status</span>
                    <select
                      value={orderDraft.paymentStatus}
                      onChange={(event) => setOrderDraft((previous) => ({ ...previous, paymentStatus: event.target.value }))}
                      className="w-full h-9 px-2 rounded-md border border-white/10 bg-white/5 text-white"
                    >
                      {['PENDING', 'PAID', 'FAILED', 'REFUNDED'].map((status) => (
                        <option key={status} value={status} className="bg-neutral-900">{status}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-white/55">
                    <span className="block mb-1 uppercase tracking-[0.12em]">Tracking Number</span>
                    <input
                      value={orderDraft.trackingNumber}
                      onChange={(event) => setOrderDraft((previous) => ({ ...previous, trackingNumber: event.target.value }))}
                      className="w-full h-9 px-2 rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/35"
                    />
                  </label>
                  <label className="text-xs text-white/55">
                    <span className="block mb-1 uppercase tracking-[0.12em]">Carrier</span>
                    <input
                      value={orderDraft.carrier}
                      onChange={(event) => setOrderDraft((previous) => ({ ...previous, carrier: event.target.value }))}
                      className="w-full h-9 px-2 rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/35"
                    />
                  </label>
                </div>

                <label className="text-xs text-white/55 block">
                  <span className="block mb-1 uppercase tracking-[0.12em]">Internal Notes</span>
                  <textarea
                    rows={4}
                    value={orderDraft.internalNotes}
                    onChange={(event) => setOrderDraft((previous) => ({ ...previous, internalNotes: event.target.value }))}
                    className="w-full px-2 py-1.5 rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/35 resize-none"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      openConfirm(
                        'Apply fulfillment update',
                        'This updates order status, payment status, tracking, and internal notes.',
                        [
                          `Status: ${context.order?.status || '-'} -> ${orderDraft.status || '-'}`,
                          `Payment: ${context.order?.paymentStatus || '-'} -> ${orderDraft.paymentStatus || '-'}`,
                          `Tracking: ${context.order?.trackingNumber || '-'} -> ${orderDraft.trackingNumber || '-'}`,
                        ],
                        runOrderUpdate
                      )
                    }
                    disabled={actionLoading}
                    className="h-9 px-4 rounded-md bg-[#FF3131] text-white text-xs uppercase tracking-[0.12em] hover:bg-[#ff4a4a] disabled:opacity-60"
                  >
                    Review Update
                  </button>
                  <button
                    onClick={() =>
                      openConfirm(
                        'Purchase shipping label',
                        'Carrier label purchase will create/update tracking and open printable label output.',
                        [`Order: ${context.order?.orderNumber || '-'}`, `Current tracking: ${context.order?.trackingNumber || 'Not set'}`],
                        runLabelPurchase
                      )
                    }
                    disabled={actionLoading}
                    className="h-9 px-4 rounded-md border border-white/10 text-white/80 text-xs uppercase tracking-[0.12em] hover:text-white hover:bg-white/10 inline-flex items-center gap-1"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Review Label Purchase
                  </button>
                  {context.order?.trackingUrl ? (
                    <button
                      onClick={() => window.open(context.order?.trackingUrl || '', '_blank', 'noopener,noreferrer')}
                      className="h-9 px-4 rounded-md border border-white/10 text-white/80 text-xs uppercase tracking-[0.12em] hover:text-white hover:bg-white/10 inline-flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Open Tracking URL
                    </button>
                  ) : null}
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-1">Tracking Snapshot</p>
                  {!trackingData ? (
                    <p className="text-sm text-white/55">No live tracking data available.</p>
                  ) : (
                    <div className="space-y-1 text-sm">
                      <p className="text-white">
                        {trackingData.statusDescription} • {trackingData.trackingNumber}
                      </p>
                      <p className="text-white/60">
                        Carrier {trackingData.carrier} • Progress {trackingData.transitProgress}%
                      </p>
                      <p className="text-white/60">
                        Last update: {trackingData.events[0] ? formatDate(trackingData.events[0].timestamp) : '-'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {activeTab === 'ticket' ? (
              <>
                {!context.selectedTicket ? (
                  <p className="text-sm text-white/55">No ticket linked to this context.</p>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-1">Ticket</p>
                        <p className="text-white">{context.selectedTicket.ticketNumber}</p>
                        <p className="text-white/60">{context.selectedTicket.subject}</p>
                        <p className="text-white/60">{context.selectedTicket.type.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-1">Status & Assignment</p>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] ${statusClass(context.selectedTicket.status)}`}>
                            {context.selectedTicket.status}
                          </span>
                          <span className="inline-flex px-2 py-0.5 rounded border border-white/20 bg-white/10 text-[10px] text-white/75">
                            {context.selectedTicket.priority}
                          </span>
                        </div>
                        <p className="text-white/60">{context.selectedTicket.assignedTo?.name || 'Unassigned'}</p>
                        <p className="text-white/60">Updated {formatDate(context.selectedTicket.updatedAt)}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-xs text-white/55">
                        <span className="block mb-1 uppercase tracking-[0.12em]">Status</span>
                        <select
                          value={ticketStatusDraft}
                          onChange={(event) => setTicketStatusDraft(event.target.value)}
                          className="w-full h-9 px-2 rounded-md border border-white/10 bg-white/5 text-white"
                        >
                          {['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED'].map((status) => (
                            <option key={status} value={status} className="bg-neutral-900">{status}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-white/55">
                        <span className="block mb-1 uppercase tracking-[0.12em]">External Reference</span>
                        <input
                          value={externalReference}
                          onChange={(event) => setExternalReference(event.target.value)}
                          className="w-full h-9 px-2 rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/35"
                        />
                      </label>
                    </div>

                    <label className="text-xs text-white/55 block">
                      <span className="block mb-1 uppercase tracking-[0.12em]">Message / Note</span>
                      <textarea
                        rows={3}
                        value={ticketReplyMessage}
                        onChange={(event) => setTicketReplyMessage(event.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/35 resize-none"
                        placeholder={ticketReplyInternal ? 'Internal note...' : 'Reply to customer...'}
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-white/65">
                      <input
                        type="checkbox"
                        checked={ticketReplyInternal}
                        onChange={(event) => setTicketReplyInternal(event.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-white/5"
                      />
                      Internal note mode
                    </label>

                    <label className="text-xs text-white/55 block">
                      <span className="block mb-1 uppercase tracking-[0.12em]">Decision Note</span>
                      <textarea
                        rows={2}
                        value={ticketNote}
                        onChange={(event) => setTicketNote(event.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/35 resize-none"
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          openConfirm(
                            'Update ticket status',
                            'This updates ticket status and adds decision metadata if provided.',
                            [`Status: ${context.selectedTicket?.status || '-'} -> ${ticketStatusDraft || '-'}`],
                            runTicketStatusUpdate
                          )
                        }
                        disabled={actionLoading}
                        className="h-9 px-4 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/80 hover:text-white hover:bg-white/10"
                      >
                        Review Status
                      </button>
                      <button
                        onClick={() =>
                          openConfirm(
                            ticketReplyInternal ? 'Add internal note' : 'Send customer reply',
                            'This posts a message to the ticket thread.',
                            [`Mode: ${ticketReplyInternal ? 'Internal' : 'Customer-facing'}`],
                            runTicketMessage
                          )
                        }
                        disabled={actionLoading || !ticketReplyMessage.trim()}
                        className="h-9 px-4 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-50"
                      >
                        Review Message
                      </button>

                      {context.selectedTicket.returnRequested && context.selectedTicket.returnApproved === null ? (
                        <>
                          <button
                            onClick={() =>
                              openConfirm(
                                'Approve return',
                                'This approves the return and can generate a label.',
                                ['Return status: pending -> approved'],
                                () => runTicketDecision('approve_return')
                              )
                            }
                            className="h-9 px-4 rounded-md border border-emerald-500/30 text-xs uppercase tracking-[0.12em] text-emerald-300"
                          >
                            Approve Return
                          </button>
                          <button
                            onClick={() =>
                              openConfirm(
                                'Deny return',
                                'This denies the pending return request.',
                                ['Return status: pending -> denied'],
                                () => runTicketDecision('deny_return')
                              )
                            }
                            className="h-9 px-4 rounded-md border border-rose-500/30 text-xs uppercase tracking-[0.12em] text-rose-300"
                          >
                            Deny Return
                          </button>
                        </>
                      ) : null}

                      {context.selectedTicket.type === 'REFUND' ? (
                        <>
                          <button
                            onClick={() =>
                              openConfirm(
                                'Mark refund requested',
                                'This moves refund workflow forward.',
                                ['Refund state: marked requested'],
                                () => runTicketDecision('mark_refund_requested')
                              )
                            }
                            className="h-9 px-4 rounded-md border border-amber-500/30 text-xs uppercase tracking-[0.12em] text-amber-300"
                          >
                            Mark Requested
                          </button>
                          <button
                            onClick={() =>
                              openConfirm(
                                'Approve refund',
                                'This approves refund at ticket operations level.',
                                ['Refund state: approved'],
                                () => runTicketDecision('approve_refund')
                              )
                            }
                            className="h-9 px-4 rounded-md border border-blue-500/30 text-xs uppercase tracking-[0.12em] text-blue-300"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              openConfirm(
                                'Complete refund',
                                'This marks refund complete and updates linked order state when applicable.',
                                ['Refund state: completed'],
                                () => runTicketDecision('complete_refund')
                              )
                            }
                            className="h-9 px-4 rounded-md border border-emerald-500/30 text-xs uppercase tracking-[0.12em] text-emerald-300"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() =>
                              openConfirm(
                                'Deny refund',
                                'This denies refund workflow for the ticket.',
                                ['Refund state: denied'],
                                () => runTicketDecision('deny_refund')
                              )
                            }
                            className="h-9 px-4 rounded-md border border-rose-500/30 text-xs uppercase tracking-[0.12em] text-rose-300"
                          >
                            Deny
                          </button>
                        </>
                      ) : null}
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-2">Conversation</p>
                      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                        {(context.selectedTicket.messages || []).map((message) => (
                          <div key={message.id} className="rounded-md border border-white/10 bg-neutral-900 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm text-white">{message.senderName}</p>
                              <p className="text-xs text-white/50">{formatDate(message.createdAt)}</p>
                            </div>
                            <p className="text-sm text-white/75 whitespace-pre-wrap">{message.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : null}

            {activeTab === 'customer' ? (
              <>
                {!context.customer ? (
                  <p className="text-sm text-white/55">No customer profile linked to this context.</p>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-1">Customer</p>
                        <p className="text-white">{context.customer.name || context.customer.email}</p>
                        <p className="text-white/60 text-sm">{context.customer.email}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-1">Tier</p>
                        <p className="text-white">{context.customer.loyaltyTier?.name || 'None'}</p>
                        <p className="text-white/60 text-sm">{context.customer.loyaltyTier?.pointMultiplier || 1}x</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-1">Current Points</p>
                        <p className="text-white">{context.customer.currentPoints.toLocaleString()}</p>
                        <p className="text-white/60 text-sm">Lifetime {context.customer.lifetimePoints.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-1">Orders / Spend</p>
                        <p className="text-white">{context.customer.totalOrders} orders</p>
                        <p className="text-white/60 text-sm">{formatCurrency(context.customer.totalSpent)}</p>
                      </div>
                    </div>

                    {customerDeepData ? (
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-2">Expanded Loyalty Snapshot</p>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                          <p className="text-white/80">AOV: <span className="text-white">{formatCurrency(customerDeepData.customer.avgOrderValue)}</span></p>
                          <p className="text-white/80">Annual Points: <span className="text-white">{customerDeepData.customer.annualPointsEarned.toLocaleString()}</span></p>
                          <p className="text-white/80">Expiring: <span className="text-white">{customerDeepData.customer.expiringPoints.toLocaleString()}</span></p>
                          <p className="text-white/80">Next Tier: <span className="text-white">{customerDeepData.customer.nextTier?.name || '-'}</span></p>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-xs text-white/55">
                        <span className="block mb-1 uppercase tracking-[0.12em]">Name</span>
                        <input
                          value={customerDraft.name}
                          onChange={(event) => setCustomerDraft((previous) => ({ ...previous, name: event.target.value }))}
                          className="w-full h-9 px-2 rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/35"
                        />
                      </label>
                      <label className="text-xs text-white/55">
                        <span className="block mb-1 uppercase tracking-[0.12em]">Phone</span>
                        <input
                          value={customerDraft.phone}
                          onChange={(event) => setCustomerDraft((previous) => ({ ...previous, phone: event.target.value }))}
                          className="w-full h-9 px-2 rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/35"
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          openConfirm(
                            'Update customer profile',
                            'This saves customer identity and preferences.',
                            [`Name: ${context.customer?.name || '-'} -> ${customerDraft.name || '-'}`],
                            runCustomerUpdate
                          )
                        }
                        disabled={actionLoading}
                        className="h-9 px-4 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/80 hover:text-white hover:bg-white/10"
                      >
                        Review Profile Update
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <input
                        value={customerPointsDelta}
                        onChange={(event) => setCustomerPointsDelta(event.target.value)}
                        className="h-9 px-2 rounded-md border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35"
                        placeholder="+/- points"
                      />
                      <input
                        value={customerPointsReason}
                        onChange={(event) => setCustomerPointsReason(event.target.value)}
                        className="h-9 px-2 rounded-md border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35"
                        placeholder="Reason"
                      />
                      <button
                        onClick={() =>
                          openConfirm(
                            'Adjust loyalty points',
                            'This will create a points transaction for the customer.',
                            [`Delta: ${customerPointsDelta || '0'} points`],
                            runPointsAdjust
                          )
                        }
                        className="h-9 px-4 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/80 hover:text-white hover:bg-white/10"
                      >
                        Review Points
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <select
                        value={customerTierDraft}
                        onChange={(event) => setCustomerTierDraft(event.target.value)}
                        className="h-9 px-2 rounded-md border border-white/10 bg-white/5 text-sm text-white"
                      >
                        <option value="" className="bg-neutral-900">Select tier</option>
                        {context.loyaltyTiers.map((tier) => (
                          <option key={tier.id} value={tier.id} className="bg-neutral-900">
                            {tier.name} ({tier.pointMultiplier}x)
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          openConfirm(
                            'Change loyalty tier',
                            'This directly updates customer tier assignment.',
                            [`Tier -> ${context.loyaltyTiers.find((tier) => tier.id === customerTierDraft)?.name || '-'}`],
                            runTierChange
                          )
                        }
                        className="h-9 px-4 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/80 hover:text-white hover:bg-white/10"
                      >
                        Review Tier
                      </button>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Notes</p>
                      <textarea
                        rows={2}
                        value={customerNoteDraft}
                        onChange={(event) => setCustomerNoteDraft(event.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 resize-none"
                        placeholder="Internal note..."
                      />
                      <label className="inline-flex items-center gap-2 text-xs text-white/65">
                        <input
                          type="checkbox"
                          checked={customerNoteImportant}
                          onChange={(event) => setCustomerNoteImportant(event.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-white/5"
                        />
                        Mark important
                      </label>
                      <button
                        onClick={() =>
                          openConfirm(
                            'Add customer note',
                            'This adds an internal note to the customer profile.',
                            [`Important: ${customerNoteImportant ? 'Yes' : 'No'}`],
                            runAddCustomerNote
                          )
                        }
                        className="h-9 px-4 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/80 hover:text-white hover:bg-white/10"
                      >
                        Review Note
                      </button>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {(context.customer.notes || []).map((note) => (
                          <div key={note.id} className="rounded-md border border-white/10 bg-neutral-900 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm text-white truncate">
                                {note.isImportant ? 'IMPORTANT • ' : ''}
                                {note.content}
                              </p>
                              <button
                                onClick={() =>
                                  openConfirm(
                                    'Delete note',
                                    'This permanently deletes the selected note.',
                                    [note.content],
                                    () => runDeleteCustomerNote(note.id)
                                  )
                                }
                                className="h-7 px-2 rounded-md border border-rose-500/30 text-[10px] uppercase tracking-[0.12em] text-rose-300"
                              >
                                Delete
                              </button>
                            </div>
                            <p className="text-xs text-white/50">{formatDate(note.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : null}

            {activeTab === 'activity' ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-2">Recent Orders</p>
                    <div className="space-y-1.5">
                      {(context.recentOrders || []).map((recentOrder) => (
                        <div key={recentOrder.id} className="rounded-md border border-white/10 bg-neutral-900 px-2 py-1.5">
                          <p className="text-sm text-white">{recentOrder.orderNumber}</p>
                          <p className="text-xs text-white/55">
                            {recentOrder.status} • {recentOrder.paymentStatus} • {formatCurrency(recentOrder.total)}
                          </p>
                          <p className="text-xs text-white/45">{formatDate(recentOrder.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-2">Recent Tickets</p>
                    <div className="space-y-1.5">
                      {(context.recentTickets || []).map((recentTicket) => (
                        <div key={recentTicket.id} className="rounded-md border border-white/10 bg-neutral-900 px-2 py-1.5">
                          <p className="text-sm text-white">{recentTicket.ticketNumber}</p>
                          <p className="text-xs text-white/55">
                            {recentTicket.type.replace(/_/g, ' ')} • {recentTicket.status}
                          </p>
                          <p className="text-xs text-white/45">{formatDate(recentTicket.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-2">Customer Points Timeline</p>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {(customerDeepData?.pointsTransactions || context.customer?.pointsTransactions || []).slice(0, 20).map((transaction) => (
                      <div key={transaction.id} className="rounded-md border border-white/10 bg-neutral-900 px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-white">{transaction.type}</p>
                          <p className={`text-sm ${transaction.points >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {transaction.points >= 0 ? '+' : ''}
                            {transaction.points}
                          </p>
                        </div>
                        <p className="text-xs text-white/55">{transaction.description || '-'}</p>
                        <p className="text-xs text-white/45">{formatDate(transaction.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </section>
        )}

        {confirmState.isOpen ? (
          <div className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-[1px]" onClick={closeConfirm}>
            <aside
              className="absolute right-0 top-0 h-full w-full max-w-md border-l border-white/10 bg-neutral-900 shadow-2xl flex flex-col"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="px-4 py-3 border-b border-white/10 space-y-1">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Impact Drawer</p>
                <p className="text-sm font-semibold text-white">{confirmState.title}</p>
                <p className="text-[11px] text-white/65">{confirmState.description}</p>
              </header>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-neutral-950/60">
                <div className="rounded-md border border-white/10 bg-neutral-900 p-2.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/45 mb-1.5">Pending Impact</p>
                  {confirmState.impact.length === 0 ? (
                    <p className="text-[11px] text-white/55">No explicit field-level impact provided.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {confirmState.impact.map((line) => (
                        <div key={line} className="rounded border border-white/10 bg-white/5 px-2 py-1.5">
                          <p className="text-[11px] text-white">{line}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <footer className="px-4 py-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  onClick={closeConfirm}
                  disabled={confirmState.submitting}
                  className="h-8 px-3 rounded-md border border-white/10 text-[11px] uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={executeConfirm}
                  disabled={confirmState.submitting || actionLoading}
                  className="h-8 px-3 rounded-md bg-[#FF3131] text-white text-[11px] uppercase tracking-[0.12em] hover:bg-[#ff4a4a] disabled:opacity-60 inline-flex items-center gap-1"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {confirmState.submitting || actionLoading ? 'Applying...' : 'Confirm Action'}
                </button>
              </footer>
            </aside>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  )
}
