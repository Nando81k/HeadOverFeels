'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, MagnifyingGlass, CircleNotch, Star, ArrowUp, ArrowDown, X, Funnel } from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { LoyaltyNav } from '@/components/admin/LoyaltyNav'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface LoyaltyCustomer {
  id: string
  name: string | null
  email: string
  loyaltyPoints: number
  loyaltyTier: string | null
  lifetimeValue: number
  totalOrders: number
  createdAt: string
  lastOrderAt: string | null
}

interface ApiResponse {
  customers: LoyaltyCustomer[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const tierColors: Record<string, string> = {
  head: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  heart: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  mind: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  overdrive: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const tierOptions = [
  { value: '', label: 'All Tiers' },
  { value: 'head', label: 'Head' },
  { value: 'heart', label: 'Heart' },
  { value: 'mind', label: 'Mind' },
  { value: 'overdrive', label: 'Overdrive' },
]

export default function LoyaltyCustomersPage() {
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Modal state
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showTierModal, setShowTierModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<LoyaltyCustomer | null>(null)
  const [pointsAdjustment, setPointsAdjustment] = useState(0)
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [newTier, setNewTier] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(tierFilter && { tier: tierFilter }),
      })
      
      const response = await fetch(`/api/admin/loyalty/customers?${params}`)
      if (response.ok) {
        const data: ApiResponse = await response.json()
        setCustomers(data.customers)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      }
    } catch (err) {
      console.error('Failed to load customers:', err)
    } finally {
      setLoading(false)
    }
  }, [page, search, tierFilter])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const handleAdjustPoints = async () => {
    if (!selectedCustomer || !pointsAdjustment) return
    
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/admin/loyalty/customers/${selectedCustomer.id}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: pointsAdjustment,
          reason: adjustmentReason || 'Manual adjustment',
        }),
      })
      
      if (response.ok) {
        setShowAdjustModal(false)
        setPointsAdjustment(0)
        setAdjustmentReason('')
        setSelectedCustomer(null)
        loadCustomers()
      }
    } catch (err) {
      console.error('Failed to adjust points:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangeTier = async () => {
    if (!selectedCustomer || !newTier) return
    
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/admin/loyalty/customers/${selectedCustomer.id}/tier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: newTier }),
      })
      
      if (response.ok) {
        setShowTierModal(false)
        setNewTier('')
        setSelectedCustomer(null)
        loadCustomers()
      }
    } catch (err) {
      console.error('Failed to change tier:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleDateString()
  }

  return (
    <AdminLayout
      title="Loyalty Customers"
      subtitle={`${total} customers enrolled in the program`}
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <LoyaltyNav />
        
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <MagnifyingGlass size={18} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Funnel size={18} weight="bold" className="text-white/40" />
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-white/30 focus:outline-none"
                >
                  {tierOptions.map(tier => (
                    <option key={tier.value} value={tier.value} className="bg-neutral-900">{tier.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={20} weight="bold" />
              Customers
            </CardTitle>
            <CardDescription>Manage loyalty members and their points</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <CircleNotch size={32} weight="bold" className="animate-spin text-white/30" />
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <Users size={48} weight="light" className="mx-auto mb-4 opacity-50" />
                <p>No customers found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-2 text-sm font-medium text-white/50">Customer</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-white/50">Tier</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-white/50">Points</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-white/50">Orders</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-white/50">Lifetime Value</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-white/50">Last Order</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-white/50">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map(customer => (
                      <tr key={customer.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium text-white">{customer.name || 'Unknown'}</p>
                            <p className="text-sm text-white/50">{customer.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          {customer.loyaltyTier ? (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${tierColors[customer.loyaltyTier] || 'bg-white/10 text-white/70 border-white/20'}`}>
                              {customer.loyaltyTier}
                            </span>
                          ) : (
                            <span className="text-white/30 text-sm">—</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="font-mono text-white">{customer.loyaltyPoints.toLocaleString()}</span>
                        </td>
                        <td className="py-3 px-2 text-right text-white/70">{customer.totalOrders}</td>
                        <td className="py-3 px-2 text-right text-white/70">{formatCurrency(customer.lifetimeValue)}</td>
                        <td className="py-3 px-2 text-white/50 text-sm">{formatDate(customer.lastOrderAt)}</td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCustomer(customer)
                                setShowAdjustModal(true)
                              }}
                              className="gap-1"
                            >
                              <ArrowUp size={14} weight="bold" className="text-green-400" />
                              <ArrowDown size={14} weight="bold" className="text-red-400" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCustomer(customer)
                                setNewTier(customer.loyaltyTier || '')
                                setShowTierModal(true)
                              }}
                            >
                              <Star size={14} weight="bold" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                <p className="text-sm text-white/50">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Adjust Points Modal */}
      {showAdjustModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-xl border border-white/10 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Adjust Points</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-white/70 mb-4">
              Adjusting points for <span className="text-white font-medium">{selectedCustomer.name || selectedCustomer.email}</span>
            </p>
            <p className="text-sm text-white/50 mb-4">
              Current balance: <span className="font-mono text-white">{selectedCustomer.loyaltyPoints.toLocaleString()}</span> points
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Points (+ to add, - to remove)</label>
                <input
                  type="number"
                  value={pointsAdjustment || ''}
                  onChange={(e) => setPointsAdjustment(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="e.g., 100 or -50"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Reason</label>
                <input
                  type="text"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="e.g., Customer appreciation bonus"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleAdjustPoints}
                  disabled={!pointsAdjustment || isSubmitting}
                  className="bg-[#FF3131] hover:bg-[#E02828] flex-1"
                >
                  {isSubmitting ? <CircleNotch size={18} className="animate-spin" /> : 'Apply'}
                </Button>
                <Button variant="outline" onClick={() => setShowAdjustModal(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Tier Modal */}
      {showTierModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-xl border border-white/10 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Change Tier</h3>
              <button onClick={() => setShowTierModal(false)} className="text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-white/70 mb-4">
              Update tier for <span className="text-white font-medium">{selectedCustomer.name || selectedCustomer.email}</span>
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">New Tier</label>
                <select
                  value={newTier}
                  onChange={(e) => setNewTier(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-white/30 focus:outline-none"
                >
                  <option value="" className="bg-neutral-900">Select tier...</option>
                  <option value="head" className="bg-neutral-900">Head</option>
                  <option value="heart" className="bg-neutral-900">Heart</option>
                  <option value="mind" className="bg-neutral-900">Mind</option>
                  <option value="overdrive" className="bg-neutral-900">Overdrive</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleChangeTier}
                  disabled={!newTier || isSubmitting}
                  className="bg-[#FF3131] hover:bg-[#E02828] flex-1"
                >
                  {isSubmitting ? <CircleNotch size={18} className="animate-spin" /> : 'Update Tier'}
                </Button>
                <Button variant="outline" onClick={() => setShowTierModal(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
