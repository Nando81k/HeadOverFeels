'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Trash, ShoppingCart, Heart, ArrowLeft, Package, ShieldCheck, Truck, Sparkle, ArrowRight } from '@phosphor-icons/react'
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
        // Handle both string URLs and {url: string} objects
        const url = typeof firstImage === 'string' ? firstImage : firstImage?.url
        if (url && (url.startsWith('/') || url.startsWith('http'))) {
          return url
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-40 pb-20">
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="w-20 h-20 bg-black flex items-center justify-center mx-auto mb-6">
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
          {/* Hero Header */}
          <section className="relative bg-black pt-40 pb-20 -mt-24">
            {/* Grain overlay */}
            <div 
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              }}
            />
            
            {/* Corner accents */}
            <motion.div 
              className="absolute top-28 left-8 w-16 h-16 border-l border-t border-white/10"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
            />
            <motion.div 
              className="absolute top-28 right-8 w-16 h-16 border-r border-t border-white/10"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium mb-6"
                >
                  <ArrowLeft size={16} weight="bold" />
                  Continue shopping
                </Link>
                
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white flex items-center justify-center">
                    <Heart size={32} weight="fill" className="text-black" />
                  </div>
                  <div>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                      My Wishlist
                    </h1>
                    <p className="text-white/60 text-sm mt-1">Your saved favorites</p>
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* Bottom gradient fade */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#FAF8F5] to-transparent pointer-events-none" />
          </section>

          {/* Empty State */}
          <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className="w-24 h-24 bg-black flex items-center justify-center mx-auto mb-8">
                <Heart size={48} weight="bold" className="text-white" />
              </div>
              <h2 className="text-2xl font-black text-black mb-4">Your wishlist is empty</h2>
              <p className="text-black/60 mb-8 max-w-sm mx-auto">
                Start adding items you love to your wishlist. They&apos;ll be waiting for you here.
              </p>
              
              <Link href="/products">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group inline-flex items-center gap-3 bg-black text-white px-8 py-4 font-semibold text-sm uppercase tracking-wider transition-all duration-300 hover:bg-black/80"
                >
                  <ShoppingCart size={20} weight="bold" />
                  Start Shopping
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" weight="bold" />
                </motion.button>
              </Link>

              {/* Trust Badges */}
              <div className="mt-16 pt-8 border-t border-black/10">
                <div className="flex flex-wrap justify-center gap-8 text-sm text-black/50">
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
        {/* Hero Header */}
        <section className="relative bg-black pt-40 pb-20 -mt-24">
          {/* Grain overlay */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
          
          {/* Corner accents */}
          <motion.div 
            className="absolute top-28 left-8 w-16 h-16 border-l border-t border-white/10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
          />
          <motion.div 
            className="absolute top-28 right-8 w-16 h-16 border-r border-t border-white/10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
          />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Link
                href="/products"
                className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium mb-6"
              >
                <ArrowLeft size={16} weight="bold" />
                Continue shopping
              </Link>
              
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white flex items-center justify-center">
                    <Heart size={32} weight="fill" className="text-black" />
                  </div>
                  <div>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                      My Wishlist
                    </h1>
                    <p className="text-white/60 text-sm mt-1">
                      {items.length} {items.length === 1 ? 'item' : 'items'} saved for later
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm">
                  <Sparkle size={18} weight="fill" className="text-white" />
                  <span className="font-bold text-white text-sm uppercase tracking-wider">{items.length} Favorites</span>
                </div>
              </div>
            </motion.div>
          </div>
          
          {/* Bottom gradient fade */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#FAF8F5] to-transparent pointer-events-none" />
        </section>

        {/* Product Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
                    className="group bg-white overflow-hidden border border-black/5 hover:border-black/20 transition-all duration-300 hover:shadow-xl"
                  >
                    {/* Product Image */}
                    <Link href={`/products/${item.product.slug}`}>
                      <div className="relative aspect-square overflow-hidden bg-[#FAF8F5]">
                        <Image
                          src={imageUrl}
                          alt={item.product.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        
                        {/* Out of Stock Overlay */}
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                            <span className="text-white font-bold text-sm px-4 py-2 bg-black/50">
                              Out of Stock
                            </span>
                          </div>
                        )}

                        {/* Heart Badge - Top Left */}
                        <div className="absolute top-3 left-3 p-2 bg-black">
                          <Heart size={14} weight="fill" className="text-white" />
                        </div>

                        {/* Remove Button - Top Right */}
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            handleRemove(item.id, item.productId, item.productVariant?.id)
                          }}
                          className="absolute top-3 right-3 p-2.5 bg-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-black hover:text-white"
                          aria-label="Remove from wishlist"
                        >
                          <Trash size={16} weight="bold" />
                        </button>
                      </div>
                    </Link>

                    {/* Product Info */}
                    <div className="p-5">
                      <Link href={`/products/${item.product.slug}`}>
                        <h3 className="font-bold text-black hover:text-black/70 transition-colors line-clamp-2 mb-2">
                          {item.product.name}
                        </h3>
                      </Link>

                      {/* Variant Info */}
                      {item.productVariant && (item.productVariant.size || item.productVariant.color) && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {item.productVariant.size && (
                            <span className="text-xs font-medium px-2.5 py-1 bg-black/5 text-black/70">
                              {item.productVariant.size}
                            </span>
                          )}
                          {item.productVariant.color && (
                            <span className="text-xs font-medium px-2.5 py-1 bg-black/5 text-black/70">
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
                        <p className="text-sm text-black/60 italic mb-4 line-clamp-2 bg-black/5 px-3 py-2 border-l-2 border-black">
                          &ldquo;{item.notes}&rdquo;
                        </p>
                      )}

                      {/* Action Button */}
                      <Link
                        href={`/products/${item.product.slug}`}
                        className="group/btn flex items-center justify-center gap-2 w-full bg-black text-white py-3 font-semibold text-sm uppercase tracking-wider hover:bg-black/80 transition-all duration-200"
                      >
                        <ShoppingCart size={18} weight="bold" />
                        View Product
                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-1" weight="bold" />
                      </Link>

                      {/* Added Date */}
                      <p className="text-[10px] text-black/40 text-center mt-3 uppercase tracking-widest">
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
