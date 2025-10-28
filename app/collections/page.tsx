'use client'

import { useState, useEffect } from 'react'
import { Navigation } from '@/components/layout/Navigation'
import { CollectionPreview } from '@/components/collections/CollectionPreview'
import { Product } from '@/lib/api/products'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CollectionWithProducts {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  products: {
    product: Product
    sortOrder: number
  }[]
  _count: {
    products: number
  }
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<CollectionWithProducts[]>([])
  const [loading, setLoading] = useState(true)

  // Load collections from API
  useEffect(() => {
    const loadCollections = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/collections?isActive=true')
        if (!response.ok) {
          throw new Error('Failed to fetch collections')
        }
        
        // API returns array directly, not wrapped in an object
        const data: CollectionWithProducts[] = await response.json()
        
        // Sort by sortOrder, then by name (API already sorts but we can ensure it)
        const sortedCollections = data.sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) {
            return a.sortOrder - b.sortOrder
          }
          return a.name.localeCompare(b.name)
        })
        setCollections(sortedCollections)
      } catch (error) {
        console.error('Failed to load collections:', error)
        setCollections([]) // Set empty array on error
      } finally {
        setLoading(false)
      }
    }

    loadCollections()
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section - Modern */}
      <section className="relative h-[70vh] min-h-[600px] overflow-hidden">
        <div className="absolute inset-0 bg-black">
          <div className="w-full h-full bg-linear-to-br from-[#FF3131]/30 to-[#CDA09B]/20" />
        </div>
        <div className="relative h-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col justify-center z-10">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-5 py-2 rounded-full mb-8">
              <Sparkles className="w-5 h-5 text-white" />
              <span className="text-sm font-semibold uppercase tracking-wider text-white">Curated Collections</span>
            </div>
            <h1 className="text-6xl lg:text-8xl font-bold mb-8 tracking-tight text-white">
              Our Collections
            </h1>
            <p className="text-xl lg:text-2xl text-white/90 leading-relaxed mb-8 max-w-3xl">
              Discover our carefully curated streetwear collections, from everyday essentials to exclusive limited drops
            </p>
            {!loading && collections.length > 0 && (
              <div className="flex items-center gap-4 text-white/70">
                <span className="text-sm uppercase tracking-wider">{collections.length} Collections</span>
                <span className="text-sm">•</span>
                <span className="text-sm uppercase tracking-wider">
                  {collections.reduce((sum, c) => sum + c._count.products, 0)} Products
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-32">
          <Loader2 className="w-12 h-12 animate-spin text-[#6B6B6B]" />
        </div>
      )}

      {/* Collections Grid */}
      {!loading && (
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
          {collections.length > 0 ? (
            <>
              {collections.map((collection, index) => (
                <CollectionPreview
                  key={collection.id}
                  name={collection.name}
                  description={collection.description || ''}
                  imageUrl={collection.image || '/placeholder-product.jpg'}
                  products={collection.products
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map(cp => cp.product)}
                  defaultExpanded={index === 0}
                />
              ))}
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-[#6B6B6B] text-xl mb-2">No collections available yet</p>
              <p className="text-[#6B6B6B]">Check back soon for new drops!</p>
            </div>
          )}
        </div>
      )}

      {/* Newsletter CTA Section */}
      <section className="py-20 lg:py-28 bg-[#2B2B2B] text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight">
            Never Miss a Drop
          </h2>
          <p className="text-lg text-white/80 mb-10 leading-relaxed">
            Join our community to get early access to new collections, exclusive drops, and special offers
          </p>
          <form className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-6 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:border-white transition-colors"
            />
            <Button
              type="submit"
              size="lg"
              className="bg-white text-[#2B2B2B] hover:bg-[#F5F1EB] whitespace-nowrap"
            >
              Subscribe
            </Button>
          </form>
        </div>
      </section>
    </div>
  )
}
