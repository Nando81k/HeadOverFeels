'use client'

import { useState, useEffect, useMemo, Suspense, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion'
import { Navigation } from '@/components/layout/Navigation'
import { productApi, Product } from '@/lib/api/products'
import { ProductCard } from '@/components/products/ProductCard'
import { ProductFilters, FilterState } from '@/components/products/ProductFilters'
import { CircleNotch, Faders, ArrowRight, X } from '@phosphor-icons/react'

function ProductsContent() {
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get('search') || ''
  const categorySlug = searchParams.get('category') || ''
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    search: searchQuery,
    priceRange: [0, 500],
    sizes: [],
    inStockOnly: false,
    sortBy: 'newest',
  })

  // Update filters when search param changes
  useEffect(() => {
    if (searchQuery) {
      setFilters(prev => ({ ...prev, search: searchQuery }))
    }
  }, [searchQuery])

  // Load products
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true)
      try {
        const response = await productApi.getAll({ 
          isActive: true,
          limit: 100 
        })
        
        if (response.data && response.data.data) {
          setProducts(response.data.data)
        } else if (response.error) {
          console.error('API Error:', response.error)
          setProducts([])
        }
      } catch (error) {
        console.error('Failed to load products:', error)
        setProducts([])
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [])

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    // Ensure products is an array
    if (!Array.isArray(products)) return []
    
    let filtered = [...products]

    // Category filter (from URL parameter)
    if (categorySlug) {
      filtered = filtered.filter(p => 
        p.category?.slug === categorySlug
      )
    }

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase()
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search)
      )
    }

    // Price range filter
    filtered = filtered.filter(p => 
      p.price >= filters.priceRange[0] && 
      p.price <= filters.priceRange[1]
    )

    // Size filter
    if (filters.sizes.length > 0) {
      filtered = filtered.filter(p =>
        p.variants.some(v => 
          v.size && filters.sizes.includes(v.size)
        )
      )
    }

    // In stock filter
    if (filters.inStockOnly) {
      filtered = filtered.filter(p => {
        const totalStock = p.variants.reduce((sum, v) => sum + v.inventory, 0)
        return totalStock > 0
      })
    }

    // Sort
    switch (filters.sortBy) {
      case 'price-asc':
        filtered.sort((a, b) => a.price - b.price)
        break
      case 'price-desc':
        filtered.sort((a, b) => b.price - a.price)
        break
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'newest':
      default:
        filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
    }

    return filtered
  }, [products, filters, categorySlug])

  // Get category name for display
  const getCategoryName = (slug: string) => {
    const categoryNames: { [key: string]: string } = {
      'hoodies': 'Hoodies & Sweatshirts',
      'tees': 'T - Shirts',
      'tshirts': 'T - Shirts',
      't-shirts': 'T - Shirts',
      'tops': 'T - Shirts',
      'jackets': 'Jackets',
      'bottoms': 'Bottoms',
      'accessories': 'Accessories'
    }
    return categoryNames[slug] || 'Products'
  }

  const getCategoryDescription = (slug: string) => {
    const descriptions: { [key: string]: string } = {
      'hoodies': 'Stay warm in style with our premium hoodies and sweatshirts. Crafted for comfort and designed to make a statement.',
      'tees': 'Essential everyday pieces for your streetwear collection. Quality basics that never go out of style.',
      'tshirts': 'Essential everyday pieces for your streetwear collection. Quality basics that never go out of style.',
      't-shirts': 'Essential everyday pieces for your streetwear collection. Quality basics that never go out of style.',
      'jackets': 'Outerwear built for style and function — explore jackets that stand up to the elements while keeping you on-trend.',
      'bottoms': 'From relaxed joggers to tailored pants, find the perfect bottoms to complete your look.',
      'accessories': 'Complete your look with our curated accessories. The perfect finishing touches for any outfit.'
    }
    return descriptions[slug] || 'Discover our latest collection of premium streetwear pieces designed for authentic expression.'
  }

  const pageTitle = categorySlug 
    ? getCategoryName(categorySlug)
    : 'All Products'

  const pageDescription = getCategoryDescription(categorySlug)

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      {/* Hero Section - Full Width */}
      <section className="relative min-h-[280px] sm:min-h-[400px] bg-white py-8 sm:py-12 lg:py-16 pt-20 sm:pt-24 lg:pt-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex flex-col justify-center">
          {/* Breadcrumb */}
          {categorySlug && (
            <Link 
              href="/products" 
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-black/70 hover:text-black transition-colors mb-2 sm:mb-3 w-fit"
            >
              <span>←</span>
              <span>All Products</span>
            </Link>
          )}
          
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black text-black mb-2 sm:mb-4 tracking-tight max-w-3xl">
            {pageTitle}
          </h1>
          
          <p className="text-base sm:text-xl lg:text-2xl text-black/70 max-w-2xl leading-relaxed mb-4 sm:mb-6">
            {pageDescription}
          </p>

          <div className="flex items-center gap-4">
            <span className="text-black/60 text-xs sm:text-sm uppercase tracking-wider">
              {loading ? 'Loading...' : `${filteredProducts.length} ${filteredProducts.length === 1 ? 'Product' : 'Products'}`}
            </span>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-12 py-4 sm:py-6 lg:py-8">
        {/* Top Bar: Filters Button + Results Count */}
        <div className="flex items-center justify-between mb-4 sm:mb-8 pb-4 sm:pb-6 border-b border-black/5">
          {/* Left: Filters Button with Badge */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="group relative flex items-center gap-3 px-6 py-3.5 text-sm font-bold text-white bg-black hover:bg-black/90 transition-all uppercase tracking-wider shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/15 hover:-translate-y-0.5"
          >
            <Faders size={20} weight="bold" className="transition-transform group-hover:rotate-12" />
            <span>Filter & Sort</span>
            {(filters.search || filters.sizes.length > 0 || filters.inStockOnly || filters.priceRange[1] < 500) && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-white text-black rounded-full flex items-center justify-center text-xs font-black shadow-md">
                {[filters.search, filters.sizes.length > 0, filters.inStockOnly, filters.priceRange[1] < 500].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Right: Results Count */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-black/50 font-medium tracking-wide">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
                  Loading...
                </span>
              ) : (
                <span>
                  <span className="font-bold text-black">{filteredProducts.length}</span> {filteredProducts.length === 1 ? 'product' : 'products'}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Filters Overlay - Swipeable Bottom Sheet on Mobile, Side Panel on Desktop */}
        <AnimatePresence>
          {showFilters && (
            <>
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowFilters(false)}
              />
              
              {/* Desktop: Side Panel */}
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="hidden lg:block fixed inset-y-0 left-0 z-50 w-[340px] max-w-[85vw] bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Panel Header */}
                <div className="sticky top-0 z-10 bg-white border-b border-black/5 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-black text-black tracking-tight">Filters</h2>
                      <p className="text-xs text-black/40 mt-0.5">Refine your search</p>
                    </div>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="w-10 h-10 flex items-center justify-center text-black/40 hover:text-black hover:bg-black/5 transition-all rounded-full"
                    >
                      <X size={22} weight="bold" />
                    </button>
                  </div>
                </div>
                
                {/* Panel Content */}
                <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
                  <ProductFilters 
                    onFilterChange={(newFilters) => {
                      setFilters(newFilters)
                    }} 
                    initialFilters={filters}
                  />
                </div>
                
                {/* Panel Footer - Apply Button */}
                <div 
                  className="sticky bottom-0 p-4 bg-gradient-to-t from-white via-white to-white/90 border-t border-black/5"
                >
                  <button
                    onClick={() => setShowFilters(false)}
                    className="w-full py-4 bg-black text-white font-bold uppercase tracking-wider text-sm hover:bg-black/90 transition-all shadow-lg"
                  >
                    View Results ({filteredProducts.length})
                  </button>
                </div>
              </motion.div>

              {/* Mobile: Swipeable Bottom Sheet */}
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.5 }}
                onDragEnd={(_, info: PanInfo) => {
                  // Close if dragged down more than 100px or with velocity
                  if (info.offset.y > 100 || info.velocity.y > 500) {
                    setShowFilters(false)
                  }
                }}
                className="lg:hidden fixed inset-x-0 bottom-0 z-50 max-h-[85vh] bg-white shadow-2xl rounded-t-3xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drag Handle - swipe indicator */}
                <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none">
                  <div className="w-12 h-1.5 bg-black/20 rounded-full" />
                </div>

                {/* Panel Header */}
                <div className="sticky top-0 z-10 bg-white border-b border-black/5 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-black text-black tracking-tight">Filters</h2>
                      <p className="text-xs text-black/40 mt-0.5">Refine your search</p>
                    </div>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="w-10 h-10 flex items-center justify-center text-black/40 hover:text-black hover:bg-black/5 transition-all rounded-full"
                    >
                      <X size={22} weight="bold" />
                    </button>
                  </div>
                </div>
                
                {/* Panel Content */}
                <div className="p-6 overflow-y-auto touch-pan-y" style={{ maxHeight: 'calc(85vh - 180px)' }}>
                  <ProductFilters 
                    onFilterChange={(newFilters) => {
                      setFilters(newFilters)
                    }} 
                    initialFilters={filters}
                  />
                </div>
                
                {/* Panel Footer - Apply Button */}
                <div 
                  className="sticky bottom-0 p-4 bg-gradient-to-t from-white via-white to-white/90 border-t border-black/5"
                  style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
                >
                  <button
                    onClick={() => setShowFilters(false)}
                    className="w-full py-4 bg-black text-white font-bold uppercase tracking-wider text-sm hover:bg-black/90 transition-all shadow-lg"
                  >
                    View Results ({filteredProducts.length})
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Products Grid - Full Width */}
        <div>
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col justify-center items-center py-20">
              <CircleNotch size={48} weight="bold" className="animate-spin text-black mb-4" />
              <p className="text-black/70">Loading products...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredProducts.length === 0 && (
            <div className="text-center py-20 px-6">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-none bg-black/5 flex items-center justify-center">
                  <Faders size={40} weight="bold" className="text-black/40" />
                </div>
                <h3 className="text-2xl font-black text-black mb-3">No products found</h3>
                <p className="text-black/70 mb-6">Try adjusting your filters or search criteria to find what you&apos;re looking for.</p>
                <button
                  onClick={() => setFilters({
                    search: '',
                    priceRange: [0, 500],
                    sizes: [],
                    inStockOnly: false,
                    sortBy: 'newest',
                  })}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-none hover:bg-black/90 transition-all font-bold uppercase tracking-wider"
                >
                  Clear all filters
                  <ArrowRight size={16} weight="bold" />
                </button>
              </div>
            </div>
          )}

          {/* Products Grid - 2 cols on mobile, 3 on tablet, 4 on desktop */}
          {!loading && filteredProducts.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    }>
      <ProductsContent />
    </Suspense>
  )
}
