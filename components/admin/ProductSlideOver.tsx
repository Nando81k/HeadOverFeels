'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { productApi, Product, CreateProductData } from '@/lib/api/products'
import { toast } from '@/lib/toast'
import {
  X, Package, CurrencyDollar, Percent, TrendUp, TrendDown,
  Plus, Trash, CaretDown, CaretUp, Image as ImageIcon,
  Tag, Barcode, Palette, Warning, CheckCircle, SpinnerGap,
  Cube, ChartLineUp, ArrowSquareOut
} from '@phosphor-icons/react'
import Link from 'next/link'

interface ProductSlideOverProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null // null = create mode, Product = edit mode
  onSuccess: () => void
}

interface VariantData {
  id?: string
  sku: string
  size?: string
  color?: string
  colorHex?: string
  inventory: number
  price?: number
  isActive: boolean
}

interface FormData {
  name: string
  description: string
  price: number
  compareAtPrice: number | null
  costPrice: number | null
  materials: string
  careGuide: string
  isActive: boolean
  isFeatured: boolean
  isFeaturedNewArrival: boolean
  isLimitedEdition: boolean
  releaseDate: string
  dropEndDate: string
  maxQuantity: number | null
  images: string[]
  variants: VariantData[]
}

const defaultFormData: FormData = {
  name: '',
  description: '',
  price: 0,
  compareAtPrice: null,
  costPrice: null,
  materials: '',
  careGuide: '',
  isActive: false,
  isFeatured: false,
  isFeaturedNewArrival: false,
  isLimitedEdition: false,
  releaseDate: '',
  dropEndDate: '',
  maxQuantity: null,
  images: [],
  variants: [{
    sku: '',
    size: '',
    color: '',
    colorHex: '',
    inventory: 0,
    isActive: true
  }]
}

export function ProductSlideOver({ isOpen, onClose, product, onSuccess }: ProductSlideOverProps) {
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState<'basic' | 'pricing' | 'variants' | 'images'>('basic')
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    pricing: true,
    variants: false,
    images: false
  })

  const isEditMode = !!product

  // Initialize form data when product changes
  useEffect(() => {
    if (product) {
      let images: string[] = []
      try {
        const parsed = typeof product.images === 'string' ? JSON.parse(product.images) : product.images
        if (Array.isArray(parsed)) {
          images = parsed.map(img => typeof img === 'string' ? img : img?.url || '')
        }
      } catch {
        images = []
      }

      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price,
        compareAtPrice: product.compareAtPrice || null,
        costPrice: (product as Product & { costPrice?: number }).costPrice || null,
        materials: product.materials || '',
        careGuide: product.careGuide || '',
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        isFeaturedNewArrival: product.isFeaturedNewArrival || false,
        isLimitedEdition: product.isLimitedEdition || false,
        releaseDate: product.releaseDate ? new Date(product.releaseDate).toISOString().split('T')[0] : '',
        dropEndDate: product.dropEndDate ? new Date(product.dropEndDate).toISOString().split('T')[0] : '',
        maxQuantity: product.maxQuantity || null,
        images,
        variants: product.variants.map(v => ({
          id: v.id,
          sku: v.sku,
          size: v.size || '',
          color: v.color || '',
          colorHex: v.colorHex || '',
          inventory: v.inventory,
          price: v.price,
          isActive: v.isActive
        }))
      })
    } else {
      setFormData(defaultFormData)
    }
  }, [product, isOpen])

  // Profit margin calculations
  const profitMargin = useMemo(() => {
    if (!formData.costPrice || !formData.price || formData.price <= 0) return null
    const profit = formData.price - formData.costPrice
    const margin = (profit / formData.price) * 100
    return {
      profit,
      margin,
      isHealthy: margin >= 40,
      isLow: margin < 20 && margin > 0,
      isNegative: margin < 0
    }
  }, [formData.price, formData.costPrice])

  // Revenue projections
  const revenueProjection = useMemo(() => {
    const totalInventory = formData.variants.reduce((sum, v) => sum + v.inventory, 0)
    if (!formData.price || totalInventory === 0) return null
    
    const grossRevenue = totalInventory * formData.price
    const costOfGoods = formData.costPrice ? totalInventory * formData.costPrice : 0
    const projectedProfit = grossRevenue - costOfGoods
    
    return {
      totalInventory,
      grossRevenue,
      costOfGoods,
      projectedProfit,
      hasCostData: !!formData.costPrice
    }
  }, [formData.price, formData.costPrice, formData.variants])

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const generateSKU = useCallback((index: number) => {
    const baseName = formData.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'PROD'
    const variant = formData.variants[index]
    const size = variant.size?.toUpperCase().slice(0, 2) || 'XX'
    const color = variant.color?.toUpperCase().slice(0, 2) || 'XX'
    const random = Math.random().toString(36).substring(2, 5).toUpperCase()
    return `${baseName}-${size}-${color}-${random}`
  }, [formData.name, formData.variants])

  const handleAddVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, {
        sku: '',
        size: '',
        color: '',
        colorHex: '',
        inventory: 0,
        isActive: true
      }]
    }))
  }

  const handleRemoveVariant = (index: number) => {
    if (formData.variants.length === 1) {
      toast.error('Cannot remove variant', 'At least one variant is required')
      return
    }
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }))
  }

  const updateVariant = (index: number, field: keyof VariantData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) => 
        i === index ? { ...v, [field]: value } : v
      )
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.name.trim()) {
      toast.error('Validation error', 'Product name is required')
      return
    }
    if (formData.price <= 0) {
      toast.error('Validation error', 'Price must be greater than 0')
      return
    }
    if (formData.variants.some(v => !v.sku.trim())) {
      toast.error('Validation error', 'All variants must have a SKU')
      return
    }

    setLoading(true)
    const loadingToast = toast.loading(isEditMode ? 'Updating product...' : 'Creating product...')

    try {
      const productData: CreateProductData = {
        name: formData.name,
        description: formData.description || undefined,
        price: formData.price,
        compareAtPrice: formData.compareAtPrice || undefined,
        costPrice: formData.costPrice || undefined,
        materials: formData.materials || undefined,
        careGuide: formData.careGuide || undefined,
        isActive: formData.isActive,
        isFeatured: formData.isFeatured,
        isFeaturedNewArrival: formData.isFeaturedNewArrival,
        isLimitedEdition: formData.isLimitedEdition,
        releaseDate: formData.releaseDate || undefined,
        dropEndDate: formData.dropEndDate || undefined,
        maxQuantity: formData.maxQuantity || undefined,
        images: JSON.stringify(formData.images),
        variants: formData.variants.map(v => ({
          id: v.id,
          sku: v.sku,
          size: v.size || undefined,
          color: v.color || undefined,
          price: v.price,
          inventory: v.inventory,
          isActive: v.isActive
        }))
      }

      let result
      if (isEditMode && product) {
        result = await productApi.update(product.id, productData)
      } else {
        result = await productApi.create(productData)
      }

      toast.dismiss(loadingToast)

      if (result.error) {
        toast.error('Failed to save product', result.error)
      } else {
        toast.success(
          isEditMode ? 'Product updated' : 'Product created',
          isEditMode ? 'Changes saved successfully' : 'New product added to catalog'
        )
        onSuccess()
        onClose()
      }
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error('Error', 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const inputClassName = "w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/50 placeholder:text-white/30"
  const labelClassName = "block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5"

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Slide Over Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-[600px] bg-neutral-950 border-l border-white/10 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FF3131]/20 rounded-lg flex items-center justify-center">
                  <Package size={20} weight="bold" className="text-[#FF3131]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {isEditMode ? 'Edit Product' : 'New Product'}
                  </h2>
                  <p className="text-xs text-white/40">
                    {isEditMode ? product?.name : 'Add a new product to your catalog'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditMode && (
                  <Link href={`/admin/products/${product?.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                    >
                      <ArrowSquareOut size={14} className="mr-1" />
                      Full Edit
                    </Button>
                  </Link>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X size={20} weight="bold" />
                </button>
              </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-4 gap-2 p-4 border-b border-white/10 bg-white/[0.02]">
              <div className="text-center">
                <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">Price</div>
                <div className="text-lg font-bold text-white">
                  ${formData.price.toFixed(2)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">Margin</div>
                <div className={`text-lg font-bold flex items-center justify-center gap-1 ${
                  !profitMargin ? 'text-white/30' :
                  profitMargin.isNegative ? 'text-red-400' :
                  profitMargin.isLow ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {profitMargin ? (
                    <>
                      {profitMargin.margin.toFixed(0)}%
                      {profitMargin.isHealthy ? <TrendUp size={14} weight="bold" /> : <TrendDown size={14} weight="bold" />}
                    </>
                  ) : '—'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">Stock</div>
                <div className={`text-lg font-bold ${
                  revenueProjection?.totalInventory === 0 ? 'text-red-400' :
                  (revenueProjection?.totalInventory || 0) <= 10 ? 'text-amber-400' : 'text-white'
                }`}>
                  {revenueProjection?.totalInventory || 0}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">Proj. Rev</div>
                <div className="text-lg font-bold text-emerald-400">
                  ${revenueProjection ? (revenueProjection.grossRevenue / 1000).toFixed(1) : '0'}k
                </div>
              </div>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                
                {/* Basic Info Section */}
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection('basic')}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/[0.07] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Tag size={16} className="text-[#FF3131]" />
                      <span className="text-sm font-medium text-white">Basic Information</span>
                    </div>
                    {expandedSections.basic ? <CaretUp size={16} className="text-white/40" /> : <CaretDown size={16} className="text-white/40" />}
                  </button>
                  
                  <AnimatePresence>
                    {expandedSections.basic && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-4">
                          <div>
                            <label className={labelClassName}>Product Name *</label>
                            <input
                              type="text"
                              value={formData.name}
                              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                              className={inputClassName}
                              placeholder="Enter product name"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className={labelClassName}>Description</label>
                            <textarea
                              value={formData.description}
                              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                              className={`${inputClassName} min-h-[80px] resize-none`}
                              placeholder="Product description..."
                              rows={3}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className={labelClassName}>Materials</label>
                              <input
                                type="text"
                                value={formData.materials}
                                onChange={(e) => setFormData(prev => ({ ...prev, materials: e.target.value }))}
                                className={inputClassName}
                                placeholder="100% Cotton"
                              />
                            </div>
                            <div>
                              <label className={labelClassName}>Care Guide</label>
                              <input
                                type="text"
                                value={formData.careGuide}
                                onChange={(e) => setFormData(prev => ({ ...prev, careGuide: e.target.value }))}
                                className={inputClassName}
                                placeholder="Machine wash cold"
                              />
                            </div>
                          </div>

                          {/* Status Toggles */}
                          <div className="flex flex-wrap gap-4 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                className="rounded border-white/10 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]"
                              />
                              <span className="text-sm text-white/70">Active</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.isFeatured}
                                onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                                className="rounded border-white/10 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]"
                              />
                              <span className="text-sm text-white/70">Featured</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.isFeaturedNewArrival}
                                onChange={(e) => setFormData(prev => ({ ...prev, isFeaturedNewArrival: e.target.checked }))}
                                className="rounded border-white/10 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]"
                              />
                              <span className="text-sm text-white/70">New Arrival</span>
                            </label>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Pricing & Costs Section */}
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection('pricing')}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/[0.07] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <CurrencyDollar size={16} className="text-emerald-400" />
                      <span className="text-sm font-medium text-white">Pricing & Costs</span>
                    </div>
                    {expandedSections.pricing ? <CaretUp size={16} className="text-white/40" /> : <CaretDown size={16} className="text-white/40" />}
                  </button>
                  
                  <AnimatePresence>
                    {expandedSections.pricing && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className={labelClassName}>Sale Price *</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
                                <input
                                  type="number"
                                  value={formData.price || ''}
                                  onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                                  className={`${inputClassName} pl-7`}
                                  placeholder="0.00"
                                  min="0"
                                  step="0.01"
                                  required
                                />
                              </div>
                            </div>
                            <div>
                              <label className={labelClassName}>Compare At Price</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
                                <input
                                  type="number"
                                  value={formData.compareAtPrice || ''}
                                  onChange={(e) => setFormData(prev => ({ ...prev, compareAtPrice: parseFloat(e.target.value) || null }))}
                                  className={`${inputClassName} pl-7`}
                                  placeholder="0.00"
                                  min="0"
                                  step="0.01"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Cost Price - Key new field */}
                          <div>
                            <label className={labelClassName}>
                              <span className="flex items-center gap-1">
                                Cost Price (Production Cost)
                                <ChartLineUp size={12} className="text-emerald-400" />
                              </span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
                              <input
                                type="number"
                                value={formData.costPrice || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, costPrice: parseFloat(e.target.value) || null }))}
                                className={`${inputClassName} pl-7`}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                              />
                            </div>
                            <p className="text-xs text-white/30 mt-1">Used for profit margin calculations and revenue projections</p>
                          </div>

                          {/* Profit Margin Indicator */}
                          {profitMargin && (
                            <div className={`p-3 rounded-lg border ${
                              profitMargin.isNegative ? 'bg-red-500/10 border-red-500/20' :
                              profitMargin.isLow ? 'bg-amber-500/10 border-amber-500/20' :
                              'bg-emerald-500/10 border-emerald-500/20'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {profitMargin.isNegative ? (
                                    <Warning size={16} className="text-red-400" />
                                  ) : profitMargin.isLow ? (
                                    <Warning size={16} className="text-amber-400" />
                                  ) : (
                                    <CheckCircle size={16} className="text-emerald-400" />
                                  )}
                                  <span className="text-sm font-medium text-white">
                                    {profitMargin.isNegative ? 'Negative Margin!' :
                                     profitMargin.isLow ? 'Low Margin' : 'Healthy Margin'}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className={`text-lg font-bold ${
                                    profitMargin.isNegative ? 'text-red-400' :
                                    profitMargin.isLow ? 'text-amber-400' : 'text-emerald-400'
                                  }`}>
                                    {profitMargin.margin.toFixed(1)}%
                                  </div>
                                  <div className="text-xs text-white/40">
                                    ${profitMargin.profit.toFixed(2)} profit/unit
                                  </div>
                                </div>
                              </div>
                              
                              {/* Margin bar */}
                              <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all ${
                                    profitMargin.isNegative ? 'bg-red-400' :
                                    profitMargin.isLow ? 'bg-amber-400' : 'bg-emerald-400'
                                  }`}
                                  style={{ width: `${Math.min(Math.max(profitMargin.margin, 0), 100)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Revenue Projection */}
                          {revenueProjection && revenueProjection.totalInventory > 0 && (
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                              <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-2">Revenue Projection</div>
                              <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                  <div className="text-xs text-white/40">Gross Revenue</div>
                                  <div className="text-sm font-bold text-white">${revenueProjection.grossRevenue.toFixed(0)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-white/40">Cost of Goods</div>
                                  <div className="text-sm font-bold text-red-400">
                                    {revenueProjection.hasCostData ? `-$${revenueProjection.costOfGoods.toFixed(0)}` : '—'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-white/40">Net Profit</div>
                                  <div className={`text-sm font-bold ${revenueProjection.hasCostData ? 'text-emerald-400' : 'text-white/30'}`}>
                                    {revenueProjection.hasCostData ? `$${revenueProjection.projectedProfit.toFixed(0)}` : '—'}
                                  </div>
                                </div>
                              </div>
                              {!revenueProjection.hasCostData && (
                                <p className="text-xs text-amber-400/70 mt-2 text-center">
                                  Add cost price for accurate profit projections
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Variants Section */}
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection('variants')}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/[0.07] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Cube size={16} className="text-blue-400" />
                      <span className="text-sm font-medium text-white">Variants ({formData.variants.length})</span>
                    </div>
                    {expandedSections.variants ? <CaretUp size={16} className="text-white/40" /> : <CaretDown size={16} className="text-white/40" />}
                  </button>
                  
                  <AnimatePresence>
                    {expandedSections.variants && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-3">
                          {formData.variants.map((variant, index) => (
                            <div key={index} className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Variant {index + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVariant(index)}
                                  className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                >
                                  <Trash size={14} />
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className={labelClassName}>SKU *</label>
                                  <div className="flex gap-1">
                                    <input
                                      type="text"
                                      value={variant.sku}
                                      onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                                      className={`${inputClassName} flex-1`}
                                      placeholder="SKU-001"
                                      required
                                    />
                                    <button
                                      type="button"
                                      onClick={() => updateVariant(index, 'sku', generateSKU(index))}
                                      className="px-2 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                      title="Auto-generate SKU"
                                    >
                                      <Barcode size={16} />
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <label className={labelClassName}>Inventory</label>
                                  <input
                                    type="number"
                                    value={variant.inventory}
                                    onChange={(e) => updateVariant(index, 'inventory', parseInt(e.target.value) || 0)}
                                    className={inputClassName}
                                    min="0"
                                  />
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className={labelClassName}>Size</label>
                                  <input
                                    type="text"
                                    value={variant.size}
                                    onChange={(e) => updateVariant(index, 'size', e.target.value)}
                                    className={inputClassName}
                                    placeholder="M, L, XL"
                                  />
                                </div>
                                <div>
                                  <label className={labelClassName}>Color</label>
                                  <div className="flex gap-1">
                                    <input
                                      type="text"
                                      value={variant.color}
                                      onChange={(e) => updateVariant(index, 'color', e.target.value)}
                                      className={`${inputClassName} flex-1`}
                                      placeholder="Black"
                                    />
                                    <input
                                      type="color"
                                      value={variant.colorHex || '#000000'}
                                      onChange={(e) => updateVariant(index, 'colorHex', e.target.value)}
                                      className="w-10 h-10 rounded-lg border border-white/10 bg-white/5 cursor-pointer"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddVariant}
                            className="w-full bg-white/5 border-white/10 border-dashed text-white/70 hover:bg-white/10 hover:border-white/20"
                          >
                            <Plus size={16} className="mr-2" />
                            Add Variant
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Images Section */}
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection('images')}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/[0.07] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ImageIcon size={16} className="text-purple-400" />
                      <span className="text-sm font-medium text-white">Images ({formData.images.length})</span>
                    </div>
                    {expandedSections.images ? <CaretUp size={16} className="text-white/40" /> : <CaretDown size={16} className="text-white/40" />}
                  </button>
                  
                  <AnimatePresence>
                    {expandedSections.images && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4">
                          <ImageUpload
                            images={formData.images}
                            onImagesChange={(images) => setFormData(prev => ({ ...prev, images }))}
                            maxImages={6}
                          />
                          
                          {/* Image Preview */}
                          {formData.images.length > 0 && (
                            <div className="mt-4 grid grid-cols-4 gap-2">
                              {formData.images.map((img, idx) => (
                                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-white/10">
                                  <Image src={img} alt={`Product ${idx + 1}`} fill className="object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({
                                      ...prev,
                                      images: prev.images.filter((_, i) => i !== idx)
                                    }))}
                                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Limited Edition Toggle */}
                <div className="p-4 border border-white/10 rounded-lg bg-white/[0.02]">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="text-sm font-medium text-white">Limited Edition Drop</span>
                      <p className="text-xs text-white/40">Enable time-limited release with countdown</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.isLimitedEdition}
                      onChange={(e) => setFormData(prev => ({ ...prev, isLimitedEdition: e.target.checked }))}
                      className="rounded border-white/10 bg-white/5 text-[#FF3131] focus:ring-[#FF3131] w-5 h-5"
                    />
                  </label>
                  
                  {formData.isLimitedEdition && (
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div>
                        <label className={labelClassName}>Release Date</label>
                        <input
                          type="date"
                          value={formData.releaseDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, releaseDate: e.target.value }))}
                          className={inputClassName}
                        />
                      </div>
                      <div>
                        <label className={labelClassName}>End Date</label>
                        <input
                          type="date"
                          value={formData.dropEndDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, dropEndDate: e.target.value }))}
                          className={inputClassName}
                        />
                      </div>
                      <div>
                        <label className={labelClassName}>Max Quantity</label>
                        <input
                          type="number"
                          value={formData.maxQuantity || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, maxQuantity: parseInt(e.target.value) || null }))}
                          className={inputClassName}
                          min="1"
                          placeholder="100"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-white/[0.02]">
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-[#FF3131] hover:bg-[#E02828] text-white flex-1 max-w-[200px]"
                >
                  {loading ? (
                    <>
                      <SpinnerGap size={16} className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} weight="bold" className="mr-2" />
                      {isEditMode ? 'Update Product' : 'Create Product'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
