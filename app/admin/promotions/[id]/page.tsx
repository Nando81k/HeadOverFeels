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
        
        const promo = await promoRes.json()
        const productsData = await productsRes.json()
        const collectionsData = await collectionsRes.json()
        
        setProducts(productsData.products || [])
        setCollections(collectionsData.collections || [])
        
        setFormData({
          name: promo.name,
          description: promo.description || '',
          code: promo.code || '',
          type: promo.type,
          value: promo.value,
          minPurchase: promo.minPurchase,
          maxDiscount: promo.maxDiscount,
          usageLimit: promo.usageLimit,
          usageCount: promo.usageCount,
          isActive: promo.isActive,
          autoApply: promo.autoApply,
          startDate: new Date(promo.startDate).toISOString().split('T')[0],
          endDate: promo.endDate ? new Date(promo.endDate).toISOString().split('T')[0] : '',
          productIds: promo.productIds || [],
          collectionIds: promo.collectionIds || [],
          customerEmails: promo.customerEmails || [],
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
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-[#FF3131] border-t-transparent rounded-full" />
      </div>
    )
  }
  
  if (error && !formData.name) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3">
          {error}
        </div>
        <Link href="/admin/promotions" className="text-[#FF3131] mt-4 inline-block">
          ← Back to Promotions
        </Link>
      </div>
    )
  }
  
  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/promotions"
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft size={24} />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white">Edit Promotion</h1>
          <p className="text-zinc-400 mt-1">{formData.name}</p>
        </div>
        
        {/* Usage Stats */}
        <div className="bg-zinc-900/50 border border-zinc-800 px-4 py-2 flex items-center gap-3">
          <ChartLine size={20} className="text-zinc-500" />
          <div>
            <p className="text-sm text-zinc-500">Total Uses</p>
            <p className="text-xl font-bold text-white">
              {formData.usageCount}
              {formData.usageLimit && (
                <span className="text-zinc-500 text-sm"> / {formData.usageLimit}</span>
              )}
            </p>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 mb-6">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <section className="bg-zinc-900/50 border border-zinc-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Info size={20} />
            Basic Information
          </h2>
          
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Promotion Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Summer Sale 20% Off"
                className="w-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FF3131]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Internal notes about this promotion..."
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FF3131] resize-none"
              />
            </div>
          </div>
        </section>
        
        {/* Promotion Type */}
        <section className="bg-zinc-900/50 border border-zinc-800 p-6">
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
                  className={`p-4 text-left border transition-colors ${
                    isSelected 
                      ? 'bg-[#FF3131]/10 border-[#FF3131] text-white' 
                      : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={24} weight={isSelected ? 'fill' : 'regular'} />
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-zinc-500">{option.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          
          {(formData.type === 'PERCENTAGE' || formData.type === 'FIXED_AMOUNT') && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
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
                  className="w-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-white focus:outline-none focus:border-[#FF3131]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                  {formData.type === 'PERCENTAGE' ? '%' : 'USD'}
                </span>
              </div>
            </div>
          )}
        </section>
        
        {/* Code Section */}
        <section className="bg-zinc-900/50 border border-zinc-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Promo Code</h2>
          
          <label className="flex items-center gap-3 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.autoApply}
              onChange={(e) => setFormData(prev => ({ ...prev, autoApply: e.target.checked }))}
              className="w-5 h-5 bg-zinc-800 border-zinc-700 rounded focus:ring-[#FF3131] focus:ring-offset-0"
            />
            <div>
              <p className="text-white font-medium">Auto-apply discount</p>
              <p className="text-xs text-zinc-500">Automatically applied when conditions are met (no code needed)</p>
            </div>
          </label>
          
          {!formData.autoApply && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Discount Code *
                </label>
                <input
                  type="text"
                  required={!formData.autoApply}
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., SUMMER20"
                  className="w-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-white font-mono placeholder:text-zinc-500 focus:outline-none focus:border-[#FF3131] uppercase"
                />
              </div>
              <button
                type="button"
                onClick={generateCode}
                className="self-end px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Generate
              </button>
            </div>
          )}
        </section>
        
        {/* Conditions */}
        <section className="bg-zinc-900/50 border border-zinc-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ShoppingBag size={20} />
            Conditions
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
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
                className="w-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FF3131]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
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
                className="w-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FF3131]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
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
                className="w-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FF3131]"
              />
            </div>
          </div>
          
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.excludeSaleItems}
                onChange={(e) => setFormData(prev => ({ ...prev, excludeSaleItems: e.target.checked }))}
                className="w-5 h-5 bg-zinc-800 border-zinc-700 rounded"
              />
              <span className="text-zinc-300">Exclude sale items</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.firstTimeOnly}
                onChange={(e) => setFormData(prev => ({ ...prev, firstTimeOnly: e.target.checked }))}
                className="w-5 h-5 bg-zinc-800 border-zinc-700 rounded"
              />
              <span className="text-zinc-300">First-time customers only</span>
            </label>
          </div>
        </section>
        
        {/* Targeting */}
        <section className="bg-zinc-900/50 border border-zinc-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users size={20} />
            Targeting (Optional)
          </h2>
          <p className="text-sm text-zinc-500 mb-4">Leave empty to apply to all products and customers</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Specific Products
              </label>
              <select
                multiple
                value={formData.productIds}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  productIds: Array.from(e.target.selectedOptions, o => o.value)
                }))}
                className="w-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-white focus:outline-none focus:border-[#FF3131] min-h-[100px]"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Specific Collections
              </label>
              <select
                multiple
                value={formData.collectionIds}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  collectionIds: Array.from(e.target.selectedOptions, o => o.value)
                }))}
                className="w-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-white focus:outline-none focus:border-[#FF3131] min-h-[100px]"
              >
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
        
        {/* Schedule */}
        <section className="bg-zinc-900/50 border border-zinc-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar size={20} />
            Schedule
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-white focus:outline-none focus:border-[#FF3131]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                End Date (optional)
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                min={formData.startDate}
                className="w-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-white focus:outline-none focus:border-[#FF3131]"
              />
            </div>
          </div>
          
          <label className="flex items-center gap-3 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="w-5 h-5 bg-zinc-800 border-zinc-700 rounded"
            />
            <div>
              <p className="text-zinc-300">Active</p>
              <p className="text-xs text-zinc-500">Uncheck to deactivate this promotion</p>
            </div>
          </label>
        </section>
        
        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link
            href="/admin/promotions"
            className="px-6 py-2 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-[#FF3131] text-white font-semibold hover:bg-[#FF3131]/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
