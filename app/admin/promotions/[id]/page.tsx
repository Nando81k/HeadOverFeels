'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Percent, 
  Tag, 
  Truck, 
  Gift,
  Calendar,
  Users,
  ShoppingBag,
  Info,
  ChartLine
} from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Button } from '@/components/ui/button'

type PromotionType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BOGO' | 'BUY_X_GET_Y'

interface FormData {
  name: string
  description: string
  code: string
  type: PromotionType
  value: number
  minPurchase: number | null
  maxDiscount: number | null
  usageLimit: number | null
  usageCount: number
  isActive: boolean
  autoApply: boolean
  startDate: string
  endDate: string
  productIds: string[]
  collectionIds: string[]
  customerEmails: string[]
  excludeSaleItems: boolean
  firstTimeOnly: boolean
}

const typeOptions = [
  { value: 'PERCENTAGE', label: 'Percentage Off', icon: Percent, description: 'e.g., 20% off entire order' },
  { value: 'FIXED_AMOUNT', label: 'Fixed Amount', icon: Tag, description: 'e.g., $10 off your order' },
  { value: 'FREE_SHIPPING', label: 'Free Shipping', icon: Truck, description: 'Waive shipping costs' },
  { value: 'BOGO', label: 'Buy One Get One', icon: Gift, description: 'Buy one item, get another free' },
  { value: 'BUY_X_GET_Y', label: 'Buy X Get Y', icon: Gift, description: 'Buy X items, get Y items free/discounted' }
]

export default function EditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([])
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([])
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    code: '',
    type: 'PERCENTAGE',
    value: 10,
    minPurchase: null,
    maxDiscount: null,
    usageLimit: null,
    usageCount: 0,
    isActive: true,
    autoApply: false,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    productIds: [],
    collectionIds: [],
    customerEmails: [],
    excludeSaleItems: false,
    firstTimeOnly: false
  })
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [promoRes, productsRes, collectionsRes] = await Promise.all([
          fetch(`/api/promotions/${id}`),
          fetch('/api/products?limit=100'),
          fetch('/api/collections')
        ])
        
        if (!promoRes.ok) throw new Error('Promotion not found')
        
        const promoData = await promoRes.json()
        const promo = promoData.data || promoData
        const productsData = await productsRes.json()
        const collectionsData = await collectionsRes.json()
        
        setProducts(productsData.products || [])
        setCollections(collectionsData.collections || [])
        
        // Helper function to safely parse dates
        const formatDate = (dateValue: string | Date | null | undefined): string => {
          if (!dateValue) return ''
          try {
            const date = new Date(dateValue)
            if (isNaN(date.getTime())) return ''
            return date.toISOString().split('T')[0]
          } catch {
            return ''
          }
        }
        
        setFormData({
          name: promo.name || '',
          description: promo.description || '',
          code: promo.code || '',
          type: promo.type || 'PERCENTAGE',
          value: promo.value || 0,
          minPurchase: promo.minimumPurchase ?? promo.minPurchase ?? null,
          maxDiscount: promo.maxUsesTotal ?? promo.maxDiscount ?? null,
          usageLimit: promo.maxUsesTotal ?? promo.usageLimit ?? null,
          usageCount: promo.usedCount ?? promo.usageCount ?? 0,
          isActive: promo.isActive ?? true,
          autoApply: promo.autoApply ?? false,
          startDate: formatDate(promo.startDate) || new Date().toISOString().split('T')[0],
          endDate: formatDate(promo.endDate),
          productIds: promo.productIds ? (typeof promo.productIds === 'string' ? promo.productIds.split(',').filter(Boolean) : promo.productIds) : [],
          collectionIds: promo.collectionIds ? (typeof promo.collectionIds === 'string' ? promo.collectionIds.split(',').filter(Boolean) : promo.collectionIds) : [],
          customerEmails: promo.customerEmails ? (typeof promo.customerEmails === 'string' ? promo.customerEmails.split(',').filter(Boolean) : promo.customerEmails) : [],
          excludeSaleItems: promo.excludeSaleItems || false,
          firstTimeOnly: promo.firstTimeOnly || false
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load promotion')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])
  
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, code }))
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    
    try {
      const res = await fetch(`/api/promotions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          code: formData.autoApply ? null : formData.code,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null
        })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update promotion')
      }
      
      router.push('/admin/promotions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }
  
  if (loading) {
    return (
      <AdminLayout title="Edit Promotion" subtitle="Loading...">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-[#FF3131] border-t-transparent rounded-full" />
        </div>
      </AdminLayout>
    )
  }
  
  if (error && !formData.name) {
    return (
      <AdminLayout title="Edit Promotion" subtitle="Error">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
        <Link href="/admin/promotions" className="text-[#FF3131] mt-4 inline-block">
          ← Back to Promotions
        </Link>
      </AdminLayout>
    )
  }
  
  return (
    <AdminLayout
      title="Edit Promotion"
      subtitle={formData.name}
      headerActions={
        <div className="flex items-center gap-3">
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg flex items-center gap-3">
            <ChartLine size={20} className="text-white/40" />
            <div>
              <p className="text-xs text-white/40">Total Uses</p>
              <p className="text-lg font-bold text-white">
                {formData.usageCount}
                {formData.usageLimit && (
                  <span className="text-white/40 text-sm"> / {formData.usageLimit}</span>
                )}
              </p>
            </div>
          </div>
          <Link href="/admin/promotions">
            <Button variant="outline" className="border-white/10">
              <ArrowLeft size={16} weight="bold" className="mr-2" />
              Back
            </Button>
          </Link>
        </div>
      }
    >
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 mb-6 rounded-lg">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
        {/* Basic Info */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Info size={20} />
            Basic Information
          </h2>
          
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Promotion Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Summer Sale 20% Off"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Internal notes about this promotion..."
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50 resize-none"
              />
            </div>
          </div>
        </section>
        
        {/* Promotion Type */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Tag size={20} />
            Discount Type
          </h2>
          
          <div className="grid grid-cols-2 gap-3">
            {typeOptions.map(option => {
              const Icon = option.icon
              const isSelected = formData.type === option.value
              
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: option.value as PromotionType }))}
                  className={`p-4 text-left border rounded-lg transition-colors ${
                    isSelected 
                      ? 'bg-[#FF3131]/10 border-[#FF3131] text-white' 
                      : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={24} weight={isSelected ? 'fill' : 'regular'} />
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-white/40">{option.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          
          {(formData.type === 'PERCENTAGE' || formData.type === 'FIXED_AMOUNT') && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-white/70 mb-2">
                {formData.type === 'PERCENTAGE' ? 'Percentage Off' : 'Amount Off ($)'}
              </label>
              <div className="relative w-48">
                <input
                  type="number"
                  required
                  min={1}
                  max={formData.type === 'PERCENTAGE' ? 100 : undefined}
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: Number(e.target.value) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#FF3131]/50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                  {formData.type === 'PERCENTAGE' ? '%' : 'USD'}
                </span>
              </div>
            </div>
          )}
        </section>
        
        {/* Code Section */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Promo Code</h2>
          
          <label className="flex items-center gap-3 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.autoApply}
              onChange={(e) => setFormData(prev => ({ ...prev, autoApply: e.target.checked }))}
              className="w-5 h-5 bg-white/5 border-white/10 rounded accent-[#FF3131]"
            />
            <div>
              <p className="text-white font-medium">Auto-apply discount</p>
              <p className="text-xs text-white/40">Automatically applied when conditions are met (no code needed)</p>
            </div>
          </label>
          
          {!formData.autoApply && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Discount Code *
                </label>
                <input
                  type="text"
                  required={!formData.autoApply}
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., SUMMER20"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50 uppercase"
                />
              </div>
              <button
                type="button"
                onClick={generateCode}
                className="self-end px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/70 hover:bg-white/10 transition-colors"
              >
                Generate
              </button>
            </div>
          )}
        </section>
        
        {/* Conditions */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ShoppingBag size={20} />
            Conditions
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Minimum Purchase ($)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={formData.minPurchase ?? ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  minPurchase: e.target.value ? Number(e.target.value) : null 
                }))}
                placeholder="No minimum"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Maximum Discount ($)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={formData.maxDiscount ?? ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  maxDiscount: e.target.value ? Number(e.target.value) : null 
                }))}
                placeholder="No maximum"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Usage Limit (total uses)
              </label>
              <input
                type="number"
                min={1}
                value={formData.usageLimit ?? ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  usageLimit: e.target.value ? Number(e.target.value) : null 
                }))}
                placeholder="Unlimited"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50"
              />
            </div>
          </div>
          
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.excludeSaleItems}
                onChange={(e) => setFormData(prev => ({ ...prev, excludeSaleItems: e.target.checked }))}
                className="w-5 h-5 bg-white/5 border-white/10 rounded accent-[#FF3131]"
              />
              <span className="text-white/70">Exclude sale items</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.firstTimeOnly}
                onChange={(e) => setFormData(prev => ({ ...prev, firstTimeOnly: e.target.checked }))}
                className="w-5 h-5 bg-white/5 border-white/10 rounded accent-[#FF3131]"
              />
              <span className="text-white/70">First-time customers only</span>
            </label>
          </div>
        </section>
        
        {/* Targeting */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users size={20} />
            Targeting (Optional)
          </h2>
          <p className="text-sm text-white/40 mb-4">Leave empty to apply to all products and customers</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Specific Products
              </label>
              <select
                multiple
                value={formData.productIds}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  productIds: Array.from(e.target.selectedOptions, o => o.value)
                }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#FF3131]/50 min-h-[100px]"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id} className="bg-neutral-900">{p.name}</option>
                ))}
              </select>
              <p className="text-xs text-white/40 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Specific Collections
              </label>
              <select
                multiple
                value={formData.collectionIds}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  collectionIds: Array.from(e.target.selectedOptions, o => o.value)
                }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#FF3131]/50 min-h-[100px]"
              >
                {collections.map(c => (
                  <option key={c.id} value={c.id} className="bg-neutral-900">{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
        
        {/* Schedule */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar size={20} />
            Schedule
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#FF3131]/50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                End Date (optional)
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                min={formData.startDate}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#FF3131]/50"
              />
            </div>
          </div>
          
          <label className="flex items-center gap-3 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="w-5 h-5 bg-white/5 border-white/10 rounded accent-[#FF3131]"
            />
            <div>
              <p className="text-white/70">Active</p>
              <p className="text-xs text-white/40">Uncheck to deactivate this promotion</p>
            </div>
          </label>
        </section>
        
        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link href="/admin/promotions">
            <Button variant="outline" className="border-white/10">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#FF3131] hover:bg-[#E02828]"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
