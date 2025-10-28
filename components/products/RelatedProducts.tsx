'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { productApi, Product } from '@/lib/api/products'
import ProductImage from '@/components/ui/ProductImage'
import { Sparkles } from 'lucide-react'

interface RelatedProductsProps {
  currentProductId: string
  limit?: number
}

export function RelatedProducts({ currentProductId, limit = 4 }: RelatedProductsProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRelatedProducts = async () => {
      try {
        setLoading(true)
        const response = await productApi.getAll({ isActive: true })
        if (response.data) {
          // Filter out current product and get random ones
          const filtered = response.data.data.filter(p => p.id !== currentProductId)
          const shuffled = filtered.sort(() => Math.random() - 0.5)
          setProducts(shuffled.slice(0, limit))
        }
      } catch (error) {
        console.error('Error loading related products:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadRelatedProducts()
  }, [currentProductId, limit])

  if (loading) {
    return (
      <section className="py-8 bg-gradient-to-br from-[#F6F1EE] via-[#F6F1EE] to-[#CDA09B]/20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="inline-block animate-pulse">
              <Sparkles className="w-6 h-6 text-[#CDA09B]" />
            </div>
            <p className="text-gray-500 mt-2 text-sm">Loading recommendations...</p>
          </div>
        </div>
      </section>
    )
  }

  if (products.length === 0) return null

  return (
    <section className="py-8 bg-gradient-to-br from-[#F6F1EE] via-[#F6F1EE] to-[#CDA09B]/20">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-center justify-center mb-6">
          <Sparkles className="w-4 h-4 text-[#CDA09B] mr-2" />
          <h2 className="text-2xl md:text-3xl font-bold text-center">
            You May Also Like
          </h2>
          <Sparkles className="w-4 h-4 text-[#CDA09B] ml-2" />
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
          {products.map((product, index) => {
            // Parse images - handle both string and already-parsed array
            let imageUrl = '/placeholder-product.jpg'
            try {
              let images
              if (typeof product.images === 'string') {
                images = JSON.parse(product.images)
              } else {
                images = product.images
              }
              
              // Images are stored as a flat array of URLs
              if (images && images.length > 0) {
                imageUrl = typeof images[0] === 'string' ? images[0] : images[0]?.url
              }
            } catch {
              // Use placeholder if parsing fails
            }

            // Ensure imageUrl is never empty
            if (!imageUrl || imageUrl.trim() === '') {
              imageUrl = '/placeholder-product.jpg'
            }

            // Get price from variants first, fall back to product price
            const variantPrices = product.variants?.map(v => v.price).filter((p): p is number => p !== null && p !== undefined) || []
            const price = variantPrices.length > 0 
              ? Math.min(...variantPrices) 
              : (typeof product.price === 'number' ? product.price : 0)

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="h-full"
              >
                <Link href={`/products/${product.slug}`} className="h-full block">
                  <div className="group bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden hover:scale-105 h-full flex flex-col">
                    {/* Product Image */}
                    <div className="relative aspect-square overflow-hidden shrink-0">
                      <ProductImage
                        src={imageUrl}
                        alt={product.name}
                        width={300}
                        height={300}
                        className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
                      />
                      
                      {/* Limited Edition Badge */}
                      {product.isLimitedEdition && (
                        <div className="absolute top-2 right-2 bg-[#FF3131] text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg">
                          Limited
                        </div>
                      )}

                      {/* New Badge (products added in last 30 days) */}
                      {new Date(product.createdAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000 && (
                        <div className="absolute top-2 left-2 bg-black text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg">
                          New
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-3 space-y-2 flex flex-col grow">
                      <h3 className="font-bold text-sm text-gray-900 line-clamp-2 group-hover:text-[#FF3131] transition-colors leading-tight min-h-10">
                        {product.name}
                      </h3>
                      
                      <p className="text-xs text-gray-600 line-clamp-1 grow">
                        {product.description}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-lg font-bold text-[#FF3131]">
                          ${price.toFixed(2)}
                        </span>
                        
                        {product.variants && product.variants.length > 1 && (
                          <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            {product.variants.length} variants
                          </span>
                        )}
                      </div>

                      {/* View Details Button - Always Visible */}
                      <div className="pt-2 mt-auto">
                        <div className="w-full bg-black text-white text-center py-1.5 rounded-lg text-xs font-semibold group-hover:bg-[#FF3131] transition-colors">
                          View Details
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* View All Products Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6"
        >
          <Link
            href="/products"
            className="inline-flex items-center gap-2 bg-black text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-[#FF3131] transition-colors text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Explore All Products
            <Sparkles className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
