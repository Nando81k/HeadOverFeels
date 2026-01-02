'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CircleNotch } from '@phosphor-icons/react'

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
    
    // Auto-generate slug from name
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
      // Prepare data
      const data = {
        ...formData,
        value: formData.value || null,
        minTierRequired: formData.minTierRequired || null,
        maxRedemptionsPerCustomer: formData.maxRedemptionsPerCustomer ? parseInt(formData.maxRedemptionsPerCustomer as string) : null,
        totalAvailable: formData.totalAvailable ? parseInt(formData.totalAvailable as string) : null,
        image: formData.image || null,
        metadata: formData.metadata || null,
      }

      const response = await fetch('/api/admin/loyalty/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to create reward')
        return
      }

      router.push('/admin/loyalty/rewards')
    } catch (error) {
      console.error('Failed to create reward:', error)
      setError('Failed to create reward')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/loyalty/rewards">
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft size={16} weight="bold" className="mr-2" />
            Back to Rewards
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-[#1A1A1A]">Add New Reward</h1>
        <p className="text-[#6B6B6B] mt-1">Create a new reward for the loyalty program</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Core details about the reward</CardDescription>
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
                placeholder="auto-generated-from-name"
              />
              <p className="text-xs text-[#6B6B6B] mt-1">URL-friendly identifier (auto-generated)</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                placeholder="Describe what the customer gets with this reward"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                  {rewardTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Dollar Value</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.value}
                onChange={(e) => handleInputChange('value', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                placeholder="For discount rewards"
              />
              <p className="text-xs text-[#6B6B6B] mt-1">Leave blank for non-monetary rewards</p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Availability & Requirements</CardTitle>
            <CardDescription>Control who can redeem this reward</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Minimum Tier Required</label>
              <select
                value={formData.minTierRequired}
                onChange={(e) => handleInputChange('minTierRequired', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
              >
                {tierOptions.map(tier => (
                  <option key={tier.value} value={tier.value}>{tier.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Max Redemptions Per Customer</label>
                <input
                  type="number"
                  min="1"
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
                  min="1"
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

        <Card className="mb-6">
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
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent font-mono text-sm"
                placeholder='{"key": "value"}'
              />
              <p className="text-xs text-[#6B6B6B] mt-1">Optional JSON data for special features</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-[#1A1A1A] hover:bg-[#2B2B2B]"
          >
            {isLoading ? (
              <>
                <CircleNotch size={16} weight="bold" className="mr-2 animate-spin" />
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
  )
}
