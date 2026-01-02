'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { productApi, Product } from '@/lib/api/products'
import ProductImage from '@/components/ui/ProductImage'
import { Sparkle, Heart, CaretLeft, CaretRight, Eye } from '@phosphor-icons/react'

interface RelatedProductsProps {
  currentProductId: string
  limit?: number
}

export function RelatedProducts({ currentProductId, limit = 8 }: RelatedProductsProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

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

  const checkScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
      setTimeout(checkScrollButtons, 300)
    }
  }

  useEffect(() => {
    checkScrollButtons()
    const scrollContainer = scrollRef.current
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkScrollButtons)
      return () => scrollContainer.removeEventListener('scroll', checkScrollButtons)
    }
  }, [products])

  if (loading) {
    return (
      <section className="py-10">
        <div className="flex items-center justify-center gap-3">
          <div className="animate-pulse">
            <Sparkle size={20} weight="fill" className="text-violet-500" />
          </div>
          <p className="text-gray-500 text-sm">Finding products you&apos;ll love...</p>
        </div>
      </section>
    )
  }

  if (products.length === 0) return null

  return (
    <section className="py-10 relative">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Sparkle size={20} weight="fill" className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              You May Also Like
            </h2>
            <p className="text-sm text-gray-500">Curated picks just for you</p>
          </div>
        </div>
        
        {/* Navigation Arrows */}
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              canScrollLeft 
                ? 'bg-black text-white hover:bg-gray-800' 
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >
            <CaretLeft size={20} weight="bold" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              canScrollRight 
                ? 'bg-black text-white hover:bg-gray-800' 
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >
            <CaretRight size={20} weight="bold" />
          </button>
        </div>
      </div>

      {/* Products Carousel */}
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {products.map((product, index) => {
          // Parse images
          let imageUrl = '/placeholder-product.jpg'
          try {
            let images
            if (typeof product.images === 'string') {
              images = JSON.parse(product.images)
            } else {
              images = product.images
            }
            
            if (images && images.length > 0) {
              imageUrl = typeof images[0] === 'string' ? images[0] : images[0]?.url
            }
          } catch {
            // Use placeholder
          }

          if (!imageUrl || imageUrl.trim() === '') {
            imageUrl = '/placeholder-product.jpg'
          }

          const variantPrices = product.variants?.map(v => v.price).filter((p): p is number => p !== null && p !== undefined) || []
          const price = variantPrices.length > 0 
            ? Math.min(...variantPrices) 
            : (typeof product.price === 'number' ? product.price : 0)

          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex-none w-[200px] snap-start"
            >
              <Link href={`/products/${product.slug}`} className="block group">
                <div className="relative bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-violet-200 hover:shadow-xl transition-all duration-300">
                  {/* Image Container */}
                  <div className="relative aspect-square overflow-hidden bg-gray-50">
                    <ProductImage
                      src={imageUrl}
                      alt={product.name}
                      width={200}
                      height={200}
                      className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
                    />
                    
                    {/* Overlay on Hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
                        <div className="bg-white rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
                          <Eye size={16} weight="bold" className="text-gray-700" />
                          <span className="text-xs font-semibold text-gray-700">Quick View</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Wishlist Button */}
                    <button 
                      className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 hover:scale-110"
                      onClick={(e) => {
                        e.preventDefault()
                        // Add wishlist functionality
                      }}
                    >
                      <Heart size={16} weight="bold" className="text-gray-600 hover:text-rose-500" />
                    </button>

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1">
                      {product.isLimitedEdition && (
                        <span className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow">
                          Limited
                        </span>
                      )}
                      {new Date(product.createdAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000 && (
                        <span className="bg-gradient-to-r from-violet-500 to-purple-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow">
                          New
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-3">
                    <h3 className="font-semibold text-sm text-gray-900 line-clamp-1 group-hover:text-violet-600 transition-colors mb-1">
                      {product.name}
                    </h3>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                        ${price.toFixed(2)}
                      </span>
                      
                      {product.variants && product.variants.length > 1 && (
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {product.variants.length} options
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>

      {/* View All Link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center mt-6"
      >
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors"
        >
          <span>Browse All Products</span>
          <CaretRight size={16} weight="bold" />
        </Link>
      </motion.div>
    </section>
  )
}
