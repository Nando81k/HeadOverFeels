'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { 
  Plus, 
  MagnifyingGlass, 
  Percent, 
  Tag, 
  Truck, 
  Gift,
  Trash,
  PencilSimple,
  Copy,
  ToggleRight,
  ToggleLeft,
  Funnel,
  X
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TableSkeleton, StatsGridSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/lib/toast'

type PromotionType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BOGO' | 'BUY_X_GET_Y'

interface Promotion {
  id: string
  name: string
  code: string | null
  type: PromotionType
  value: number
  minimumPurchase: number | null
  maxUsesTotal: number | null
  maxUsesPerCustomer: number | null
  usedCount: number
  isActive: boolean
  autoApply: boolean
  startDate: string
  endDate: string | null
  createdAt: string
}

const typeConfig: Record<PromotionType, { icon: typeof Percent; label: string; color: string }> = {
  PERCENTAGE: { icon: Percent, label: 'Percentage Off', color: 'bg-blue-500/20 text-blue-400' },
  FIXED_AMOUNT: { icon: Tag, label: 'Fixed Amount', color: 'bg-green-500/20 text-green-400' },
  FREE_SHIPPING: { icon: Truck, label: 'Free Shipping', color: 'bg-purple-500/20 text-purple-400' },
  BOGO: { icon: Gift, label: 'Buy One Get One', color: 'bg-amber-500/20 text-amber-400' },
  BUY_X_GET_Y: { icon: Gift, label: 'Buy X Get Y', color: 'bg-pink-500/20 text-pink-400' }
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  
  useEffect(() => {
    fetchPromotions()
  }, [])
  
  const fetchPromotions = async () => {
    try {
      const res = await fetch('/api/promotions?includeExpired=true')
      const data = await res.json()
      setPromotions(data.data || [])
    } catch (error) {
      console.error('Failed to fetch promotions:', error)
      toast.error('Failed to load promotions')
    } finally {
      setLoading(false)
    }
  }
  
  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      await fetch(`/api/promotions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentState })
      })
      setPromotions(prev => 
        prev.map(p => p.id === id ? { ...p, isActive: !currentState } : p)
      )
      toast.success(`Promotion ${!currentState ? 'activated' : 'deactivated'}`)
    } catch (error) {
      console.error('Failed to toggle promotion:', error)
      toast.error('Failed to update promotion')
    }
  }
  
  const deletePromotion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return
    
    try {
      await fetch(`/api/promotions/${id}`, { method: 'DELETE' })
      setPromotions(prev => prev.filter(p => p.id !== id))
      toast.success('Promotion deleted')
    } catch (error) {
      console.error('Failed to delete promotion:', error)
      toast.error('Failed to delete promotion')
    }
  }
  
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success('Code copied to clipboard')
  }
  
  const getStatus = (promo: Promotion): { label: string; color: string } => {
    const now = new Date()
    const start = new Date(promo.startDate)
    const end = promo.endDate ? new Date(promo.endDate) : null
    
    if (!promo.isActive) return { label: 'Inactive', color: 'bg-white/10 text-white/50' }
    if (now < start) return { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-400' }
    if (end && now > end) return { label: 'Expired', color: 'bg-red-500/20 text-red-400' }
    if (promo.maxUsesTotal && promo.usedCount >= promo.maxUsesTotal) {
      return { label: 'Limit Reached', color: 'bg-amber-500/20 text-amber-400' }
    }
    return { label: 'Active', color: 'bg-emerald-500/20 text-emerald-400' }
  }
  
  const formatValue = (promo: Promotion): string => {
    switch (promo.type) {
      case 'PERCENTAGE': return `${promo.value}% off`
      case 'FIXED_AMOUNT': return `$${promo.value} off`
      case 'FREE_SHIPPING': return 'Free Shipping'
      case 'BOGO': return 'Buy 1 Get 1'
      case 'BUY_X_GET_Y': return 'Buy X Get Y'
    }
  }
  
  // Search submit handler
  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    setAppliedSearchQuery(searchQuery)
  }
  
  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('')
    setAppliedSearchQuery('')
    setFilterType('all')
    setFilterStatus('all')
  }
  
  // Filter promotions
  const filtered = promotions.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(appliedSearchQuery.toLowerCase()) ||
                         (p.code?.toLowerCase().includes(appliedSearchQuery.toLowerCase()))
    const matchesType = filterType === 'all' || p.type === filterType
    const status = getStatus(p)
    const matchesStatus = filterStatus === 'all' || status.label.toLowerCase() === filterStatus.toLowerCase()
    return matchesSearch && matchesType && matchesStatus
  })
  
  // Stats
  const activeCount = promotions.filter(p => getStatus(p).label === 'Active').length
  const totalUsage = promotions.reduce((sum, p) => sum + (p.usedCount || 0), 0)
  const hasActiveFilters = appliedSearchQuery || filterType !== 'all' || filterStatus !== 'all'
  
  return (
    <AdminLayout
      title="Promotions"
      subtitle="Manage discount codes and special offers"
      headerActions={
        <Link href="/admin/promotions/new">
          <Button className="bg-[#FF3131] hover:bg-[#E02828]">
            <Plus size={16} weight="bold" className="mr-2" />
            Create Promotion
          </Button>
        </Link>
      }
    >
      {/* Stats Grid */}
      {loading ? (
        <StatsGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 flex items-center gap-1">
                <Tag size={12} />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold text-white">{promotions.length}</div>
              <p className="text-xs text-white/40">Promotions</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">Active</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold text-emerald-400">{activeCount}</div>
              <p className="text-xs text-white/40">Running</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">Usage</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold text-blue-400">{totalUsage}</div>
              <p className="text-xs text-white/40">Times used</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">Auto-Apply</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold text-purple-400">
                {promotions.filter(p => p.autoApply).length}
              </div>
              <p className="text-xs text-white/40">Automatic</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="flex-1">
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/50"
                />
              </div>
            </form>
            
            {/* Filter Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`border-white/10 ${showFilters ? 'bg-white/10' : ''}`}
            >
              <Funnel size={16} className="mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 bg-[#FF3131] text-white text-xs px-1.5 py-0.5 rounded">
                  {[appliedSearchQuery, filterType !== 'all', filterStatus !== 'all'].filter(Boolean).length}
                </span>
              )}
            </Button>
          </div>
          
          {/* Filter Options */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-4 pt-4 mt-4 border-t border-white/10">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 mb-2">Type</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#FF3131]/50"
                    >
                      <option value="all">All Types</option>
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="FIXED_AMOUNT">Fixed Amount</option>
                      <option value="FREE_SHIPPING">Free Shipping</option>
                      <option value="BOGO">BOGO</option>
                      <option value="BUY_X_GET_Y">Buy X Get Y</option>
                    </select>
                  </div>
                  
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 mb-2">Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#FF3131]/50"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                  
                  {hasActiveFilters && (
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        onClick={clearAllFilters}
                        className="text-white/50 hover:text-white"
                      >
                        <X size={16} className="mr-1" />
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
      </CardContent>
      </Card>

      {/* Promotions Table */}
      {loading ? (
        <TableSkeleton rows={5} columns={7} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No promotions found"
          description={hasActiveFilters ? "Try adjusting your search or filters" : "Create your first promotion to get started"}
          action={
            !hasActiveFilters ? { label: "Create Promotion", href: "/admin/promotions/new" } : undefined
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 p-4">Promotion</th>
                  <th className="text-left text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 p-4">Type</th>
                  <th className="text-left text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 p-4">Value</th>
                  <th className="text-left text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 p-4">Code</th>
                  <th className="text-left text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 p-4">Usage</th>
                  <th className="text-left text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 p-4">Status</th>
                  <th className="text-left text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((promo) => {
                    const TypeIcon = typeConfig[promo.type].icon
                    const status = getStatus(promo)
                    
                    return (
                      <motion.tr
                        key={promo.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="p-4">
                          <p className="font-medium text-white">{promo.name}</p>
                          {promo.minimumPurchase && (
                            <p className="text-xs text-white/40">Min: ${promo.minimumPurchase}</p>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${typeConfig[promo.type].color}`}>
                            <TypeIcon size={14} />
                            {typeConfig[promo.type].label}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-white font-medium">{formatValue(promo)}</span>
                        </td>
                        <td className="p-4">
                          {promo.code ? (
                            <button
                              onClick={() => copyCode(promo.code!)}
                              className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded text-sm font-mono text-white/70 hover:bg-white/10 transition-colors group"
                            >
                              {promo.code}
                              <Copy size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ) : (
                            <span className="text-xs text-white/30 italic">Auto-apply</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="text-white">
                            {promo.usedCount || 0}
                            {promo.maxUsesTotal && (
                              <span className="text-white/40"> / {promo.maxUsesTotal}</span>
                            )}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleActive(promo.id, promo.isActive)}
                              className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
                              title={promo.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {promo.isActive ? (
                                <ToggleRight size={20} weight="fill" className="text-emerald-400" />
                              ) : (
                                <ToggleLeft size={20} />
                              )}
                            </button>
                            <Link
                              href={`/admin/promotions/${promo.id}`}
                              className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
                              title="Edit"
                            >
                              <PencilSimple size={18} />
                            </Link>
                            <button
                              onClick={() => deletePromotion(promo.id)}
                              className="p-2 text-white/40 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash size={18} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AdminLayout>
  )
}
