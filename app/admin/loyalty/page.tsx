'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from '@/lib/toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users, 
  Coins, 
  Gift, 
  TrendUp, 
  TrendDown,
  ArrowRight,
  Ticket,
  Truck,
  Eye,
  CircleNotch
} from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { LoyaltyNav } from '@/components/admin/LoyaltyNav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface LoyaltyStats {
  overview: {
    totalMembers: number
    activeMembers: number
    activeMemberPercentage: number
    totalPointsInCirculation: number
    pointsEarnedLast30Days: number
    pointsRedeemedLast30Days: number
    weekOverWeekChange: number
  }
  tierDistribution: Array<{
    tierId: string | null
    tierName: string
    count: number
  }>
  popularRewards: Array<{
    id: string
    name: string
    pointsCost: number
    rewardType: string
    redemptionCount: number
  }>
  recentTransactions: Array<{
    id: string
    customerEmail: string
    customerName: string
    customerTier: string
    type: string
    points: number
    description: string
    createdAt: string
  }>
  recentRedemptions: Array<{
    id: string
    customerEmail: string
    customerName: string
    rewardName: string
    rewardType: string
    pointsSpent: number
    status: string
    couponCode: string | null
    createdAt: string
  }>
  dailyActivity: Array<{
    date: string
    earned: number
    redeemed: number
    count: number
  }>
  tiers: Array<{
    id: string
    name: string
    minPoints: number
  }>
}

interface TierQuick {
  id: string
  name: string
  freeShipping: boolean
  earlyDropAccess: boolean
}

interface RewardQuick {
  id: string
  name: string
  isActive: boolean
  pointsCost?: number
  rewardType?: string
}

export default function AdminLoyaltyPage() {
  const router = useRouter()
  const [stats, setStats] = useState<LoyaltyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tiersQuick, setTiersQuick] = useState<TierQuick[] | null>(null)
  const [rewardsQuick, setRewardsQuick] = useState<RewardQuick[] | null>(null)
  const [savingTiers, setSavingTiers] = useState<Record<string, boolean>>({})
  const [savingRewards, setSavingRewards] = useState<Record<string, boolean>>({})

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/loyalty/stats')

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error('Failed to fetch loyalty stats')
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }, [router])

  const loadQuickControls = async () => {
    try {
      const [tiersRes, rewardsRes] = await Promise.all([
        fetch('/api/admin/loyalty/tiers'),
        fetch('/api/admin/loyalty/rewards?limit=6')
      ])

      if (tiersRes.ok) {
        const t = await tiersRes.json()
        setTiersQuick(t.map((tier: TierQuick) => ({ 
          id: tier.id, 
          name: tier.name, 
          freeShipping: tier.freeShipping, 
          earlyDropAccess: tier.earlyDropAccess 
        })))
      }
      if (rewardsRes.ok) {
        const r = await rewardsRes.json()
        const items = Array.isArray(r) ? r : (r.items || [])
        setRewardsQuick(items.map((reward: RewardQuick & { pointsCost: number; rewardType: string }) => ({ 
          id: reward.id, 
          name: reward.name, 
          isActive: reward.isActive, 
          pointsCost: reward.pointsCost, 
          rewardType: reward.rewardType 
        })))
      }
    } catch (err) {
      console.error('Failed to load quick controls:', err)
    }
  }

  useEffect(() => {
    fetchStats()
    loadQuickControls()
  }, [fetchStats])

  const toggleTierPerk = async (tierId: string, field: 'freeShipping' | 'earlyDropAccess', value: boolean) => {
    setSavingTiers(prev => ({ ...prev, [tierId]: true }))
    try {
      const response = await fetch(`/api/admin/loyalty/tiers/${tierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      })
      if (!response.ok) {
        const data = await response.json()
        toast.error('Failed to update tier', data.error)
        return
      }
      toast.success('Tier perk updated')
      await loadQuickControls()
      await fetchStats()
    } catch (err) {
      console.error('Failed to toggle tier perk:', err)
      toast.error('Failed to update perk')
    } finally {
      setSavingTiers(prev => ({ ...prev, [tierId]: false }))
    }
  }

  const toggleRewardActive = async (rewardId: string, nextActive: boolean) => {
    setSavingRewards(prev => ({ ...prev, [rewardId]: true }))
    try {
      const response = await fetch(`/api/admin/loyalty/rewards/${rewardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive })
      })
      if (!response.ok) {
        const data = await response.json()
        toast.error('Failed to update reward', data.error)
        return
      }
      toast.success(`Reward ${nextActive ? 'activated' : 'deactivated'}`)
      await loadQuickControls()
      await fetchStats()
    } catch (err) {
      console.error('Failed to toggle reward:', err)
      toast.error('Failed to update reward')
    } finally {
      setSavingRewards(prev => ({ ...prev, [rewardId]: false }))
    }
  }
      
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toLocaleString()
  }

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'EARNED': 
      case 'PURCHASE':
      case 'FIRST_PURCHASE':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      case 'REDEEMED':
      case 'REDEMPTION':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
      case 'BONUS':
      case 'TIER_BONUS':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      case 'REFERRAL':
      case 'REFERRAL_GIVE':
      case 'REFERRAL_RECEIVE':
        return 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
      case 'BIRTHDAY': 
        return 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
      case 'ADJUSTMENT':
      case 'ADMIN_ADJUSTMENT':
        return 'bg-white/10 text-white/70 border border-white/20'
      default: 
        return 'bg-white/10 text-white/70 border border-white/20'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      case 'ACTIVE': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      case 'USED': 
      case 'FULFILLED': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      case 'EXPIRED': return 'bg-white/10 text-white/50 border border-white/20'
      default: return 'bg-white/10 text-white/70 border border-white/20'
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Loyalty Program" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <CircleNotch size={48} weight="bold" className="animate-spin text-white/30" />
        </div>
      </AdminLayout>
    )
  }

  if (error || !stats) {
    return (
      <AdminLayout title="Loyalty Program" subtitle="Error loading data">
        <Card>
          <CardContent className="pt-6">
            <p className="text-white/70">{error || 'Failed to load loyalty statistics'}</p>
            <Button onClick={fetchStats} className="mt-4 bg-[#FF3131] hover:bg-[#E02828]">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </AdminLayout>
    )
  }

  const { overview, tierDistribution, popularRewards, recentTransactions, recentRedemptions, dailyActivity } = stats
  const maxDailyPoints = Math.max(...dailyActivity.map(d => Math.max(d.earned, d.redeemed)), 1)

  return (
    <AdminLayout
      title="Loyalty Program"
      subtitle="Manage rewards, tiers, and member engagement"
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <LoyaltyNav />
        
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Members */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-1">Total Members</p>
                  <p className="text-3xl font-bold text-white">{formatNumber(overview.totalMembers)}</p>
                  <p className="text-sm text-white/50 mt-1">
                    {overview.activeMembers} active ({overview.activeMemberPercentage}%)
                  </p>
                </div>
                <div className="w-12 h-12 bg-[#FF3131]/10 rounded-lg flex items-center justify-center">
                  <Users size={24} weight="bold" className="text-[#FF3131]" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Points in Circulation */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-1">Points in Circulation</p>
                  <p className="text-3xl font-bold text-white">{formatNumber(overview.totalPointsInCirculation)}</p>
                  <p className="text-sm text-white/50 mt-1">Total outstanding</p>
                </div>
                <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <Coins size={24} weight="bold" className="text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Points Earned (30d) */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-1">Points Earned (30d)</p>
                  <p className="text-3xl font-bold text-white">+{formatNumber(overview.pointsEarnedLast30Days)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {overview.weekOverWeekChange >= 0 ? (
                      <TrendUp size={16} weight="bold" className="text-emerald-400" />
                    ) : (
                      <TrendDown size={16} weight="bold" className="text-rose-400" />
                    )}
                    <span className={`text-sm ${overview.weekOverWeekChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {overview.weekOverWeekChange >= 0 ? '+' : ''}{overview.weekOverWeekChange}% vs last week
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <TrendUp size={24} weight="bold" className="text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Points Redeemed (30d) */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-1">Points Redeemed (30d)</p>
                  <p className="text-3xl font-bold text-white">{formatNumber(overview.pointsRedeemedLast30Days)}</p>
                  <p className="text-sm text-white/50 mt-1">Rewards claimed</p>
                </div>
                <div className="w-12 h-12 bg-violet-500/10 rounded-lg flex items-center justify-center">
                  <Gift size={24} weight="bold" className="text-violet-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Tier Perks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tier Perks</CardTitle>
                  <p className="text-sm text-white/50 mt-1">Toggle perks for each tier</p>
                </div>
                <Link href="/admin/loyalty/tiers" className="text-sm font-medium text-white/60 hover:text-white transition-colors flex items-center gap-1">
                  Manage <ArrowRight size={14} weight="bold" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {tiersQuick === null ? (
                <div className="flex items-center justify-center py-8">
                  <CircleNotch size={24} weight="bold" className="animate-spin text-white/30" />
                </div>
              ) : tiersQuick.length === 0 ? (
                <p className="text-sm text-white/50 text-center py-8">No tiers found</p>
              ) : (
                tiersQuick.map((tier) => (
                  <div key={tier.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{tier.name}</p>
                      <p className="text-xs text-white/50">Quick perks</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleTierPerk(tier.id, 'freeShipping', !tier.freeShipping)}
                        disabled={!!savingTiers[tier.id]}
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                          tier.freeShipping 
                            ? 'bg-[#FF3131] text-white' 
                            : 'bg-white/5 border border-white/10 text-white/60 hover:border-white/30'
                        }`}
                      >
                        {savingTiers[tier.id] ? (
                          <CircleNotch size={14} weight="bold" className="animate-spin" />
                        ) : (
                          <Truck size={14} weight="bold" />
                        )}
                        Free Shipping
                      </button>
                      <button
                        onClick={() => toggleTierPerk(tier.id, 'earlyDropAccess', !tier.earlyDropAccess)}
                        disabled={!!savingTiers[tier.id]}
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                          tier.earlyDropAccess 
                            ? 'bg-[#FF3131] text-white' 
                            : 'bg-white/5 border border-white/10 text-white/60 hover:border-white/30'
                        }`}
                      >
                        {savingTiers[tier.id] ? (
                          <CircleNotch size={14} weight="bold" className="animate-spin" />
                        ) : (
                          <Eye size={14} weight="bold" />
                        )}
                        Early Access
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Quick Rewards */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Quick Rewards</CardTitle>
                  <p className="text-sm text-white/50 mt-1">Enable/disable rewards quickly</p>
                </div>
                <Link href="/admin/loyalty/rewards" className="text-sm font-medium text-white/60 hover:text-white transition-colors flex items-center gap-1">
                  Manage <ArrowRight size={14} weight="bold" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {rewardsQuick === null ? (
                <div className="flex items-center justify-center py-8">
                  <CircleNotch size={24} weight="bold" className="animate-spin text-white/30" />
                </div>
              ) : rewardsQuick.length === 0 ? (
                <p className="text-sm text-white/50 text-center py-8">No rewards found</p>
              ) : (
                rewardsQuick.map((reward) => (
                  <div key={reward.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{reward.name}</p>
                      <p className="text-xs text-white/50">{reward.pointsCost ? `${reward.pointsCost.toLocaleString()} pts` : reward.rewardType}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleRewardActive(reward.id, !reward.isActive)}
                        disabled={!!savingRewards[reward.id]}
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                          reward.isActive 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-white/5 border border-white/10 text-white/60 hover:border-white/30'
                        }`}
                      >
                        {savingRewards[reward.id] ? (
                          <CircleNotch size={14} weight="bold" className="animate-spin" />
                        ) : (
                          reward.isActive ? 'Active' : 'Inactive'
                        )}
                      </button>
                      <Link 
                        href={`/admin/loyalty/rewards/${reward.id}/edit`} 
                        className="px-3 py-2 text-xs font-medium text-white/60 hover:text-white transition-colors"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Points Activity Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Points Activity (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end gap-1">
                {dailyActivity.slice(-30).map((day) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
                    <div 
                      className="w-full bg-[#FF3131] rounded-t transition-all hover:bg-[#FF3131]/80"
                      style={{ height: `${(day.earned / maxDailyPoints) * 100}%`, minHeight: day.earned > 0 ? '4px' : '0' }}
                      title={`${day.date}: ${day.earned} earned`}
                    />
                    <div 
                      className="w-full bg-white/30 rounded-t transition-all hover:bg-white/40"
                      style={{ height: `${(day.redeemed / maxDailyPoints) * 100}%`, minHeight: day.redeemed > 0 ? '4px' : '0' }}
                      title={`${day.date}: ${day.redeemed} redeemed`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#FF3131] rounded" />
                  <span className="text-sm text-white/60 font-medium">Earned</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-white/30 rounded" />
                  <span className="text-sm text-white/60 font-medium">Redeemed</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tier Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Tier Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tierDistribution.map((tier, index) => {
                const totalInTiers = tierDistribution.reduce((sum, t) => sum + t.count, 0)
                const percentage = totalInTiers > 0 ? (tier.count / totalInTiers) * 100 : 0
                const colors = ['bg-[#FF3131]', 'bg-rose-400', 'bg-violet-400', 'bg-amber-400', 'bg-emerald-400']
                
                return (
                  <div key={tier.tierId || 'no-tier'}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-white">{tier.tierName}</span>
                      <span className="text-white/50 font-medium">{tier.count} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-2 ${colors[index % colors.length]} transition-all rounded-full`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Popular Rewards and Recent Redemptions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Popular Rewards */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Popular Rewards</CardTitle>
                <Link href="/admin/loyalty/rewards" className="text-sm font-medium text-white/60 hover:text-white transition-colors flex items-center gap-1">
                  View All <ArrowRight size={14} weight="bold" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {popularRewards.length === 0 ? (
                <p className="text-white/50 text-center py-8">No rewards redeemed yet</p>
              ) : (
                popularRewards.map((reward, index) => (
                  <div key={reward.id} className="flex items-center justify-between p-4 bg-white/5 border-l-4 border-l-[#FF3131] rounded-r-lg hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#FF3131]">#{index + 1}</span>
                      <div>
                        <p className="font-medium text-white">{reward.name}</p>
                        <p className="text-sm text-white/50">{reward.pointsCost.toLocaleString()} pts</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white">{reward.redemptionCount}</p>
                      <p className="text-xs text-white/50">redemptions</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Redemptions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Redemptions</CardTitle>
                <Link href="/admin/loyalty/redemptions" className="text-sm font-medium text-white/60 hover:text-white transition-colors flex items-center gap-1">
                  View All <ArrowRight size={14} weight="bold" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-80 overflow-y-auto">
              {recentRedemptions.length === 0 ? (
                <p className="text-white/50 text-center py-8">No redemptions yet</p>
              ) : (
                recentRedemptions.map((redemption) => (
                  <div key={redemption.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                    <div>
                      <p className="font-medium text-white">{redemption.rewardName}</p>
                      <p className="text-sm text-white/50">{redemption.customerName}</p>
                      {redemption.couponCode && (
                        <p className="text-xs text-white/60 font-mono mt-1 flex items-center gap-1">
                          <Ticket size={12} weight="bold" />
                          {redemption.couponCode}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(redemption.status)}`}>
                        {redemption.status}
                      </span>
                      <p className="text-xs text-white/50 mt-1">
                        {new Date(redemption.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Point Transactions</CardTitle>
              <Link href="/admin/loyalty/transactions" className="text-sm font-medium text-white/60 hover:text-white transition-colors flex items-center gap-1">
                View All <ArrowRight size={14} weight="bold" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs font-medium text-white/50 uppercase tracking-wide px-4 py-3">Customer</th>
                    <th className="text-left text-xs font-medium text-white/50 uppercase tracking-wide px-4 py-3">Tier</th>
                    <th className="text-left text-xs font-medium text-white/50 uppercase tracking-wide px-4 py-3">Type</th>
                    <th className="text-left text-xs font-medium text-white/50 uppercase tracking-wide px-4 py-3">Description</th>
                    <th className="text-right text-xs font-medium text-white/50 uppercase tracking-wide px-4 py-3">Points</th>
                    <th className="text-right text-xs font-medium text-white/50 uppercase tracking-wide px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-white/50">
                        No transactions yet
                      </td>
                    </tr>
                  ) : (
                    recentTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-white">{transaction.customerName}</p>
                            <p className="text-sm text-white/50">{transaction.customerEmail}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 text-xs font-medium bg-white/10 text-white/70 rounded-full">
                            {transaction.customerTier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTransactionTypeColor(transaction.type)}`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-white/60 max-w-xs truncate">
                          {transaction.description}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${transaction.points >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {transaction.points >= 0 ? '+' : ''}{transaction.points.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-white/50">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
