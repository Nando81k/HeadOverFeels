'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckSquare } from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { FulfillmentCaseDrawer } from '@/components/admin/fulfillment/FulfillmentCaseDrawer'
import { FulfillmentCommandBar } from '@/components/admin/fulfillment/FulfillmentCommandBar'
import { FulfillmentQueueGrid } from '@/components/admin/fulfillment/FulfillmentQueueGrid'
import {
  FULFILLMENT_BLOCKER_LABELS,
  FULFILLMENT_NEXT_ACTION_LABELS,
  type FulfillmentAgeBucket,
  type FulfillmentNextAction,
  type FulfillmentQueueItem,
  type FulfillmentQueueType,
  type FulfillmentSortDirection,
  type FulfillmentSortField,
} from '@/lib/fulfillment/queue'
import type { FulfillmentActionResult } from '@/lib/fulfillment/types'
import {
  deriveActiveRecordHeader,
  deriveRecordContext,
  deriveWorkspaceAvailability,
  getDefaultDrawerTabForQueueItem,
  toQueueRowViewModel,
  type FulfillmentDrawerTab,
} from '@/lib/fulfillment/console'
import { toast } from '@/lib/toast'

type QueueResponse = {
  data: FulfillmentQueueItem[]
  counts: {
    total: number
    byType: Record<FulfillmentQueueType, number>
  }
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

type FulfillmentContextResponse = {
  fulfillmentReadiness?: {
    hasOrder: boolean
    primaryAction: FulfillmentNextAction | 'OPEN_CASE' | 'FIX_ADDRESS' | 'REQUEST_PAYMENT'
    steps: Array<{
      id: 'validate_address' | 'buy_label' | 'print_label' | 'mark_shipped' | 'notify_customer'
      label: string
      ready: boolean
      reason?: string
    }>
  }
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

const QUEUE_LABELS: Record<FulfillmentQueueType, string> = {
  FULFILL_ORDER: 'Ready to Ship',
  PAYMENT_EXCEPTION: 'Payment',
  SHIPPING_EXCEPTION: 'Shipping',
  RETURN_REVIEW: 'Return',
  REFUND_REVIEW: 'Refund',
}

const OPERATIONAL_QUEUE_TYPES: FulfillmentQueueType[] = [
  'FULFILL_ORDER',
  'SHIPPING_EXCEPTION',
  'RETURN_REVIEW',
  'REFUND_REVIEW',
]

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  CONFIRMED: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  PROCESSING: 'bg-violet-500/20 text-violet-300 border-violet-400/30',
  SHIPPED: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  DELIVERED: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  CANCELLED: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
  REFUNDED: 'bg-white/10 text-white/75 border-white/20',
  OPEN: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  IN_PROGRESS: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  WAITING_CUSTOMER: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/30',
  ESCALATED: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
  RESOLVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  CLOSED: 'bg-white/10 text-white/75 border-white/20',
  PAID: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  FAILED: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
}

const FILTER_STORAGE_KEY = 'hof_admin_fulfillment_filters_v1'
const OPERATOR_PREFS_STORAGE_KEY = 'hof_admin_fulfillment_operator_prefs_v1'

type FulfillmentOperatorPreferences = {
  quickShipMode: boolean
  denseRows: boolean
  defaultLane: FulfillmentQueueType
  defaultCarrier: string
  defaultService: string
}

type BatchProgressState = {
  running: boolean
  action: 'labels' | 'markShipped' | 'sendTracking' | null
  requested: number
  processed: number
  succeeded: number
  failed: number
  failedOrderIds: string[]
}

const DEFAULT_OPERATOR_PREFS: FulfillmentOperatorPreferences = {
  quickShipMode: false,
  denseRows: true,
  defaultLane: 'FULFILL_ORDER',
  defaultCarrier: 'USPS',
  defaultService: 'ground',
}

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

function formatDateOnly(value: string | null | undefined) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function getStatusColor(status: string | null | undefined) {
  if (!status) {
    return 'bg-white/10 text-white/75 border-white/20'
  }
  return STATUS_COLORS[status] || 'bg-white/10 text-white/75 border-white/20'
}

function buildEmptyFilterCounts(): QueueResponse['counts'] {
  return {
    total: 0,
    byType: {
      FULFILL_ORDER: 0,
      PAYMENT_EXCEPTION: 0,
      SHIPPING_EXCEPTION: 0,
      RETURN_REVIEW: 0,
      REFUND_REVIEW: 0,
    },
  }
}

function normalizeActionResult(error: unknown, fallbackMessage: string): FulfillmentActionResult {
  if (error instanceof Error) {
    return {
      success: false,
      message: error.message || fallbackMessage,
    }
  }
  return {
    success: false,
    message: fallbackMessage,
  }
}

export default function AdminFulfillmentPage() {
  const searchParams = useSearchParams()
  const deepLinkOrderId = searchParams.get('orderId')
  const deepLinkTicketId = searchParams.get('ticketId')

  const [queueItems, setQueueItems] = useState<FulfillmentQueueItem[]>([])
  const [counts, setCounts] = useState<QueueResponse['counts']>(buildEmptyFilterCounts())
  const [pagination, setPagination] = useState<QueueResponse['pagination']>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  })
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [refreshingQueue, setRefreshingQueue] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [selectedQueueTypes, setSelectedQueueTypes] = useState<FulfillmentQueueType[]>(['FULFILL_ORDER'])
  const [orderStatusFilter, setOrderStatusFilter] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('')
  const [ticketStatusFilter, setTicketStatusFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')
  const [ageBucket, setAgeBucket] = useState<FulfillmentAgeBucket>('all')
  const [sortBy, setSortBy] = useState<FulfillmentSortField>('priority')
  const [sortDir, setSortDir] = useState<FulfillmentSortDirection>('desc')

  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeDrawerTab, setActiveDrawerTab] = useState<FulfillmentDrawerTab>('summary')
  const [context, setContext] = useState<FulfillmentContextResponse | null>(null)
  const [loadingContext, setLoadingContext] = useState(false)

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [latestBatchPrintUrls, setLatestBatchPrintUrls] = useState<string[]>([])
  const [lastSingleLabelUrl, setLastSingleLabelUrl] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<BatchProgressState>({
    running: false,
    action: null,
    requested: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    failedOrderIds: [],
  })
  const [operatorPrefs, setOperatorPrefs] = useState<FulfillmentOperatorPreferences>(DEFAULT_OPERATOR_PREFS)

  const [orderDraft, setOrderDraft] = useState({
    status: '',
    paymentStatus: '',
    trackingNumber: '',
    carrier: '',
    trackingUrl: '',
    internalNotes: '',
  })

  const [ticketStatusDraft, setTicketStatusDraft] = useState('')
  const [ticketNote, setTicketNote] = useState('')
  const [externalReference, setExternalReference] = useState('')
  const [ticketReplyMessage, setTicketReplyMessage] = useState('')
  const [ticketReplyInternal, setTicketReplyInternal] = useState(true)

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

  const [showUnsavedGuard, setShowUnsavedGuard] = useState(false)
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null)
  const [pendingCloseDrawer, setPendingCloseDrawer] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        search?: string
        queueTypes?: FulfillmentQueueType[]
        orderStatus?: string
        paymentStatus?: string
        ticketStatus?: string
        assigned?: 'all' | 'assigned' | 'unassigned'
        ageBucket?: FulfillmentAgeBucket
        sortBy?: FulfillmentSortField
        sortDir?: FulfillmentSortDirection
      }
      if (typeof parsed.search === 'string') {
        setSearchInput(parsed.search)
        setSearchDebounced(parsed.search)
      }
      if (Array.isArray(parsed.queueTypes) && parsed.queueTypes.length > 0) {
        const sanitizedQueueTypes = parsed.queueTypes.filter((queueType) =>
          OPERATIONAL_QUEUE_TYPES.includes(queueType)
        )
        if (sanitizedQueueTypes.length > 0) {
          setSelectedQueueTypes(sanitizedQueueTypes)
        }
      }
      if (typeof parsed.orderStatus === 'string') setOrderStatusFilter(parsed.orderStatus)
      if (typeof parsed.paymentStatus === 'string') setPaymentStatusFilter(parsed.paymentStatus)
      if (typeof parsed.ticketStatus === 'string') setTicketStatusFilter(parsed.ticketStatus)
      if (parsed.assigned === 'all' || parsed.assigned === 'assigned' || parsed.assigned === 'unassigned') {
        setAssignedFilter(parsed.assigned)
      }
      if (parsed.ageBucket) setAgeBucket(parsed.ageBucket)
      if (parsed.sortBy) setSortBy(parsed.sortBy)
      if (parsed.sortDir) setSortDir(parsed.sortDir)
    } catch {
      // Ignore malformed local storage values.
    }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(OPERATOR_PREFS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<FulfillmentOperatorPreferences>
      setOperatorPrefs((previous) => {
        const merged = {
          ...previous,
          ...parsed,
        }
        if (!OPERATIONAL_QUEUE_TYPES.includes(merged.defaultLane)) {
          merged.defaultLane = 'FULFILL_ORDER'
        }
        return merged
      })
    } catch {
      // Ignore malformed local storage values.
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({
          search: searchInput.trim(),
          queueTypes: selectedQueueTypes,
          orderStatus: orderStatusFilter,
          paymentStatus: paymentStatusFilter,
          ticketStatus: ticketStatusFilter,
          assigned: assignedFilter,
          ageBucket,
          sortBy,
          sortDir,
        })
      )
    } catch {
      // Ignore localStorage write errors.
    }
  }, [
    ageBucket,
    assignedFilter,
    orderStatusFilter,
    paymentStatusFilter,
    searchInput,
    selectedQueueTypes,
    sortBy,
    sortDir,
    ticketStatusFilter,
  ])

  useEffect(() => {
    try {
      localStorage.setItem(OPERATOR_PREFS_STORAGE_KEY, JSON.stringify(operatorPrefs))
    } catch {
      // Ignore localStorage write errors.
    }
  }, [operatorPrefs])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim()
      setSearchDebounced(next)
      setPagination((previous) => (previous.page === 1 ? previous : { ...previous, page: 1 }))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const activeItem = useMemo(
    () => queueItems.find((item) => item.id === activeItemId) || null,
    [queueItems, activeItemId]
  )

  const activeQueueIndex = useMemo(
    () => queueItems.findIndex((item) => item.id === activeItemId),
    [activeItemId, queueItems]
  )

  const moveSelectionByOffset = useCallback(
    (offset: number) => {
      if (queueItems.length === 0) return
      const currentIndex = activeQueueIndex >= 0 ? activeQueueIndex : 0
      const nextIndex = Math.min(queueItems.length - 1, Math.max(0, currentIndex + offset))
      const nextItem = queueItems[nextIndex]
      if (!nextItem) return
      setActiveItemId(nextItem.id)
      setIsDrawerOpen((previous) => previous && Boolean(nextItem.orderId))
      setActiveDrawerTab(getDefaultDrawerTabForQueueItem(nextItem))
    },
    [activeQueueIndex, queueItems]
  )

  const advanceToNextEligibleRow = useCallback(() => {
    if (!operatorPrefs.quickShipMode) return
    if (queueItems.length === 0) return

    const startIndex = activeQueueIndex >= 0 ? activeQueueIndex + 1 : 0
    for (let index = startIndex; index < queueItems.length; index += 1) {
      const candidate = queueItems[index]
      if (candidate?.queueType === 'FULFILL_ORDER' && candidate.orderId) {
        setActiveItemId(candidate.id)
        setIsDrawerOpen(true)
        setActiveDrawerTab('fulfillment')
        return
      }
    }
  }, [activeQueueIndex, operatorPrefs.quickShipMode, queueItems])

  const selectableRows = useMemo(
    () => queueItems.filter((item) => item.orderId).map((item) => item.orderId as string),
    [queueItems]
  )
  const selectedCount = selectedOrderIds.size
  const allRowsSelected = selectableRows.length > 0 && selectableRows.every((orderId) => selectedOrderIds.has(orderId))
  const selectedRows = useMemo(
    () => queueItems.filter((item) => item.orderId && selectedOrderIds.has(item.orderId)),
    [queueItems, selectedOrderIds]
  )
  const selectedForLabel = useMemo(
    () => selectedRows.filter((item) => item.labelEligible && item.orderId).map((item) => item.orderId as string),
    [selectedRows]
  )
  const selectedForMarkShipped = useMemo(
    () =>
      selectedRows
        .filter(
          (item) =>
            item.orderId &&
            item.trackingNumber &&
            item.orderStatus !== 'SHIPPED' &&
            item.orderStatus !== 'DELIVERED'
        )
        .map((item) => item.orderId as string),
    [selectedRows]
  )
  const selectedForTrackingUpdate = useMemo(
    () =>
      selectedRows
        .filter((item) => item.orderId && item.trackingNumber && item.carrier)
        .map((item) => item.orderId as string),
    [selectedRows]
  )

  const fetchQueue = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshingQueue(true)
      } else {
        setLoadingQueue(true)
      }

      try {
        const params = new URLSearchParams({
          page: String(pagination.page),
          limit: String(pagination.limit),
          sortBy,
          sortDir,
        })

        if (searchDebounced.length > 0) params.set('search', searchDebounced)
        if (selectedQueueTypes.length > 0) params.set('queueTypes', selectedQueueTypes.join(','))
        if (orderStatusFilter) params.set('orderStatuses', orderStatusFilter)
        if (paymentStatusFilter) params.set('paymentStatuses', paymentStatusFilter)
        if (ticketStatusFilter) params.set('ticketStatuses', ticketStatusFilter)
        if (assignedFilter !== 'all') params.set('assigned', assignedFilter)
        if (ageBucket !== 'all') params.set('ageBucket', ageBucket)

        const response = await fetch(`/api/admin/fulfillment/queue?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to load fulfillment queue')
        }

        const payload: QueueResponse = await response.json()
        setQueueItems(payload.data || [])
        setCounts(payload.counts || buildEmptyFilterCounts())
        setPagination(payload.pagination)
        setSelectedOrderIds((previous) => {
          const available = new Set((payload.data || []).map((item) => item.orderId).filter(Boolean) as string[])
          return new Set(Array.from(previous).filter((orderId) => available.has(orderId)))
        })
      } catch (error) {
        console.error('Failed to fetch queue:', error)
        toast.error('Failed to load fulfillment queue')
      } finally {
        setLoadingQueue(false)
        setRefreshingQueue(false)
      }
    },
    [
      ageBucket,
      assignedFilter,
      orderStatusFilter,
      pagination.limit,
      pagination.page,
      paymentStatusFilter,
      searchDebounced,
      selectedQueueTypes,
      sortBy,
      sortDir,
      ticketStatusFilter,
    ]
  )

  const fetchContext = useCallback(async (orderId: string | null, ticketId: string | null) => {
    if (!orderId && !ticketId) {
      setContext(null)
      return
    }

    setLoadingContext(true)
    try {
      const params = new URLSearchParams()
      if (orderId) params.set('orderId', orderId)
      if (ticketId) params.set('ticketId', ticketId)

      const response = await fetch(`/api/admin/fulfillment/context?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to load context')
      }
      const payload: FulfillmentContextResponse = await response.json()
      setContext(payload)
    } catch (error) {
      console.error('Failed to fetch fulfillment context:', error)
      toast.error('Failed to load workbench context')
    } finally {
      setLoadingContext(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const applyRowSelection = useCallback(
    (item: FulfillmentQueueItem) => {
      setActiveItemId(item.id)
      setActiveDrawerTab(getDefaultDrawerTabForQueueItem(item))
      setIsDrawerOpen(Boolean(item.orderId))
    },
    []
  )

  useEffect(() => {
    if (!queueItems.length) {
      setActiveItemId(null)
      setContext(null)
      setIsDrawerOpen(false)
      return
    }

    if (deepLinkOrderId) {
      const linkedByOrder = queueItems.find((item) => item.orderId === deepLinkOrderId)
      if (linkedByOrder) {
        applyRowSelection(linkedByOrder)
        return
      }
    }

    if (deepLinkTicketId) {
      const linkedByTicket = queueItems.find((item) => item.ticketId === deepLinkTicketId)
      if (linkedByTicket) {
        applyRowSelection(linkedByTicket)
        return
      }
    }

    const stillExists = queueItems.some((item) => item.id === activeItemId)
    if (!stillExists) {
      setActiveItemId(null)
      setIsDrawerOpen(false)
    }
  }, [queueItems, deepLinkOrderId, deepLinkTicketId, activeItemId, applyRowSelection])

  useEffect(() => {
    if (!activeItem?.ticketId && !activeItem?.orderId) {
      setContext(null)
      return
    }
    fetchContext(activeItem.orderId, activeItem.ticketId)
  }, [activeItem?.ticketId, activeItem?.orderId, fetchContext])

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
  }, [
    context?.order?.id,
    context?.order?.status,
    context?.order?.paymentStatus,
    context?.order?.trackingNumber,
    context?.order?.carrier,
    context?.order?.trackingUrl,
    context?.order?.internalNotes,
  ])

  useEffect(() => {
    setTicketStatusDraft(context?.selectedTicket?.status || '')
  }, [context?.selectedTicket?.id, context?.selectedTicket?.status])

  useEffect(() => {
    if (!context?.customer) return
    setCustomerDraft({
      name: context.customer.name || '',
      phone: context.customer.phone || '',
      birthday: formatDateOnly(context.customer.birthday),
      newsletter: context.customer.newsletter,
      smsOptIn: context.customer.smsOptIn,
    })
    setCustomerTierDraft(context.customer.loyaltyTier?.id || '')
  }, [
    context?.customer?.id,
    context?.customer?.name,
    context?.customer?.phone,
    context?.customer?.birthday,
    context?.customer?.newsletter,
    context?.customer?.smsOptIn,
    context?.customer?.loyaltyTier?.id,
  ])

  const clearTransientDrafts = useCallback(() => {
    setTicketNote('')
    setExternalReference('')
    setTicketReplyMessage('')
    setTicketReplyInternal(true)
    setCustomerPointsDelta('')
    setCustomerPointsReason('')
    setCustomerNoteDraft('')
    setCustomerNoteImportant(false)
  }, [])

  const resetAllDraftsFromContext = useCallback(() => {
    if (context?.order) {
      setOrderDraft({
        status: context.order.status || '',
        paymentStatus: context.order.paymentStatus || '',
        trackingNumber: context.order.trackingNumber || '',
        carrier: context.order.carrier || '',
        trackingUrl: context.order.trackingUrl || '',
        internalNotes: context.order.internalNotes || '',
      })
    }
    setTicketStatusDraft(context?.selectedTicket?.status || '')
    if (context?.customer) {
      setCustomerDraft({
        name: context.customer.name || '',
        phone: context.customer.phone || '',
        birthday: formatDateOnly(context.customer.birthday),
        newsletter: context.customer.newsletter,
        smsOptIn: context.customer.smsOptIn,
      })
      setCustomerTierDraft(context.customer.loyaltyTier?.id || '')
    }
    clearTransientDrafts()
  }, [
    clearTransientDrafts,
    context?.customer?.birthday,
    context?.customer?.loyaltyTier?.id,
    context?.customer?.name,
    context?.customer?.newsletter,
    context?.customer?.phone,
    context?.customer?.smsOptIn,
    context?.order,
    context?.selectedTicket?.status,
  ])

  const clearAllFilters = useCallback(() => {
    setSearchInput('')
    setSearchDebounced('')
    setSelectedQueueTypes([operatorPrefs.defaultLane])
    setOrderStatusFilter('')
    setPaymentStatusFilter('')
    setTicketStatusFilter('')
    setAssignedFilter('all')
    setAgeBucket('all')
    setSortBy('priority')
    setSortDir('desc')
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [operatorPrefs.defaultLane])

  const toggleQueueType = (queueType: FulfillmentQueueType) => {
    if (!OPERATIONAL_QUEUE_TYPES.includes(queueType)) {
      return
    }
    setPagination((prev) => ({ ...prev, page: 1 }))
    setSelectedQueueTypes((previous) => {
      if (previous.includes(queueType)) {
        const next = previous.filter((type) => type !== queueType)
        return next.length > 0 ? next : [operatorPrefs.defaultLane]
      }
      return [...previous, queueType]
    })
  }

  const toggleSelectAll = () => {
    if (allRowsSelected) {
      setSelectedOrderIds(new Set())
      return
    }
    setSelectedOrderIds(new Set(selectableRows))
  }

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((previous) => {
      const next = new Set(previous)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  const refreshActiveContext = useCallback(async () => {
    if (activeItem?.orderId || activeItem?.ticketId) {
      await fetchContext(activeItem.orderId, activeItem.ticketId)
      return
    }
    if (context?.order?.id || context?.selectedTicket?.id) {
      await fetchContext(context.order?.id || null, context.selectedTicket?.id || null)
    }
  }, [activeItem?.orderId, activeItem?.ticketId, context?.order?.id, context?.selectedTicket?.id, fetchContext])

  const purchaseSingleLabel = async (orderId: string) => {
    setActionLoading(true)
    const loadingToast = toast.loading('Purchasing shipping label...')
    try {
      const response = await fetch(`/api/admin/fulfillment/orders/${orderId}/label/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to purchase shipping label')
      }

      const labelUrl = payload.label?.labelUrl as string | undefined
      if (labelUrl) {
        setLastSingleLabelUrl(labelUrl)
        window.open(labelUrl, '_blank', 'noopener,noreferrer')
      }

      toast.dismiss(loadingToast)
      toast.success('Shipping label purchased')
      await fetchQueue(true)
      await refreshActiveContext()
      advanceToNextEligibleRow()
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to purchase shipping label')
      toast.dismiss(loadingToast)
      toast.error('Label purchase failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const purchaseBatchLabels = async (explicitOrderIds?: string[]) => {
    const orderIds = explicitOrderIds ?? Array.from(selectedOrderIds)
    if (orderIds.length === 0) return

    setActionLoading(true)
    setBatchProgress({
      running: true,
      action: 'labels',
      requested: orderIds.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      failedOrderIds: [],
    })
    const loadingToast = toast.loading(`Purchasing ${orderIds.length} shipping labels...`)
    try {
      const response = await fetch('/api/admin/fulfillment/orders/labels/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderIds }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to purchase labels in batch')
      }
      const urls = Array.isArray(payload.printUrls)
        ? (payload.printUrls as unknown[]).filter((url: unknown): url is string => typeof url === 'string')
        : []
      const failedOrderIds = Array.isArray(payload.results)
        ? (payload.results as Array<{ success?: boolean; orderId?: string }>)
            .filter((result) => !result.success && typeof result.orderId === 'string')
            .map((result) => result.orderId as string)
        : []

      setBatchProgress({
        running: false,
        action: 'labels',
        requested: orderIds.length,
        processed: payload.summary?.processed || orderIds.length,
        succeeded: payload.summary?.succeeded || 0,
        failed: payload.summary?.failed || 0,
        failedOrderIds,
      })
      setLatestBatchPrintUrls(urls)
      if (!explicitOrderIds) {
        setSelectedOrderIds(new Set())
      }
      toast.dismiss(loadingToast)
      toast.success(`Batch complete: ${payload.summary?.succeeded || 0} success, ${payload.summary?.failed || 0} failed`)
      await fetchQueue(true)
      await refreshActiveContext()
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to process label batch')
      setBatchProgress({
        running: false,
        action: 'labels',
        requested: orderIds.length,
        processed: 0,
        succeeded: 0,
        failed: orderIds.length,
        failedOrderIds: orderIds,
      })
      toast.dismiss(loadingToast)
      toast.error('Batch label purchase failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const markShippedBatch = async (orderIds: string[]) => {
    if (orderIds.length === 0) return

    setActionLoading(true)
    setBatchProgress({
      running: true,
      action: 'markShipped',
      requested: orderIds.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      failedOrderIds: [],
    })
    const loadingToast = toast.loading(`Marking ${orderIds.length} orders as shipped...`)

    const failedOrderIds: string[] = []
    let succeeded = 0

    try {
      for (const [index, orderId] of orderIds.entries()) {
        try {
          const response = await fetch(`/api/admin/fulfillment/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'SHIPPED' }),
          })
          if (!response.ok) {
            failedOrderIds.push(orderId)
          } else {
            succeeded += 1
          }
        } catch {
          failedOrderIds.push(orderId)
        }

        setBatchProgress((previous) => ({
          ...previous,
          processed: index + 1,
          succeeded,
          failed: failedOrderIds.length,
          failedOrderIds: [...failedOrderIds],
        }))
      }

      setBatchProgress({
        running: false,
        action: 'markShipped',
        requested: orderIds.length,
        processed: orderIds.length,
        succeeded,
        failed: failedOrderIds.length,
        failedOrderIds,
      })
      toast.dismiss(loadingToast)
      toast.success(`Batch shipped: ${succeeded} success, ${failedOrderIds.length} failed`)
      await fetchQueue(true)
      await refreshActiveContext()
      setSelectedOrderIds(new Set())
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to mark orders shipped')
      toast.dismiss(loadingToast)
      toast.error('Batch ship failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const sendTrackingUpdatesBatch = async (orderIds: string[]) => {
    if (orderIds.length === 0) return

    setActionLoading(true)
    setBatchProgress({
      running: true,
      action: 'sendTracking',
      requested: orderIds.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      failedOrderIds: [],
    })
    const loadingToast = toast.loading(`Sending ${orderIds.length} tracking updates...`)

    const failedOrderIds: string[] = []
    let succeeded = 0

    try {
      for (const [index, orderId] of orderIds.entries()) {
        try {
          const row = queueItems.find((item) => item.orderId === orderId)
          const trackingNumber = row?.trackingNumber || ''
          const carrier = row?.carrier || operatorPrefs.defaultCarrier || 'USPS'
          if (!trackingNumber) {
            failedOrderIds.push(orderId)
            setBatchProgress((previous) => ({
              ...previous,
              processed: index + 1,
              succeeded,
              failed: failedOrderIds.length,
              failedOrderIds: [...failedOrderIds],
            }))
            continue
          }
          const response = await fetch(`/api/orders/${orderId}/tracking`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trackingNumber,
              carrier,
              sendEmail: true,
            }),
          })
          if (!response.ok) {
            failedOrderIds.push(orderId)
          } else {
            succeeded += 1
          }
        } catch {
          failedOrderIds.push(orderId)
        }

        setBatchProgress((previous) => ({
          ...previous,
          processed: index + 1,
          succeeded,
          failed: failedOrderIds.length,
          failedOrderIds: [...failedOrderIds],
        }))
      }

      setBatchProgress({
        running: false,
        action: 'sendTracking',
        requested: orderIds.length,
        processed: orderIds.length,
        succeeded,
        failed: failedOrderIds.length,
        failedOrderIds,
      })
      toast.dismiss(loadingToast)
      toast.success(`Tracking updates: ${succeeded} sent, ${failedOrderIds.length} failed`)
      await fetchQueue(true)
      await refreshActiveContext()
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to send tracking updates')
      toast.dismiss(loadingToast)
      toast.error('Tracking update batch failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const updateOrder = async (payload: Record<string, unknown>, successMessage: string) => {
    if (!context?.order?.id) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/fulfillment/orders/${context.order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || 'Failed to update order')
      }

      toast.success(successMessage)
      await fetchQueue(true)
      await fetchContext(context.order.id, context.selectedTicket?.id || null)
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to update order')
      toast.error('Order update failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const saveOrderDraft = async () => {
    await updateOrder(
      {
        status: orderDraft.status,
        paymentStatus: orderDraft.paymentStatus,
        trackingNumber: orderDraft.trackingNumber,
        carrier: orderDraft.carrier,
        trackingUrl: orderDraft.trackingUrl,
        internalNotes: orderDraft.internalNotes,
      },
      'Order fulfillment details saved'
    )
    if (orderDraft.status === 'SHIPPED') {
      advanceToNextEligibleRow()
    }
  }

  const sendTrackingUpdate = async (
    orderId: string,
    trackingNumber: string,
    carrier: string
  ) => {
    if (!trackingNumber.trim()) {
      toast.error('Tracking number is required to send update')
      return
    }
    if (!carrier.trim()) {
      toast.error('Carrier is required to send update')
      return
    }

    setActionLoading(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: trackingNumber.trim(),
          carrier: carrier.trim(),
          sendEmail: true,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send tracking update')
      }

      toast.success('Tracking update sent to customer')
      await fetchQueue(true)
      await refreshActiveContext()
      advanceToNextEligibleRow()
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to send tracking update')
      toast.error('Tracking update failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const markOrderShipped = async (orderId: string) => {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/fulfillment/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SHIPPED' }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to mark order as shipped')
      }

      toast.success('Order marked as shipped')
      await fetchQueue(true)
      await refreshActiveContext()
      advanceToNextEligibleRow()
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to mark order as shipped')
      toast.error('Shipment update failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const reviewHighValueHoldForOrder = useCallback(
    async (orderId: string) => {
      setActionLoading(true)
      try {
        const response = await fetch(`/api/admin/fulfillment/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewHighValueHold: true }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to mark hold as reviewed')
        }

        toast.success('High-value hold reviewed')
        await fetchQueue(true)
        if (activeItem?.orderId === orderId || context?.order?.id === orderId) {
          await refreshActiveContext()
        }
      } catch (error) {
        const result = normalizeActionResult(error, 'Failed to review hold')
        toast.error('Review hold failed', result.message)
      } finally {
        setActionLoading(false)
      }
    },
    [activeItem?.orderId, context?.order?.id, fetchQueue, refreshActiveContext]
  )

  const applyTicketDecision = async (
    action:
      | 'approve_return'
      | 'deny_return'
      | 'mark_refund_requested'
      | 'approve_refund'
      | 'complete_refund'
      | 'deny_refund'
      | 'update_status',
    options?: {
      status?: string
      generateLabel?: boolean
    }
  ) => {
    const selectedTicketId = context?.selectedTicket?.id || context?.relatedTickets?.[0]?.id
    if (!selectedTicketId) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/fulfillment/tickets/${selectedTicketId}/decision`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          status: options?.status,
          generateLabel: options?.generateLabel,
          note: ticketNote.trim() || undefined,
          externalReference: externalReference.trim() || undefined,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update ticket')
      }

      setTicketNote('')
      setExternalReference('')
      toast.success('Ticket decision updated')
      await fetchQueue(true)
      await fetchContext(context?.order?.id || null, selectedTicketId)
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to update ticket')
      toast.error('Ticket update failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const sendTicketReply = async () => {
    const selectedTicketId = context?.selectedTicket?.id || context?.relatedTickets?.[0]?.id
    if (!selectedTicketId) return
    if (!ticketReplyMessage.trim()) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/fulfillment/tickets/${selectedTicketId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: ticketReplyMessage.trim(),
          isInternal: ticketReplyInternal,
          nextStatus: ticketReplyInternal ? undefined : 'WAITING_CUSTOMER',
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send ticket message')
      }

      setTicketReplyMessage('')
      setTicketReplyInternal(true)
      toast.success(ticketReplyInternal ? 'Internal note added' : 'Reply sent to customer')
      await fetchQueue(true)
      await fetchContext(context?.order?.id || null, selectedTicketId)
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to send message')
      toast.error('Message send failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const saveCustomerProfile = async () => {
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
          birthday: customerDraft.birthday.trim() || null,
          newsletter: customerDraft.newsletter,
          smsOptIn: customerDraft.smsOptIn,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update customer profile')
      }

      toast.success('Customer profile updated')
      await fetchQueue(true)
      await fetchContext(context.order?.id || null, context.selectedTicket?.id || null)
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to update customer profile')
      toast.error('Customer update failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const addCustomerNote = async () => {
    if (!context?.customer?.id) return
    if (!customerNoteDraft.trim()) return

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
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to add customer note')
      }

      setCustomerNoteDraft('')
      setCustomerNoteImportant(false)
      toast.success('Customer note added')
      await fetchContext(context.order?.id || null, context.selectedTicket?.id || null)
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to add note')
      toast.error('Note create failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const deleteCustomerNote = async (noteId: string) => {
    if (!context?.customer?.id) return

    setActionLoading(true)
    try {
      const response = await fetch(
        `/api/admin/fulfillment/customers/${context.customer.id}/notes?noteId=${encodeURIComponent(noteId)}`,
        { method: 'DELETE' }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete note')
      }
      toast.success('Note removed')
      await fetchContext(context.order?.id || null, context.selectedTicket?.id || null)
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to delete note')
      toast.error('Note delete failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const adjustCustomerPoints = async () => {
    if (!context?.customer?.id) return
    const parsedPoints = Number.parseInt(customerPointsDelta, 10)
    if (!Number.isFinite(parsedPoints) || parsedPoints === 0) {
      toast.error('Enter a non-zero points adjustment')
      return
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
          points: parsedPoints,
          reason: customerPointsReason.trim() || undefined,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to adjust points')
      }

      setCustomerPointsDelta('')
      setCustomerPointsReason('')
      toast.success(payload.message || 'Customer points updated')
      await fetchQueue(true)
      await fetchContext(context.order?.id || null, context.selectedTicket?.id || null)
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to adjust customer points')
      toast.error('Points adjustment failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const changeCustomerTier = async () => {
    if (!context?.customer?.id) return
    if (!customerTierDraft) {
      toast.error('Select a tier first')
      return
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
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to change customer tier')
      }

      toast.success(payload.message || 'Tier changed')
      await fetchQueue(true)
      await fetchContext(context.order?.id || null, context.selectedTicket?.id || null)
    } catch (error) {
      const result = normalizeActionResult(error, 'Failed to change tier')
      toast.error('Tier change failed', result.message)
    } finally {
      setActionLoading(false)
    }
  }

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; value: string; clear: () => void }> = []
    if (searchDebounced) {
      chips.push({
        key: 'search',
        label: 'Search',
        value: searchDebounced,
        clear: () => {
          setSearchInput('')
          setSearchDebounced('')
        },
      })
    }
    if (selectedQueueTypes.length > 0) {
      chips.push({
        key: 'types',
        label: 'Queue',
        value: selectedQueueTypes.map((type) => QUEUE_LABELS[type]).join(', '),
        clear: () => setSelectedQueueTypes([]),
      })
    }
    if (orderStatusFilter) {
      chips.push({
        key: 'orderStatus',
        label: 'Order',
        value: orderStatusFilter,
        clear: () => setOrderStatusFilter(''),
      })
    }
    if (paymentStatusFilter) {
      chips.push({
        key: 'paymentStatus',
        label: 'Payment',
        value: paymentStatusFilter,
        clear: () => setPaymentStatusFilter(''),
      })
    }
    if (ticketStatusFilter) {
      chips.push({
        key: 'ticketStatus',
        label: 'Ticket',
        value: ticketStatusFilter,
        clear: () => setTicketStatusFilter(''),
      })
    }
    if (assignedFilter !== 'all') {
      chips.push({
        key: 'assigned',
        label: 'Assignee',
        value: assignedFilter,
        clear: () => setAssignedFilter('all'),
      })
    }
    if (ageBucket !== 'all') {
      chips.push({
        key: 'age',
        label: 'Age',
        value: ageBucket,
        clear: () => setAgeBucket('all'),
      })
    }
    return chips
  }, [
    ageBucket,
    assignedFilter,
    orderStatusFilter,
    paymentStatusFilter,
    searchDebounced,
    selectedQueueTypes,
    ticketStatusFilter,
  ])

  const openBatchPrintUrls = () => {
    latestBatchPrintUrls.forEach((url) => {
      window.open(url, '_blank', 'noopener,noreferrer')
    })
  }

  const selectedTicket = context?.selectedTicket || null
  const queueRows = useMemo(
    () => queueItems.map((item) => toQueueRowViewModel(item, QUEUE_LABELS[item.queueType] || item.queueType)),
    [queueItems]
  )
  const activeQueueRow = useMemo(
    () => queueRows.find((row) => row.id === activeItemId) || null,
    [activeItemId, queueRows]
  )

  const recordContext = useMemo(() => deriveRecordContext(activeItem, context), [activeItem, context])
  const workspaceAvailability = useMemo(() => deriveWorkspaceAvailability(recordContext), [recordContext])
  const activeRecordHeader = useMemo(
    () =>
      deriveActiveRecordHeader(
        activeItem
          ? {
              orderNumber: activeItem.orderNumber,
              ticketNumber: activeItem.ticketNumber,
              customerName: activeItem.customerName,
              queueType: activeItem.queueType,
            }
          : null,
        activeItem ? QUEUE_LABELS[activeItem.queueType] || activeItem.queueType : 'Queue'
      ),
    [activeItem]
  )

  const hasOrderDraftChanges = useMemo(() => {
    if (!context?.order) return false
    return (
      orderDraft.status !== (context.order.status || '') ||
      orderDraft.paymentStatus !== (context.order.paymentStatus || '') ||
      orderDraft.trackingNumber !== (context.order.trackingNumber || '') ||
      orderDraft.carrier !== (context.order.carrier || '') ||
      orderDraft.trackingUrl !== (context.order.trackingUrl || '') ||
      orderDraft.internalNotes !== (context.order.internalNotes || '')
    )
  }, [
    context?.order?.carrier,
    context?.order?.internalNotes,
    context?.order?.paymentStatus,
    context?.order?.status,
    context?.order?.trackingNumber,
    context?.order?.trackingUrl,
    orderDraft.carrier,
    orderDraft.internalNotes,
    orderDraft.paymentStatus,
    orderDraft.status,
    orderDraft.trackingNumber,
    orderDraft.trackingUrl,
  ])

  const hasTicketDraftChanges = useMemo(() => {
    const statusChanged = Boolean(selectedTicket && ticketStatusDraft && ticketStatusDraft !== selectedTicket.status)
    return (
      statusChanged ||
      ticketReplyMessage.trim().length > 0 ||
      ticketNote.trim().length > 0 ||
      externalReference.trim().length > 0
    )
  }, [externalReference, selectedTicket, ticketNote, ticketReplyMessage, ticketStatusDraft])

  const hasCustomerDraftChanges = useMemo(() => {
    if (!context?.customer) {
      return (
        customerPointsDelta.trim().length > 0 ||
        customerPointsReason.trim().length > 0 ||
        customerNoteDraft.trim().length > 0
      )
    }

    return (
      customerDraft.name !== (context.customer.name || '') ||
      customerDraft.phone !== (context.customer.phone || '') ||
      customerDraft.birthday !== formatDateOnly(context.customer.birthday) ||
      customerDraft.newsletter !== context.customer.newsletter ||
      customerDraft.smsOptIn !== context.customer.smsOptIn ||
      customerTierDraft !== (context.customer.loyaltyTier?.id || '') ||
      customerPointsDelta.trim().length > 0 ||
      customerPointsReason.trim().length > 0 ||
      customerNoteDraft.trim().length > 0
    )
  }, [
    context?.customer?.birthday,
    context?.customer?.loyaltyTier?.id,
    context?.customer?.name,
    context?.customer?.newsletter,
    context?.customer?.phone,
    context?.customer?.smsOptIn,
    customerDraft.birthday,
    customerDraft.name,
    customerDraft.newsletter,
    customerDraft.phone,
    customerDraft.smsOptIn,
    customerNoteDraft,
    customerPointsDelta,
    customerPointsReason,
    customerTierDraft,
  ])

  const hasUnsavedChanges = useMemo(
    () => hasOrderDraftChanges || hasTicketDraftChanges || hasCustomerDraftChanges,
    [hasCustomerDraftChanges, hasOrderDraftChanges, hasTicketDraftChanges]
  )

  const requestSelectRow = useCallback(
    (item: FulfillmentQueueItem) => {
      if (isDrawerOpen && hasUnsavedChanges && item.id !== activeItemId) {
        setPendingSelectionId(item.id)
        setPendingCloseDrawer(false)
        setShowUnsavedGuard(true)
        return
      }
      applyRowSelection(item)
    },
    [activeItemId, applyRowSelection, hasUnsavedChanges, isDrawerOpen]
  )

  const requestCloseDrawer = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingCloseDrawer(true)
      setPendingSelectionId(null)
      setShowUnsavedGuard(true)
      return
    }
    setIsDrawerOpen(false)
  }, [hasUnsavedChanges])

  const discardUnsavedAndContinue = useCallback(() => {
    resetAllDraftsFromContext()
    setShowUnsavedGuard(false)
    if (pendingCloseDrawer) {
      setIsDrawerOpen(false)
      setPendingCloseDrawer(false)
      return
    }
    if (pendingSelectionId) {
      const next = queueItems.find((item) => item.id === pendingSelectionId)
      if (next) {
        applyRowSelection(next)
      }
      setPendingSelectionId(null)
    }
  }, [applyRowSelection, pendingCloseDrawer, pendingSelectionId, queueItems, resetAllDraftsFromContext])

  const keepEditing = useCallback(() => {
    setShowUnsavedGuard(false)
    setPendingSelectionId(null)
    setPendingCloseDrawer(false)
  }, [])

  const saveOrderFromDrawer = useCallback(() => {
    if (!context?.order) {
      toast.info('Select an order row first')
      return
    }
    void saveOrderDraft()
  }, [context?.order, saveOrderDraft])

  const purchaseSingleLabelFromDrawer = useCallback(() => {
    if (!context?.order?.id) {
      toast.info('Select an order row first')
      return
    }
    void purchaseSingleLabel(context.order.id)
  }, [context?.order?.id, purchaseSingleLabel])

  const markOrderShippedFromDrawer = useCallback(() => {
    if (!context?.order?.id) {
      toast.info('Select an order row first')
      return
    }
    void markOrderShipped(context.order.id)
  }, [context?.order?.id, markOrderShipped])

  const notifyTrackingUpdateFromDrawer = useCallback(() => {
    if (!context?.order?.id) {
      toast.info('Select an order row first')
      return
    }
    const trackingNumber = (orderDraft.trackingNumber || context.order.trackingNumber || '').trim()
    const carrier = (orderDraft.carrier || context.order.carrier || operatorPrefs.defaultCarrier || '').trim()
    if (!trackingNumber) {
      toast.info('Add tracking number before sending update')
      return
    }
    if (!carrier) {
      toast.info('Add carrier before sending update')
      return
    }
    void sendTrackingUpdate(context.order.id, trackingNumber, carrier)
  }, [context?.order, operatorPrefs.defaultCarrier, orderDraft.carrier, orderDraft.trackingNumber, sendTrackingUpdate])

  const updateTicketStatusFromDrawer = useCallback(() => {
    const fallbackTicket = selectedTicket || context?.relatedTickets?.[0] || null
    if (!fallbackTicket) {
      toast.info('Select a ticket row first')
      return
    }
    if (!ticketStatusDraft || ticketStatusDraft === fallbackTicket.status) {
      toast.info('Select a different ticket status to continue')
      return
    }
    void applyTicketDecision('update_status', { status: ticketStatusDraft })
  }, [applyTicketDecision, context?.relatedTickets, selectedTicket, ticketStatusDraft])

  const sendTicketReplyFromDrawer = useCallback(() => {
    const fallbackTicket = selectedTicket || context?.relatedTickets?.[0] || null
    if (!fallbackTicket) {
      toast.info('Select a ticket row first')
      return
    }
    if (!ticketReplyMessage.trim()) {
      toast.info('Write a message before sending')
      return
    }
    void sendTicketReply()
  }, [context?.relatedTickets, selectedTicket, sendTicketReply, ticketReplyMessage])

  const applyTicketDecisionFromDrawer = useCallback(
    (
      action:
        | 'approve_return'
        | 'deny_return'
        | 'mark_refund_requested'
        | 'approve_refund'
        | 'complete_refund'
        | 'deny_refund',
      options?: { generateLabel?: boolean }
    ) => {
      const fallbackTicket = selectedTicket || context?.relatedTickets?.[0] || null
      if (!fallbackTicket) {
        toast.info('Select a ticket row first')
        return
      }
      void applyTicketDecision(action, options)
    },
    [applyTicketDecision, context?.relatedTickets, selectedTicket]
  )

  const saveCustomerProfileFromDrawer = useCallback(() => {
    if (!context?.customer) {
      toast.info('Select a customer-linked row first')
      return
    }
    void saveCustomerProfile()
  }, [context?.customer, saveCustomerProfile])

  const adjustPointsFromDrawer = useCallback(() => {
    if (!context?.customer) {
      toast.info('Select a customer-linked row first')
      return
    }
    void adjustCustomerPoints()
  }, [adjustCustomerPoints, context?.customer])

  const changeTierFromDrawer = useCallback(() => {
    if (!context?.customer) {
      toast.info('Select a customer-linked row first')
      return
    }
    void changeCustomerTier()
  }, [changeCustomerTier, context?.customer])

  const addCustomerNoteFromDrawer = useCallback(() => {
    if (!context?.customer) {
      toast.info('Select a customer-linked row first')
      return
    }
    void addCustomerNote()
  }, [addCustomerNote, context?.customer])

  const deleteCustomerNoteFromDrawer = useCallback(
    (noteId: string) => {
      if (!context?.customer) {
        toast.info('Select a customer-linked row first')
        return
      }
      void deleteCustomerNote(noteId)
    },
    [context?.customer, deleteCustomerNote]
  )

  const runNextActionForRow = useCallback(
    (row: FulfillmentQueueItem) => {
      if (!row.orderId && !row.ticketId) return

      switch (row.nextAction) {
        case 'BUY_LABEL':
          if (row.orderId) {
            void purchaseSingleLabel(row.orderId)
          } else {
            toast.info('No order linked for label purchase')
          }
          break
        case 'MARK_SHIPPED':
          if (row.orderId) {
            void markOrderShipped(row.orderId)
          } else {
            toast.info('No order linked for shipment status update')
          }
          break
        case 'SEND_TRACKING_UPDATE':
          if (row.orderId && row.trackingNumber) {
            void sendTrackingUpdate(row.orderId, row.trackingNumber, row.carrier || operatorPrefs.defaultCarrier)
          } else {
            toast.info('Tracking number is required before sending update')
          }
          break
        case 'REQUEST_PAYMENT':
          toast.info('Open the ticket tab to request updated payment details')
          break
        case 'FIX_ADDRESS':
          toast.info('Open fulfillment details to fix shipping address')
          break
        case 'REVIEW_HOLD':
          if (row.orderId) {
            void reviewHighValueHoldForOrder(row.orderId)
          } else {
            toast.info('No order linked for hold review')
          }
          break
        case 'RESOLVE_TICKET':
          if (row.orderId) {
            setIsDrawerOpen(true)
            setActiveDrawerTab('ticket')
          } else {
            toast.info('Select an order to open the side drawer')
          }
          break
        default:
          if (row.orderId) {
            setIsDrawerOpen(true)
            setActiveDrawerTab(getDefaultDrawerTabForQueueItem(row))
          } else {
            toast.info('Select an order to open the side drawer')
          }
      }
    },
    [markOrderShipped, operatorPrefs.defaultCarrier, purchaseSingleLabel, reviewHighValueHoldForOrder, sendTrackingUpdate]
  )

  const runPrimaryActionForActive = useCallback(() => {
    if (!activeItem) {
      toast.info('Select a queue row first')
      return
    }
    runNextActionForRow(activeItem)
  }, [activeItem, runNextActionForRow])

  const tabAvailability = useMemo<Record<FulfillmentDrawerTab, boolean>>(
    () => ({
      summary: Boolean(activeItem || context),
      fulfillment: workspaceAvailability.fulfillment,
      ticket: workspaceAvailability.ticket,
      customer: workspaceAvailability.customer,
    }),
    [activeItem, context, workspaceAvailability]
  )

  useEffect(() => {
    const isEditableElement = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tagName = target.tagName.toLowerCase()
      return (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target.isContentEditable
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) {
        return
      }

      if (event.key === 'j') {
        event.preventDefault()
        moveSelectionByOffset(1)
        return
      }
      if (event.key === 'k') {
        event.preventDefault()
        moveSelectionByOffset(-1)
        return
      }
      if (event.key === 'o') {
        event.preventDefault()
        if (activeItem?.orderId) {
          setIsDrawerOpen(true)
        } else {
          toast.info('Select an order to open the side drawer')
        }
        return
      }
      if (event.key === 'a') {
        event.preventDefault()
        runPrimaryActionForActive()
        return
      }
      if (event.key === 's') {
        if (activeItem?.orderId) {
          event.preventDefault()
          void markOrderShipped(activeItem.orderId)
        }
        return
      }
      if (event.key === 'p') {
        if (lastSingleLabelUrl) {
          event.preventDefault()
          window.open(lastSingleLabelUrl, '_blank', 'noopener,noreferrer')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeItem?.orderId, lastSingleLabelUrl, markOrderShipped, moveSelectionByOffset, runPrimaryActionForActive])

  return (
    <AdminLayout
      title="Fulfillment Workbench"
      subtitle="Legacy-style queue table with side operations drawer"
      contentScroll="hidden"
      contentClassName="p-3 sm:p-4 lg:p-4 pb-20 sm:pb-24 lg:pb-4"
      headerActions={
        <div className="flex items-center gap-2">
          <Link
            href="/admin/orders"
            className="h-8 px-2.5 rounded-md border border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center"
          >
            Legacy Orders
          </Link>
          <Link
            href="/admin/support/tickets"
            className="h-8 px-2.5 rounded-md border border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center"
          >
            Legacy Tickets
          </Link>
          <Link
            href="/admin/customers"
            className="h-8 px-2.5 rounded-md border border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center"
          >
            Legacy Customers
          </Link>
        </div>
      }
    >
      <div className="h-full min-h-0 flex flex-col gap-3 text-white">
        <div className="sticky top-0 z-30 bg-neutral-950/90 backdrop-blur py-1">
          <FulfillmentCommandBar
            searchInput={searchInput}
            onSearchChange={(value) => setSearchInput(value)}
            orderStatusFilter={orderStatusFilter}
            onOrderStatusChange={(value) => {
              setOrderStatusFilter(value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            paymentStatusFilter={paymentStatusFilter}
            onPaymentStatusChange={(value) => {
              setPaymentStatusFilter(value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            ticketStatusFilter={ticketStatusFilter}
            onTicketStatusChange={(value) => {
              setTicketStatusFilter(value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            assignedFilter={assignedFilter}
            onAssignedChange={(value) => {
              setAssignedFilter(value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            ageBucket={ageBucket}
            onAgeBucketChange={(value) => {
              setAgeBucket(value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortDir={sortDir}
            onToggleSortDir={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            totalResults={pagination.total}
            refreshing={refreshingQueue}
            onRefresh={() => fetchQueue(true)}
            selectedQueueTypes={selectedQueueTypes}
            onToggleQueueType={toggleQueueType}
            queueTypeCounts={counts.byType}
            queueLabels={QUEUE_LABELS}
            queueTypes={OPERATIONAL_QUEUE_TYPES}
            onResetFilters={clearAllFilters}
            activeFilterChips={activeFilterChips}
          />
        </div>

        <section className="rounded-xl border border-white/10 bg-neutral-900/80 px-3 py-2.5 flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-white/70">
            <input
              type="checkbox"
              checked={operatorPrefs.quickShipMode}
              onChange={(event) =>
                setOperatorPrefs((previous) => ({ ...previous, quickShipMode: event.target.checked }))
              }
              className="h-3.5 w-3.5 rounded border border-white/20 bg-white/5"
            />
            Quick Ship Mode
          </label>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-white/70">
            <input
              type="checkbox"
              checked={operatorPrefs.denseRows}
              onChange={(event) =>
                setOperatorPrefs((previous) => ({ ...previous, denseRows: event.target.checked }))
              }
              className="h-3.5 w-3.5 rounded border border-white/20 bg-white/5"
            />
            Dense Rows
          </label>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={operatorPrefs.defaultLane}
              onChange={(event) => {
                const lane = event.target.value as FulfillmentQueueType
                setOperatorPrefs((previous) => ({ ...previous, defaultLane: lane }))
                setSelectedQueueTypes([lane])
              }}
              className="h-8 px-2 rounded-md border border-white/10 bg-white/5 text-[11px] text-white"
            >
              {OPERATIONAL_QUEUE_TYPES.map((queueType) => (
                <option key={queueType} value={queueType} className="bg-neutral-900">
                  Default: {QUEUE_LABELS[queueType]}
                </option>
              ))}
            </select>
            <input
              value={operatorPrefs.defaultCarrier}
              onChange={(event) =>
                setOperatorPrefs((previous) => ({ ...previous, defaultCarrier: event.target.value }))
              }
              placeholder="Carrier"
              className="h-8 w-28 px-2 rounded-md border border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/35"
            />
            <input
              value={operatorPrefs.defaultService}
              onChange={(event) =>
                setOperatorPrefs((previous) => ({ ...previous, defaultService: event.target.value }))
              }
              placeholder="Service"
              className="h-8 w-28 px-2 rounded-md border border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/35"
            />
          </div>
        </section>

        {selectedCount > 0 ? (
          <section className="sticky top-[11.1rem] z-20 border border-[#FF3131]/35 rounded-xl bg-[#FF3131]/12 px-3 py-2 flex items-center gap-3">
            <CheckSquare className="w-4.5 h-4.5 text-[#ff6b6b]" />
            <p className="text-sm text-white">
              {selectedCount} order{selectedCount > 1 ? 's' : ''} selected
            </p>
            <button
              onClick={() => void purchaseBatchLabels(selectedForLabel)}
              disabled={actionLoading || selectedForLabel.length === 0}
              className="h-8 px-3 rounded-md bg-[#FF3131] text-white text-xs uppercase tracking-[0.12em] hover:bg-[#ff4747] disabled:opacity-60"
            >
              Buy Labels ({selectedForLabel.length})
            </button>
            <button
              onClick={() => void markShippedBatch(selectedForMarkShipped)}
              disabled={actionLoading || selectedForMarkShipped.length === 0}
              className="h-8 px-3 rounded-md border border-white/15 text-xs uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10 disabled:opacity-60"
            >
              Mark Shipped ({selectedForMarkShipped.length})
            </button>
            <button
              onClick={() => void sendTrackingUpdatesBatch(selectedForTrackingUpdate)}
              disabled={actionLoading || selectedForTrackingUpdate.length === 0}
              className="h-8 px-3 rounded-md border border-white/15 text-xs uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10 disabled:opacity-60"
            >
              Send Tracking ({selectedForTrackingUpdate.length})
            </button>
            {latestBatchPrintUrls.length > 0 ? (
              <button
                onClick={openBatchPrintUrls}
                className="h-8 px-3 rounded-md border border-white/15 text-xs uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10"
              >
                Print All
              </button>
            ) : null}
          </section>
        ) : null}

        {(batchProgress.running || batchProgress.processed > 0) && batchProgress.action ? (
          <section className="rounded-xl border border-white/10 bg-neutral-900/80 px-3 py-2.5 flex flex-wrap items-center gap-3">
            <p className="text-[11px] text-white/70 uppercase tracking-[0.12em]">
              Batch {batchProgress.action}
            </p>
            <p className="text-sm text-white">
              {batchProgress.processed}/{batchProgress.requested} processed
            </p>
            <p className="text-[11px] text-emerald-300">Success: {batchProgress.succeeded}</p>
            <p className="text-[11px] text-rose-300">Failed: {batchProgress.failed}</p>
            {!batchProgress.running && batchProgress.failedOrderIds.length > 0 ? (
              <button
                onClick={() => {
                  if (batchProgress.action === 'labels') {
                    void purchaseBatchLabels(batchProgress.failedOrderIds)
                    return
                  }
                  if (batchProgress.action === 'markShipped') {
                    void markShippedBatch(batchProgress.failedOrderIds)
                    return
                  }
                  void sendTrackingUpdatesBatch(batchProgress.failedOrderIds)
                }}
                className="ml-auto h-8 px-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-[11px] uppercase tracking-[0.12em] text-amber-300"
              >
                Retry Failed ({batchProgress.failedOrderIds.length})
              </button>
            ) : null}
          </section>
        ) : null}

        <div className="flex-1 min-h-0">
          <FulfillmentQueueGrid
            loading={loadingQueue}
            rows={queueRows}
            activeRowId={activeItemId}
            onSelectRow={(row) => {
              const selectedRow = queueItems.find((item) => item.id === row.id)
              if (!selectedRow) return
              requestSelectRow(selectedRow)
            }}
            selectedOrderIds={selectedOrderIds}
            allRowsSelected={allRowsSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelectOrder={toggleSelectOrder}
            onPurchaseSingleLabel={purchaseSingleLabel}
            onRunNextAction={(row) => {
              const source = queueItems.find((item) => item.id === row.id)
              if (!source) return
              runNextActionForRow(source)
            }}
            pagination={{
              page: pagination.page,
              pages: pagination.pages,
              total: pagination.total,
            }}
            onPrevPage={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            onNextPage={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
            queueLabels={QUEUE_LABELS}
            nextActionLabels={FULFILLMENT_NEXT_ACTION_LABELS}
            blockerLabels={FULFILLMENT_BLOCKER_LABELS}
            statusClassName={getStatusColor}
            formatCurrency={formatCurrency}
            dense={operatorPrefs.denseRows}
          />

          <FulfillmentCaseDrawer
            isOpen={isDrawerOpen}
            loading={loadingContext}
            activeRecordHeader={activeRecordHeader}
            activeQueueRow={activeQueueRow}
            activeTab={activeDrawerTab}
            onChangeTab={setActiveDrawerTab}
            tabAvailability={tabAvailability}
            onRequestClose={requestCloseDrawer}
            context={context}
            fulfillmentReadiness={context?.fulfillmentReadiness || null}
            selectedTicket={selectedTicket}
            orderDraft={orderDraft}
            setOrderDraft={setOrderDraft}
            ticketStatusDraft={ticketStatusDraft}
            setTicketStatusDraft={setTicketStatusDraft}
            externalReference={externalReference}
            setExternalReference={setExternalReference}
            ticketReplyMessage={ticketReplyMessage}
            setTicketReplyMessage={setTicketReplyMessage}
            ticketReplyInternal={ticketReplyInternal}
            setTicketReplyInternal={setTicketReplyInternal}
            ticketNote={ticketNote}
            setTicketNote={setTicketNote}
            customerDraft={customerDraft}
            setCustomerDraft={setCustomerDraft}
            customerPointsDelta={customerPointsDelta}
            setCustomerPointsDelta={setCustomerPointsDelta}
            customerPointsReason={customerPointsReason}
            setCustomerPointsReason={setCustomerPointsReason}
            customerTierDraft={customerTierDraft}
            setCustomerTierDraft={setCustomerTierDraft}
            customerNoteDraft={customerNoteDraft}
            setCustomerNoteDraft={setCustomerNoteDraft}
            customerNoteImportant={customerNoteImportant}
            setCustomerNoteImportant={setCustomerNoteImportant}
            actionLoading={actionLoading}
            lastSingleLabelUrl={lastSingleLabelUrl}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            statusClassName={getStatusColor}
            onSaveOrder={saveOrderFromDrawer}
            onPurchaseSingleLabel={purchaseSingleLabelFromDrawer}
            onMarkShipped={markOrderShippedFromDrawer}
            onNotifyTrackingUpdate={notifyTrackingUpdateFromDrawer}
            onRunPrimaryAction={runPrimaryActionForActive}
            onUpdateTicketStatus={updateTicketStatusFromDrawer}
            onSendTicketReply={sendTicketReplyFromDrawer}
            onApplyTicketDecision={applyTicketDecisionFromDrawer}
            onSaveCustomerProfile={saveCustomerProfileFromDrawer}
            onAdjustPoints={adjustPointsFromDrawer}
            onChangeTier={changeTierFromDrawer}
            onAddNote={addCustomerNoteFromDrawer}
            onDeleteNote={deleteCustomerNoteFromDrawer}
          />
        </div>

        {showUnsavedGuard ? (
          <div className="fixed inset-0 z-[85] bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-white/10 bg-neutral-900 p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Unsaved draft changes</p>
              <p className="text-sm text-white/65">
                You have unsaved changes in the drawer. Discard them and continue?
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={keepEditing}
                  className="h-8 px-3 rounded-md border border-white/10 text-[11px] uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10"
                >
                  Keep Editing
                </button>
                <button
                  onClick={discardUnsavedAndContinue}
                  className="h-8 px-3 rounded-md bg-rose-600 text-white text-[11px] uppercase tracking-[0.12em]"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </AdminLayout>
  )
}
