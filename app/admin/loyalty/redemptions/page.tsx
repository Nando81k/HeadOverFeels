'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { LoyaltyNav } from '@/components/admin/LoyaltyNav'
import { BulkActionToolbar } from '@/components/admin/BulkActionToolbar'
import { toast } from '@/lib/toast'
import {
  Ticket,
  MagnifyingGlass,
  CheckCircle,
  XCircle,
  Package,
  Download,
  Heart,
  Sparkle,
  Gift,
  Truck,
  CircleNotch,
  FunnelSimple,
  CaretDown,
  X,
  Check,
  Warning,
} from '@phosphor-icons/react'

interface Redemption {
  id: string
  status: string
  pointsSpent: number
  couponCode: string | null
  trackingNumber: string | null
  shippedAt: string | null
  usedAt: string | null
  metadata: string | null
  createdAt: string
  updatedAt: string
  customer: { id: string; email: string; name: string | null }
  reward: { id: string; name: string; rewardType: string; value: number | null }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REWARD_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  DISCOUNT: Gift,
  FREE_SHIPPING: Truck,
  EXCLUSIVE_PRODUCT: Sparkle,
  CHARITY_DONATION: Heart,
  DIGITAL_CONTENT: Download,
  PHYSICAL_PERK: Package,
}

const REWARD_TYPE_LABELS: Record<string, string> = {
  DISCOUNT: 'Discount',
  FREE_SHIPPING: 'Free Shipping',
  EARLY_ACCESS: 'Early Access',
  EXCLUSIVE_PRODUCT: 'Exclusive',
  CHARITY_DONATION: 'Charity',
  DIGITAL_CONTENT: 'Digital',
  PHYSICAL_PERK: 'Physical Perk',
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Pending' },
  FULFILLED: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Fulfilled' },
  USED: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Used' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Cancelled' },
  EXPIRED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Expired' },
}

const FULFILLMENT_TYPES = ['PHYSICAL_PERK', 'DIGITAL_CONTENT', 'CHARITY_DONATION', 'EXCLUSIVE_PRODUCT']

function FulfillModal({
  redemption,
  onClose,
  onSave,
}: {
  redemption: Redemption
  onClose: () => void
  onSave: (id: string, status: string, trackingNumber: string, note: string) => Promise<void>
}) {
  const [status, setStatus] = useState<'FULFILLED' | 'CANCELLED'>(
    redemption.status === 'CANCELLED' ? 'CANCELLED' : 'FULFILLED'
  )
  const [trackingNumber, setTrackingNumber] = useState(redemption.trackingNumber ?? '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  let existingNote = ''
  try {
    const meta = JSON.parse(redemption.metadata || '{}')
    existingNote = meta.adminNote || ''
  } catch { /* ignore */ }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(redemption.id, status, trackingNumber, note)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const isPhysical = redemption.reward.rewardType === 'PHYSICAL_PERK'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Fulfill Redemption</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Customer + Reward */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
            <p className="text-sm font-semibold text-gray-900">{redemption.customer.name || redemption.customer.email}</p>
            <p className="text-xs text-gray-500">{redemption.customer.email}</p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-medium text-gray-700">{redemption.reward.name}</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500">{redemption.pointsSpent.toLocaleString()} pts</span>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">Action</label>
            <div className="flex gap-2">
              <button
                onClick={() => setStatus('FULFILLED')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                  status === 'FULFILLED'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <CheckCircle size={16} weight={status === 'FULFILLED' ? 'fill' : 'regular'} />
                Mark Fulfilled
              </button>
              <button
                onClick={() => setStatus('CANCELLED')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                  status === 'CANCELLED'
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <XCircle size={16} weight={status === 'CANCELLED' ? 'fill' : 'regular'} />
                Cancel
              </button>
            </div>
          </div>

          {/* Tracking Number — physical perks only */}
          {isPhysical && status === 'FULFILLED' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                Tracking Number <span className="font-normal text-gray-400 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. 1Z999AA10123456784"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30"
              />
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">
              Admin Note <span className="font-normal text-gray-400 normal-case">(internal)</span>
            </label>
            {existingNote && (
              <p className="text-xs text-gray-500 mb-1.5 italic">&ldquo;{existingNote}&rdquo;</p>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add an internal note about this fulfillment…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30 resize-none"
            />
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
              status === 'CANCELLED'
                ? 'bg-red-500 hover:bg-red-600 disabled:bg-red-300'
                : 'bg-black hover:bg-black/85 disabled:bg-gray-300'
            }`}
          >
            {saving ? <CircleNotch size={16} className="animate-spin" /> : <Check size={16} weight="bold" />}
            {saving ? 'Saving…' : status === 'CANCELLED' ? 'Cancel Redemption' : 'Mark Fulfilled'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminLoyaltyRedemptionsPage() {
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [typeFilter, setTypeFilter] = useState('needs_fulfillment')
  const [fulfillTarget, setFulfillTarget] = useState<Redemption | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const fetchRedemptions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
      })
      if (search) params.set('search', search)
      if (typeFilter === 'needs_fulfillment') {
        params.set('needsFulfillment', 'true')
      } else {
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
        if (typeFilter && typeFilter !== 'all') params.set('rewardType', typeFilter)
      }

      const res = await fetch(`/api/admin/loyalty/redemptions?${params}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setRedemptions(data.items)
      setTotal(data.total)
      setPageCount(data.pageCount)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, typeFilter])

  useEffect(() => {
    fetchRedemptions()
  }, [fetchRedemptions])

  const handleSave = async (id: string, status: string, trackingNumber: string, note: string) => {
    const body: Record<string, unknown> = { status }
    if (trackingNumber) body.trackingNumber = trackingNumber
    if (note) body.note = note

    const res = await fetch(`/api/admin/loyalty/redemptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Failed to update')

    setSuccessId(id)
    setTimeout(() => setSuccessId(null), 2000)
    fetchRedemptions()
  }

  const pendingFulfillmentCount = typeFilter === 'needs_fulfillment' ? total : undefined

  // ─── Bulk selection ────────────────────────────────────────────────────
  // Only PENDING redemptions of fulfillable types can be selected — others
  // (already fulfilled, coupon-based, etc.) aren't valid for bulk fulfill.
  const selectableIds = useMemo(
    () =>
      redemptions
        .filter((r) => FULFILLMENT_TYPES.includes(r.reward.rewardType) && r.status === 'PENDING')
        .map((r) => r.id),
    [redemptions]
  )

  // Drop selection on filter / page / search change
  useEffect(() => {
    setSelectedIds(new Set())
  }, [page, search, statusFilter, typeFilter])

  const allSelectableSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (selectableIds.every((id) => prev.has(id))) return new Set()
      return new Set(selectableIds)
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkAction = async (newStatus: 'FULFILLED' | 'CANCELLED') => {
    if (selectedIds.size === 0 || bulkLoading) return
    if (newStatus === 'CANCELLED') {
      const ok = confirm(`Cancel ${selectedIds.size} ${selectedIds.size === 1 ? 'redemption' : 'redemptions'}? Customers will not receive these rewards.`)
      if (!ok) return
    }

    setBulkLoading(true)
    const ids = Array.from(selectedIds)
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/admin/loyalty/redemptions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          }).then((res) => {
            if (!res.ok) throw new Error(`Failed for ${id}`)
            return id
          })
        )
      )
      const success = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - success
      const verb = newStatus === 'FULFILLED' ? 'fulfilled' : 'cancelled'
      if (failed === 0) {
        toast.success(`${success} ${success === 1 ? 'redemption' : 'redemptions'} ${verb}`)
      } else {
        toast.error(`${verb.charAt(0).toUpperCase() + verb.slice(1)} ${success}, ${failed} failed`)
      }
      clearSelection()
      fetchRedemptions()
    } catch (error) {
      console.error('Bulk redemption update failed:', error)
      toast.error('Bulk update failed')
    } finally {
      setBulkLoading(false)
    }
  }

  return (
    <AdminLayout title="Redemptions" subtitle="Manage reward fulfillment">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Ticket size={24} weight="fill" />
              Redemptions
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Manage reward fulfillment and track redemption status.
            </p>
          </div>
        </div>

        <LoyaltyNav />

        {/* Bulk action toolbar — shows when one or more fulfillable redemptions are selected */}
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          itemNoun="redemption"
          onClear={clearSelection}
          actions={[
            {
              key: 'fulfill',
              label: 'Mark fulfilled',
              icon: <CheckCircle size={13} weight="bold" />,
              tone: 'primary',
              onClick: () => handleBulkAction('FULFILLED'),
              loading: bulkLoading,
            },
            {
              key: 'cancel',
              label: 'Cancel',
              icon: <XCircle size={13} weight="bold" />,
              tone: 'danger',
              onClick: () => handleBulkAction('CANCELLED'),
              loading: bulkLoading,
            },
          ]}
        />

        {/* Filters */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search customer name or email…"
                className="w-full pl-9 pr-4 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            {/* Type filter */}
            <div className="relative">
              <FunnelSimple size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
                className="pl-9 pr-8 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none cursor-pointer"
              >
                <option value="needs_fulfillment">Needs Fulfillment</option>
                <option value="all">All Types</option>
                <option value="PHYSICAL_PERK">Physical Perks</option>
                <option value="DIGITAL_CONTENT">Digital</option>
                <option value="CHARITY_DONATION">Charity</option>
                <option value="EXCLUSIVE_PRODUCT">Exclusive</option>
                <option value="DISCOUNT">Discounts</option>
                <option value="FREE_SHIPPING">Free Shipping</option>
              </select>
              <CaretDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            </div>

            {/* Status filter — hidden when in needs_fulfillment mode */}
            {typeFilter !== 'needs_fulfillment' && (
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                  className="pl-4 pr-8 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="FULFILLED">Fulfilled</option>
                  <option value="USED">Used</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="EXPIRED">Expired</option>
                </select>
                <CaretDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-900">
                {typeFilter === 'needs_fulfillment' ? 'Pending Fulfillment' : 'All Redemptions'}
              </h2>
              {typeFilter === 'needs_fulfillment' && pendingFulfillmentCount !== undefined && pendingFulfillmentCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                  <Warning size={11} className="mr-1" />
                  {pendingFulfillmentCount} pending
                </span>
              )}
            </div>
            <span className="text-sm text-gray-500">{total.toLocaleString()} total</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <CircleNotch size={32} className="animate-spin text-gray-300" />
            </div>
          ) : redemptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Ticket size={28} className="text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">No redemptions found</p>
              {typeFilter === 'needs_fulfillment' && (
                <p className="text-gray-400 text-sm mt-1">All rewards are fulfilled — great work!</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left w-10">
                      {selectableIds.length > 0 ? (
                        <input
                          type="checkbox"
                          checked={allSelectableSelected}
                          onChange={toggleSelectAll}
                          aria-label="Select all fulfillable redemptions on this page"
                          className="w-4 h-4 cursor-pointer accent-black"
                        />
                      ) : null}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reward</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Points</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {redemptions.map((r) => {
                    const Icon = REWARD_TYPE_ICONS[r.reward.rewardType] || Gift
                    const statusStyle = STATUS_STYLES[r.status] || STATUS_STYLES.PENDING
                    const isFulfillable = FULFILLMENT_TYPES.includes(r.reward.rewardType) && r.status === 'PENDING'
                    const isSuccess = successId === r.id

                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-gray-50/50 transition-colors ${
                          isSuccess
                            ? 'bg-emerald-50'
                            : selectedIds.has(r.id)
                              ? 'bg-gray-50'
                              : ''
                        }`}
                      >
                        <td className="px-4 py-4">
                          {isFulfillable ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              onChange={() => toggleSelect(r.id)}
                              aria-label={`Select redemption for ${r.customer.email}`}
                              className="w-4 h-4 cursor-pointer accent-black"
                            />
                          ) : null}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-gray-900">{r.customer.name || '—'}</p>
                          <p className="text-xs text-gray-400">{r.customer.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                              <Icon size={14} className="text-gray-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 leading-tight">{r.reward.name}</p>
                              <p className="text-xs text-gray-400">{REWARD_TYPE_LABELS[r.reward.rewardType]}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.label}
                          </span>
                          {r.couponCode && (
                            <p className="text-[10px] text-gray-400 font-mono mt-1">{r.couponCode}</p>
                          )}
                          {r.trackingNumber && (
                            <p className="text-[10px] text-gray-400 font-mono mt-1">📦 {r.trackingNumber}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-gray-900">{r.pointsSpent.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-500">
                            {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isFulfillable ? (
                            <button
                              onClick={() => setFulfillTarget(r)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-black/80 transition-colors"
                            >
                              <CheckCircle size={13} weight="bold" />
                              Fulfill
                            </button>
                          ) : r.status === 'PENDING' && r.couponCode ? (
                            <span className="text-xs text-gray-400">Awaiting use</span>
                          ) : isSuccess ? (
                            <span className="text-xs text-emerald-600 font-semibold flex items-center justify-end gap-1">
                              <Check size={13} weight="bold" />
                              Saved
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {page} of {pageCount}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page === pageCount}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {fulfillTarget && (
        <FulfillModal
          redemption={fulfillTarget}
          onClose={() => setFulfillTarget(null)}
          onSave={handleSave}
        />
      )}
    </AdminLayout>
  )
}
