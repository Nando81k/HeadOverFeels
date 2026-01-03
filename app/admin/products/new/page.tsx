'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { productApi, CreateProductData } from '@/lib/api/products'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { 
  Package, Plus, X, ArrowLeft, FloppyDisk, Eye, Tag, Percent, 
  CurrencyDollar, Calendar, Sparkle, Stack, ListBullets, TShirt,
  Barcode, Palette, Ruler, Hash, CaretDown, CaretUp, Trash,
  Lightning, Clock, Fire, CheckCircle, Info
} from '@phosphor-icons/react'
import { toast } from '@/lib/toast'

interface Collection {
  id: string
  name: string
  slug: string
  description?: string
  isActive: boolean
}

export default function NewProductPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateProductData>({
    name: '',
    description: '',
    price: 0,
    compareAtPrice: undefined,
    costPrice: undefined,
    materials: '',
    careGuide: '',
    isActive: true,
    isFeatured: false,
    isFeaturedNewArrival: false,
    variants: [],
    isLimitedEdition: false,
    releaseDate: undefined,
    dropEndDate: undefined,
    maxQuantity: undefined
  })
  const [variants, setVariants] = useState([
    { sku: '', size: '', color: '', price: 0, inventory: 0, isActive: true }
  ])
  const [productImages, setProductImages] = useState<string[]>([])

  // Section collapse state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Collection management state
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([])
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDescription, setNewCollectionDescription] = useState('')
  const [isCreatingCollection, setIsCreatingCollection] = useState(false)

  // Calculate profit margin
  const profitMargin = useMemo(() => {
    if (!formData.costPrice || !formData.price || formData.price <= 0) return null
    const profit = formData.price - formData.costPrice
    const margin = (profit / formData.price) * 100
    return {
      profit,
      margin,
      isHealthy: margin >= 40,
      isLow: margin < 20 && margin > 0
    }
  }, [formData.price, formData.costPrice])

  // Calculate total inventory from variants
  const totalInventory = useMemo(() => {
    return variants.reduce((sum, v) => sum + (v.inventory || 0), 0)
  }, [variants])

  // Fetch collections on mount
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await fetch('/api/collections')
        if (!response.ok) {
          console.error('Failed to fetch collections:', response.status)
          return
        }
        const data = await response.json()
        setCollections(data)
      } catch (error) {
        console.error('Error fetching collections:', error)
      }
    }
    fetchCollections()
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

  const handleInputChange = (field: keyof CreateProductData, value: string | number | boolean | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleVariantChange = (index: number, field: string, value: string | number | boolean) => {
    const updatedVariants = variants.map((variant, i) => 
      i === index ? { ...variant, [field]: value } : variant
    )
    setVariants(updatedVariants)
  }

  const generateUniqueSKU = (productName: string, size?: string, color?: string) => {
    const namePart = productName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PROD'
    const sizePart = size ? `-${size.toUpperCase().replace(/[^A-Z0-9]/g, '')}` : ''
    const colorPart = color ? `-${color.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)}` : ''
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase()
    
    return `${namePart}${sizePart}${colorPart}-${randomPart}`
  }

  const autoGenerateSKUs = () => {
    const productName = formData.name || 'Product'
    const updatedVariants = variants.map(variant => ({
      ...variant,
      sku: generateUniqueSKU(productName, variant.size, variant.color)
    }))
    setVariants(updatedVariants)
    toast.success('SKUs Generated', `Generated ${updatedVariants.length} unique SKUs`)
  }

  const addVariant = () => {
    setVariants([...variants, { sku: '', size: '', color: '', price: 0, inventory: 0, isActive: true }])
  }

  const removeVariant = (index: number) => {
    if (variants.length > 1) {
      setVariants(variants.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const validVariants = variants.filter(v => v.sku.trim() !== '')
      
      const productData: CreateProductData = {
        ...formData,
        images: JSON.stringify(productImages),
        variants: validVariants.length > 0 ? validVariants : undefined
      }

      const result = await productApi.create(productData)

      if (result.error) {
        setError(result.error)
        toast.error('Failed to create product', result.error)
        if (result.details) {
          console.error('Validation errors:', result.details)
        }
        return
      }

      if (result.data && selectedCollectionIds.length > 0) {
        const productId = result.data.id
        const collectionAssignmentPromises = selectedCollectionIds.map(async (collectionId) => {
          try {
            const collectionResponse = await fetch(`/api/collections/${collectionId}`)
            if (!collectionResponse.ok) {
              console.error(`Failed to fetch collection ${collectionId}`)
              return
            }
            const collectionData = await collectionResponse.json()
            
            const existingProductIds = collectionData.products?.map((p: { productId: string }) => p.productId) || []
            const updatedProductIds = [...existingProductIds, productId]
            
            const updateResponse = await fetch(`/api/collections/${collectionId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productIds: updatedProductIds }),
            })

            if (!updateResponse.ok) {
              console.error(`Failed to assign product to collection ${collectionId}`)
            }
          } catch (err) {
            console.error(`Error assigning product to collection ${collectionId}:`, err)
          }
        })

        await Promise.all(collectionAssignmentPromises)
      }

      toast.success('Product created!', `${formData.name} has been published`)
      router.push('/admin/products')
    } catch (err) {
      setError('An unexpected error occurred')
      toast.error('Error', 'An unexpected error occurred')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const headerActions = (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        onClick={() => {
          handleInputChange('isActive', false)
          toast.info('Draft mode', 'Product will be saved as inactive')
        }}
        className="border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
      >
        <FloppyDisk weight="bold" className="w-4 h-4 mr-2" />
        Save as Draft
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={isLoading}
        className="bg-[#FF3131] hover:bg-[#FF3131]/80 text-white"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
            Publishing...
          </>
        ) : (
          <>
            <Eye weight="bold" className="w-4 h-4 mr-2" />
            Publish Product
          </>
        )}
      </Button>
    </div>
  )

  return (
    <AdminLayout 
      title="Add New Product" 
      subtitle="Create a new product for your store"
      headerActions={headerActions}
    >
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-center gap-3">
          <X weight="bold" className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">
            <X weight="bold" className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FF3131]/20 rounded-lg">
              <CurrencyDollar weight="bold" className="w-5 h-5 text-[#FF3131]" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Price</p>
              <p className="text-xl font-bold text-white">$${formData.price?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${profitMargin?.isHealthy ? 'bg-emerald-500/20' : profitMargin?.isLow ? 'bg-amber-500/20' : 'bg-white/10'}`}>
              <Percent weight="bold" className={`w-5 h-5 ${profitMargin?.isHealthy ? 'text-emerald-400' : profitMargin?.isLow ? 'text-amber-400' : 'text-white/40'}`} />
            </div>
            <div>
              <p className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Margin</p>
              <p className={`text-xl font-bold ${profitMargin?.isHealthy ? 'text-emerald-400' : profitMargin?.isLow ? 'text-amber-400' : 'text-white/40'}`}>
                {profitMargin ? `${profitMargin.margin.toFixed(1)}%` : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Stack weight="bold" className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Inventory</p>
              <p className="text-xl font-bold text-white">{totalInventory} units</p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <TShirt weight="bold" className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Variants</p>
              <p className="text-xl font-bold text-white">{variants.filter(v => v.sku).length}</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('basic')}
                className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#FF3131]/20 rounded-lg">
                    <Package weight="bold" className="w-5 h-5 text-[#FF3131]" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-white">Basic Information</h3>
                    <p className="text-sm text-white/50">Product name, description, and pricing</p>
                  </div>
                </div>
                {collapsedSections.has('basic') ? (
                  <CaretDown weight="bold" className="w-5 h-5 text-white/40" />
                ) : (
                  <CaretUp weight="bold" className="w-5 h-5 text-white/40" />
                )}
              </button>
              
              {!collapsedSections.has('basic') && (
                <div className="p-5 pt-0 space-y-5 border-t border-white/5">
                  <div>
                    <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-2">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-all"
                      placeholder="e.g. Oversized Streetwear Hoodie"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-2">
                      Description
                    </label>
                    <textarea
                      rows={4}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-all resize-none"
                      placeholder="Describe your product's features, fit, and style..."
                      value={formData.description || ''}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-2">
                        Price *
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">$</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-all"
                          placeholder="0.00"
                          value={formData.price || ''}
                          onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-2">
                        Compare at Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">$</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-all"
                          placeholder="0.00"
                          value={formData.compareAtPrice || ''}
                          onChange={(e) => handleInputChange('compareAtPrice', parseFloat(e.target.value) || undefined)}
                        />
                      </div>
                      <p className="text-[10px] text-white/30 mt-1">Original price to show discount</p>
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-2">
                        Cost Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">$</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-all"
                          placeholder="0.00"
                          value={formData.costPrice || ''}
                          onChange={(e) => handleInputChange('costPrice', parseFloat(e.target.value) || undefined)}
                        />
                      </div>
                      <p className="text-[10px] text-white/30 mt-1">For profit calculations</p>
                    </div>
                  </div>

                  {profitMargin && (
                    <div className={`p-4 rounded-lg border ${profitMargin.isHealthy ? 'bg-emerald-500/10 border-emerald-500/20' : profitMargin.isLow ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {profitMargin.isHealthy ? (
                            <CheckCircle weight="fill" className="w-5 h-5 text-emerald-400" />
                          ) : profitMargin.isLow ? (
                            <Info weight="fill" className="w-5 h-5 text-amber-400" />
                          ) : (
                            <Info weight="fill" className="w-5 h-5 text-white/40" />
                          )}
                          <div>
                            <p className={`text-sm font-medium ${profitMargin.isHealthy ? 'text-emerald-400' : profitMargin.isLow ? 'text-amber-400' : 'text-white/70'}`}>
                              {profitMargin.isHealthy ? 'Healthy Margin' : profitMargin.isLow ? 'Low Margin Warning' : 'Margin Preview'}
                            </p>
                            <p className="text-[10px] text-white/40">
                              Profit: $${profitMargin.profit.toFixed(2)} per unit (${profitMargin.margin.toFixed(1)}% margin)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${profitMargin.isHealthy ? 'text-emerald-400' : profitMargin.isLow ? 'text-amber-400' : 'text-white'}`}>
                            {profitMargin.margin.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('images')}
                className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Sparkle weight="bold" className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-white">Product Images</h3>
                    <p className="text-sm text-white/50">{productImages.length} images uploaded</p>
                  </div>
                </div>
                {collapsedSections.has('images') ? (
                  <CaretDown weight="bold" className="w-5 h-5 text-white/40" />
                ) : (
                  <CaretUp weight="bold" className="w-5 h-5 text-white/40" />
                )}
              </button>
              
              {!collapsedSections.has('images') && (
                <div className="p-5 pt-0 border-t border-white/5">
                  <ImageUpload 
                    images={productImages}
                    onImagesChange={setProductImages}
                    maxImages={5}
                  />
                </div>
              )}
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <ListBullets weight="bold" className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Product Variants</h3>
                    <p className="text-sm text-white/50">Add sizes, colors, and inventory</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    size="sm"
                    onClick={autoGenerateSKUs}
                    className="border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
                  >
                    <Barcode weight="bold" className="w-4 h-4 mr-2" />
                    Generate SKUs
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    size="sm"
                    onClick={addVariant}
                    className="border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
                  >
                    <Plus weight="bold" className="w-4 h-4 mr-2" />
                    Add Variant
                  </Button>
                </div>
              </div>
              
              <div className="p-5 pt-0 space-y-4 border-t border-white/5">
                {variants.map((variant, index) => (
                  <div key={index} className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Hash weight="bold" className="w-4 h-4 text-white/40" />
                        <span className="text-sm font-medium text-white">Variant {index + 1}</span>
                      </div>
                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVariant(index)}
                          className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash weight="bold" className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-1">
                          <Ruler weight="bold" className="w-3 h-3 inline mr-1" />
                          Size
                        </label>
                        <input
                          type="text"
                          value={variant.size}
                          onChange={(e) => handleVariantChange(index, 'size', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50"
                          placeholder="S, M, L, XL"
                        />
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-1">
                          <Palette weight="bold" className="w-3 h-3 inline mr-1" />
                          Color
                        </label>
                        <input
                          type="text"
                          value={variant.color}
                          onChange={(e) => handleVariantChange(index, 'color', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50"
                          placeholder="Black, White"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-1">
                          SKU *
                        </label>
                        <input
                          type="text"
                          required
                          value={variant.sku}
                          onChange={(e) => handleVariantChange(index, 'sku', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50"
                          placeholder="HOF-001"
                        />
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-1">
                          Price Override
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={variant.price || ''}
                          onChange={(e) => handleVariantChange(index, 'price', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50"
                          placeholder="Optional"
                        />
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-1">
                          Inventory *
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={variant.inventory}
                          onChange={(e) => handleVariantChange(index, 'inventory', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                {variants.length === 0 && (
                  <div className="text-center py-8">
                    <TShirt weight="duotone" className="w-12 h-12 text-white/20 mx-auto mb-3" />
                    <p className="text-white/50 mb-3">No variants yet</p>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={addVariant}
                      className="border-white/10 text-white/70 hover:bg-white/5"
                    >
                      <Plus weight="bold" className="w-4 h-4 mr-2" />
                      Add First Variant
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <CheckCircle weight="bold" className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Status</h3>
              </div>
              
              <div>
                <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-2">
                  Visibility
                </label>
                <select 
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#FF3131]/50"
                  value={formData.isActive ? 'active' : 'draft'}
                  onChange={(e) => handleInputChange('isActive', e.target.value === 'active')}
                >
                  <option value="draft" className="bg-neutral-900">Draft</option>
                  <option value="active" className="bg-neutral-900">Active</option>
                </select>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Fire weight="bold" className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Featured Sections</h3>
              </div>
              
              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.isFeatured || false}
                  onChange={(e) => handleInputChange('isFeatured', e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]/20"
                />
                <div>
                  <span className="text-sm font-medium text-white block">Best Sellers</span>
                  <span className="text-[10px] text-white/40">Featured on home page</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.isFeaturedNewArrival || false}
                  onChange={(e) => handleInputChange('isFeaturedNewArrival', e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]/20"
                />
                <div>
                  <span className="text-sm font-medium text-white block">New Arrivals</span>
                  <span className="text-[10px] text-white/40">Hero carousel (max 10)</span>
                </div>
              </label>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#FF3131]/20 rounded-lg">
                  <Lightning weight="fill" className="w-5 h-5 text-[#FF3131]" />
                </div>
                <h3 className="text-lg font-semibold text-white">Limited Edition</h3>
              </div>
              
              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.isLimitedEdition || false}
                  onChange={(e) => handleInputChange('isLimitedEdition', e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]/20"
                />
                <span className="text-sm font-medium text-white">This is a limited drop</span>
              </label>

              {formData.isLimitedEdition && (
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-2">
                      <Calendar weight="bold" className="w-3 h-3 inline mr-1" />
                      Release Date
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.releaseDate || ''}
                      onChange={(e) => handleInputChange('releaseDate', e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#FF3131]/50"
                    />
                    <p className="text-[10px] text-white/30 mt-1">When the drop becomes available</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-2">
                      <Clock weight="bold" className="w-3 h-3 inline mr-1" />
                      Drop End Date
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.dropEndDate || ''}
                      onChange={(e) => handleInputChange('dropEndDate', e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#FF3131]/50"
                    />
                    <p className="text-[10px] text-white/30 mt-1">Countdown timer ends here</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-2">
                      Max Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxQuantity || ''}
                      onChange={(e) => handleInputChange('maxQuantity', parseInt(e.target.value) || undefined)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50"
                      placeholder="Total units available"
                    />
                    <p className="text-[10px] text-white/30 mt-1">Total limited quantity</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <Stack weight="bold" className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Collections</h3>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowNewCollectionModal(true)}
                  className="border-white/10 text-white/70 hover:bg-white/5 hover:text-white text-xs"
                >
                  <Plus weight="bold" className="w-3 h-3 mr-1" />
                  New
                </Button>
              </div>
              
              {collections.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {collections.map((collection) => (
                    <label
                      key={collection.id}
                      className="flex items-start gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCollectionIds.includes(collection.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCollectionIds([...selectedCollectionIds, collection.id])
                          } else {
                            setSelectedCollectionIds(selectedCollectionIds.filter(id => id !== collection.id))
                          }
                        }}
                        className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]/20"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-white block truncate">{collection.name}</span>
                        {collection.description && (
                          <span className="text-[10px] text-white/40 block truncate">{collection.description}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Stack weight="duotone" className="w-10 h-10 text-white/20 mx-auto mb-2" />
                  <p className="text-sm text-white/50 mb-2">No collections yet</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewCollectionModal(true)}
                    className="border-white/10 text-white/70 hover:bg-white/5"
                  >
                    Create First Collection
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <Tag weight="bold" className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Details</h3>
              </div>
              
              <div>
                <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-2">
                  Materials
                </label>
                <input
                  type="text"
                  value={formData.materials || ''}
                  onChange={(e) => handleInputChange('materials', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50"
                  placeholder="100% Cotton"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-2">
                  Care Instructions
                </label>
                <textarea
                  rows={3}
                  value={formData.careGuide || ''}
                  onChange={(e) => handleInputChange('careGuide', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50 resize-none"
                  placeholder="Machine wash cold, tumble dry low..."
                />
              </div>
            </div>
          </div>
        </div>
      </form>

      {showNewCollectionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Create New Collection</h2>
              <button
                type="button"
                onClick={() => {
                  setShowNewCollectionModal(false)
                  setNewCollectionName('')
                  setNewCollectionDescription('')
                }}
                className="text-white/40 hover:text-white p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X weight="bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-2">
                  Collection Name *
                </label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50"
                  placeholder="e.g. Summer Collection 2024"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] block mb-2">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#FF3131]/50 resize-none"
                  placeholder="Brief description of this collection..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowNewCollectionModal(false)
                  setNewCollectionName('')
                  setNewCollectionDescription('')
                }}
                disabled={isCreatingCollection}
                className="border-white/10 text-white/70 hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  if (!newCollectionName.trim()) {
                    toast.error('Error', 'Collection name is required')
                    return
                  }

                  setIsCreatingCollection(true)
                  try {
                    const response = await fetch('/api/collections', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: newCollectionName,
                        description: newCollectionDescription || undefined,
                        isActive: true,
                      }),
                    })

                    if (!response.ok) {
                      throw new Error('Failed to create collection')
                    }

                    const newCollection = await response.json()
                    setCollections([...collections, newCollection])
                    setSelectedCollectionIds([...selectedCollectionIds, newCollection.id])
                    setShowNewCollectionModal(false)
                    setNewCollectionName('')
                    setNewCollectionDescription('')
                    toast.success('Collection created!', newCollectionName)
                  } catch (err) {
                    toast.error('Error', 'Failed to create collection')
                    console.error('Error creating collection:', err)
                  } finally {
                    setIsCreatingCollection(false)
                  }
                }}
                disabled={isCreatingCollection || !newCollectionName.trim()}
                className="bg-[#FF3131] hover:bg-[#FF3131]/80 text-white"
              >
                {isCreatingCollection ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Collection'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
