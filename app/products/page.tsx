'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Navigation } from '@/components/layout/Navigation'
import { productApi, Product } from '@/lib/api/products'
import { ProductCard } from '@/components/products/ProductCard'
import { ProductFilters, FilterState } from '@/components/products/ProductFilters'
import { Loader2, SlidersHorizontal, ArrowRight } from 'lucide-react'

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
      'tees': 'Tees & Tops',
      'accessories': 'Accessories'
    }
    return categoryNames[slug] || 'Products'
  }

  const getCategoryDescription = (slug: string) => {
    const descriptions: { [key: string]: string } = {
      'hoodies': 'Stay warm in style with our premium hoodies and sweatshirts. Crafted for comfort and designed to make a statement.',
      'tees': 'Essential everyday pieces for your streetwear collection. Quality basics that never go out of style.',
      'accessories': 'Complete your look with our curated accessories. The perfect finishing touches for any outfit.'
    }
    return descriptions[slug] || 'Discover our latest collection of premium streetwear pieces designed for authentic expression.'
  }

  const getCategoryImage = (slug: string) => {
    const images: { [key: string]: string } = {
      'hoodies': '/assets/Sweatshirt_hoodie_collection.png',
      'tees': '/assets/Sweatshirt_hoodie_collection.png', // Update with actual tees image
      'accessories': '/assets/Sweatshirt_hoodie_collection.png' // Update with actual accessories image
    }
    return images[slug] || '/assets/Sweatshirt_hoodie_collection.png'
  }

  const pageTitle = categorySlug 
    ? getCategoryName(categorySlug)
    : 'All Products'

  const pageDescription = getCategoryDescription(categorySlug)
  const heroImage = getCategoryImage(categorySlug)

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      {/* Hero Section - Full Width */}
      <section className="relative h-[60vh] lg:h-[70vh] min-h-[500px] overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={heroImage}
            alt={pageTitle}
            fill
            className="object-cover object-center"
            priority
            quality={90}
          />
          <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/60 to-black/40" />
        </div>
        
        <div className="relative h-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col justify-center z-10">
          {/* Breadcrumb */}
          {categorySlug && (
            <Link 
              href="/products" 
              className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors mb-6 w-fit"
            >
              <span>←</span>
              <span>All Products</span>
            </Link>
          )}
          
          <h1 className="text-5xl lg:text-7xl font-bold text-white mb-6 tracking-tight max-w-3xl">
            {pageTitle}
          </h1>
          
          <p className="text-xl lg:text-2xl text-white/90 max-w-2xl leading-relaxed mb-8">
            {pageDescription}
          </p>

          <div className="flex items-center gap-4">
            <span className="text-white/70 text-sm uppercase tracking-wider">
              {loading ? 'Loading...' : `${filteredProducts.length} ${filteredProducts.length === 1 ? 'Product' : 'Products'}`}
            </span>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        {/* Top Bar: Filters Button + Sort */}
        <div className="flex items-center justify-between mb-10 pb-6 border-b border-gray-200">
          {/* Left: Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-3 px-6 py-3 text-sm font-semibold text-white bg-black hover:bg-[#FF3131] rounded-lg transition-all duration-300 transform hover:scale-105"
          >
            <SlidersHorizontal className="w-5 h-5" />
            <span>Filter & Sort</span>
          </button>

          {/* Right: View Toggle or Additional Actions */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 font-medium">
              Showing {loading ? '...' : filteredProducts.length} items
            </span>
          </div>
        </div>

        {/* Filters Overlay - Triggered by Button */}
        {showFilters && (
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowFilters(false)}>
            <div 
              className="absolute inset-y-0 left-0 w-80 bg-white overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {/* Close button */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-[#2B2B2B]">Filters</h2>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="text-[#6B6B6B] hover:text-[#2B2B2B] text-2xl leading-none"
                  >
                    ✕
                  </button>
                </div>
                <ProductFilters onFilterChange={setFilters} />
              </div>
            </div>
          </div>
        )}

        {/* Products Grid - Full Width */}
        <div>
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col justify-center items-center py-32">
              <Loader2 className="w-12 h-12 animate-spin text-[#FF3131] mb-4" />
              <p className="text-gray-600">Loading products...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredProducts.length === 0 && (
            <div className="text-center py-32 px-6">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                  <SlidersHorizontal className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">No products found</h3>
                <p className="text-gray-600 mb-6">Try adjusting your filters or search criteria to find what you&apos;re looking for.</p>
                <button
                  onClick={() => setFilters({
                    search: '',
                    priceRange: [0, 500],
                    sizes: [],
                    inStockOnly: false,
                    sortBy: 'newest',
                  })}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-[#FF3131] transition-all duration-300"
                >
                  Clear all filters
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Products Grid - Modern Layout with Larger Cards */}
          {!loading && filteredProducts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
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
        <Loader2 className="w-8 h-8 animate-spin text-[#FF3131]" />
      </div>
    }>
      <ProductsContent />
    </Suspense>
  )
}
