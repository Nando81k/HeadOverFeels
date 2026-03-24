'use client'

import Link from 'next/link'
import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowSquareOut,
  ChatCircleText,
  Clock,
  CopySimple,
  CreditCard,
  CurrencyDollar,
  FloppyDisk,
  IdentificationCard,
  Notepad,
  Package,
  Receipt,
  Ticket,
  Truck,
  User,
  X,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { TrackingMap } from '@/components/orders/TrackingMap'
import type { FulfillmentDrawerTab } from '@/lib/fulfillment/console'
import type { FulfillmentNextAction } from '@/lib/fulfillment/queue'
import type { TrackingResult } from '@/lib/shipping/tracking'
import { toast } from '@/lib/toast'

type FulfillmentOrderContext = {
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
  createdAt: string
  updatedAt: string
  shippedAt: string | null
  deliveredAt: string | null
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

type FulfillmentTicketContext = {
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

type FulfillmentCustomerContext = {
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
} | null

type FulfillmentContext = {
  order: FulfillmentOrderContext
  selectedTicket: FulfillmentTicketContext
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
  customer: FulfillmentCustomerContext
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
} | null

type OrderDraft = {
  status: string
  paymentStatus: string
  trackingNumber: string
  carrier: string
  trackingUrl: string
  internalNotes: string
}

type CustomerDraft = {
  name: string
  phone: string
  birthday: string
  newsletter: boolean
  smsOptIn: boolean
}

interface FulfillmentCaseDrawerProps {
  isOpen: boolean
  loading: boolean
  activeRecordHeader: {
    primaryLabel: string
    secondaryLabel: string
  }
  activeQueueRow?: {
    ageHours: number
    slaRisk: string
    nextAction: FulfillmentNextAction
  } | null
  activeTab: FulfillmentDrawerTab
  onChangeTab: (tab: FulfillmentDrawerTab) => void
  tabAvailability: Record<FulfillmentDrawerTab, boolean>
  onRequestClose: () => void
  context: FulfillmentContext
  fulfillmentReadiness?: {
    hasOrder: boolean
    primaryAction: string
    steps: Array<{
      id: 'validate_address' | 'buy_label' | 'print_label' | 'mark_shipped' | 'notify_customer'
      label: string
      ready: boolean
      reason?: string
    }>
  } | null
  selectedTicket: FulfillmentTicketContext
  orderDraft: OrderDraft
  setOrderDraft: Dispatch<SetStateAction<OrderDraft>>
  ticketStatusDraft: string
  setTicketStatusDraft: (value: string) => void
  externalReference: string
  setExternalReference: (value: string) => void
  ticketReplyMessage: string
  setTicketReplyMessage: (value: string) => void
  ticketReplyInternal: boolean
  setTicketReplyInternal: (value: boolean) => void
  ticketNote: string
  setTicketNote: (value: string) => void
  customerDraft: CustomerDraft
  setCustomerDraft: Dispatch<SetStateAction<CustomerDraft>>
  customerPointsDelta: string
  setCustomerPointsDelta: (value: string) => void
  customerPointsReason: string
  setCustomerPointsReason: (value: string) => void
  customerTierDraft: string
  setCustomerTierDraft: (value: string) => void
  customerNoteDraft: string
  setCustomerNoteDraft: (value: string) => void
  customerNoteImportant: boolean
  setCustomerNoteImportant: (value: boolean) => void
  actionLoading: boolean
  lastSingleLabelUrl: string | null
  formatCurrency: (amount: number | null | undefined) => string
  formatDate: (value: string | null | undefined) => string
  statusClassName?: (status: string | null | undefined) => string
  onSaveOrder: () => void
  onPurchaseSingleLabel: () => void
  onMarkShipped: () => void
  onNotifyTrackingUpdate: () => void
  onRunPrimaryAction: () => void
  onUpdateTicketStatus: () => void
  onSendTicketReply: () => void
  onApplyTicketDecision: (
    action:
      | 'approve_return'
      | 'deny_return'
      | 'mark_refund_requested'
      | 'approve_refund'
      | 'complete_refund'
      | 'deny_refund',
    options?: { generateLabel?: boolean }
  ) => void
  onSaveCustomerProfile: () => void
  onAdjustPoints: () => void
  onChangeTier: () => void
  onAddNote: () => void
  onDeleteNote: (noteId: string) => void
}

const DRAWER_TABS: Array<{ key: FulfillmentDrawerTab; label: string; icon: typeof Receipt }> = [
  { key: 'summary', label: 'Summary', icon: Receipt },
  { key: 'fulfillment', label: 'Fulfillment', icon: Truck },
  { key: 'ticket', label: 'Ticket', icon: Ticket },
  { key: 'customer', label: 'Customer', icon: User },
]

const DEFAULT_STATUS_CLASS = 'bg-white/10 text-white/75 border-white/20'

function getDefaultStatusClass(status: string | null | undefined) {
  if (!status) return DEFAULT_STATUS_CLASS
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
  return DEFAULT_STATUS_CLASS
}

function buildDetailsHref(orderId: string | null | undefined, ticketId: string | null | undefined, tab: string) {
  const params = new URLSearchParams()
  if (orderId) params.set('orderId', orderId)
  if (ticketId) params.set('ticketId', ticketId)
  if (tab) params.set('tab', tab)
  return `/admin/fulfillment/details${params.toString() ? `?${params.toString()}` : ''}`
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
  if (!address) {
    return ['No address on file']
  }

  const lines = [
    `${address.firstName} ${address.lastName}`,
    address.address1,
    address.address2 || '',
    `${address.city}, ${address.state} ${address.postalCode}`,
    address.country,
  ]

  return lines.filter((line) => line.trim().length > 0)
}

function formatTicketType(type: string) {
  return type.replace(/_/g, ' ')
}

type FulfillmentReadinessStepId =
  | 'validate_address'
  | 'buy_label'
  | 'print_label'
  | 'mark_shipped'
  | 'notify_customer'

function getGuidedActionLabel(stepId: FulfillmentReadinessStepId) {
  switch (stepId) {
    case 'validate_address':
      return 'Validate'
    case 'buy_label':
      return 'Buy + Print Label'
    case 'print_label':
      return 'Print Label'
    case 'mark_shipped':
      return 'Mark Shipped'
    case 'notify_customer':
      return 'Notify Customer'
    default:
      return 'Run'
  }
}

function MoneyMetric({
  label,
  value,
  icon: Icon,
  tone = 'text-white',
}: {
  label: string
  value: string
  icon: typeof CurrencyDollar
  tone?: string
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-2.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">{label}</p>
        <Icon className="w-3.5 h-3.5 text-white/45" />
      </div>
      <p className={`text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Receipt; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-6 w-6 rounded-md border border-white/10 bg-white/10 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-white/75" />
      </div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">{title}</p>
    </div>
  )
}

function QuickLinks({
  detailHref,
  orderId,
  ticketId,
  customerId,
}: {
  detailHref: string
  orderId: string | null | undefined
  ticketId: string | null | undefined
  customerId: string | null | undefined
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Link
        href={detailHref}
        className="h-7 px-2.5 rounded-md border border-white/10 text-[10px] uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10 inline-flex items-center gap-1"
      >
        <ArrowSquareOut className="w-3.5 h-3.5" />
        Open Full Details
      </Link>
      <details className="relative">
        <summary className="list-none h-7 px-2.5 rounded-md border border-white/10 text-[10px] uppercase tracking-[0.12em] text-white/65 hover:text-white hover:bg-white/10 inline-flex items-center gap-1 cursor-pointer">
          More Actions
        </summary>
        <div className="absolute right-0 mt-1 w-40 rounded-md border border-white/10 bg-neutral-900 shadow-xl p-1.5 flex flex-col gap-1 z-20">
          {orderId ? (
            <Link
              href={`/admin/orders/${orderId}`}
              className="h-7 px-2 rounded text-[10px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center"
            >
              Legacy Order
            </Link>
          ) : null}
          {ticketId ? (
            <Link
              href={`/admin/support/tickets/${ticketId}`}
              className="h-7 px-2 rounded text-[10px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center"
            >
              Legacy Ticket
            </Link>
          ) : null}
          {customerId ? (
            <Link
              href={`/admin/customers/${customerId}`}
              className="h-7 px-2 rounded text-[10px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center"
            >
              Legacy Customer
            </Link>
          ) : null}
        </div>
      </details>
    </div>
  )
}

export function FulfillmentCaseDrawer({
  isOpen,
  loading,
  activeRecordHeader,
  activeQueueRow,
  activeTab,
  onChangeTab,
  tabAvailability,
  onRequestClose,
  context,
  fulfillmentReadiness,
  selectedTicket,
  orderDraft,
  setOrderDraft,
  ticketStatusDraft,
  setTicketStatusDraft,
  externalReference,
  setExternalReference,
  ticketReplyMessage,
  setTicketReplyMessage,
  ticketReplyInternal,
  setTicketReplyInternal,
  ticketNote,
  setTicketNote,
  customerDraft,
  setCustomerDraft,
  customerPointsDelta,
  setCustomerPointsDelta,
  customerPointsReason,
  setCustomerPointsReason,
  customerTierDraft,
  setCustomerTierDraft,
  customerNoteDraft,
  setCustomerNoteDraft,
  customerNoteImportant,
  setCustomerNoteImportant,
  actionLoading,
  lastSingleLabelUrl,
  formatCurrency,
  formatDate,
  statusClassName,
  onSaveOrder,
  onPurchaseSingleLabel,
  onMarkShipped,
  onNotifyTrackingUpdate,
  onRunPrimaryAction,
  onUpdateTicketStatus,
  onSendTicketReply,
  onApplyTicketDecision,
  onSaveCustomerProfile,
  onAdjustPoints,
  onChangeTier,
  onAddNote,
  onDeleteNote,
}: FulfillmentCaseDrawerProps) {
  const order = context?.order || null
  const customer = context?.customer || null
  const relatedTickets = context?.relatedTickets || []
  const statusClass = statusClassName || getDefaultStatusClass
  const detailHref = buildDetailsHref(order?.id, selectedTicket?.id, activeTab === 'summary' ? 'order' : activeTab)

  const [trackingLoading, setTrackingLoading] = useState(false)
  const [trackingData, setTrackingData] = useState<TrackingResult | null>(null)
  const [trackingError, setTrackingError] = useState<string | null>(null)
  const [trackingLastUpdated, setTrackingLastUpdated] = useState<string | null>(null)
  const [showTrackingMap, setShowTrackingMap] = useState(false)

  const activeTrackingNumber = (orderDraft.trackingNumber || order?.trackingNumber || '').trim()
  const canLoadTracking = Boolean(
    isOpen && activeTab === 'fulfillment' && order?.id && activeTrackingNumber.length > 0
  )
  const hasCompleteShippingAddress = useMemo(() => {
    if (!order?.shippingAddress) {
      return false
    }
    const address = order.shippingAddress
    return Boolean(
      address.firstName?.trim() &&
        address.lastName?.trim() &&
        address.address1?.trim() &&
        address.city?.trim() &&
        address.state?.trim() &&
        address.postalCode?.trim() &&
        address.country?.trim()
    )
  }, [order?.shippingAddress])
  const canPrintLabel = Boolean(lastSingleLabelUrl && lastSingleLabelUrl.trim().length > 0)
  const visibleReadinessSteps = useMemo(
    () => fulfillmentReadiness?.steps?.filter((step) => step.id !== 'print_label') || [],
    [fulfillmentReadiness?.steps]
  )

  const fetchTracking = useCallback(
    async (silent = false) => {
      if (!order?.id || !activeTrackingNumber) {
        setTrackingData(null)
        setTrackingError(null)
        return
      }

      if (!silent) {
        setTrackingLoading(true)
      }

      try {
        const response = await fetch(`/api/orders/${order.id}/tracking/live`)
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load live tracking')
        }

        if (payload?.hasTracking && payload?.data) {
          setTrackingData(payload.data as TrackingResult)
          setTrackingError(null)
          setTrackingLastUpdated(new Date().toISOString())
          return
        }

        setTrackingData(null)
        setTrackingError(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load live tracking'
        setTrackingError(message)
      } finally {
        setTrackingLoading(false)
      }
    },
    [order?.id, activeTrackingNumber]
  )

  const runGuidedFulfillmentAction = useCallback(
    (stepId: FulfillmentReadinessStepId) => {
      switch (stepId) {
        case 'validate_address':
          if (hasCompleteShippingAddress) {
            toast.success('Shipping address is complete')
          } else {
            toast.error('Shipping address is incomplete')
          }
          break
        case 'buy_label':
          onPurchaseSingleLabel()
          break
        case 'print_label':
          if (canPrintLabel && lastSingleLabelUrl) {
            window.open(lastSingleLabelUrl, '_blank', 'noopener,noreferrer')
          } else {
            toast.info('Purchase a label first to print it')
          }
          break
        case 'mark_shipped':
          onMarkShipped()
          break
        case 'notify_customer':
          onNotifyTrackingUpdate()
          break
        default:
          break
      }
    },
    [canPrintLabel, hasCompleteShippingAddress, lastSingleLabelUrl, onMarkShipped, onNotifyTrackingUpdate, onPurchaseSingleLabel]
  )

  useEffect(() => {
    setShowTrackingMap(false)
    setTrackingData(null)
    setTrackingError(null)
    setTrackingLastUpdated(null)
  }, [order?.id])

  useEffect(() => {
    if (!canLoadTracking) {
      return
    }

    void fetchTracking(false)
    const intervalId = window.setInterval(() => {
      void fetchTracking(true)
    }, 30000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [canLoadTracking, fetchTracking])

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]"
            onClick={onRequestClose}
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-[760px] border-l border-white/10 bg-neutral-900 shadow-2xl"
          >
            <header className="px-4 py-3 border-b border-white/10 bg-neutral-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">{activeRecordHeader.secondaryLabel}</p>
                  <p className="text-sm font-semibold text-white mt-0.5">{activeRecordHeader.primaryLabel}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {activeQueueRow ? (
                      <>
                        <span className="inline-flex px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.12em] text-white/70">
                          {activeQueueRow.ageHours}h age
                        </span>
                        <span className="inline-flex px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.12em] text-white/70">
                          SLA {activeQueueRow.slaRisk}
                        </span>
                      </>
                    ) : null}
                    {order ? (
                      <>
                        <span className="inline-flex px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-[10px] uppercase tracking-[0.12em] text-emerald-300">
                          Total {formatCurrency(order.total)}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] uppercase tracking-[0.12em] ${statusClass(order.paymentStatus)}`}>
                          {order.paymentStatus}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const recordCode = order?.orderNumber || selectedTicket?.ticketNumber
                      if (recordCode) navigator.clipboard?.writeText(recordCode)
                    }}
                    className="h-8 px-2 rounded-md border border-white/10 text-[10px] uppercase tracking-[0.12em] text-white/70 inline-flex items-center gap-1 hover:text-white hover:bg-white/10"
                  >
                    <CopySimple className="w-3.5 h-3.5" />
                    Copy
                  </button>
                  <button
                    onClick={onRequestClose}
                    className="h-8 w-8 rounded-md border border-white/10 text-white/60 hover:text-white hover:bg-white/10 inline-flex items-center justify-center"
                    aria-label="Close drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {DRAWER_TABS.map((tab) => {
                  const active = tab.key === activeTab
                  const disabled = !tabAvailability[tab.key]
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.key}
                      data-testid={`fulfillment-drawer-tab-${tab.key}`}
                      onClick={() => onChangeTab(tab.key)}
                      disabled={disabled}
                      className={`h-7 px-2.5 rounded-md border text-[10px] uppercase tracking-[0.12em] inline-flex items-center gap-1.5 ${
                        active
                          ? 'border-white bg-white text-black'
                          : disabled
                            ? 'border-white/10 text-white/30 cursor-not-allowed'
                            : 'border-white/10 text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </header>

            <div className="h-[calc(100%-117px)] overflow-y-auto bg-neutral-950/50 p-3 space-y-3">
              {loading ? <p className="text-sm text-white/55">Loading case details...</p> : null}

              {activeTab === 'summary' ? (
                <section className="rounded-lg border border-white/10 bg-neutral-900 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle icon={Receipt} title="Summary" />
                    <QuickLinks
                      detailHref={detailHref}
                      orderId={order?.id}
                      ticketId={selectedTicket?.id}
                      customerId={customer?.id}
                    />
                  </div>

                  {!order && !selectedTicket && !customer ? (
                    <p className="text-sm text-white/55">Select a queue row to load details.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <MoneyMetric
                          label="Subtotal"
                          value={formatCurrency(order?.subtotal)}
                          icon={Receipt}
                        />
                        <MoneyMetric
                          label="Discount"
                          value={formatCurrency(order?.discount)}
                          icon={Receipt}
                          tone="text-emerald-300"
                        />
                        <MoneyMetric
                          label="Shipping"
                          value={formatCurrency(order?.shipping)}
                          icon={Truck}
                        />
                        <MoneyMetric
                          label="Tax"
                          value={formatCurrency(order?.tax)}
                          icon={CurrencyDollar}
                        />
                        <MoneyMetric
                          label="Total"
                          value={formatCurrency(order?.total)}
                          icon={CurrencyDollar}
                        />
                        <MoneyMetric
                          label="Payment"
                          value={order?.paymentStatus || '-'}
                          icon={CreditCard}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                          <p className="text-white/45 mb-1">Order ID</p>
                          <p className="text-white">{order?.orderNumber || '-'}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                          <p className="text-white/45 mb-1">Ticket ID</p>
                          <p className="text-white">{selectedTicket?.ticketNumber || '-'}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                          <p className="text-white/45 mb-1">Customer</p>
                          <p className="text-white truncate">{customer?.name || customer?.email || '-'}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                          <p className="text-white/45 mb-1">Queue Lane</p>
                          <p className="text-white">{activeRecordHeader.secondaryLabel || '-'}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                          <p className="text-white/45 mb-1">Created</p>
                          <p className="text-white">{formatDate(order?.createdAt || selectedTicket?.createdAt)}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                          <p className="text-white/45 mb-1">Updated</p>
                          <p className="text-white">{formatDate(order?.updatedAt || selectedTicket?.updatedAt)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {order?.status ? (
                          <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] ${statusClass(order.status)}`}>
                            {order.status}
                          </span>
                        ) : null}
                        {order?.paymentStatus ? (
                          <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] ${statusClass(order.paymentStatus)}`}>
                            {order.paymentStatus}
                          </span>
                        ) : null}
                        {selectedTicket?.status ? (
                          <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] ${statusClass(selectedTicket.status)}`}>
                            {selectedTicket.status}
                          </span>
                        ) : null}
                        {selectedTicket?.priority ? (
                          <span className="inline-flex px-2 py-0.5 rounded border border-white/20 bg-white/10 text-[10px] text-white/75">
                            {selectedTicket.priority}
                          </span>
                        ) : null}
                      </div>

                      <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5 space-y-2">
                        <SectionTitle icon={Clock} title="Recent Activity" />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Recent Orders</p>
                            {context?.recentOrders?.slice(0, 4).map((recentOrder) => (
                              <div key={recentOrder.id} className="rounded border border-white/10 bg-white/5 px-2 py-1">
                                <p className="text-[11px] text-white">{recentOrder.orderNumber}</p>
                                <p className="text-[10px] text-white/55">{recentOrder.status} • {formatCurrency(recentOrder.total)}</p>
                              </div>
                            ))}
                            {(context?.recentOrders || []).length === 0 ? (
                              <p className="text-[11px] text-white/55">No recent orders.</p>
                            ) : null}
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Recent Tickets</p>
                            {context?.recentTickets?.slice(0, 4).map((ticket) => (
                              <div key={ticket.id} className="rounded border border-white/10 bg-white/5 px-2 py-1">
                                <p className="text-[11px] text-white">{ticket.ticketNumber}</p>
                                <p className="text-[10px] text-white/55 truncate">{formatTicketType(ticket.type)} • {ticket.status}</p>
                              </div>
                            ))}
                            {(context?.recentTickets || []).length === 0 ? (
                              <p className="text-[11px] text-white/55">No recent tickets.</p>
                            ) : null}
                          </div>
                        </div>
                        {(ticketNote.trim() || orderDraft.internalNotes.trim()) ? (
                          <div className="rounded border border-amber-400/20 bg-amber-500/10 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-amber-300 mb-1">Pending Operational Notes</p>
                            {orderDraft.internalNotes.trim() ? (
                              <p className="text-[11px] text-amber-100">Fulfillment: {orderDraft.internalNotes.trim()}</p>
                            ) : null}
                            {ticketNote.trim() ? (
                              <p className="text-[11px] text-amber-100">Ticket: {ticketNote.trim()}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                </section>
              ) : null}

              {activeTab === 'fulfillment' ? (
                <section className="rounded-lg border border-white/10 bg-neutral-900 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle icon={Truck} title="Fulfillment" />
                    <QuickLinks
                      detailHref={detailHref}
                      orderId={order?.id}
                      ticketId={selectedTicket?.id}
                      customerId={customer?.id}
                    />
                  </div>

                  {!order ? (
                    <p className="text-sm text-white/55">No order context for fulfillment operations.</p>
                  ) : (
                    <>
                      <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <SectionTitle icon={Truck} title="Live Courier Tracking" />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowTrackingMap((previous) => !previous)}
                              className="h-7 px-2.5 rounded-md border border-white/10 text-[10px] uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10"
                            >
                              {showTrackingMap ? 'Hide Map' : 'Show Map'}
                            </button>
                            <button
                              onClick={() => void fetchTracking(false)}
                              disabled={!canLoadTracking || trackingLoading}
                              className="h-7 px-2.5 rounded-md border border-white/10 text-[10px] uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10 disabled:opacity-50"
                            >
                              {trackingLoading ? 'Refreshing...' : 'Refresh'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                          <div className="rounded border border-white/10 bg-white/5 p-2">
                            <p className="text-white/45 mb-1">Tracking #</p>
                            <p className="text-white truncate">{activeTrackingNumber || 'Not set'}</p>
                          </div>
                          <div className="rounded border border-white/10 bg-white/5 p-2">
                            <p className="text-white/45 mb-1">Carrier</p>
                            <p className="text-white truncate">{orderDraft.carrier || order.carrier || '-'}</p>
                          </div>
                          <div className="rounded border border-white/10 bg-white/5 p-2">
                            <p className="text-white/45 mb-1">Status</p>
                            <p className="text-white truncate">{trackingData?.statusDescription || order.status}</p>
                          </div>
                          <div className="rounded border border-white/10 bg-white/5 p-2">
                            <p className="text-white/45 mb-1">Progress</p>
                            <p className="text-white">{trackingData ? `${trackingData.transitProgress}%` : '-'}</p>
                          </div>
                        </div>

                        {trackingData ? (
                          <div>
                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-[#FF3131] transition-[width] duration-300"
                                style={{ width: `${trackingData.transitProgress}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-white/45 mt-1">
                              {trackingLastUpdated ? `Last updated ${formatDate(trackingLastUpdated)}` : 'Waiting for live updates'}
                            </p>
                          </div>
                        ) : null}

                        {trackingError ? (
                          <div className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1.5">
                            <p className="text-[11px] text-rose-200">{trackingError}</p>
                          </div>
                        ) : null}

                        {showTrackingMap ? (
                          <div className="rounded-md border border-white/10 overflow-hidden bg-slate-900 h-64">
                            {trackingData ? (
                              <TrackingMap
                                origin={trackingData.originLocation}
                                destination={trackingData.destinationLocation}
                                currentLocation={trackingData.currentLocation}
                                events={trackingData.events}
                                status={trackingData.status}
                                compact
                              />
                            ) : (
                              <div className="h-full flex items-center justify-center text-sm text-white/55">
                                {activeTrackingNumber ? 'Loading map...' : 'Add tracking number to load map'}
                              </div>
                            )}
                          </div>
                        ) : null}

                        {trackingData?.events?.length ? (
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {trackingData.events.slice(0, 5).map((event, index) => (
                              <div key={`${event.timestamp}-${index}`} className="rounded border border-white/10 bg-white/5 px-2 py-1.5">
                                <p className="text-[11px] text-white">{event.description}</p>
                                <p className="text-[10px] text-white/55">
                                  {event.location.city}, {event.location.state} • {formatDate(event.timestamp)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <MoneyMetric label="Subtotal" value={formatCurrency(order.subtotal)} icon={Receipt} />
                        <MoneyMetric label="Discount" value={formatCurrency(order.discount)} icon={Receipt} tone="text-emerald-300" />
                        <MoneyMetric label="Shipping" value={formatCurrency(order.shipping)} icon={Truck} />
                        <MoneyMetric label="Tax" value={formatCurrency(order.tax)} icon={CurrencyDollar} />
                        <MoneyMetric label="Total" value={formatCurrency(order.total)} icon={CurrencyDollar} />
                        <MoneyMetric label="Payment" value={order.paymentStatus} icon={CreditCard} />
                      </div>

                      <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5 space-y-2">
                        <SectionTitle icon={Package} title="Order Items" />
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {order.items.map((item) => {
                            const imageSrc = item.productImage || normalizeImage(item.product?.images)
                            return (
                              <div
                                key={item.id}
                                className="grid grid-cols-[56px_minmax(0,1fr)_auto] gap-2 rounded-md border border-white/10 bg-neutral-900 p-2"
                              >
                                <div className="h-14 w-14 rounded-md border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                                  {imageSrc ? (
                                    <img src={imageSrc} alt={item.productName} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[10px] text-white/40 uppercase">No Img</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[11px] text-white truncate">{item.product?.name || item.productName}</p>
                                  <p className="text-[10px] text-white/50 truncate">
                                    {item.variantDetails || `${item.productVariant?.size || 'Default'} • ${item.productVariant?.color || ''}`}
                                  </p>
                                  <p className="text-[10px] text-white/45">Qty {item.quantity}</p>
                                </div>
                                <p className="text-[11px] text-white">{formatCurrency(item.price * item.quantity)}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45 mb-1">Shipping Address</p>
                          {formatAddressLines(order.shippingAddress).map((line) => (
                            <p key={`ship-${line}`} className="text-[11px] text-white/80">
                              {line}
                            </p>
                          ))}
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45 mb-1">Billing Address</p>
                          {formatAddressLines(order.billingAddress).map((line) => (
                            <p key={`bill-${line}`} className="text-[11px] text-white/80">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>

                      {visibleReadinessSteps.length ? (
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5 space-y-2">
                          <SectionTitle icon={Clock} title="Guided Fulfillment Stack" />
                          <div className="space-y-1.5">
                            {visibleReadinessSteps.map((step) => (
                              <div
                                key={step.id}
                                className={`rounded border px-2 py-1.5 ${
                                  step.ready
                                    ? 'border-emerald-500/25 bg-emerald-500/10'
                                    : 'border-amber-500/25 bg-amber-500/10'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] text-white">{step.label}</p>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-[10px] uppercase tracking-[0.12em] ${
                                        step.ready ? 'text-emerald-300' : 'text-amber-300'
                                      }`}
                                    >
                                      {step.ready ? 'Ready' : 'Blocked'}
                                    </span>
                                    <button
                                      data-testid={`guided-step-action-${step.id}`}
                                      onClick={() => runGuidedFulfillmentAction(step.id)}
                                      disabled={
                                        actionLoading ||
                                        (step.id !== 'validate_address' && !step.ready) ||
                                        (step.id === 'print_label' && !canPrintLabel)
                                      }
                                      className="h-7 px-2.5 rounded-md border border-white/10 bg-white/10 text-[10px] uppercase tracking-[0.12em] text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-45 disabled:cursor-not-allowed"
                                    >
                                      {getGuidedActionLabel(step.id)}
                                    </button>
                                  </div>
                                </div>
                                {!step.ready && step.reason ? (
                                  <p className="text-[10px] text-amber-100/90 mt-0.5">{step.reason}</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block mb-1 text-[10px] uppercase tracking-[0.12em] text-white/45">Order status</label>
                          <select
                            value={orderDraft.status}
                            onChange={(event) => setOrderDraft((previous) => ({ ...previous, status: event.target.value }))}
                            className="w-full h-8 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white"
                          >
                            <option value="PENDING" className="bg-neutral-900">PENDING</option>
                            <option value="CONFIRMED" className="bg-neutral-900">CONFIRMED</option>
                            <option value="PROCESSING" className="bg-neutral-900">PROCESSING</option>
                            <option value="SHIPPED" className="bg-neutral-900">SHIPPED</option>
                            <option value="DELIVERED" className="bg-neutral-900">DELIVERED</option>
                            <option value="CANCELLED" className="bg-neutral-900">CANCELLED</option>
                            <option value="REFUNDED" className="bg-neutral-900">REFUNDED</option>
                          </select>
                        </div>
                        <div>
                          <label className="block mb-1 text-[10px] uppercase tracking-[0.12em] text-white/45">Payment status</label>
                          <select
                            value={orderDraft.paymentStatus}
                            onChange={(event) => setOrderDraft((previous) => ({ ...previous, paymentStatus: event.target.value }))}
                            className="w-full h-8 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white"
                          >
                            <option value="PENDING" className="bg-neutral-900">PENDING</option>
                            <option value="PAID" className="bg-neutral-900">PAID</option>
                            <option value="FAILED" className="bg-neutral-900">FAILED</option>
                            <option value="REFUNDED" className="bg-neutral-900">REFUNDED</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={orderDraft.trackingNumber}
                          onChange={(event) => setOrderDraft((previous) => ({ ...previous, trackingNumber: event.target.value }))}
                          className="h-8 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35"
                          placeholder="Tracking number"
                        />
                        <input
                          value={orderDraft.carrier}
                          onChange={(event) => setOrderDraft((previous) => ({ ...previous, carrier: event.target.value }))}
                          className="h-8 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35"
                          placeholder="Carrier"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={orderDraft.internalNotes}
                        onChange={(event) => setOrderDraft((previous) => ({ ...previous, internalNotes: event.target.value }))}
                        placeholder="Internal notes..."
                        className="w-full px-2 py-1.5 rounded-md border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35 resize-none"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={onSaveOrder}
                          disabled={actionLoading}
                          className="h-8 px-3 rounded-md bg-[#FF3131] text-white text-xs uppercase tracking-[0.12em] disabled:opacity-60 hover:bg-[#ff4a4a] inline-flex items-center gap-1"
                        >
                          <FloppyDisk className="w-3.5 h-3.5" />
                          Save Fulfillment
                        </button>
                        <button
                          onClick={onPurchaseSingleLabel}
                          disabled={actionLoading}
                          className="h-8 px-3 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/75 inline-flex items-center gap-1 hover:text-white hover:bg-white/10"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          Buy + Print Label
                        </button>
                        <button
                          onClick={onNotifyTrackingUpdate}
                          disabled={actionLoading || !activeTrackingNumber || !(orderDraft.carrier || order.carrier)}
                          className="h-8 px-3 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/75 inline-flex items-center gap-1 hover:text-white hover:bg-white/10 disabled:opacity-50"
                        >
                          <ChatCircleText className="w-3.5 h-3.5" />
                          Send Tracking Update
                        </button>
                      </div>

                      <div className="sticky bottom-0 z-10 -mx-3 px-3 py-2 bg-gradient-to-t from-neutral-900 via-neutral-900 to-transparent border-t border-white/10">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">
                            Primary Action
                          </p>
                          <button
                            onClick={onRunPrimaryAction}
                            disabled={actionLoading}
                            className="h-8 px-3 rounded-md bg-[#FF3131] text-white text-xs uppercase tracking-[0.12em] hover:bg-[#ff4a4a] disabled:opacity-60"
                          >
                            {activeQueueRow?.nextAction === 'BUY_LABEL'
                              ? 'Buy + Print Label'
                              : activeQueueRow?.nextAction === 'MARK_SHIPPED'
                                ? 'Mark Shipped'
                                : activeQueueRow?.nextAction === 'SEND_TRACKING_UPDATE'
                                  ? 'Send Tracking Update'
                                  : activeQueueRow?.nextAction === 'REQUEST_PAYMENT'
                                    ? 'Request Payment'
                                    : activeQueueRow?.nextAction === 'FIX_ADDRESS'
                                      ? 'Fix Address'
                                      : activeQueueRow?.nextAction === 'REVIEW_HOLD'
                                        ? 'Review Hold'
                                        : activeQueueRow?.nextAction === 'RESOLVE_TICKET'
                                          ? 'Resolve Ticket'
                                          : 'Open Case'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              ) : null}

              {activeTab === 'ticket' ? (
                <section className="rounded-lg border border-white/10 bg-neutral-900 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle icon={Ticket} title="Ticket" />
                    <QuickLinks
                      detailHref={detailHref}
                      orderId={order?.id}
                      ticketId={selectedTicket?.id}
                      customerId={customer?.id}
                    />
                  </div>

                  {!selectedTicket ? (
                    <p className="text-sm text-white/55">No ticket context available for this row.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-md border border-white/10 bg-white/5 p-2">
                          <p className="text-white/45 mb-1">Type</p>
                          <p className="text-white">{formatTicketType(selectedTicket.type)}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/5 p-2">
                          <p className="text-white/45 mb-1">Priority</p>
                          <p className="text-white">{selectedTicket.priority}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/5 p-2">
                          <p className="text-white/45 mb-1">Status</p>
                          <p className="text-white">{selectedTicket.status}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/5 p-2">
                          <p className="text-white/45 mb-1">Assigned</p>
                          <p className="text-white">{selectedTicket.assignedTo?.name || 'Unassigned'}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2 col-span-2">
                          <p className="text-white/45 mb-1">Subject</p>
                          <p className="text-white">{selectedTicket.subject}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                          <p className="text-white/45 mb-1">Return</p>
                          <p className="text-white">
                            {selectedTicket.returnRequested
                              ? selectedTicket.returnApproved === null
                                ? 'Requested / Pending'
                                : selectedTicket.returnApproved
                                  ? 'Approved'
                                  : 'Denied'
                              : 'Not requested'}
                          </p>
                          <p className="text-white/60 text-[10px] truncate">{selectedTicket.returnLabel || '-'}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                          <p className="text-white/45 mb-1">Refund</p>
                          <p className="text-white">{selectedTicket.refundAmount ? formatCurrency(selectedTicket.refundAmount) : '-'}</p>
                          <p className="text-white/60 text-[10px] truncate">{selectedTicket.refundReason || '-'}</p>
                        </div>
                      </div>

                      {relatedTickets.length > 0 ? (
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45 mb-1">Related Tickets</p>
                          <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                            {relatedTickets.slice(0, 4).map((ticket) => (
                              <div key={ticket.id} className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px]">
                                <p className="text-white">{ticket.ticketNumber} • {ticket.status}</p>
                                <p className="text-white/55 truncate">{ticket.subject}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={ticketStatusDraft}
                          onChange={(event) => setTicketStatusDraft(event.target.value)}
                          className="h-8 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white"
                        >
                          <option value="OPEN" className="bg-neutral-900">OPEN</option>
                          <option value="IN_PROGRESS" className="bg-neutral-900">IN_PROGRESS</option>
                          <option value="WAITING_CUSTOMER" className="bg-neutral-900">WAITING_CUSTOMER</option>
                          <option value="ESCALATED" className="bg-neutral-900">ESCALATED</option>
                          <option value="RESOLVED" className="bg-neutral-900">RESOLVED</option>
                          <option value="CLOSED" className="bg-neutral-900">CLOSED</option>
                        </select>
                        <input
                          value={externalReference}
                          onChange={(event) => setExternalReference(event.target.value)}
                          className="h-8 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35"
                          placeholder="External reference"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={ticketReplyMessage}
                        onChange={(event) => setTicketReplyMessage(event.target.value)}
                        placeholder={ticketReplyInternal ? 'Internal note...' : 'Reply to customer...'}
                        className="w-full px-2 py-1.5 rounded-md border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35 resize-none"
                      />
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-white/65">
                        <input
                          type="checkbox"
                          checked={ticketReplyInternal}
                          onChange={(event) => setTicketReplyInternal(event.target.checked)}
                          className="h-3.5 w-3.5 rounded border border-white/20 bg-white/5"
                        />
                        Internal note mode
                      </label>
                      <textarea
                        rows={2}
                        value={ticketNote}
                        onChange={(event) => setTicketNote(event.target.value)}
                        placeholder="Decision note..."
                        className="w-full px-2 py-1.5 rounded-md border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35 resize-none"
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={onUpdateTicketStatus}
                          disabled={actionLoading}
                          className="h-8 px-3 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10"
                        >
                          Apply Status
                        </button>
                        <button
                          onClick={onSendTicketReply}
                          disabled={actionLoading || !ticketReplyMessage.trim()}
                          className="h-8 px-3 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10 disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <ChatCircleText className="w-3.5 h-3.5" />
                          Send Message
                        </button>
                        {selectedTicket.returnRequested && selectedTicket.returnApproved === null ? (
                          <>
                            <button
                              onClick={() => onApplyTicketDecision('approve_return', { generateLabel: true })}
                              className="h-8 px-3 rounded-md border border-emerald-500/30 text-xs uppercase tracking-[0.12em] text-emerald-300"
                            >
                              Approve Return
                            </button>
                            <button
                              onClick={() => onApplyTicketDecision('deny_return')}
                              className="h-8 px-3 rounded-md border border-rose-500/30 text-xs uppercase tracking-[0.12em] text-rose-300"
                            >
                              Deny Return
                            </button>
                          </>
                        ) : null}
                        {selectedTicket.type === 'REFUND' ? (
                          <>
                            <button
                              onClick={() => onApplyTicketDecision('mark_refund_requested')}
                              className="h-8 px-3 rounded-md border border-amber-500/30 text-xs uppercase tracking-[0.12em] text-amber-300"
                            >
                              Mark Requested
                            </button>
                            <button
                              onClick={() => onApplyTicketDecision('approve_refund')}
                              className="h-8 px-3 rounded-md border border-blue-500/30 text-xs uppercase tracking-[0.12em] text-blue-300"
                            >
                              Approve Refund
                            </button>
                            <button
                              onClick={() => onApplyTicketDecision('complete_refund')}
                              className="h-8 px-3 rounded-md border border-emerald-500/30 text-xs uppercase tracking-[0.12em] text-emerald-300"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => onApplyTicketDecision('deny_refund')}
                              className="h-8 px-3 rounded-md border border-rose-500/30 text-xs uppercase tracking-[0.12em] text-rose-300"
                            >
                              Deny
                            </button>
                          </>
                        ) : null}
                      </div>

                      <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
                        <SectionTitle icon={ChatCircleText} title="Conversation" />
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 mt-2">
                          {selectedTicket.messages.length === 0 ? (
                            <p className="text-[11px] text-white/55">No messages yet.</p>
                          ) : (
                            selectedTicket.messages.map((message) => (
                              <div key={message.id} className="rounded border border-white/10 bg-neutral-900 px-2 py-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] text-white">{message.senderName}</p>
                                  <p className="text-[10px] text-white/45">{formatDate(message.createdAt)}</p>
                                </div>
                                <p className="text-[10px] text-white/45 uppercase tracking-[0.1em] mt-0.5">
                                  {message.isInternal ? 'Internal' : 'Customer'}
                                </p>
                                <p className="text-[11px] text-white/75 whitespace-pre-wrap">{message.message}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </section>
              ) : null}

              {activeTab === 'customer' ? (
                <section className="rounded-lg border border-white/10 bg-neutral-900 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle icon={IdentificationCard} title="Customer" />
                    <QuickLinks
                      detailHref={detailHref}
                      orderId={order?.id}
                      ticketId={selectedTicket?.id}
                      customerId={customer?.id}
                    />
                  </div>

                  {!customer ? (
                    <p className="text-sm text-white/55">No customer context available.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-md border border-white/10 bg-white/5 p-2">
                          <p className="text-white/45 mb-1">Customer</p>
                          <p className="text-white">{customer.name || customer.email}</p>
                          <p className="text-white/60 truncate">{customer.email}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/5 p-2">
                          <p className="text-white/45 mb-1">Preferences</p>
                          <div className="flex flex-wrap gap-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${customer.newsletter ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50'}`}>
                              Newsletter {customer.newsletter ? 'On' : 'Off'}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${customer.smsOptIn ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50'}`}>
                              SMS {customer.smsOptIn ? 'On' : 'Off'}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                          <p className="text-white/45 mb-1">Orders / Spend</p>
                          <p className="text-white">{customer.totalOrders} orders</p>
                          <p className="text-white/60">{formatCurrency(customer.totalSpent)}</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                          <p className="text-white/45 mb-1">Loyalty</p>
                          <p className="text-white">{customer.loyaltyTier?.name || 'None'} ({customer.loyaltyTier?.pointMultiplier || 1}x)</p>
                          <p className="text-white/60">Current {customer.currentPoints.toLocaleString()} pts</p>
                          <p className="text-white/60">Lifetime {customer.lifetimePoints.toLocaleString()} pts</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={customerDraft.name}
                          onChange={(event) => setCustomerDraft((previous) => ({ ...previous, name: event.target.value }))}
                          className="h-8 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35"
                          placeholder="Name"
                        />
                        <input
                          value={customerDraft.phone}
                          onChange={(event) => setCustomerDraft((previous) => ({ ...previous, phone: event.target.value }))}
                          className="h-8 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35"
                          placeholder="Phone"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-white/65 rounded-md border border-white/10 bg-white/5 px-2">
                          <input
                            type="checkbox"
                            checked={customerDraft.newsletter}
                            onChange={(event) => setCustomerDraft((previous) => ({ ...previous, newsletter: event.target.checked }))}
                            className="h-3.5 w-3.5 rounded border border-white/20 bg-white/5"
                          />
                          Newsletter
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-white/65 rounded-md border border-white/10 bg-white/5 px-2">
                          <input
                            type="checkbox"
                            checked={customerDraft.smsOptIn}
                            onChange={(event) => setCustomerDraft((previous) => ({ ...previous, smsOptIn: event.target.checked }))}
                            className="h-3.5 w-3.5 rounded border border-white/20 bg-white/5"
                          />
                          SMS Opt-In
                        </label>
                      </div>
                      <button
                        onClick={onSaveCustomerProfile}
                        disabled={actionLoading}
                        className="h-8 px-3 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10 inline-flex items-center gap-1"
                      >
                        <FloppyDisk className="w-3.5 h-3.5" />
                        Save Profile
                      </button>

                      <div className="grid grid-cols-3 gap-2">
                        <input
                          value={customerPointsDelta}
                          onChange={(event) => setCustomerPointsDelta(event.target.value)}
                          className="h-8 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35"
                          placeholder="+/- points"
                        />
                        <input
                          value={customerPointsReason}
                          onChange={(event) => setCustomerPointsReason(event.target.value)}
                          className="h-8 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35"
                          placeholder="Reason"
                        />
                        <button
                          onClick={onAdjustPoints}
                          className="h-8 px-3 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10"
                        >
                          Apply Points
                        </button>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <select
                          value={customerTierDraft}
                          onChange={(event) => setCustomerTierDraft(event.target.value)}
                          className="h-8 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white"
                        >
                          <option value="" className="bg-neutral-900">Select tier</option>
                          {context?.loyaltyTiers.map((tier) => (
                            <option key={tier.id} value={tier.id} className="bg-neutral-900">
                              {tier.name} ({tier.pointMultiplier}x)
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={onChangeTier}
                          className="h-8 px-3 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10"
                        >
                          Update Tier
                        </button>
                      </div>

                      <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5 space-y-2">
                        <SectionTitle icon={Notepad} title="Notes" />
                        <textarea
                          rows={2}
                          value={customerNoteDraft}
                          onChange={(event) => setCustomerNoteDraft(event.target.value)}
                          className="w-full px-2 py-1.5 rounded-md border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35 resize-none"
                          placeholder="Internal customer note..."
                        />
                        <div className="flex items-center justify-between gap-2">
                          <label className="inline-flex items-center gap-1.5 text-[11px] text-white/65">
                            <input
                              type="checkbox"
                              checked={customerNoteImportant}
                              onChange={(event) => setCustomerNoteImportant(event.target.checked)}
                              className="h-3.5 w-3.5 rounded border border-white/20 bg-white/5"
                            />
                            Mark important
                          </label>
                          <button
                            onClick={onAddNote}
                            className="h-8 px-3 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10"
                          >
                            Add Note
                          </button>
                        </div>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {customer.notes.length === 0 ? (
                            <p className="text-[11px] text-white/55">No notes yet.</p>
                          ) : (
                            customer.notes.map((note) => (
                              <div key={note.id} className="rounded border border-white/10 bg-neutral-900 px-2 py-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] text-white truncate">
                                    {note.isImportant ? 'IMPORTANT • ' : ''}
                                    {note.content}
                                  </p>
                                  <button
                                    onClick={() => onDeleteNote(note.id)}
                                    className="h-6 px-1.5 rounded border border-rose-500/30 text-[10px] uppercase tracking-[0.12em] text-rose-300"
                                  >
                                    Delete
                                  </button>
                                </div>
                                <p className="text-[10px] text-white/45">{formatDate(note.createdAt)}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45 mb-1">Recent Orders</p>
                          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                            {(context?.recentOrders || []).slice(0, 5).map((recentOrder) => (
                              <p key={recentOrder.id} className="text-[11px] text-white/80">
                                {recentOrder.orderNumber} • {formatCurrency(recentOrder.total)}
                              </p>
                            ))}
                            {(context?.recentOrders || []).length === 0 ? (
                              <p className="text-[11px] text-white/55">No recent orders.</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45 mb-1">Recent Points</p>
                          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                            {customer.pointsTransactions.slice(0, 5).map((transaction) => (
                              <p key={transaction.id} className="text-[11px] text-white/80">
                                <span className={transaction.points >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                                  {transaction.points >= 0 ? '+' : ''}
                                  {transaction.points}
                                </span>
                                {' • '}
                                {transaction.type}
                              </p>
                            ))}
                            {customer.pointsTransactions.length === 0 ? (
                              <p className="text-[11px] text-white/55">No points transactions.</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
