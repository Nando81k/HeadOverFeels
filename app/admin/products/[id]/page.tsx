'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ImageUpload } from '@/components/admin/ImageUpload'

interface ProductImage {
  url: string
  alt: string
}

interface Variant {
  size?: string
  color?: string
  colorHex?: string
  images?: string
  sku: string
  price?: number
  inventory: number
}

interface Collection {
  id: string
  name: string
  slug: string
}

interface Product {
  id: string
  name: string
  slug: string
  description: string
  price: number
  compareAtPrice?: number
  category: string
  images: string
  isActive: boolean
  isFeatured: boolean
  isFeaturedNewArrival?: boolean
  isLimitedEdition?: boolean
  releaseDate?: string | null
  dropEndDate?: string | null
  maxQuantity?: number | null
  variants: Variant[]
  collections?: { collectionId: string }[]
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])
  
  // Collection creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [newCollectionData, setNewCollectionData] = useState({
    name: '',
    description: '',
    isActive: true,
  })

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price: '',
    compareAtPrice: '',
    category: '',
    materials: '',
    careGuide: '',
    isActive: true,
    isFeatured: false,
    isFeaturedNewArrival: false,
    isLimitedEdition: false,
    releaseDate: '',
    dropEndDate: '',
    maxQuantity: '',
  })

  const [images, setImages] = useState<ProductImage[]>([])
  const [variants, setVariants] = useState<Variant[]>([
    { size: 'S', color: '', colorHex: '', images: '', sku: '', inventory: 0 },
  ])

  // Load product data
  useEffect(() => {
    async function loadProduct() {
      try {
        const response = await fetch(`/api/products/${id}`)
        if (!response.ok) {
          throw new Error('Failed to load product')
        }

        const data = await response.json()
        setProduct(data)

        // Populate form
        setFormData({
          name: data.name,
          slug: data.slug,
          description: data.description,
          price: data.price.toString(),
          compareAtPrice: data.compareAtPrice?.toString() || '',
          category: data.categoryId || '',
          materials: data.materials || '',
          careGuide: data.careGuide || '',
          isActive: data.isActive,
          isFeatured: data.isFeatured,
          isFeaturedNewArrival: data.isFeaturedNewArrival || false,
          isLimitedEdition: data.isLimitedEdition || false,
          releaseDate: data.releaseDate ? new Date(data.releaseDate).toISOString().slice(0, 16) : '',
          dropEndDate: data.dropEndDate ? new Date(data.dropEndDate).toISOString().slice(0, 16) : '',
          maxQuantity: data.maxQuantity?.toString() || '',
        })

        // Parse images
        try {
          const parsedImages = typeof data.images === 'string'
            ? JSON.parse(data.images)
            : data.images
          
          // Ensure images are in the correct format with url and alt
          const formattedImages: ProductImage[] = Array.isArray(parsedImages) 
            ? parsedImages.map((img: string | ProductImage) => {
                if (typeof img === 'string') {
                  return { url: img, alt: data.name }
                }
                return { 
                  url: typeof img.url === 'string' ? img.url : String(img), 
                  alt: img.alt || data.name 
                }
              })
            : []
          
          setImages(formattedImages)
        } catch {
          setImages([])
        }

        // Set variants
        if (data.variants && data.variants.length > 0) {
          setVariants(data.variants)
        }

        // Set selected collections
        if (data.collections && data.collections.length > 0) {
          setSelectedCollections(data.collections.map((c: { collectionId: string }) => c.collectionId))
        }

        setLoading(false)
      } catch {
        setError('Failed to load product')
        setLoading(false)
      }
    }

    loadProduct()
  }, [id])

  // Load available collections and categories
  useEffect(() => {
    async function loadData() {
      try {
        const [collectionsRes, categoriesRes] = await Promise.all([
          fetch('/api/collections'),
          fetch('/api/categories')
        ])
        
        if (collectionsRes.ok) {
          const collectionsData = await collectionsRes.json()
          setCollections(Array.isArray(collectionsData) ? collectionsData : [])
        }
        
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json()
          setCategories(Array.isArray(categoriesData) ? categoriesData : [])
        }
      } catch (error) {
        console.error('Failed to load collections/categories:', error)
      }
    }

    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        materials: formData.materials,
        careGuide: formData.careGuide,
        isActive: formData.isActive,
        isFeatured: formData.isFeatured,
        isFeaturedNewArrival: formData.isFeaturedNewArrival,
        isLimitedEdition: formData.isLimitedEdition,
        categoryId: formData.category || null,
        price: parseFloat(formData.price),
        compareAtPrice: formData.compareAtPrice
          ? parseFloat(formData.compareAtPrice)
          : null,
        releaseDate: formData.releaseDate || null,
        dropEndDate: formData.dropEndDate || null,
        maxQuantity: formData.maxQuantity ? parseInt(formData.maxQuantity) : null,
        images: JSON.stringify(images),
        variants: variants.map((v) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const variant: any = {
            sku: v.sku,
            size: v.size || undefined,
            color: v.color || undefined,
            colorHex: v.colorHex || '',
            images: v.images || undefined,
            inventory: parseInt(v.inventory?.toString() || '0') || 0,
          }
          // Only include price if it has a value
          if (v.price) {
            variant.price = parseFloat(v.price.toString())
          }
          return variant
        }),
        collectionIds: selectedCollections,
      }
      
      console.log('Sending payload:', payload)
      console.log('Payload JSON:', JSON.stringify(payload, null, 2))
      console.log('Variants being sent:', payload.variants)
      
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        const errorMsg = result.details 
          ? `${result.error}: ${typeof result.details === 'string' ? result.details : JSON.stringify(result.details)}`
          : result.error || 'Failed to update product'
        setError(errorMsg)
        if (result.details) {
          console.error('Validation errors:', result.details)
          console.error('Full validation error details:', JSON.stringify(result.details, null, 2))
        }
        return
      }

      router.push('/admin/products')
      router.refresh()
    } catch {
      setError('An error occurred while updating the product')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete product')
      }

      router.push('/admin/products')
      router.refresh()
    } catch {
      setError('Failed to delete product')
      setDeleting(false)
    }
  }

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError('')

    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCollectionData),
      })

      const result = await response.json()

      if (!response.ok) {
        setCreateError(result.error || 'Failed to create collection')
        return
      }

      // Add new collection to the list
      setCollections([...collections, result])
      
      // Auto-select the new collection
      setSelectedCollections([...selectedCollections, result.id])
      
      // Reset form and close modal
      setNewCollectionData({ name: '', description: '', isActive: true })
      setShowCreateModal(false)
    } catch {
      setCreateError('An error occurred while creating the collection')
    } finally {
      setCreating(false)
    }
  }

  const addVariant = () => {
    setVariants([...variants, { size: '', color: '', colorHex: '', images: '', sku: '', inventory: 0 }])
  }

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index))
  }

  const updateVariant = (index: number, field: keyof Variant, value: string | number) => {
    const updated = [...variants]
    updated[index] = { ...updated[index], [field]: value }
    setVariants(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (error && !product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button asChild variant="outline">
            <Link href="/admin/products">Back to Products</Link>
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 text-neutral-600 hover:text-black transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Products
          </Link>
          <h1 className="text-3xl font-bold">Edit Product</h1>
        </div>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Product
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Slug *</label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                placeholder="product-url-slug"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description *
              </label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Category *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Pricing */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Pricing</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Price *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Compare at Price (Optional)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.compareAtPrice}
                onChange={(e) =>
                  setFormData({ ...formData, compareAtPrice: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black"
              />
            </div>
          </div>
        </Card>

        {/* Images */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Product Images</h2>
          <ImageUpload 
            images={images.map(img => img.url)} 
            onImagesChange={(urls) => setImages(urls.map(url => ({ url, alt: formData.name })))} 
          />
        </Card>

        {/* Variants */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Variants</h2>
            <Button type="button" variant="outline" onClick={addVariant}>
              Add Variant
            </Button>
          </div>
          <div className="space-y-4">
            {variants.map((variant, index) => (
              <div
                key={index}
                className="p-6 border rounded-lg space-y-4"
              >
                <div className="grid md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Size</label>
                    <input
                      type="text"
                      value={variant.size}
                      onChange={(e) => updateVariant(index, 'size', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="S, M, L"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Color Name</label>
                    <input
                      type="text"
                      value={variant.color}
                      onChange={(e) => updateVariant(index, 'color', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Color Hex
                      {variant.colorHex && (
                        <span
                          className="ml-2 inline-block w-4 h-4 rounded-full border border-gray-300"
                          style={{ backgroundColor: variant.colorHex }}
                        />
                      )}
                    </label>
                    <input
                      type="text"
                      value={variant.colorHex || ''}
                      onChange={(e) => updateVariant(index, 'colorHex', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg font-mono"
                      placeholder="#000000"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">SKU *</label>
                    <input
                      type="text"
                      required
                      value={variant.sku}
                      onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Inventory *
                    </label>
                    <input
                      type="number"
                      required
                      value={variant.inventory}
                      onChange={(e) =>
                        updateVariant(index, 'inventory', parseInt(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                    />
                  </div>
                </div>

                {/* Variant Images */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Variant Images (Optional)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Upload images specific to this variant (e.g., product in this color)
                  </p>
                  <ImageUpload
                    images={
                      variant.images
                        ? (() => {
                            try {
                              const parsed = typeof variant.images === 'string'
                                ? JSON.parse(variant.images)
                                : variant.images
                              return Array.isArray(parsed)
                                ? parsed.map((img: string | { url: string }) => 
                                    typeof img === 'string' ? img : img.url
                                  )
                                : []
                            } catch {
                              return []
                            }
                          })()
                        : []
                    }
                    onImagesChange={(urls) =>
                      updateVariant(
                        index,
                        'images',
                        JSON.stringify(urls.map((url) => ({ url, alt: `${variant.color || 'Variant'} ${variant.size || ''}` })))
                      )
                    }
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeVariant(index)}
                    disabled={variants.length === 1}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Variant
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Status */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Active (visible on store)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) =>
                  setFormData({ ...formData, isFeatured: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Featured</span>
            </label>
          </div>
        </Card>

        {/* Collections */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold">Collections</h2>
              <p className="text-sm text-gray-600 mt-1">
                Select which collections this product belongs to
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(true)}
            >
              + Create New
            </Button>
          </div>
          {collections.length === 0 ? (
            <p className="text-sm text-gray-500">No collections available. Create one to get started!</p>
          ) : (
            <div className="space-y-3">
              {collections.map((collection) => (
                <label key={collection.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedCollections.includes(collection.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCollections([...selectedCollections, collection.id])
                      } else {
                        setSelectedCollections(
                          selectedCollections.filter((id) => id !== collection.id)
                        )
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">{collection.name}</span>
                </label>
              ))}
            </div>
          )}
        </Card>

        {/* Limited Edition Drop */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Limited Edition Drop</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.isLimitedEdition}
                onChange={(e) =>
                  setFormData({ ...formData, isLimitedEdition: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">This is a limited edition drop</span>
            </label>

            {formData.isLimitedEdition && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Release Date</label>
                  <input
                    type="datetime-local"
                    value={formData.releaseDate}
                    onChange={(e) =>
                      setFormData({ ...formData, releaseDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                  />
                  <p className="text-xs text-gray-500 mt-1">When the drop becomes available</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Drop End Date</label>
                  <input
                    type="datetime-local"
                    value={formData.dropEndDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dropEndDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                  />
                  <p className="text-xs text-gray-500 mt-1">When the drop ends (countdown timer)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Max Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxQuantity}
                    onChange={(e) =>
                      setFormData({ ...formData, maxQuantity: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                    placeholder="Total units available"
                  />
                  <p className="text-xs text-gray-500 mt-1">Total limited quantity for this drop</p>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Featured Sections */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Featured Sections</h2>
          <p className="text-sm text-gray-600 mb-4">Feature this product in special sections on the home page</p>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) =>
                  setFormData({ ...formData, isFeatured: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Featured Product (Best Sellers section)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.isFeaturedNewArrival}
                onChange={(e) =>
                  setFormData({ ...formData, isFeaturedNewArrival: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">New Arrivals Carousel (Hero section)</span>
            </label>
            <p className="text-xs text-gray-500">Maximum 10 products will display in the New Arrivals carousel</p>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex gap-4">
          <Button type="submit" size="lg" disabled={saving} className="flex-1">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Update Product'
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            asChild
          >
            <Link href="/admin/products">Cancel</Link>
          </Button>
        </div>
      </form>

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Create New Collection</h3>
            
            {createError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Collection Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCollectionData.name}
                  onChange={(e) =>
                    setNewCollectionData({ ...newCollectionData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="e.g., Summer 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  value={newCollectionData.description}
                  onChange={(e) =>
                    setNewCollectionData({ ...newCollectionData, description: e.target.value })
                  }
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="Brief description of this collection"
                />
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={newCollectionData.isActive}
                    onChange={(e) =>
                      setNewCollectionData({ ...newCollectionData, isActive: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Active (visible on store)</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={creating}
                  className="flex-1"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Collection'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateError('')
                    setNewCollectionData({ name: '', description: '', isActive: true })
                  }}
                  disabled={creating}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
