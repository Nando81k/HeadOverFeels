'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  MagnifyingGlass,
  Users,
  Crown,
  Coins,
  PencilSimple,
  Plus,
  Minus,
  Faders,
  CaretDown,
  X,
  Check,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react'

interface Customer {
  id: string
  email: string
  name: string | null
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
  totalSpent: number
  tier: {
    id: string
    name: string
  } | null
  orderCount: number
  transactionCount: number
  redemptionCount: number
  createdAt: string
}

interface Tier {
  id: string
  name: string
}

interface CustomerData {
  data: Customer[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasMore: boolean
  }
  tiers: Tier[]
}

export default function AdminCustomersPage() {
  const router = useRouter()
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [search, setSearch] = useState('')
  const [selectedTier, setSelectedTier] = useState('')
  const [sortBy, setSortBy] = useState('currentPoints')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  
  // Modal state
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [modalMode, setModalMode] = useState<'points' | 'tier' | null>(null)
  const [pointsAmount, setPointsAmount] = useState('')
  const [pointsReason, setPointsReason] = useState('')
  const [newTierId, setNewTierId] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        sortBy,
        sortOrder,
      })
      
      if (search) params.set('search', search)
      if (selectedTier) params.set('tier', selectedTier)

      const response = await fetch(`/api/admin/loyalty/customers?${params}`)
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error('Failed to fetch customers')
      }

      const data = await response.json()
      setCustomerData(data)
    } catch (err) {
      console.error('Error fetching customers:', err)
      setError('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [page, search, selectedTier, sortBy, sortOrder, router])

  useEffect(() => {
    const debounce = setTimeout(fetchCustomers, 300)
    return () => clearTimeout(debounce)
  }, [fetchCustomers])

  const openPointsModal = (customer: Customer) => {
    setEditingCustomer(customer)
    setModalMode('points')
    setPointsAmount('')
    setPointsReason('')
  }

  const openTierModal = (customer: Customer) => {
    setEditingCustomer(customer)
    setModalMode('tier')
    setNewTierId(customer.tier?.id || '')
  }

  const closeModal = () => {
    setEditingCustomer(null)
    setModalMode(null)
    setPointsAmount('')
    setPointsReason('')
    setNewTierId('')
  }

  const handleAdjustPoints = async () => {
    if (!editingCustomer || !pointsAmount) return

    try {
      setSaving(true)
      const response = await fetch('/api/admin/loyalty/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: editingCustomer.id,
          action: 'adjustPoints',
          points: parseInt(pointsAmount),
          reason: pointsReason || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to adjust points')
      }

      await fetchCustomers()
      closeModal()
    } catch (err) {
      console.error('Error adjusting points:', err)
      setError('Failed to adjust points')
    } finally {
      setSaving(false)
    }
  }

  const handleChangeTier = async () => {
    if (!editingCustomer || !newTierId) return

    try {
      setSaving(true)
      const response = await fetch('/api/admin/loyalty/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: editingCustomer.id,
          action: 'changeTier',
          tierId: newTierId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to change tier')
      }

      await fetchCustomers()
      closeModal()
    } catch (err) {
      console.error('Error changing tier:', err)
      setError('Failed to change tier')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getTierColor = (tierName: string | null) => {
    const colorMap: Record<string, string> = {
      Head: 'bg-gray-100 text-gray-800',
      Heart: 'bg-purple-100 text-purple-800',
      Mind: 'bg-blue-100 text-blue-800',
      Overdrive: 'bg-yellow-100 text-yellow-800',
    }
    return colorMap[tierName || ''] || 'bg-gray-100 text-gray-600'
  }

  if (loading && !customerData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/admin/loyalty"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-6 h-6 text-purple-600" weight="fill" />
                  Customer Management
                </h1>
                <p className="text-gray-500 mt-1">View and manage customer loyalty status</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Tier Filter */}
            <div className="relative">
              <select
                value={selectedTier}
                onChange={(e) => { setSelectedTier(e.target.value); setPage(1) }}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">All Tiers</option>
                {customerData?.tiers.map(tier => (
                  <option key={tier.id} value={tier.id}>{tier.name}</option>
                ))}
              </select>
              <CaretDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <Faders className="text-gray-400 w-4 h-4" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="currentPoints">Current Points</option>
                <option value="lifetimePoints">Lifetime Points</option>
                <option value="totalSpent">Total Spent</option>
                <option value="createdAt">Join Date</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {sortOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 text-sm underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Customers Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">Customer</th>
                  <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">Tier</th>
                  <th className="text-right text-sm font-medium text-gray-500 px-4 py-3">Current Points</th>
                  <th className="text-right text-sm font-medium text-gray-500 px-4 py-3">Lifetime Points</th>
                  <th className="text-right text-sm font-medium text-gray-500 px-4 py-3">Total Spent</th>
                  <th className="text-center text-sm font-medium text-gray-500 px-4 py-3">Orders</th>
                  <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">Joined</th>
                  <th className="text-center text-sm font-medium text-gray-500 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customerData?.data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No customers found</p>
                    </td>
                  </tr>
                ) : (
                  customerData?.data.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{customer.name || 'No Name'}</p>
                          <p className="text-sm text-gray-500">{customer.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {customer.tier ? (
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${getTierColor(customer.tier.name)}`}>
                            {customer.tier.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">No Tier</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-purple-600">
                          {customer.currentPoints.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {customer.lifetimePoints.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        ${customer.totalSpent.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {customer.orderCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(customer.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openPointsModal(customer)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Adjust Points"
                          >
                            <Coins className="w-5 h-5" weight="fill" />
                          </button>
                          <button
                            onClick={() => openTierModal(customer)}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Change Tier"
                          >
                            <Crown className="w-5 h-5" weight="fill" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {customerData && customerData.pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Showing {((page - 1) * customerData.pagination.limit) + 1} to {Math.min(page * customerData.pagination.limit, customerData.pagination.total)} of {customerData.pagination.total} customers
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CaretLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {customerData.pagination.pages}
                </span>
                <button
                  onClick={() => setPage(Math.min(customerData.pagination.pages, page + 1))}
                  disabled={page === customerData.pagination.pages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CaretRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Points Adjustment Modal */}
      {modalMode === 'points' && editingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Coins className="w-5 h-5 text-green-600" weight="fill" />
                Adjust Points
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Adjusting points for <strong>{editingCustomer.name || editingCustomer.email}</strong>
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Current balance: <span className="font-semibold text-purple-600">{editingCustomer.currentPoints.toLocaleString()} points</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Points Amount
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPointsAmount(prev => {
                        const val = parseInt(prev) || 0
                        return String(val >= 0 ? -Math.abs(val || 100) : val)
                      })}
                      className={`px-4 py-2 rounded-lg border ${
                        parseInt(pointsAmount) < 0 
                          ? 'bg-red-100 border-red-300 text-red-700' 
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Minus weight="bold" />
                    </button>
                    <input
                      type="number"
                      value={pointsAmount}
                      onChange={(e) => setPointsAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => setPointsAmount(prev => {
                        const val = parseInt(prev) || 0
                        return String(val <= 0 ? Math.abs(val || 100) : val)
                      })}
                      className={`px-4 py-2 rounded-lg border ${
                        parseInt(pointsAmount) > 0 
                          ? 'bg-green-100 border-green-300 text-green-700' 
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Plus weight="bold" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    value={pointsReason}
                    onChange={(e) => setPointsReason(e.target.value)}
                    placeholder="e.g., Customer service gesture"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {pointsAmount && (
                  <div className={`p-4 rounded-lg ${parseInt(pointsAmount) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className={`text-sm font-medium ${parseInt(pointsAmount) >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                      New balance will be: {(editingCustomer.currentPoints + parseInt(pointsAmount || '0')).toLocaleString()} points
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustPoints}
                disabled={!pointsAmount || saving}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check weight="bold" />
                    Apply
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tier Change Modal */}
      {modalMode === 'tier' && editingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Crown className="w-5 h-5 text-purple-600" weight="fill" />
                Change Tier
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Changing tier for <strong>{editingCustomer.name || editingCustomer.email}</strong>
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Current tier: <span className={`font-semibold px-2 py-0.5 rounded-full ${editingCustomer.tier ? getTierColor(editingCustomer.tier.name) : 'bg-gray-100 text-gray-600'}`}>
                  {editingCustomer.tier?.name || 'None'}
                </span>
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select New Tier
                </label>
                <div className="space-y-2">
                  {customerData?.tiers.map(tier => (
                    <button
                      key={tier.id}
                      onClick={() => setNewTierId(tier.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        newTierId === tier.id 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getTierColor(tier.name)}`}>
                        {tier.name}
                      </span>
                      {newTierId === tier.id && (
                        <Check className="w-5 h-5 text-purple-600" weight="bold" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeTier}
                disabled={!newTierId || newTierId === editingCustomer.tier?.id || saving}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check weight="bold" />
                    Apply
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
