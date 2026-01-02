'use client'

import { useState, useEffect } from 'react'
import { Navigation } from '@/components/layout/Navigation'
import { CollectionPreview } from '@/components/collections/CollectionPreview'
import { Product } from '@/lib/api/products'
import { CircleNotch, Sparkle } from '@phosphor-icons/react'
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
      <section className="relative h-[60vh] min-h-[500px] overflow-hidden bg-white pt-24 lg:pt-32">
        <div className="relative h-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col justify-center z-10">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 bg-white border border-black/10 px-5 py-2 rounded-none mb-6">
              <Sparkle size={20} weight="fill" className="text-black" />
              <span className="text-sm font-bold uppercase tracking-wider text-black">Curated Collections</span>
            </div>
            <h1 className="text-6xl lg:text-8xl font-black mb-6 tracking-tight text-black">
              Our Collections
            </h1>
            <p className="text-xl lg:text-2xl text-black/70 leading-relaxed mb-6 max-w-3xl">
              Discover our carefully curated streetwear collections, from everyday essentials to exclusive limited drops
            </p>
            {!loading && collections.length > 0 && (
              <div className="flex items-center gap-4 text-black/60">
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
        <div className="flex justify-center items-center py-16">
          <CircleNotch size={48} weight="bold" className="animate-spin text-black" />
        </div>
      )}

      {/* Collections Grid */}
      {!loading && (
        <div className="max-w-7xl mx-auto px-6 py-6 lg:py-8">
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
              <p className="text-black/70 text-xl mb-2">No collections available yet</p>
              <p className="text-black/60">Check back soon for new drops!</p>
            </div>
          )}
        </div>
      )}

      {/* Newsletter CTA Section */}
      <section className="py-12 lg:py-16 bg-white text-black border-t border-black/10">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-black mb-6 tracking-tight">
            Never Miss a Drop
          </h2>
          <p className="text-lg text-black/70 mb-10 leading-relaxed">
            Join our community to get early access to new collections, exclusive drops, and special offers
          </p>
          <form className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-6 py-4 rounded-none bg-white border border-black/10 text-black placeholder:text-black/40 focus:outline-none focus:border-black/20 transition-colors h-[52px]"
            />
            <Button
              type="submit"
              size="lg"
              className="bg-black text-white hover:bg-black/90 whitespace-nowrap h-[52px] px-8 rounded-none font-bold uppercase tracking-wider"
            >
              Subscribe
            </Button>
          </form>
        </div>
      </section>
    </div>
  )
}
