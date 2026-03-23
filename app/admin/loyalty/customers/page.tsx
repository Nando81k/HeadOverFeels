'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowsClockwise, Gift, MagnifyingGlass, Star, Users } from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { LoyaltyNav } from '@/components/admin/LoyaltyNav'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/lib/toast'

type LoyaltyCustomer = {
  id: string
  name: string | null
  email: string
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
  totalSpent: number
  tier: { id: string; name: string } | null
  orderCount: number
  createdAt: string
}

type TierOption = { id: string; name: string }

type ApiResponse = {
  data: LoyaltyCustomer[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  tiers: TierOption[]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export default function LoyaltyCustomersPage() {
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([])
  const [tiers, setTiers] = useState<TierOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [selectedCustomer, setSelectedCustomer] = useState<LoyaltyCustomer | null>(null)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showTierModal, setShowTierModal] = useState(false)
  const [pointsAdjustment, setPointsAdjustment] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [newTierId, setNewTierId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = search.trim()
      setDebouncedSearch((prev) => {
        if (prev !== next) {
          setPage(1)
        }
        return next
      })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [search])

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(tierFilter ? { tier: tierFilter } : {}),
      })

      const response = await fetch(`/api/admin/loyalty/customers?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch loyalty customers')
      }

      const result: ApiResponse = await response.json()
      setCustomers(result.data || [])
      setTiers(result.tiers || [])
      setTotal(result.pagination?.total || 0)
      setTotalPages(Math.max(1, result.pagination?.pages || 1))
    } catch (error) {
      console.error('Failed to load loyalty customers:', error)
      toast.error('Failed to load loyalty customers')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, tierFilter])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const openAdjustModal = (customer: LoyaltyCustomer) => {
    setSelectedCustomer(customer)
    setPointsAdjustment('')
    setAdjustmentReason('')
    setShowAdjustModal(true)
  }

  const openTierModal = (customer: LoyaltyCustomer) => {
    setSelectedCustomer(customer)
    setNewTierId(customer.tier?.id || '')
    setShowTierModal(true)
  }

  const applyPointsAdjustment = async () => {
    if (!selectedCustomer) return
    const points = Number.parseInt(pointsAdjustment, 10)
    if (!Number.isFinite(points) || points === 0) {
      toast.error('Invalid points adjustment', 'Enter a non-zero points value')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/loyalty/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          action: 'adjustPoints',
          points,
          reason: adjustmentReason.trim() || 'Manual adjustment',
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to apply points adjustment')
      }

      toast.success('Points updated')
      setShowAdjustModal(false)
      setSelectedCustomer(null)
      loadCustomers()
    } catch (error) {
      console.error('Failed to adjust points:', error)
      toast.error('Adjustment failed', error instanceof Error ? error.message : 'Could not adjust points')
    } finally {
      setSubmitting(false)
    }
  }

  const applyTierChange = async () => {
    if (!selectedCustomer || !newTierId) return

    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/loyalty/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          action: 'changeTier',
          tierId: newTierId,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to change tier')
      }

      toast.success('Tier updated')
      setShowTierModal(false)
      setSelectedCustomer(null)
      loadCustomers()
    } catch (error) {
      console.error('Failed to change tier:', error)
      toast.error('Tier update failed', error instanceof Error ? error.message : 'Could not update tier')
    } finally {
      setSubmitting(false)
    }
  }

  const activeFilters = useMemo(() => [Boolean(debouncedSearch), Boolean(tierFilter)].filter(Boolean).length, [debouncedSearch, tierFilter])

  return (
    <AdminLayout
      title="Loyalty Customers"
      subtitle={`${total} loyalty customers`}
      headerActions={
        <div className="flex items-center gap-2">
          <Link
            href="/admin/customers"
            className="h-10 px-4 inline-flex items-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-colors text-xs uppercase tracking-[0.14em]"
          >
            Primary View
          </Link>
          <button
            type="button"
            onClick={loadCustomers}
            className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowsClockwise size={16} weight="bold" />
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <LoyaltyNav />

        <div className="sticky top-0 z-20 bg-neutral-950/95 backdrop-blur pb-4">
          <div className="border border-white/10 rounded-xl bg-neutral-900 p-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px_auto] lg:items-end">
            <div>
              <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Search</label>
              <div className="relative">
                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name or email"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
                />
              </div>
            </div>
            <div>
              <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Tier</label>
              <select
                value={tierFilter}
                onChange={(event) => {
                  setTierFilter(event.target.value)
                  setPage(1)
                }}
                className="w-full h-10 px-3 rounded-lg border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:border-white/30"
              >
                <option value="" className="bg-neutral-900">All tiers</option>
                {tiers.map((tier) => (
                  <option key={tier.id} value={tier.id} className="bg-neutral-900">
                    {tier.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-white/50 text-right">
              <span className="text-white font-semibold">{total}</span> results
              <span className="mx-2 text-white/20">|</span>
              <span className="text-white/80">{activeFilters}</span> filters
            </div>
          </div>
        </div>

        <div className="border border-white/10 bg-neutral-900 rounded-xl overflow-hidden">
          {loading ? (
            <TableSkeleton rows={10} columns={7} />
          ) : customers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Loyalty Customers Found"
              description="No customers match this loyalty filter selection."
              action={{
                label: 'Clear Filters',
                onClick: () => {
                  setSearch('')
                  setTierFilter('')
                  setPage(1)
                },
              }}
            />
          ) : (
            <>
              <div className="hidden lg:block max-h-[70vh] overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-neutral-950">
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Customer</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Tier</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-white/40">Points</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-white/40">Orders</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-white/40">Spent</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Joined</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-white/40">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-3">
                          <p className="text-sm text-white font-medium">{customer.name || 'Unnamed Customer'}</p>
                          <p className="text-xs text-white/45">{customer.email}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-white/75">{customer.tier?.name || 'None'}</td>
                        <td className="px-4 py-3 text-sm text-white text-right">{customer.currentPoints.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-white text-right">{customer.orderCount}</td>
                        <td className="px-4 py-3 text-sm text-white text-right">{formatCurrency(customer.totalSpent)}</td>
                        <td className="px-4 py-3 text-sm text-white/65">{new Date(customer.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openAdjustModal(customer)}
                              className="h-8 px-3 inline-flex items-center gap-1 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                            >
                              <Gift size={12} weight="bold" />
                              Points
                            </button>
                            <button
                              type="button"
                              onClick={() => openTierModal(customer)}
                              className="h-8 px-3 inline-flex items-center gap-1 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                            >
                              <Star size={12} weight="bold" />
                              Tier
                            </button>
                            <Link
                              href={`/admin/customers/${customer.id}`}
                              className="h-8 px-3 inline-flex items-center rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lg:hidden divide-y divide-white/10">
                {customers.map((customer) => (
                  <div key={customer.id} className="p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{customer.name || 'Unnamed Customer'}</p>
                      <p className="text-xs text-white/50">{customer.email}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-white/40">Tier</p>
                        <p className="text-white font-medium">{customer.tier?.name || 'None'}</p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-white/40">Points</p>
                        <p className="text-white font-medium">{customer.currentPoints.toLocaleString()}</p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-white/40">Orders</p>
                        <p className="text-white font-medium">{customer.orderCount}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openAdjustModal(customer)}
                        className="h-8 px-3 inline-flex items-center rounded-md border border-white/10 text-xs text-white/70 hover:text-white hover:bg-white/10"
                      >
                        Points
                      </button>
                      <button
                        type="button"
                        onClick={() => openTierModal(customer)}
                        className="h-8 px-3 inline-flex items-center rounded-md border border-white/10 text-xs text-white/70 hover:text-white hover:bg-white/10"
                      >
                        Tier
                      </button>
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="h-8 px-3 inline-flex items-center rounded-md border border-white/10 text-xs text-white/70 hover:text-white hover:bg-white/10"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/45">
                    Page <span className="text-white">{page}</span> of <span className="text-white">{totalPages}</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page === 1}
                      className="h-8 px-3 rounded-md border border-white/10 text-white/65 hover:text-white hover:bg-white/10 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page === totalPages}
                      className="h-8 px-3 rounded-md border border-white/10 text-white/65 hover:text-white hover:bg-white/10 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAdjustModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white">Adjust Points</h3>
            <p className="text-sm text-white/60 mt-1 mb-4">
              {selectedCustomer.name || selectedCustomer.email} currently has {selectedCustomer.currentPoints.toLocaleString()} points.
            </p>
            <div className="space-y-3">
              <input
                value={pointsAdjustment}
                onChange={(event) => setPointsAdjustment(event.target.value)}
                placeholder="Use positive or negative points"
                className="w-full h-10 px-3 rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
              />
              <input
                value={adjustmentReason}
                onChange={(event) => setAdjustmentReason(event.target.value)}
                placeholder="Reason"
                className="w-full h-10 px-3 rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="h-9 px-4 rounded-md border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyPointsAdjustment}
                className="h-9 px-4 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4a4a] disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTierModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white">Change Tier</h3>
            <p className="text-sm text-white/60 mt-1 mb-4">
              Update tier for {selectedCustomer.name || selectedCustomer.email}.
            </p>
            <select
              value={newTierId}
              onChange={(event) => setNewTierId(event.target.value)}
              className="w-full h-10 px-3 rounded-md border border-white/10 bg-white/5 text-white focus:outline-none focus:border-white/30"
            >
              <option value="" className="bg-neutral-900">Select tier</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id} className="bg-neutral-900">
                  {tier.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTierModal(false)}
                className="h-9 px-4 rounded-md border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyTierChange}
                className="h-9 px-4 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4a4a] disabled:opacity-50"
                disabled={submitting || !newTierId}
              >
                {submitting ? 'Saving...' : 'Update Tier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
