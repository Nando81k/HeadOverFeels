'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { toast } from '@/lib/toast'
import { 
  Gift, 
  Plus, 
  PencilSimple, 
  Trash, 
  Eye, 
  EyeSlash, 
  CircleNotch, 
  Truck, 
  Lightning, 
  Sparkle, 
  Heart, 
  Download, 
  Package,
  CaretLeft,
  CaretRight
} from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { LoyaltyNav } from '@/components/admin/LoyaltyNav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Reward {
  id: string
  name: string
  slug: string
  description: string | null
  pointsCost: number
  rewardType: string
  value: number | null
  isActive: boolean
  minTierRequired: string | null
  maxRedemptionsPerCustomer: number | null
  totalAvailable: number | null
  totalRedeemed: number
  image: string | null
  sortOrder: number
  _count: {
    redemptions: number
  }
}

const rewardTypeIcons = {
  DISCOUNT: Gift,
  FREE_SHIPPING: Truck,
  EARLY_ACCESS: Lightning,
  EXCLUSIVE_PRODUCT: Sparkle,
  CHARITY_DONATION: Heart,
  DIGITAL_CONTENT: Download,
  PHYSICAL_PERK: Package,
}

const rewardTypeLabels = {
  DISCOUNT: 'Discount',
  FREE_SHIPPING: 'Shipping',
  EARLY_ACCESS: 'Early Access',
  EXCLUSIVE_PRODUCT: 'Exclusive',
  CHARITY_DONATION: 'Charity',
  DIGITAL_CONTENT: 'Digital',
  PHYSICAL_PERK: 'Physical Perk',
}

export default function AdminRewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    totalRedemptions: 0
  })
  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)

  const loadRewards = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('limit', PAGE_SIZE.toString())
      params.append('page', page.toString())

      if (filter !== 'all') {
        params.append('isActive', filter === 'active' ? 'true' : 'false')
      }
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter)
      }

      const response = await fetch(`/api/admin/loyalty/rewards?${params.toString()}`)
      const data = await response.json()
      
      if (Array.isArray(data)) {
        setRewards(data)
        setPageCount(1)
        const active = data.filter(r => r.isActive).length
        const totalRedemptions = data.reduce((sum, r) => sum + r._count.redemptions, 0)
        setStats({
          total: data.length,
          active,
          inactive: data.length - active,
          totalRedemptions
        })
      } else {
        setRewards(data.items || [])
        setPageCount(data.pageCount || 1)
        const active = (data.items || []).filter((r: Reward) => r.isActive).length
        const totalRedemptions = (data.items || []).reduce((sum: number, r: Reward) => sum + r._count.redemptions, 0)
        setStats({
          total: data.total || 0,
          active: active,
          inactive: (data.total || 0) - active,
          totalRedemptions
        })
      }
    } catch (error) {
      console.error('Failed to load rewards:', error)
    } finally {
      setLoading(false)
    }
  }, [filter, categoryFilter, page])

  useEffect(() => {
    loadRewards()
  }, [loadRewards])

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [rewardToDelete, setRewardToDelete] = useState<Reward | null>(null)
  const [deletingReward, setDeletingReward] = useState<string | null>(null)

  const performDeleteReward = async () => {
    if (!rewardToDelete) return
    setDeletingReward(rewardToDelete.id)
    try {
      const response = await fetch(`/api/admin/loyalty/rewards/${rewardToDelete.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error || 'Failed to delete reward')
        return
      }
      toast.success('Reward deleted')
      loadRewards()
    } catch (error) {
      console.error('Failed to delete reward:', error)
      toast.error('Failed to delete reward')
    } finally {
      setDeletingReward(null)
      setConfirmDeleteOpen(false)
      setRewardToDelete(null)
    }
  }

  const handleDelete = (reward: Reward) => {
    setRewardToDelete(reward)
    setConfirmDeleteOpen(true)
  }

  const toggleStatus = async (reward: Reward) => {
    setSavingStatus(prev => ({ ...prev, [reward.id]: true }))
    try {
      const response = await fetch(`/api/admin/loyalty/rewards/${reward.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reward, isActive: !reward.isActive }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || 'Failed to update reward')
        return
      }
      
      toast.success(`Reward ${!reward.isActive ? 'activated' : 'deactivated'}`)
      loadRewards()
    } catch (error) {
      console.error('Failed to update reward:', error)
      toast.error('Failed to update reward')
    } finally {
      setSavingStatus(prev => ({ ...prev, [reward.id]: false }))
    }
  }

  return (
    <AdminLayout
      title="Loyalty Rewards"
      subtitle="Manage rewards that customers can redeem with points"
      headerActions={
        <Link href="/admin/loyalty/rewards/new">
          <Button className="gap-2 bg-[#FF3131] hover:bg-[#E02828]">
            <Plus size={16} weight="bold" />
            Add Reward
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <LoyaltyNav />
        
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card variant="dark">
            <CardContent className="pt-6">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Total Rewards</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </CardContent>
          </Card>
          <Card variant="dark">
            <CardContent className="pt-6">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Active</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
            </CardContent>
          </Card>
          <Card variant="dark">
            <CardContent className="pt-6">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Inactive</p>
              <p className="text-2xl font-bold text-white/60">{stats.inactive}</p>
            </CardContent>
          </Card>
          <Card variant="dark">
            <CardContent className="pt-6">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Total Redemptions</p>
              <p className="text-2xl font-bold text-[#FF3131]">{stats.totalRedemptions}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card variant="dark">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6 flex-wrap">
              <div>
                <label className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2 block">Status</label>
                <div className="flex gap-2">
                  {(['all', 'active', 'inactive'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        filter === status 
                          ? 'bg-[#FF3131] text-white' 
                          : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2 block">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 text-white rounded-lg text-sm focus:border-[#FF3131]/50 focus:outline-none"
                >
                  <option value="all" className="bg-neutral-900">All Categories</option>
                  {Object.entries(rewardTypeLabels).map(([value, label]) => (
                    <option key={value} value={value} className="bg-neutral-900">{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rewards List */}
        <Card variant="dark">
          <CardHeader>
            <CardTitle>Rewards ({rewards.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <CircleNotch size={32} weight="bold" className="animate-spin text-white/30" />
              </div>
            ) : rewards.length === 0 ? (
              <div className="text-center py-16">
                <Gift size={48} weight="bold" className="mx-auto text-white/20 mb-3" />
                <p className="text-white/50">No rewards found</p>
                <Link href="/admin/loyalty/rewards/new">
                  <Button className="mt-4 bg-[#FF3131] hover:bg-[#E02828]">
                    Create Your First Reward
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {rewards.map((reward) => {
                  const Icon = rewardTypeIcons[reward.rewardType as keyof typeof rewardTypeIcons] || Gift
                  return (
                    <div
                      key={reward.id}
                      className="p-6 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            reward.isActive ? 'bg-[#FF3131]/10' : 'bg-white/5'
                          }`}>
                            <Icon className={`w-6 h-6 ${reward.isActive ? 'text-[#FF3131]' : 'text-white/40'}`} weight="bold" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1 flex-wrap">
                              <h3 className="font-bold text-white">{reward.name}</h3>
                              <span className="text-xs text-white/60 bg-white/10 px-2 py-0.5 rounded">
                                {rewardTypeLabels[reward.rewardType as keyof typeof rewardTypeLabels]}
                              </span>
                              {!reward.isActive && (
                                <span className="text-xs text-white/50 bg-white/5 px-2 py-0.5 rounded">
                                  Inactive
                                </span>
                              )}
                              {reward.minTierRequired && (
                                <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded capitalize">
                                  {reward.minTierRequired}+
                                </span>
                              )}
                            </div>
                            
                            <p className="text-sm text-white/50 mb-3">{reward.description}</p>
                            
                            <div className="flex items-center gap-4 text-sm">
                              <span className="font-bold text-white">
                                {reward.pointsCost.toLocaleString()} pts
                              </span>
                              {reward.value && (
                                <span className="text-white/40">
                                  ${reward.value.toFixed(2)} value
                                </span>
                              )}
                              <span className="text-white/40">
                                {reward._count.redemptions} redemptions
                              </span>
                              {reward.totalAvailable && (
                                <span className="text-white/40">
                                  {reward.totalAvailable - reward.totalRedeemed} remaining
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => toggleStatus(reward)}
                            disabled={!!savingStatus[reward.id]}
                            className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                            title={reward.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {savingStatus[reward.id] ? (
                              <CircleNotch size={18} weight="bold" className="animate-spin text-white/60" />
                            ) : reward.isActive ? (
                              <Eye size={18} weight="bold" className="text-emerald-400" />
                            ) : (
                              <EyeSlash size={18} weight="bold" className="text-white/40" />
                            )}
                          </button>
                          
                          <Link href={`/admin/loyalty/rewards/${reward.id}/edit`}>
                            <button className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                              <PencilSimple size={18} weight="bold" className="text-white/60" />
                            </button>
                          </Link>
                          
                          <button
                            onClick={() => handleDelete(reward)}
                            disabled={reward._count.redemptions > 0}
                            className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-rose-500/10 hover:border-rose-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={reward._count.redemptions > 0 ? 'Cannot delete reward with redemptions' : 'Delete reward'}
                          >
                            <Trash size={18} weight="bold" className="text-white/60" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="border-t border-white/5 px-6 py-4 flex items-center justify-between">
                <p className="text-sm text-white/50">Page {page} of {pageCount}</p>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    disabled={page <= 1}
                    className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <CaretLeft size={18} weight="bold" className="text-white/60" />
                  </button>
                  <button 
                    onClick={() => setPage(p => Math.min(pageCount, p + 1))} 
                    disabled={page >= pageCount}
                    className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <CaretRight size={18} weight="bold" className="text-white/60" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        title={rewardToDelete ? `Delete reward "${rewardToDelete.name}"?` : 'Delete reward?'}
        description={rewardToDelete ? `This will delete the reward "${rewardToDelete.name}" and remove it from customer options.` : undefined}
        confirmLabel="Delete Reward"
        loading={!!deletingReward}
        onConfirm={performDeleteReward}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </AdminLayout>
  )
}
