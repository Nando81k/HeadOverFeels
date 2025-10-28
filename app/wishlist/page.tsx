'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Trash2, ShoppingCart, Heart, Sparkles, Home } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWishlistStore } from '@/lib/store/wishlist'

interface WishlistItem {
  id: string
  productId: string
  notes?: string | null
  createdAt: Date
  product: {
    id: string
    name: string
    slug: string
    price: number
    images: string
    isActive: boolean
  }
  productVariant?: {
    id: string
    size?: string | null
    color?: string | null
    price?: number | null
    inventory: number
  } | null
}

export default function WishlistPage() {
  const [isLoading, setIsLoading] = useState(true)
  const { loadWishlist, syncWithServer, removeFromWishlist: removeFromStore } = useWishlistStore()
  const [items, setItems] = useState<WishlistItem[]>([])

  const fetchWishlist = useCallback(async () => {
    try {
      setIsLoading(true)
      // Force sync with server to get fresh data
      await syncWithServer()
      const response = await fetch('/api/wishlist')
      const { data } = await response.json()
      setItems(data || [])
    } catch (error) {
      console.error('Error fetching wishlist:', error)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [syncWithServer])

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])

  const handleRemove = async (id: string, productId: string, productVariantId?: string | null) => {
    try {
      // Remove from API
      await fetch(`/api/wishlist/${id}`, {
        method: 'DELETE'
      })
      // Update local state
      setItems(items.filter(item => item.id !== id))
      // Update Zustand store to sync the badge count
      await removeFromStore(productId, productVariantId || undefined)
    } catch (error) {
      console.error('Error removing item:', error)
    }
  }

  const getProductImage = (imagesJson: string) => {
    try {
      const images = JSON.parse(imagesJson)
      if (Array.isArray(images) && images.length > 0) {
        const firstImage = images[0]
        // Extract url from {url, alt} object
        if (firstImage?.url && (firstImage.url.startsWith('/') || firstImage.url.startsWith('http'))) {
          return firstImage.url
        }
      }
      return '/placeholder-product.jpg'
    } catch (error) {
      console.error('Error parsing images JSON:', error)
      return '/placeholder-product.jpg'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F6F1EE] via-[#F6F1EE] to-[#CDA09B]/20">
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <Heart className="w-16 h-16 text-[#FF3131] mx-auto mb-4 animate-pulse" />
              <p className="text-xl font-medium text-gray-800">Loading your wishlist...</p>
              <p className="text-sm text-gray-500 mt-2">Gathering your favorite items</p>
            </motion.div>
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F6F1EE] via-[#F6F1EE] to-[#CDA09B]/20">
        <div className="container mx-auto px-4 py-16">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight">
              My Wishlist
            </h1>
            <p className="text-lg text-gray-600">Your curated collection of desires</p>
          </motion.div>

          {/* Empty State */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-center py-20"
          >
            <div className="max-w-md mx-auto">
              <div className="relative inline-block mb-8">
                <Heart className="w-24 h-24 text-[#CDA09B] mx-auto" strokeWidth={1.5} />
                <Sparkles className="w-8 h-8 text-[#FF3131] absolute -top-2 -right-2 animate-pulse" />
              </div>
              
              <h2 className="text-3xl font-bold mb-4">Your Wishlist Awaits</h2>
              <p className="text-lg text-gray-600 mb-8">
                Start building your dream collection of streetwear essentials
              </p>
              
              <Link
                href="/products"
                className="group inline-flex items-center gap-3 bg-[#FF3131] text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-black transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Explore Products
                <ShoppingCart className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F6F1EE] via-[#F6F1EE] to-[#CDA09B]/20">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold mb-3 tracking-tight">
                My Wishlist
              </h1>
              <p className="text-lg text-gray-600">
                {items.length} {items.length === 1 ? 'item' : 'items'} saved for later
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2 bg-white px-6 py-3 rounded-full shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold group"
              >
                <Home className="w-5 h-5 text-gray-700 group-hover:text-[#FF3131] transition-colors" />
                <span className="hidden sm:inline">Home</span>
              </Link>
              
              <div className="flex items-center gap-2 bg-white px-6 py-3 rounded-full shadow-md">
                <Heart className="w-5 h-5 text-[#FF3131] fill-[#FF3131]" />
                <span className="font-semibold text-lg">{items.length}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {items.map((item, index) => {
              const productPrice = item.productVariant?.price || item.product.price
              const images = getProductImage(item.product.images)
              const isOutOfStock = !item.product.isActive || 
                (item.productVariant && item.productVariant.inventory <= 0)

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05, duration: 0.4 }}
                  className="group relative bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Product Image */}
                  <Link href={`/products/${item.product.slug}`}>
                    <div className="relative aspect-square overflow-hidden bg-gray-100">
                      <Image
                        src={images}
                        alt={item.product.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      
                      {/* Out of Stock Overlay */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                          <div className="text-center">
                            <span className="text-white font-bold text-lg">Out of Stock</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Gradient Overlay on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  </Link>

                  {/* Product Info */}
                  <div className="p-5">
                    <Link href={`/products/${item.product.slug}`}>
                      <h3 className="font-bold text-lg mb-2 hover:text-[#FF3131] transition-colors line-clamp-2 min-h-14">
                        {item.product.name}
                      </h3>
                    </Link>

                    {/* Variant Info */}
                    {item.productVariant && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {item.productVariant.size && (
                          <span className="text-xs font-medium px-3 py-1 bg-gray-100 rounded-full">
                            {item.productVariant.size}
                          </span>
                        )}
                        {item.productVariant.color && (
                          <span className="text-xs font-medium px-3 py-1 bg-gray-100 rounded-full">
                            {item.productVariant.color}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Price */}
                    <p className="text-2xl font-bold mb-4 text-[#FF3131]">
                      ${productPrice.toFixed(2)}
                    </p>

                    {/* Notes */}
                    {item.notes && (
                      <p className="text-sm text-gray-600 italic mb-4 line-clamp-2 bg-gray-50 px-3 py-2 rounded-lg">
                        &ldquo;{item.notes}&rdquo;
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 mb-3">
                      <Link
                        href={`/products/${item.product.slug}`}
                        className="flex-1 bg-black text-white px-4 py-3 rounded-xl hover:bg-[#FF3131] transition-all duration-300 flex items-center justify-center gap-2 font-semibold group/btn"
                      >
                        <ShoppingCart size={18} className="group-hover/btn:scale-110 transition-transform" />
                        View
                      </Link>
                      <button
                        onClick={() => handleRemove(item.id, item.productId, item.productVariant?.id)}
                        className="px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-[#FF3131] hover:bg-[#FF3131]/5 transition-all duration-300 group/del"
                        aria-label="Remove from wishlist"
                      >
                        <Trash2 
                          size={18} 
                          className="text-gray-600 group-hover/del:text-[#FF3131] group-hover/del:scale-110 transition-all" 
                        />
                      </button>
                    </div>

                    {/* Added Date */}
                    <p className="text-xs text-gray-400 text-center">
                      Added {new Date(item.createdAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
