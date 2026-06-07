'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CircleNotch, PencilSimple } from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { LoyaltyNav } from '@/components/admin/LoyaltyNav'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface FormData {
  name: string
  slug: string
  description: string
  pointsCost: number
  rewardType: string
  value: number | string
  isActive: boolean
  minTierRequired: string
  maxRedemptionsPerCustomer: number | string
  totalAvailable: number | string
  image: string
  metadata: string
  sortOrder: number
}

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

export function AdminLoyaltyRewardEditV1Page() {
  const router = useRouter()
  const params = useParams()
  const rewardId = params.id as string

  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState<FormData>({
    name: '',
    slug: '',
    description: '',
    pointsCost: 0,
    rewardType: 'DISCOUNT',
    value: '',
    isActive: true,
    minTierRequired: '',
    maxRedemptionsPerCustomer: '',
    totalAvailable: '',
    image: '',
    metadata: '',
    sortOrder: 0,
  })

  const getStringValue = (val: unknown, fallback = ''): string =>
    (val as string) || fallback

  const getNumberValue = (val: unknown, fallback = 0): number =>
    (val as number) || fallback

  const getNullableValue = (val: unknown): number | string =>
    val !== null ? (val as number | string) : ''

  const mapRewardToFormData = (reward: Record<string, unknown>): FormData => ({
    name: getStringValue(reward.name),
    slug: getStringValue(reward.slug),
    description: getStringValue(reward.description),
    pointsCost: getNumberValue(reward.pointsCost),
    rewardType: getStringValue(reward.rewardType, 'DISCOUNT'),
    value: getNullableValue(reward.value),
    isActive: (reward.isActive as boolean) ?? true,
    minTierRequired: getStringValue(reward.minTierRequired),
    maxRedemptionsPerCustomer: getNullableValue(reward.maxRedemptionsPerCustomer),
    totalAvailable: getNullableValue(reward.totalAvailable),
    image: getStringValue(reward.image),
    metadata: getStringValue(reward.metadata),
    sortOrder: getNumberValue(reward.sortOrder),
  })

  const loadReward = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/loyalty/rewards/${rewardId}`)

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to load reward')
        return
      }

      const reward = await response.json()
      setFormData(mapRewardToFormData(reward))
    } catch (err) {
      console.error('Failed to load reward:', err)
      setError('Failed to load reward')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReward()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewardId])

  const handleInputChange = (field: keyof FormData, value: string | number | boolean) => {
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
    setIsSubmitting(true)
    setError('')

    try {
      const data = {
        ...formData,
        value: formData.value !== '' ? formData.value : null,
        minTierRequired: formData.minTierRequired || null,
        maxRedemptionsPerCustomer: formData.maxRedemptionsPerCustomer !== ''
          ? parseInt(formData.maxRedemptionsPerCustomer as string)
          : null,
        totalAvailable: formData.totalAvailable !== ''
          ? parseInt(formData.totalAvailable as string)
          : null,
        image: formData.image || null,
        metadata: formData.metadata || null,
      }

      const response = await fetch(`/api/admin/loyalty/rewards/${rewardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const result = await response.json()
        setError(result.error || 'Failed to update reward')
        return
      }

      router.push('/admin/loyalty/rewards')
    } catch (err) {
      console.error('Failed to update reward:', err)
      setError('Failed to update reward')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Edit Reward" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <CircleNotch size={32} weight="bold" className="animate-spin text-white/30" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title="Edit Reward"
      subtitle="Update reward details and settings"
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
                <PencilSimple size={20} weight="bold" />
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
                <p className="text-xs text-white/40 mt-1">URL-friendly identifier</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="Describe what the customer gets"
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
                  step="0.01"
                  min="0"
                  value={formData.value}
                  onChange={(e) => handleInputChange('value', e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="For discount rewards"
                />
              </div>
            </CardContent>
          </Card>

          {/* Availability & Requirements */}
          <Card variant="dark">
            <CardHeader>
              <CardTitle>Availability &amp; Requirements</CardTitle>
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
                    min="0"
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
                    min="0"
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
                  rows={4}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none font-mono text-sm"
                  placeholder='{"key": "value"}'
                />
                <p className="text-xs text-white/40 mt-1">Optional JSON data for special reward properties</p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#FF3131] hover:bg-[#E02828]"
            >
              {isSubmitting ? (
                <>
                  <CircleNotch size={18} weight="bold" className="animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
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
