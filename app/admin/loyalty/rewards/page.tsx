'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Gift, Plus, PencilSimple, Trash, Eye, EyeSlash, CircleNotch, Medal, Truck, Lightning, Sparkle, Heart, Download, Package } from '@phosphor-icons/react'

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
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    totalRedemptions: 0
  })

  useEffect(() => {
    loadRewards()
  }, [filter, categoryFilter])

  const loadRewards = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
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
        
        // Calculate stats
        const active = data.filter(r => r.isActive).length
        const totalRedemptions = data.reduce((sum, r) => sum + r._count.redemptions, 0)
        
        setStats({
          total: data.length,
          active,
          inactive: data.length - active,
          totalRedemptions
        })
      }
    } catch (error) {
      console.error('Failed to load rewards:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reward?')) return
    
    try {
      const response = await fetch(`/api/admin/loyalty/rewards/${id}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        alert(data.error || 'Failed to delete reward')
        return
      }
      
      loadRewards()
    } catch (error) {
      console.error('Failed to delete reward:', error)
      alert('Failed to delete reward')
    }
  }

  const toggleStatus = async (reward: Reward) => {
    try {
      const response = await fetch(`/api/admin/loyalty/rewards/${reward.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reward, isActive: !reward.isActive }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to update reward')
        return
      }
      
      loadRewards()
    } catch (error) {
      console.error('Failed to update reward:', error)
      alert('Failed to update reward')
    }
  }

  const filteredRewards = rewards

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Loyalty Rewards</h1>
          <p className="text-[#6B6B6B] mt-1">Manage rewards that customers can redeem with points</p>
        </div>
        <Link href="/admin/loyalty/rewards/new">
          <Button className="bg-[#1A1A1A] hover:bg-[#2B2B2B]">
            <Plus size={16} weight="bold" className="mr-2" />
            Add Reward
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Rewards</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Inactive</CardDescription>
            <CardTitle className="text-3xl text-orange-600">{stats.inactive}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Redemptions</CardDescription>
            <CardTitle className="text-3xl text-purple-600">{stats.totalRedemptions}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <div className="flex gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('active')}
                >
                  Active
                </Button>
                <Button
                  variant={filter === 'inactive' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('inactive')}
                >
                  Inactive
                </Button>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="all">All Categories</option>
                {Object.entries(rewardTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rewards List */}
      <Card>
        <CardHeader>
          <CardTitle>Rewards ({filteredRewards.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <CircleNotch size={32} weight="bold" className="animate-spin text-[#6B6B6B]" />
            </div>
          ) : filteredRewards.length === 0 ? (
            <div className="text-center py-12">
              <Gift size={48} weight="bold" className="mx-auto text-[#6B6B6B] mb-3" />
              <p className="text-[#6B6B6B]">No rewards found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRewards.map((reward) => {
                const Icon = rewardTypeIcons[reward.rewardType as keyof typeof rewardTypeIcons] || Gift
                return (
                  <div
                    key={reward.id}
                    className="border rounded-lg p-4 hover:bg-[#F5F1EB] transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          reward.isActive ? 'bg-[#1A1A1A]' : 'bg-gray-300'
                        }`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-[#1A1A1A]">{reward.name}</h3>
                            <span className="text-sm text-[#6B6B6B] bg-[#F5F1EB] px-2 py-0.5 rounded">
                              {rewardTypeLabels[reward.rewardType as keyof typeof rewardTypeLabels]}
                            </span>
                            {!reward.isActive && (
                              <span className="text-sm text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                                Inactive
                              </span>
                            )}
                            {reward.minTierRequired && (
                              <span className="text-sm text-purple-600 bg-purple-100 px-2 py-0.5 rounded capitalize">
                                {reward.minTierRequired}+
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-[#6B6B6B] mb-2">{reward.description}</p>
                          
                          <div className="flex items-center gap-4 text-sm">
                            <span className="font-medium text-[#1A1A1A]">
                              {reward.pointsCost.toLocaleString()} points
                            </span>
                            {reward.value && (
                              <span className="text-[#6B6B6B]">
                                ${reward.value.toFixed(2)} value
                              </span>
                            )}
                            <span className="text-[#6B6B6B]">
                              {reward._count.redemptions} redemptions
                            </span>
                            {reward.totalAvailable && (
                              <span className="text-[#6B6B6B]">
                                {reward.totalAvailable - reward.totalRedeemed} remaining
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleStatus(reward)}
                          title={reward.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {reward.isActive ? (
                            <Eye size={16} weight="bold" />
                          ) : (
                            <EyeSlash size={16} weight="bold" />
                          )}
                        </Button>
                        
                        <Link href={`/admin/loyalty/rewards/${reward.id}/edit`}>
                          <Button variant="outline" size="sm">
                            <PencilSimple size={16} weight="bold" />
                          </Button>
                        </Link>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(reward.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={reward._count.redemptions > 0}
                          title={reward._count.redemptions > 0 ? 'Cannot delete reward with redemptions' : 'Delete reward'}
                        >
                          <Trash size={16} weight="bold" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="mt-6 flex gap-4">
        <Link href="/admin/loyalty/tiers">
          <Button variant="outline">
            <Medal size={16} weight="bold" className="mr-2" />
            Manage Tiers
          </Button>
        </Link>
        <Link href="/admin">
          <Button variant="outline">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}
