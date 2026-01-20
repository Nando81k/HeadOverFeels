'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Percent, 
  Tag, 
  Truck, 
  Gift,
  Calendar,
  Users,
  ShoppingBag,
  Info,
  FloppyDisk,
  Eye,
  CaretDown,
  CaretUp,
  Lightning,
  Hash,
  Clock,
  Check
} from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'

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

export default function NewPromotionPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([])
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([])
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    code: '',
    type: 'PERCENTAGE',
    value: 10,
    minPurchase: null,
    maxDiscount: null,
    usageLimit: null,
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
    // Fetch products and collections for targeting
    const fetchData = async () => {
      try {
        const [productsRes, collectionsRes] = await Promise.all([
          fetch('/api/products?limit=100'),
          fetch('/api/collections')
        ])
        const productsData = await productsRes.json()
        const collectionsData = await collectionsRes.json()
        setProducts(productsData.products || [])
        setCollections(collectionsData.collections || [])
      } catch (err) {
        console.error('Failed to fetch data:', err)
      }
    }
    fetchData()
  }, [])
  
  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }
  
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
      const res = await fetch('/api/promotions', {
        method: 'POST',
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
        throw new Error(data.error || 'Failed to create promotion')
      }
      
      toast.success('Promotion created!', `${formData.name} is now active`)
      router.push('/admin/promotions')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      toast.error('Failed to create promotion', message)
    } finally {
      setSaving(false)
    }
  }
  
  const headerActions = (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        onClick={() => {
          setFormData(prev => ({ ...prev, isActive: false }))
          toast.info('Draft mode', 'Promotion will be saved as inactive')
        }}
        className="border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
      >
        <FloppyDisk weight="bold" className="w-4 h-4 mr-2" />
        Save as Draft
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={saving}
        className="bg-[#FF3131] hover:bg-[#FF3131]/80 text-white"
      >
        {saving ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
            Creating...
          </>
        ) : (
          <>
            <Eye weight="bold" className="w-4 h-4 mr-2" />
            Create Promotion
          </>
        )}
      </Button>
    </div>
  )
  
  return (
    <AdminLayout
      title="Create Promotion"
      subtitle="Set up a new discount code or offer"
      headerActions={headerActions}
    >
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      
      {/* Preview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-[#FF3131]/20 rounded-lg">
              <Tag weight="bold" className="w-4 h-4 md:w-5 md:h-5 text-[#FF3131]" />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Type</p>
              <p className="text-base md:text-lg font-bold text-white">
                {typeOptions.find(t => t.value === formData.type)?.label || '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-emerald-500/20 rounded-lg">
              <Percent weight="bold" className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Value</p>
              <p className="text-base md:text-lg font-bold text-emerald-400">
                {formData.type === 'PERCENTAGE' ? `${formData.value}%` : 
                 formData.type === 'FIXED_AMOUNT' ? `$${formData.value}` : 
                 formData.type === 'FREE_SHIPPING' ? 'Free' : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-blue-500/20 rounded-lg">
              <Hash weight="bold" className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Code</p>
              <p className="text-base md:text-lg font-bold text-white font-mono truncate max-w-[80px] md:max-w-none">
                {formData.autoApply ? 'AUTO' : formData.code || '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`p-1.5 md:p-2 rounded-lg ${formData.isActive ? 'bg-emerald-500/20' : 'bg-white/10'}`}>
              <Lightning weight="bold" className={`w-4 h-4 md:w-5 md:h-5 ${formData.isActive ? 'text-emerald-400' : 'text-white/40'}`} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Status</p>
              <p className={`text-base md:text-lg font-bold ${formData.isActive ? 'text-emerald-400' : 'text-white/40'}`}>
                {formData.isActive ? 'Active' : 'Draft'}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        {/* Basic Info */}
        <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('basic')}
            className="w-full flex items-center justify-between p-4 md:p-5 text-left hover:bg-white/5 transition-colors"
          >
            <h2 className="text-sm md:text-base font-semibold text-white flex items-center gap-2">
              <Info size={18} className="text-[#FF3131]" />
              Basic Information
            </h2>
            {collapsedSections.has('basic') ? (
              <CaretDown weight="bold" className="w-4 h-4 text-white/40" />
            ) : (
              <CaretUp weight="bold" className="w-4 h-4 text-white/40" />
            )}
          </button>
          
          {!collapsedSections.has('basic') && (
            <div className="px-4 md:px-5 pb-4 md:pb-5 grid gap-3 md:gap-4">
              <div>
                <label className="block text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 md:mb-2">
                  Promotion Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Summer Sale 20% Off"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 md:mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Internal notes about this promotion..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors resize-none"
                />
              </div>
            </div>
          )}
        </section>
        
        {/* Promotion Type */}
        <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('type')}
            className="w-full flex items-center justify-between p-4 md:p-5 text-left hover:bg-white/5 transition-colors"
          >
            <h2 className="text-sm md:text-base font-semibold text-white flex items-center gap-2">
              <Tag size={18} className="text-[#FF3131]" />
              Discount Type
            </h2>
            {collapsedSections.has('type') ? (
              <CaretDown weight="bold" className="w-4 h-4 text-white/40" />
            ) : (
              <CaretUp weight="bold" className="w-4 h-4 text-white/40" />
            )}
          </button>
          
          {!collapsedSections.has('type') && (
            <div className="px-4 md:px-5 pb-4 md:pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                {typeOptions.map(option => {
                  const Icon = option.icon
                  const isSelected = formData.type === option.value
                  
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: option.value as PromotionType }))}
                      className={`p-3 md:p-4 text-left border rounded-lg transition-all ${
                        isSelected 
                          ? 'bg-[#FF3131]/10 border-[#FF3131] text-white' 
                          : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 md:gap-3">
                        <Icon size={20} weight={isSelected ? 'fill' : 'regular'} className={`md:w-6 md:h-6 ${isSelected ? 'text-[#FF3131]' : ''}`} />
                        <div>
                          <p className="font-medium text-sm md:text-base">{option.label}</p>
                          <p className="text-[10px] md:text-xs text-white/40">{option.description}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              
              {/* Value input based on type */}
              {(formData.type === 'PERCENTAGE' || formData.type === 'FIXED_AMOUNT') && (
                <div className="mt-3 md:mt-4">
                  <label className="block text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 md:mb-2">
                    {formData.type === 'PERCENTAGE' ? 'Percentage Off' : 'Amount Off ($)'}
                  </label>
                  <div className="relative w-full sm:w-48">
                    <input
                      type="number"
                      required
                      min={1}
                      max={formData.type === 'PERCENTAGE' ? 100 : undefined}
                      value={formData.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, value: Number(e.target.value) }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-white focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                      {formData.type === 'PERCENTAGE' ? '%' : 'USD'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
        
        {/* Code Section */}
        <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('code')}
            className="w-full flex items-center justify-between p-4 md:p-5 text-left hover:bg-white/5 transition-colors"
          >
            <h2 className="text-sm md:text-base font-semibold text-white flex items-center gap-2">
              <Hash size={18} className="text-[#FF3131]" />
              Promo Code
            </h2>
            {collapsedSections.has('code') ? (
              <CaretDown weight="bold" className="w-4 h-4 text-white/40" />
            ) : (
              <CaretUp weight="bold" className="w-4 h-4 text-white/40" />
            )}
          </button>
          
          {!collapsedSections.has('code') && (
            <div className="px-4 md:px-5 pb-4 md:pb-5">
              <label className="flex items-start md:items-center gap-3 mb-3 md:mb-4 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${formData.autoApply ? 'bg-[#FF3131] border-[#FF3131]' : 'bg-white/5 border-white/20 group-hover:border-white/40'}`}>
                  {formData.autoApply && <Check size={14} weight="bold" className="text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={formData.autoApply}
                  onChange={(e) => setFormData(prev => ({ ...prev, autoApply: e.target.checked }))}
                  className="sr-only"
                />
                <div>
                  <p className="text-white font-medium text-sm md:text-base">Auto-apply discount</p>
                  <p className="text-[10px] md:text-xs text-white/40">Automatically applied when conditions are met (no code needed)</p>
                </div>
              </label>
              
              {!formData.autoApply && (
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                  <div className="flex-1">
                    <label className="block text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 md:mb-2">
                      Discount Code *
                    </label>
                    <input
                      type="text"
                      required={!formData.autoApply}
                      value={formData.code}
                      onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      placeholder="e.g., SUMMER20"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors uppercase"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={generateCode}
                    className="sm:self-end px-4 py-2.5 md:py-3 bg-white/5 border border-white/10 rounded-lg text-sm md:text-base text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Generate
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
        
        {/* Conditions */}
        <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('conditions')}
            className="w-full flex items-center justify-between p-4 md:p-5 text-left hover:bg-white/5 transition-colors"
          >
            <h2 className="text-sm md:text-base font-semibold text-white flex items-center gap-2">
              <ShoppingBag size={18} className="text-[#FF3131]" />
              Conditions
            </h2>
            {collapsedSections.has('conditions') ? (
              <CaretDown weight="bold" className="w-4 h-4 text-white/40" />
            ) : (
              <CaretUp weight="bold" className="w-4 h-4 text-white/40" />
            )}
          </button>
          
          {!collapsedSections.has('conditions') && (
            <div className="px-4 md:px-5 pb-4 md:pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                <div>
                  <label className="block text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 md:mb-2">
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
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 md:mb-2">
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
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 md:mb-2">
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
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors"
                  />
                </div>
              </div>
              
              <div className="mt-3 md:mt-4 space-y-2 md:space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${formData.excludeSaleItems ? 'bg-[#FF3131] border-[#FF3131]' : 'bg-white/5 border-white/20 group-hover:border-white/40'}`}>
                    {formData.excludeSaleItems && <Check size={14} weight="bold" className="text-white" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.excludeSaleItems}
                    onChange={(e) => setFormData(prev => ({ ...prev, excludeSaleItems: e.target.checked }))}
                    className="sr-only"
                  />
                  <span className="text-white/70 text-sm md:text-base">Exclude sale items</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${formData.firstTimeOnly ? 'bg-[#FF3131] border-[#FF3131]' : 'bg-white/5 border-white/20 group-hover:border-white/40'}`}>
                    {formData.firstTimeOnly && <Check size={14} weight="bold" className="text-white" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.firstTimeOnly}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstTimeOnly: e.target.checked }))}
                    className="sr-only"
                  />
                  <span className="text-white/70 text-sm md:text-base">First-time customers only</span>
                </label>
              </div>
            </div>
          )}
        </section>
        
        {/* Targeting */}
        <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('targeting')}
            className="w-full flex items-center justify-between p-4 md:p-5 text-left hover:bg-white/5 transition-colors"
          >
            <h2 className="text-sm md:text-base font-semibold text-white flex items-center gap-2">
              <Users size={18} className="text-[#FF3131]" />
              Targeting (Optional)
            </h2>
            {collapsedSections.has('targeting') ? (
              <CaretDown weight="bold" className="w-4 h-4 text-white/40" />
            ) : (
              <CaretUp weight="bold" className="w-4 h-4 text-white/40" />
            )}
          </button>
          
          {!collapsedSections.has('targeting') && (
            <div className="px-4 md:px-5 pb-4 md:pb-5">
              <p className="text-xs md:text-sm text-white/40 mb-3 md:mb-4">Leave empty to apply to all products and customers</p>
              
              <div className="space-y-3 md:space-y-4">
                <div>
                  <label className="block text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 md:mb-2">
                    Specific Products
                  </label>
                  <select
                    multiple
                    value={formData.productIds}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      productIds: Array.from(e.target.selectedOptions, o => o.value)
                    }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-white focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors min-h-[80px] md:min-h-[100px]"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id} className="bg-zinc-900">{p.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] md:text-xs text-white/30 mt-1">Hold Ctrl/Cmd to select multiple</p>
                </div>
                
                <div>
                  <label className="block text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 md:mb-2">
                    Specific Collections
                  </label>
                  <select
                    multiple
                    value={formData.collectionIds}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      collectionIds: Array.from(e.target.selectedOptions, o => o.value)
                    }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-white focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors min-h-[80px] md:min-h-[100px]"
                  >
                    {collections.map(c => (
                      <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </section>
        
        {/* Schedule */}
        <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('schedule')}
            className="w-full flex items-center justify-between p-4 md:p-5 text-left hover:bg-white/5 transition-colors"
          >
            <h2 className="text-sm md:text-base font-semibold text-white flex items-center gap-2">
              <Calendar size={18} className="text-[#FF3131]" />
              Schedule
            </h2>
            {collapsedSections.has('schedule') ? (
              <CaretDown weight="bold" className="w-4 h-4 text-white/40" />
            ) : (
              <CaretUp weight="bold" className="w-4 h-4 text-white/40" />
            )}
          </button>
          
          {!collapsedSections.has('schedule') && (
            <div className="px-4 md:px-5 pb-4 md:pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 md:mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-white focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors [color-scheme:dark]"
                  />
                </div>
                
                <div>
                  <label className="block text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 md:mb-2">
                    End Date (optional)
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    min={formData.startDate}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-white focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>
              
              <label className="flex items-start md:items-center gap-3 mt-3 md:mt-4 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${formData.isActive ? 'bg-[#FF3131] border-[#FF3131]' : 'bg-white/5 border-white/20 group-hover:border-white/40'}`}>
                  {formData.isActive && <Check size={14} weight="bold" className="text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="sr-only"
                />
                <div>
                  <p className="text-white/70 text-sm md:text-base">Active immediately</p>
                  <p className="text-[10px] md:text-xs text-white/40">Uncheck to create as draft</p>
                </div>
              </label>
            </div>
          )}
        </section>
      </form>
    </AdminLayout>
  )
}
