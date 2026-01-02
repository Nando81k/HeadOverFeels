'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CircleNotch } from '@phosphor-icons/react'

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

export default function EditRewardPage() {
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
      
      setFormData({
        name: reward.name || '',
        slug: reward.slug || '',
        description: reward.description || '',
        pointsCost: reward.pointsCost || 0,
        rewardType: reward.rewardType || 'DISCOUNT',
        value: reward.value !== null ? reward.value : '',
        isActive: reward.isActive ?? true,
        minTierRequired: reward.minTierRequired || '',
        maxRedemptionsPerCustomer: reward.maxRedemptionsPerCustomer !== null ? reward.maxRedemptionsPerCustomer : '',
        totalAvailable: reward.totalAvailable !== null ? reward.totalAvailable : '',
        image: reward.image || '',
        metadata: reward.metadata || '',
        sortOrder: reward.sortOrder || 0,
      })
    } catch (error) {
      console.error('Failed to load reward:', error)
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
    
    // Auto-generate slug from name (but allow manual override)
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
      // Prepare data with proper null handling
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
    } catch (error) {
      console.error('Failed to update reward:', error)
      setError('Failed to update reward')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <CircleNotch size={32} weight="bold" className="animate-spin text-[#6B6B6B]" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/admin/loyalty/rewards"
          className="inline-flex items-center text-sm text-[#6B6B6B] hover:text-[#1A1A1A] mb-2"
        >
          <ArrowLeft size={16} weight="bold" className="mr-1" />
          Back to Rewards
        </Link>
        <h1 className="text-3xl font-bold text-[#1A1A1A]">Edit Reward</h1>
        <p className="text-[#6B6B6B] mt-1">Update reward details and settings</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Reward Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                placeholder="e.g., $10 Off Next Purchase"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Slug *</label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => handleInputChange('slug', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                placeholder="e.g., 10-off-next-purchase"
              />
              <p className="text-xs text-[#6B6B6B] mt-1">Auto-generated from name, but can be customized</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                placeholder="Describe what the customer gets..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Points Cost *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.pointsCost}
                  onChange={(e) => handleInputChange('pointsCost', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Reward Type *</label>
                <select
                  required
                  value={formData.rewardType}
                  onChange={(e) => handleInputChange('rewardType', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                >
                  <option value="DISCOUNT">Discount</option>
                  <option value="FREE_SHIPPING">Free Shipping</option>
                  <option value="EARLY_ACCESS">Early Access</option>
                  <option value="EXCLUSIVE_PRODUCT">Exclusive Product</option>
                  <option value="DIGITAL_CONTENT">Digital Content</option>
                  <option value="PHYSICAL_PERK">Physical Perk</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Dollar Value</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.value}
                  onChange={(e) => handleInputChange('value', e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                  placeholder="For discount rewards"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Availability & Requirements */}
        <Card>
          <CardHeader>
            <CardTitle>Availability & Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Minimum Tier Required</label>
                <select
                  value={formData.minTierRequired}
                  onChange={(e) => handleInputChange('minTierRequired', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                >
                  <option value="">All Tiers</option>
                  <option value="head">Head Tier</option>
                  <option value="heart">Heart Tier</option>
                  <option value="mind">Mind Tier</option>
                  <option value="overdrive">Overdrive Tier</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Redemptions Per Customer</label>
                <input
                  type="number"
                  min="0"
                  value={formData.maxRedemptionsPerCustomer}
                  onChange={(e) => handleInputChange('maxRedemptionsPerCustomer', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                  placeholder="Unlimited"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Total Available</label>
                <input
                  type="number"
                  min="0"
                  value={formData.totalAvailable}
                  onChange={(e) => handleInputChange('totalAvailable', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                Active (visible to customers)
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Additional Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Image URL</label>
              <input
                type="url"
                value={formData.image}
                onChange={(e) => handleInputChange('image', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Sort Order</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => handleInputChange('sortOrder', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
              />
              <p className="text-xs text-[#6B6B6B] mt-1">Lower numbers appear first</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Metadata (JSON)</label>
              <textarea
                value={formData.metadata}
                onChange={(e) => handleInputChange('metadata', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent font-mono text-sm"
                placeholder='{"key": "value"}'
              />
              <p className="text-xs text-[#6B6B6B] mt-1">Optional JSON data for special reward properties</p>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#1A1A1A] hover:bg-[#2B2B2B] text-white px-6"
          >
            {isSubmitting ? (
              <>
                <CircleNotch size={16} weight="bold" className="mr-2 animate-spin" />
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
  )
}
