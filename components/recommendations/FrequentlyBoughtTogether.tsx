'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, ShoppingCart, Check, Package, Sparkle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface BundleProduct {
  id: string
  name: string
  slug: string
  price: number
  images: string
  coOccurrenceScore?: number
}

interface FrequentlyBoughtTogetherProps {
  productId: string
  sourceProductName: string
  sourceProductPrice: number
  limit?: number
}

export function FrequentlyBoughtTogether({
  productId,
  sourceProductName,
  sourceProductPrice,
  limit = 3,
}: FrequentlyBoughtTogetherProps) {
  const [products, setProducts] = useState<BundleProduct[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [bundlePricing, setBundlePricing] = useState<{
    originalPrice: number
    finalPrice: number
    savings: number
    savingsPercentage: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFrequentlyBought() {
      try {
        setLoading(true)
        const response = await fetch(
          `/api/recommendations/frequently-bought-together/${productId}?limit=${limit}`
        )
        const data = await response.json()

        if (data.success) {
          setProducts(data.data.recommendations || [])
          setBundlePricing(data.data.bundlePricing || null)
          // Select all products by default
          const allIds = new Set<string>((data.data.recommendations || []).map((p: BundleProduct) => p.id))
          setSelectedProducts(allIds)
        }
      } catch (err) {
        console.error('Error fetching frequently bought together:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchFrequentlyBought()
  }, [productId, limit])

  const toggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }

  // Calculate dynamic pricing based on selection
  const calculateDynamicPricing = () => {
    const selectedProductsList = products.filter(p => selectedProducts.has(p.id))
    const bundleTotal = sourceProductPrice + selectedProductsList.reduce((sum, p) => sum + p.price, 0)
    const discount = selectedProductsList.length >= 2 ? 0.1 : selectedProductsList.length === 1 ? 0.05 : 0
    const finalPrice = bundleTotal * (1 - discount)
    return {
      originalPrice: bundleTotal,
      finalPrice,
      savings: bundleTotal - finalPrice,
      savingsPercentage: Math.round(discount * 100)
    }
  }

  const dynamicPricing = calculateDynamicPricing()

  if (loading || products.length === 0) {
    return null
  }

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-8"
    >
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 rounded-3xl p-6 border border-amber-100">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
            <Package size={20} weight="fill" className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Complete the Look
            </h2>
            <p className="text-sm text-gray-600">
              Bundle & save up to 10%
            </p>
          </div>
        </div>

        {/* Products Selection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {/* Source Product - Always Selected */}
          <div className="relative bg-white rounded-2xl p-3 border-2 border-amber-400 shadow-sm">
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
              <Check size={14} weight="bold" className="text-white" />
            </div>
            <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl flex items-center justify-center mb-2">
              <span className="text-xs font-medium text-gray-500 text-center px-2">This Item</span>
            </div>
            <p className="text-xs font-medium text-gray-900 line-clamp-2 mb-1 leading-tight">
              {sourceProductName}
            </p>
            <p className="text-sm font-bold text-gray-900">
              ${sourceProductPrice.toFixed(2)}
            </p>
          </div>

          {/* Recommended Products */}
          {products.map((product, index) => {
            let images: unknown = []
            try {
              images = JSON.parse(product.images as string)
            } catch {
              images = []
            }

            const pickFirstValidImage = (imgs: unknown): string | null => {
              if (!imgs || !Array.isArray(imgs)) return null
              for (const img of imgs) {
                if (typeof img === 'string' && img.trim().length > 0) return img.trim()
                if (typeof img === 'object' && img !== null && 'url' in img) {
                  const u = (img as Record<string, unknown>).url
                  if (typeof u === 'string' && u.trim().length > 0) return u.trim()
                }
              }
              return null
            }

            const mainImage = pickFirstValidImage(images) || '/placeholder-product.jpg'
            const isSelected = selectedProducts.has(product.id)

            return (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                {/* Plus indicator between items */}
                {index === 0 && (
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full hidden md:flex items-center justify-center">
                    <Plus size={16} weight="bold" className="text-amber-500" />
                  </div>
                )}
                
                <button
                  onClick={() => toggleProduct(product.id)}
                  className={`w-full text-left bg-white rounded-2xl p-3 border-2 transition-all duration-200 ${
                    isSelected 
                      ? 'border-amber-400 shadow-md' 
                      : 'border-transparent hover:border-amber-200 opacity-60'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                      <Check size={14} weight="bold" className="text-white" />
                    </div>
                  )}
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 mb-2">
                    <Image
                      src={mainImage}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                  </div>
                  <p className="text-xs font-medium text-gray-900 line-clamp-2 mb-1 leading-tight">
                    {product.name}
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    ${product.price.toFixed(2)}
                  </p>
                </button>
              </motion.div>
            )
          })}
        </div>

        {/* Bundle Summary */}
        {selectedProducts.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-4 border border-amber-200"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Bundle Total</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">
                      ${dynamicPricing.finalPrice.toFixed(2)}
                    </span>
                    {dynamicPricing.savings > 0 && (
                      <span className="text-sm text-gray-400 line-through">
                        ${dynamicPricing.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                {dynamicPricing.savings > 0 && (
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 py-1.5 rounded-full text-xs font-bold">
                    Save ${dynamicPricing.savings.toFixed(2)}
                  </div>
                )}
              </div>
              
              <button className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl">
                <ShoppingCart size={18} weight="bold" />
                Add {selectedProducts.size + 1} Items
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.section>
  )
}
