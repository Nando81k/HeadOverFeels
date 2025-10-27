'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { productApi, CreateProductData } from '@/lib/api/products'
import { ImageUpload } from '@/components/admin/ImageUpload'

interface Collection {
  id: string
  name: string
  slug: string
  description?: string
  isActive: boolean
}

export default function NewProductPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateProductData>({
    name: '',
    description: '',
    price: 0,
    compareAtPrice: undefined,
    materials: '',
    careGuide: '',
    isActive: true,
    isFeatured: false,
    variants: [],
    isLimitedEdition: false,
    releaseDate: undefined,
    dropEndDate: undefined,
    maxQuantity: undefined
  })
  const [variants, setVariants] = useState([
    { sku: '', size: '', color: '', price: 0, inventory: 0, isActive: true }
  ])
  const [productImages, setProductImages] = useState<string[]>([])

  // Collection management state
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([])
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDescription, setNewCollectionDescription] = useState('')
  const [isCreatingCollection, setIsCreatingCollection] = useState(false)

  // Fetch collections on mount
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await fetch('/api/collections')
        if (!response.ok) {
          console.error('Failed to fetch collections:', response.status)
          return
        }
        const data = await response.json()
        setCollections(data)
      } catch (error) {
        console.error('Error fetching collections:', error)
      }
    }
    fetchCollections()
  }, [])

  const handleInputChange = (field: keyof CreateProductData, value: string | number | boolean | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleVariantChange = (index: number, field: string, value: string | number | boolean) => {
    const updatedVariants = variants.map((variant, i) => 
      i === index ? { ...variant, [field]: value } : variant
    )
    setVariants(updatedVariants)
  }

  const generateUniqueSKU = (productName: string, size?: string, color?: string) => {
    // Create SKU from product name, size, and color
    const namePart = productName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PROD'
    const sizePart = size ? `-${size.toUpperCase().replace(/[^A-Z0-9]/g, '')}` : ''
    const colorPart = color ? `-${color.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)}` : ''
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase()
    
    return `${namePart}${sizePart}${colorPart}-${randomPart}`
  }

  const autoGenerateSKUs = () => {
    const productName = formData.name || 'Product'
    const updatedVariants = variants.map(variant => ({
      ...variant,
      sku: generateUniqueSKU(productName, variant.size, variant.color)
    }))
    setVariants(updatedVariants)
  }

  const addVariant = () => {
    setVariants([...variants, { sku: '', size: '', color: '', price: 0, inventory: 0, isActive: true }])
  }

  const removeVariant = (index: number) => {
    if (variants.length > 1) {
      setVariants(variants.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Filter out empty variants and prepare data
      const validVariants = variants.filter(v => v.sku.trim() !== '')
      
      const productData: CreateProductData = {
        ...formData,
        images: JSON.stringify(productImages),
        variants: validVariants.length > 0 ? validVariants : undefined
      }

      const result = await productApi.create(productData)

      if (result.error) {
        setError(result.error)
        if (result.details) {
          console.error('Validation errors:', result.details)
        }
        return
      }

      // Assign product to selected collections
      if (result.data && selectedCollectionIds.length > 0) {
        const productId = result.data.id
        const collectionAssignmentPromises = selectedCollectionIds.map(async (collectionId) => {
          try {
            // Get current collection to preserve existing products
            const collectionResponse = await fetch(`/api/collections/${collectionId}`)
            if (!collectionResponse.ok) {
              console.error(`Failed to fetch collection ${collectionId}`)
              return
            }
            const collectionData = await collectionResponse.json()
            
            // Get existing product IDs
            const existingProductIds = collectionData.products?.map((p: { productId: string }) => p.productId) || []
            
            // Add new product ID to the list
            const updatedProductIds = [...existingProductIds, productId]
            
            // Update collection with new product
            const updateResponse = await fetch(`/api/collections/${collectionId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productIds: updatedProductIds }),
            })

            if (!updateResponse.ok) {
              console.error(`Failed to assign product to collection ${collectionId}`)
            }
          } catch (err) {
            console.error(`Error assigning product to collection ${collectionId}:`, err)
          }
        })

        // Wait for all collection assignments to complete
        await Promise.all(collectionAssignmentPromises)
      }

      // Success - redirect to products list
      router.push('/admin/products')
    } catch (err) {
      setError('An unexpected error occurred')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/admin/products" className="text-blue-600 hover:text-blue-800">
                ← Back to Products
              </Link>
              <h1 className="text-2xl font-bold">Add New Product</h1>
            </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={() => handleInputChange('isActive', false)}>
              Save as Draft
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Publishing...' : 'Publish Product'}
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
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Essential details about your product
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Product Name *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                    placeholder="e.g. Oversized Streetwear Hoodie"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                    placeholder="Describe your product's features, fit, and style..."
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Price *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                        placeholder="0.00"
                        value={formData.price || ''}
                        onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Compare at Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                        placeholder="0.00"
                        value={formData.compareAtPrice || ''}
                        onChange={(e) => handleInputChange('compareAtPrice', parseFloat(e.target.value) || undefined)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product Images */}
            <Card>
              <CardHeader>
                <CardTitle>Product Images</CardTitle>
                <CardDescription>
                  Upload high-quality images of your product
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUpload 
                  images={productImages}
                  onImagesChange={setProductImages}
                  maxImages={5}
                />
              </CardContent>
            </Card>

            {/* Variants */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Product Variants</CardTitle>
                    <CardDescription>
                      Add different sizes, colors, and inventory levels
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={autoGenerateSKUs}
                      title="Auto-generate unique SKUs for all variants"
                    >
                      Generate SKUs
                    </Button>
                    <Button type="button" variant="outline" onClick={addVariant}>
                      Add Variant
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {variants.map((variant, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Variant {index + 1}</h4>
                        {variants.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVariant(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Size
                          </label>
                          <input
                            type="text"
                            value={variant.size}
                            onChange={(e) => handleVariantChange(index, 'size', e.target.value)}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="S, M, L, XL"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Color
                          </label>
                          <input
                            type="text"
                            value={variant.color}
                            onChange={(e) => handleVariantChange(index, 'color', e.target.value)}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="Black, White"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            SKU *
                          </label>
                          <input
                            type="text"
                            required
                            value={variant.sku}
                            onChange={(e) => handleVariantChange(index, 'sku', e.target.value)}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="HOF-001"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Price Override
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={variant.price || ''}
                            onChange={(e) => handleVariantChange(index, 'price', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="Optional"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Inventory *
                          </label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={variant.inventory}
                            onChange={(e) => handleVariantChange(index, 'inventory', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {variants.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p className="mb-2">No variants yet</p>
                      <Button type="button" variant="outline" onClick={addVariant}>
                        Add First Variant
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Visibility</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black">
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="featured"
                    className="rounded border-gray-300 text-black focus:ring-black"
                  />
                  <label htmlFor="featured" className="ml-2 text-sm">Featured product</label>
                </div>
              </CardContent>
            </Card>

            {/* Organization */}
            <Card>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black">
                    <option value="">Select category</option>
                    <option value="hoodies">Hoodies</option>
                    <option value="tshirts">T-Shirts</option>
                    <option value="accessories">Accessories</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Tags</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                    placeholder="streetwear, limited-edition"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
                </div>
              </CardContent>
            </Card>

            {/* Limited Edition Drop */}
            <Card>
              <CardHeader>
                <CardTitle>Limited Edition Drop</CardTitle>
                <CardDescription>
                  Configure time-limited release settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="limitedEdition"
                    checked={formData.isLimitedEdition || false}
                    onChange={(e) => handleInputChange('isLimitedEdition', e.target.checked)}
                    className="rounded border-gray-300 text-black focus:ring-black"
                  />
                  <label htmlFor="limitedEdition" className="ml-2 text-sm font-medium">
                    This is a limited edition drop
                  </label>
                </div>

                {formData.isLimitedEdition && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Release Date</label>
                      <input
                        type="datetime-local"
                        value={formData.releaseDate || ''}
                        onChange={(e) => handleInputChange('releaseDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                      />
                      <p className="text-xs text-gray-500 mt-1">When the drop becomes available</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Drop End Date</label>
                      <input
                        type="datetime-local"
                        value={formData.dropEndDate || ''}
                        onChange={(e) => handleInputChange('dropEndDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                      />
                      <p className="text-xs text-gray-500 mt-1">When the drop ends (countdown timer)</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Max Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.maxQuantity || ''}
                        onChange={(e) => handleInputChange('maxQuantity', parseInt(e.target.value) || undefined)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                        placeholder="Total units available"
                      />
                      <p className="text-xs text-gray-500 mt-1">Total limited quantity for this drop</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Collections */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Collections</CardTitle>
                    <CardDescription>
                      Assign this product to collections
                    </CardDescription>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowNewCollectionModal(true)}
                  >
                    Create New
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {collections.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {collections.map((collection) => (
                      <label
                        key={collection.id}
                        className="flex items-start space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCollectionIds.includes(collection.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCollectionIds([...selectedCollectionIds, collection.id])
                            } else {
                              setSelectedCollectionIds(selectedCollectionIds.filter(id => id !== collection.id))
                            }
                          }}
                          className="mt-0.5 rounded border-gray-300 text-black focus:ring-black"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{collection.name}</div>
                          {collection.description && (
                            <div className="text-xs text-gray-500">{collection.description}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-gray-500">
                    <p>No collections yet</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setShowNewCollectionModal(true)}
                    >
                      Create First Collection
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Product Details */}
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Materials</label>
                  <input
                    type="text"
                    value={formData.materials || ''}
                    onChange={(e) => handleInputChange('materials', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                    placeholder="100% Cotton"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Care Instructions</label>
                  <textarea
                    rows={3}
                    value={formData.careGuide || ''}
                    onChange={(e) => handleInputChange('careGuide', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                    placeholder="Machine wash cold, tumble dry low..."
                  />
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
        </form>
      </div>

      {/* New Collection Modal */}
      {showNewCollectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Create New Collection</h2>
              <button
                type="button"
                onClick={() => {
                  setShowNewCollectionModal(false)
                  setNewCollectionName('')
                  setNewCollectionDescription('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Collection Name *</label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="e.g. Summer Collection 2024"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  rows={3}
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="Brief description of this collection..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowNewCollectionModal(false)
                  setNewCollectionName('')
                  setNewCollectionDescription('')
                }}
                disabled={isCreatingCollection}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  if (!newCollectionName.trim()) {
                    setError('Collection name is required')
                    return
                  }

                  setIsCreatingCollection(true)
                  try {
                    const response = await fetch('/api/collections', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: newCollectionName,
                        description: newCollectionDescription || undefined,
                        isActive: true,
                      }),
                    })

                    if (!response.ok) {
                      throw new Error('Failed to create collection')
                    }

                    const newCollection = await response.json()
                    setCollections([...collections, newCollection])
                    setSelectedCollectionIds([...selectedCollectionIds, newCollection.id])
                    setShowNewCollectionModal(false)
                    setNewCollectionName('')
                    setNewCollectionDescription('')
                    setError(null)
                  } catch (err) {
                    setError('Failed to create collection. Please try again.')
                    console.error('Error creating collection:', err)
                  } finally {
                    setIsCreatingCollection(false)
                  }
                }}
                disabled={isCreatingCollection || !newCollectionName.trim()}
              >
                {isCreatingCollection ? 'Creating...' : 'Create Collection'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}