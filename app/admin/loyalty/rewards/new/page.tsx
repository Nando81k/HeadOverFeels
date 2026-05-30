'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CircleNotch, Gift } from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { LoyaltyNav } from '@/components/admin/LoyaltyNav'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const rewardTypes = [
  { value: 'DISCOUNT', label: 'Discount' },
  { value: 'FREE_SHIPPING', label: 'Free Shipping' },
  { value: 'EARLY_ACCESS', label: 'Early Access' },
  { value: 'EXCLUSIVE_PRODUCT', label: 'Exclusive Product' },
  { value: 'DIGITAL_CONTENT', label: 'Digital Content' },
  { value: 'PHYSICAL_PERK', label: 'Physical Perk' },
]

const tierOptions = [
  { value: '', label: 'All Tiers' },
  { value: 'head', label: 'Head' },
  { value: 'heart', label: 'Heart' },
  { value: 'mind', label: 'Mind' },
  { value: 'overdrive', label: 'Overdrive' },
]

export default function NewRewardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    pointsCost: 0,
    rewardType: 'DISCOUNT',
    value: 0,
    isActive: true,
    minTierRequired: '',
    maxRedemptionsPerCustomer: '',
    totalAvailable: '',
    image: '',
    metadata: '',
    sortOrder: 0,
  })

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    if (field === 'name' && typeof value === 'string') {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      setFormData(prev => ({ ...prev, slug }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const data = {
        ...formData,
        value: formData.value || null,
        minTierRequired: formData.minTierRequired || null,
        maxRedemptionsPerCustomer: formData.maxRedemptionsPerCustomer 
          ? parseInt(formData.maxRedemptionsPerCustomer) 
          : null,
        totalAvailable: formData.totalAvailable 
          ? parseInt(formData.totalAvailable) 
          : null,
        image: formData.image || null,
        metadata: formData.metadata || null,
      }

      const response = await fetch('/api/admin/loyalty/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const result = await response.json()
        setError(result.error || 'Failed to create reward')
        return
      }

      router.push('/admin/loyalty/rewards')
    } catch (err) {
      console.error('Failed to create reward:', err)
      setError('Failed to create reward')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AdminLayout
      title="Add New Reward"
      subtitle="Create a new reward for the loyalty program"
      headerActions={
        <Link href="/admin/loyalty/rewards">
          <Button variant="outline" className="gap-2">
            <ArrowLeft size={16} weight="bold" />
            Back to Rewards
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <LoyaltyNav />
        
        <div className="max-w-4xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 mb-6 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card variant="dark">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift size={20} weight="bold" />
                Basic Information
              </CardTitle>
              <CardDescription>Core details about the reward</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Reward Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="e.g., $10 Off Next Purchase"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Slug *</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => handleInputChange('slug', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="auto-generated-from-name"
                />
                <p className="text-xs text-white/40 mt-1">URL-friendly identifier (auto-generated)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="Describe what the customer gets with this reward"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Points Cost *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.pointsCost}
                    onChange={(e) => handleInputChange('pointsCost', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Reward Type *</label>
                  <select
                    required
                    value={formData.rewardType}
                    onChange={(e) => handleInputChange('rewardType', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-white/30 focus:outline-none"
                  >
                    {rewardTypes.map(type => (
                      <option key={type.value} value={type.value} className="bg-neutral-900">{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Dollar Value</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => handleInputChange('value', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="For discount rewards"
                />
                <p className="text-xs text-white/40 mt-1">Leave blank for non-monetary rewards</p>
              </div>
            </CardContent>
          </Card>

          {/* Availability & Requirements */}
          <Card variant="dark">
            <CardHeader>
              <CardTitle>Availability & Requirements</CardTitle>
              <CardDescription>Control who can redeem this reward</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Minimum Tier Required</label>
                <select
                  value={formData.minTierRequired}
                  onChange={(e) => handleInputChange('minTierRequired', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-white/30 focus:outline-none"
                >
                  {tierOptions.map(tier => (
                    <option key={tier.value} value={tier.value} className="bg-neutral-900">{tier.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Max Redemptions Per Customer</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxRedemptionsPerCustomer}
                    onChange={(e) => handleInputChange('maxRedemptionsPerCustomer', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                    placeholder="Unlimited"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Total Available</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.totalAvailable}
                    onChange={(e) => handleInputChange('totalAvailable', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <span className="font-medium text-white">Active</span>
                  <p className="text-sm text-white/50">Visible to customers for redemption</p>
                </div>
              </label>
            </CardContent>
          </Card>

          {/* Additional Settings */}
          <Card variant="dark">
            <CardHeader>
              <CardTitle>Additional Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Image URL</label>
                <input
                  type="url"
                  value={formData.image}
                  onChange={(e) => handleInputChange('image', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Sort Order</label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => handleInputChange('sortOrder', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                />
                <p className="text-xs text-white/40 mt-1">Lower numbers appear first</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Metadata (JSON)</label>
                <textarea
                  value={formData.metadata}
                  onChange={(e) => handleInputChange('metadata', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none font-mono text-sm"
                  placeholder='{"key": "value"}'
                />
                <p className="text-xs text-white/40 mt-1">Optional JSON data for special features</p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-[#FF3131] hover:bg-[#E02828]"
            >
              {isLoading ? (
                <>
                  <CircleNotch size={18} weight="bold" className="animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Reward'
              )}
            </Button>
            <Link href="/admin/loyalty/rewards">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
        </div>
      </div>
    </AdminLayout>
  )
}
