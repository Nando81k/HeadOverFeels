'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { ArrowLeft, Loader2, X, Plus, GripVertical } from 'lucide-react'

interface Product {
  id: string
  name: string
  slug: string
  price: number
  images: string[]
}

interface CollectionProduct {
  id: string
  productId: string
  sortOrder: number
  product: Product
}

interface Collection {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  products: CollectionProduct[]
}

export default function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collection, setCollection] = useState<Collection | null>(null)
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [showProductSelector, setShowProductSelector] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    isActive: true,
    isFeatured: false,
    sortOrder: 0
  })
  const [images, setImages] = useState<string[]>([])

  useEffect(() => {
    loadCollection()
    loadAvailableProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadCollection = async () => {
    try {
      const response = await fetch(`/api/collections/${id}`)
      if (!response.ok) throw new Error('Failed to load collection')
      
      const data = await response.json()
      setCollection(data)
      setFormData({
        name: data.name,
        slug: data.slug,
        description: data.description || '',
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        sortOrder: data.sortOrder
      })
      setImages(data.image ? [data.image] : [])
      setSelectedProductIds(data.products.map((cp: CollectionProduct) => cp.productId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collection')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableProducts = async () => {
    try {
      const response = await fetch('/api/products')
      if (!response.ok) throw new Error('Failed to load products')
      const data = await response.json()
      setAvailableProducts(data.products || data)
    } catch (err) {
      console.error('Failed to load products:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          image: images[0] || null,
          productIds: selectedProductIds
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update collection')
      }

      router.push('/admin/collections')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const removeProduct = (productId: string) => {
    setSelectedProductIds(prev => prev.filter(id => id !== productId))
  }

  const addProducts = (productIds: string[]) => {
    setSelectedProductIds(prev => [...new Set([...prev, ...productIds])])
    setShowProductSelector(false)
  }

  const moveProduct = (productId: string, direction: 'up' | 'down') => {
    const index = selectedProductIds.indexOf(productId)
    if (index === -1) return
    
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= selectedProductIds.length) return
    
    const newOrder = [...selectedProductIds]
    ;[newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]]
    setSelectedProductIds(newOrder)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Collection not found</h2>
          <Link href="/admin/collections">
            <Button>Back to Collections</Button>
          </Link>
        </div>
      </div>
    )
  }

  const selectedProducts = selectedProductIds
    .map(id => Array.isArray(availableProducts) ? availableProducts.find(p => p.id === id) : undefined)
    .filter(Boolean) as Product[]

  const unselectedProducts = Array.isArray(availableProducts) 
    ? availableProducts.filter(p => !selectedProductIds.includes(p.id))
    : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/admin/collections" className="text-blue-600 hover:text-blue-800">
                <ArrowLeft className="w-4 h-4 inline mr-2" />
                Back to Collections
              </Link>
              <h1 className="text-2xl font-bold">Edit Collection</h1>
            </div>
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/collections')}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Collection Details */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Essential details about your collection
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Collection Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                      placeholder="e.g. Winter 2026, Summer Essentials"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Slug (URL-friendly name)
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                      placeholder="winter-2026"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                      placeholder="Describe this collection..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Sort Order</label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Lower numbers appear first
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Collection Image */}
              <Card>
                <CardHeader>
                  <CardTitle>Collection Image</CardTitle>
                  <CardDescription>
                    Upload a cover image for this collection
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ImageUpload 
                    images={images}
                    onImagesChange={setImages}
                    maxImages={1}
                  />
                </CardContent>
              </Card>

              {/* Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="text-sm font-medium">Active (visible on store)</span>
                      <p className="text-xs text-gray-500">
                        Enable this to make the collection visible to customers
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="text-sm font-medium">Featured</span>
                      <p className="text-xs text-gray-500">
                        Highlight this collection on the homepage
                      </p>
                    </div>
                  </label>
                </CardContent>
              </Card>
            </form>
          </div>

          {/* Right Column - Product Assignment */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Products ({selectedProducts.length})</CardTitle>
                    <CardDescription>Manage products in this collection</CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowProductSelector(!showProductSelector)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Product Selector */}
                {showProductSelector && unselectedProducts.length > 0 && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-64 overflow-y-auto">
                    <p className="text-sm font-medium mb-3">Select products to add:</p>
                    <div className="space-y-2">
                      {unselectedProducts.map(product => (
                        <label key={product.id} className="flex items-center gap-2 hover:bg-white p-2 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              if (e.target.checked) {
                                addProducts([product.id])
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">{product.name}</span>
                          <span className="text-xs text-gray-500 ml-auto">${product.price}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Products List */}
                {selectedProducts.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No products added yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedProducts.map((product, index) => (
                      <div
                        key={product.id}
                        className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg group hover:border-gray-300"
                      >
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => moveProduct(product.id, 'up')}
                            disabled={index === 0}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <GripVertical className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveProduct(product.id, 'down')}
                            disabled={index === selectedProducts.length - 1}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <GripVertical className="w-3 h-3" />
                          </button>
                        </div>
                        
                        {product.images?.[0] && (
                          <Image
                            src={product.images[0]}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 object-cover rounded"
                          />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <p className="text-xs text-gray-500">${product.price}</p>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => removeProduct(product.id)}
                          className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Product Count Info */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{selectedProducts.length}</p>
                  <p className="text-sm text-gray-500">Products in collection</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
