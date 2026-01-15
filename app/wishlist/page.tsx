'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Trash, ShoppingCart, Heart, ArrowLeft, Package, ShieldCheck, Truck, Sparkle } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWishlistStore } from '@/lib/store/wishlist'
import { Navigation } from '@/components/layout/Navigation'

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
  const { syncWithServer, removeFromWishlist: removeFromStore } = useWishlistStore()
  const [items, setItems] = useState<WishlistItem[]>([])

  const fetchWishlist = useCallback(async () => {
    try {
      setIsLoading(true)
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
      await fetch(`/api/wishlist/${id}`, {
        method: 'DELETE'
      })
      setItems(items.filter(item => item.id !== id))
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
        if (firstImage?.url && (firstImage.url.startsWith('/') || firstImage.url.startsWith('http'))) {
          return firstImage.url
        }
      }
      return '/placeholder-product.jpg'
    } catch {
      return '/placeholder-product.jpg'
    }
  }

  if (isLoading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-[#FAF8F5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Heart size={36} weight="fill" className="text-white animate-pulse" />
                </div>
                <p className="text-xl font-bold text-black">Loading your wishlist...</p>
                <p className="text-sm text-black/50 mt-2">Gathering your favorite items</p>
              </motion.div>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (items.length === 0) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-[#FAF8F5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-10"
            >
              <Link
                href="/products"
                className="inline-flex items-center gap-2 text-black/60 hover:text-black transition-colors text-sm font-medium mb-4"
              >
                <ArrowLeft size={16} weight="bold" />
                Continue shopping
              </Link>
              
              <h1 className="text-4xl md:text-5xl font-black tracking-tight logo-font text-black">
                My Wishlist
              </h1>
            </motion.div>

            {/* Empty State Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="max-w-lg mx-auto"
            >
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                {/* Gradient Header */}
                <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-8 py-10 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
                    <Heart size={40} weight="bold" className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Your wishlist is empty</h2>
                </div>
                
                {/* Content */}
                <div className="p-8 text-center">
                  <p className="text-black/60 mb-8">
                    Start adding items you love to your wishlist. They&apos;ll be waiting for you here.
                  </p>
                  
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-2 bg-black hover:bg-black/80 text-white px-8 py-4 rounded-full font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                  >
                    <ShoppingCart size={20} weight="bold" />
                    Start Shopping
                  </Link>

                  {/* Trust Badges */}
                  <div className="mt-10 pt-6 border-t border-black/5">
                    <div className="flex flex-wrap justify-center gap-6 text-sm text-black/50">
                      {[
                        { icon: ShieldCheck, text: 'Secure checkout' },
                        { icon: Package, text: 'Free returns' },
                        { icon: Truck, text: 'Fast shipping' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <item.icon size={16} weight="bold" />
                          <span>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-[#FAF8F5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
          {/* Back Link */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-black/60 hover:text-black transition-colors text-sm font-medium mb-6"
            >
              <ArrowLeft size={16} weight="bold" />
              Continue shopping
            </Link>
          </motion.div>

          {/* Header Card with Gradient */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-8"
          >
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-8 md:px-8">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Heart size={28} weight="fill" className="text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl md:text-3xl font-black text-white">
                        My Wishlist
                      </h1>
                      <p className="text-white/80 text-sm mt-0.5">
                        {items.length} {items.length === 1 ? 'item' : 'items'} saved for later
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
                    <Sparkle size={18} weight="fill" className="text-white" />
                    <span className="font-bold text-white">{items.length} Favorites</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Product Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {items.map((item, index) => {
                const productPrice = item.productVariant?.price || item.product.price
                const imageUrl = getProductImage(item.product.images)
                const isOutOfStock = !item.product.isActive || 
                  (item.productVariant && item.productVariant.inventory <= 0)

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="group bg-white rounded-2xl overflow-hidden border border-black/5 shadow-sm hover:shadow-xl hover:border-rose-200 transition-all duration-300"
                  >
                    {/* Product Image */}
                    <Link href={`/products/${item.product.slug}`}>
                      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-black/2 to-black/5">
                        <Image
                          src={imageUrl}
                          alt={item.product.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        
                        {/* Out of Stock Overlay */}
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                            <span className="text-white font-bold text-sm px-4 py-2 bg-black/50 rounded-full">
                              Out of Stock
                            </span>
                          </div>
                        )}

                        {/* Heart Badge - Top Left */}
                        <div className="absolute top-3 left-3 p-2 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full shadow-md">
                          <Heart size={14} weight="fill" className="text-white" />
                        </div>

                        {/* Remove Button - Top Right */}
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            handleRemove(item.id, item.productId, item.productVariant?.id)
                          }}
                          className="absolute top-3 right-3 p-2.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-rose-500 hover:text-white"
                          aria-label="Remove from wishlist"
                        >
                          <Trash size={16} weight="bold" />
                        </button>
                      </div>
                    </Link>

                    {/* Product Info */}
                    <div className="p-5">
                      <Link href={`/products/${item.product.slug}`}>
                        <h3 className="font-bold text-black hover:text-rose-600 transition-colors line-clamp-2 mb-2">
                          {item.product.name}
                        </h3>
                      </Link>

                      {/* Variant Info */}
                      {item.productVariant && (item.productVariant.size || item.productVariant.color) && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {item.productVariant.size && (
                            <span className="text-xs font-medium px-2.5 py-1 bg-rose-50 rounded-full text-rose-600">
                              {item.productVariant.size}
                            </span>
                          )}
                          {item.productVariant.color && (
                            <span className="text-xs font-medium px-2.5 py-1 bg-rose-50 rounded-full text-rose-600">
                              {item.productVariant.color}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Price */}
                      <p className="text-xl font-black text-black mb-4">
                        ${productPrice.toFixed(2)}
                      </p>

                      {/* Notes */}
                      {item.notes && (
                        <p className="text-sm text-black/60 italic mb-4 line-clamp-2 bg-rose-50 px-3 py-2 rounded-xl border border-rose-100">
                          &ldquo;{item.notes}&rdquo;
                        </p>
                      )}

                      {/* Action Button */}
                      <Link
                        href={`/products/${item.product.slug}`}
                        className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white py-3 rounded-xl font-semibold hover:from-rose-600 hover:to-pink-700 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <ShoppingCart size={18} weight="bold" />
                        View Product
                      </Link>

                      {/* Added Date */}
                      <p className="text-xs text-black/40 text-center mt-3">
                        Added {new Date(item.createdAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </>
  )
}
