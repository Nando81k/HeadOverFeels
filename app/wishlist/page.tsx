'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Trash, ShoppingCart, Heart, Package, ShieldCheck, Truck, Sparkle, ArrowRight, Eye, X, Fire } from '@phosphor-icons/react'
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
  const [removingId, setRemovingId] = useState<string | null>(null)

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
    setRemovingId(id)
    try {
      await fetch(`/api/wishlist/${id}`, {
        method: 'DELETE'
      })
      setItems(items.filter(item => item.id !== id))
      await removeFromStore(productId, productVariantId || undefined)
    } catch (error) {
      console.error('Error removing item:', error)
    } finally {
      setRemovingId(null)
    }
  }

  const getProductImage = (imagesJson: string) => {
    try {
      const images = JSON.parse(imagesJson)
      if (Array.isArray(images) && images.length > 0) {
        const firstImage = images[0]
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

  // Loading State - Editorial Style
  if (isLoading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3 md:gap-4 pt-20 md:pt-0">
          <div className="relative">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-black flex items-center justify-center">
              <Heart size={20} weight="fill" className="text-white md:hidden" />
              <Heart size={28} weight="fill" className="text-white hidden md:block" />
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-2 border-2 border-black/10 border-t-black"
            />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Loading Wishlist</p>
        </div>
      </>
    )
  }

  // Empty State - Editorial Style
  if (items.length === 0) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-white pt-20 md:pt-0">
          <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.02]">
              <div className="absolute inset-0" style={{
                backgroundImage: 'repeating-linear-gradient(0deg, black 0px, black 1px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, black 0px, black 1px, transparent 1px, transparent 60px)'
              }} />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto px-4 text-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8 md:mb-12"
              >
                <div className="relative inline-block">
                  <motion.div 
                    className="w-20 h-20 md:w-32 md:h-32 bg-black flex items-center justify-center mx-auto"
                    whileHover={{ scale: 1.02 }}
                  >
                    <Heart size={40} weight="bold" className="text-white md:hidden" />
                    <Heart size={64} weight="bold" className="text-white hidden md:block" />
                  </motion.div>
                  
                  <motion.div
                    animate={{ y: [-5, 5, -5], rotate: [0, 5, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute -top-2 -right-2 md:-top-4 md:-right-4"
                  >
                    <Sparkle size={20} weight="fill" className="text-black md:hidden" />
                    <Sparkle size={28} weight="fill" className="text-white hidden md:block" />
                  </motion.div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-black/40 mb-2 md:mb-4">Your Wishlist</p>
                <h1 className="text-2xl md:text-4xl lg:text-6xl font-black text-black mb-4 md:mb-6 tracking-tight">
                  Nothing Saved Yet
                </h1>
                <p className="text-sm md:text-lg text-black/50 max-w-md mx-auto mb-6 md:mb-10 leading-relaxed">
                  Start curating your collection by saving items you love.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center"
              >
                <Link href="/products">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full sm:w-auto bg-black text-white px-6 py-3 md:px-10 md:py-5 font-black text-xs md:text-sm uppercase tracking-widest hover:bg-black/90 transition-colors group flex items-center justify-center gap-2 md:gap-3"
                  >
                    Browse Collection
                    <ArrowRight size={16} weight="bold" className="group-hover:translate-x-1 transition-transform md:hidden" />
                    <ArrowRight size={18} weight="bold" className="group-hover:translate-x-1 transition-transform hidden md:block" />
                  </motion.button>
                </Link>
                <Link href="/drops">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full sm:w-auto border-2 border-black text-black px-6 py-3 md:px-10 md:py-5 font-black text-xs md:text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all group flex items-center justify-center gap-2 md:gap-3"
                  >
                    <Fire size={16} weight="bold" className="md:hidden" />
                    <Fire size={18} weight="bold" className="hidden md:block" />
                    View Drops
                  </motion.button>
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="mt-10 md:mt-16 pt-8 md:pt-12 border-t border-black/10"
              >
                <div className="flex flex-wrap justify-center gap-4 md:gap-8 lg:gap-12">
                  {[
                    { icon: Truck, label: 'Free Ship', sub: '$100+' },
                    { icon: ShieldCheck, label: 'Secure', sub: 'Synced' },
                    { icon: Package, label: 'Returns', sub: '30 Days' },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 + i * 0.1 }}
                      className="flex items-center gap-2 md:gap-3"
                    >
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-black/5 flex items-center justify-center">
                        <item.icon size={14} weight="bold" className="text-black/40 md:hidden" />
                        <item.icon size={18} weight="bold" className="text-black/40 hidden md:block" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] md:text-xs font-black text-black uppercase tracking-wide">{item.label}</p>
                        <p className="text-[9px] md:text-[10px] text-black/40 uppercase tracking-wider">{item.sub}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Main Wishlist View
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-28 pb-4 md:pb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 md:gap-4">
                <div className="w-9 h-9 md:w-12 md:h-12 bg-black flex items-center justify-center">
                  <Heart size={16} weight="fill" className="text-white md:hidden" />
                  <Heart size={22} weight="fill" className="text-white hidden md:block" />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-0.5 md:mb-1">My Collection</p>
                  <h1 className="text-xl md:text-3xl lg:text-4xl font-black text-black tracking-tight">Wishlist</h1>
                </div>
              </div>
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-black/40">
                {items.length} {items.length === 1 ? 'Item' : 'Items'}
              </span>
            </motion.div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 md:py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-6"
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
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="group bg-white border border-black/5 hover:border-black transition-all duration-300"
                  >
                    {/* Product Image */}
                    <div className="relative aspect-3/4 overflow-hidden bg-[#F5F5F5]">
                      <Link href={`/products/${item.product.slug}`}>
                        <Image
                          src={imageUrl}
                          alt={item.product.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </Link>
                      
                      {/* Out of Stock Overlay */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white px-4 py-2 border border-white">
                            Sold Out
                          </span>
                        </div>
                      )}

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemove(item.id, item.productId, item.productVariant?.id)}
                        disabled={removingId === item.id}
                        className="absolute top-1.5 right-1.5 md:top-3 md:right-3 w-7 h-7 md:w-10 md:h-10 bg-white border border-black/10 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:bg-black hover:text-white hover:border-black disabled:opacity-50"
                        aria-label="Remove from wishlist"
                      >
                        {removingId === item.id ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                          >
                            <X size={12} weight="bold" className="md:hidden" />
                            <X size={16} weight="bold" className="hidden md:block" />
                          </motion.div>
                        ) : (
                          <>
                            <X size={12} weight="bold" className="md:hidden" />
                            <X size={16} weight="bold" className="hidden md:block" />
                          </>
                        )}
                      </button>

                      {/* Quick View - Desktop only */}
                      <Link
                        href={`/products/${item.product.slug}`}
                        className="hidden md:flex absolute bottom-0 left-0 right-0 bg-black text-white py-3 items-center justify-center gap-2 opacity-0 group-hover:opacity-100 translate-y-full group-hover:translate-y-0 transition-all duration-300"
                      >
                        <Eye size={16} weight="bold" />
                        <span className="text-[10px] font-black uppercase tracking-[0.15em]">Quick View</span>
                      </Link>
                    </div>

                    {/* Product Info */}
                    <div className="p-2 md:p-4">
                      {/* Variant Tags */}
                      {item.productVariant && (item.productVariant.size || item.productVariant.color) && (
                        <div className="flex flex-wrap gap-1 md:gap-1.5 mb-1 md:mb-2">
                          {item.productVariant.color && (
                            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] px-1.5 md:px-2 py-0.5 md:py-1 bg-black/5 text-black/60">
                              {item.productVariant.color}
                            </span>
                          )}
                          {item.productVariant.size && (
                            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] px-1.5 md:px-2 py-0.5 md:py-1 bg-black/5 text-black/60">
                              {item.productVariant.size}
                            </span>
                          )}
                        </div>
                      )}

                      <Link href={`/products/${item.product.slug}`}>
                        <h3 className="font-bold text-black hover:text-black/60 transition-colors line-clamp-2 mb-1 md:mb-2 text-xs md:text-sm">
                          {item.product.name}
                        </h3>
                      </Link>

                      <div className="flex items-center justify-between">
                        <p className="text-sm md:text-lg font-black text-black tabular-nums">
                          ${productPrice.toFixed(2)}
                        </p>
                        <p className="text-[8px] md:text-[9px] font-medium uppercase tracking-[0.1em] md:tracking-[0.15em] text-black/40 hidden sm:block">
                          {new Date(item.createdAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>

                      {/* Notes - hidden on mobile */}
                      {item.notes && (
                        <p className="hidden md:block text-xs text-black/50 italic mt-3 pt-3 border-t border-black/5 line-clamp-2">
                          &ldquo;{item.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>

          {/* Footer CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 md:mt-16 pt-8 md:pt-12 border-t border-black/10 text-center"
          >
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-black/40 mb-3 md:mb-4">Continue Exploring</p>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
              <Link href="/products">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-black text-white px-5 py-3 md:px-8 md:py-4 font-black text-xs md:text-sm uppercase tracking-widest hover:bg-black/90 transition-colors group flex items-center justify-center gap-2 md:gap-3"
                >
                  <ShoppingCart size={14} weight="bold" className="md:hidden" />
                  <ShoppingCart size={18} weight="bold" className="hidden md:block" />
                  <span className="md:hidden">Browse Products</span>
                  <span className="hidden md:inline">Browse All Products</span>
                </motion.button>
              </Link>
              <Link href="/drops">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="border-2 border-black text-black px-5 py-3 md:px-8 md:py-4 font-black text-xs md:text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all group flex items-center justify-center gap-2 md:gap-3"
                >
                  <Fire size={14} weight="bold" className="md:hidden" />
                  <Fire size={18} weight="bold" className="hidden md:block" />
                  <span className="md:hidden">View Drops</span>
                  <span className="hidden md:inline">View Latest Drops</span>
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
}
