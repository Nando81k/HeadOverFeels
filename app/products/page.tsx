'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/layout/Navigation'
import { productApi, Product } from '@/lib/api/products'
import { ProductCard } from '@/components/products/ProductCard'
import { ProductFilters, FilterState } from '@/components/products/ProductFilters'
import { Loader2, SlidersHorizontal } from 'lucide-react'

export default function ProductsPage() {
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

  const pageTitle = categorySlug 
    ? getCategoryName(categorySlug)
    : 'All Products'

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <Navigation />
      
      {/* Simple Header - Comfrt Style */}
      <div className="bg-[#FAF8F5] border-b border-[#E5DDD5] pt-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          {categorySlug && (
            <div className="mb-3">
              <Link 
                href="/products" 
                className="text-sm text-[#6B6B6B] hover:text-[#FF3131] transition-colors"
              >
                ← All Products
              </Link>
            </div>
          )}
          
          <h1 className="text-3xl md:text-4xl font-bold text-[#2B2B2B] tracking-tight">
            {pageTitle}
          </h1>
          
          {/* Category description */}
          {categorySlug && (
            <p className="mt-2 text-[#6B6B6B]">
              {categorySlug === 'hoodies' && 'Stay warm in style with our premium hoodies and sweatshirts'}
              {categorySlug === 'tees' && 'Essential everyday pieces for your streetwear collection'}
              {categorySlug === 'accessories' && 'Complete your look with our curated accessories'}
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Bar: Filters Button + Sort + Results Count */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#E5DDD5]">
          {/* Left: Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#2B2B2B] hover:bg-[#F5F1EB] rounded-lg transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
          </button>

          {/* Right: Results Count + Sort */}
          <div className="flex items-center gap-6">
            <p className="text-sm text-[#6B6B6B]">
              {loading ? (
                'Loading...'
              ) : (
                `${filteredProducts.length} ${filteredProducts.length === 1 ? 'Product' : 'Products'}`
              )}
            </p>
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
            <div className="flex justify-center items-center py-32">
              <Loader2 className="w-10 h-10 animate-spin text-[#6B6B6B]" />
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredProducts.length === 0 && (
            <div className="text-center py-32">
              <p className="text-[#2B2B2B] text-xl font-medium mb-2">No products found</p>
              <p className="text-[#6B6B6B]">Try adjusting your filters or search criteria</p>
            </div>
          )}

          {/* Products Grid - Comfrt Style: 4 columns full width */}
          {!loading && filteredProducts.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
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
