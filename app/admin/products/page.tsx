'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { productApi, Product } from '@/lib/api/products'
import { RestockModal } from '@/components/admin/RestockModal'
import { Package } from 'lucide-react'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [restockModal, setRestockModal] = useState<{
    isOpen: boolean
    product: Product | null
  }>({ isOpen: false, product: null })
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    draft: 0,
    lowStock: 0
  })

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const result = await productApi.getAll({ limit: 50 })
      if (result.data && result.data.data) {
        setProducts(result.data.data)
        
        // Calculate stats
        const active = result.data.data.filter(p => p.isActive).length
        const draft = result.data.data.filter(p => !p.isActive).length
        const lowStock = result.data.data.filter(p => {
          const totalInventory = p.variants.reduce((sum, v) => sum + v.inventory, 0)
          return totalInventory < 10
        }).length
        
        setStats({
          total: result.data.data.length,
          active,
          draft,
          lowStock
        })
      }
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    // Optimistically remove from UI immediately
    setProducts(prevProducts => prevProducts.filter(p => p.id !== id))
    
    // Update stats optimistically
    const deletedProduct = products.find(p => p.id === id)
    if (deletedProduct) {
      setStats(prevStats => {
        const totalInventory = deletedProduct.variants.reduce((sum, v) => sum + v.inventory, 0)
        return {
          total: prevStats.total - 1,
          active: prevStats.active - (deletedProduct.isActive ? 1 : 0),
          draft: prevStats.draft - (!deletedProduct.isActive ? 1 : 0),
          lowStock: prevStats.lowStock - (totalInventory < 10 ? 1 : 0)
        }
      })
    }
    
    // Delete from server in background
    const result = await productApi.delete(id)
    if (result.error) {
      // Show user-friendly error message
      if (result.error.includes('existing orders')) {
        alert('Cannot delete product with existing orders.\n\nThis product will be marked as inactive instead.')
        // Mark as inactive instead
        await productApi.update(id, { isActive: false })
      }
      // Reload products to revert optimistic update and show correct state
      loadProducts()
    }
  }

  const toggleStatus = async (product: Product) => {
    const result = await productApi.update(product.id, {
      isActive: !product.isActive
    })
    
    if (result.error) {
      alert(result.error)
    } else {
      loadProducts() // Reload products
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-blue-600 hover:text-blue-800">
                ← Admin Dashboard
              </Link>
              <h1 className="text-2xl font-bold">Product Management</h1>
            </div>
            <Link href="/admin/products/new">
              <Button>
                Add New Product
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
                {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-sm text-gray-500">All products</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.active}</div>
              <p className="text-sm text-gray-500">Published products</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-600">{stats.draft}</div>
              <p className="text-sm text-gray-500">Unpublished products</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Low Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{stats.lowStock}</div>
              <p className="text-sm text-gray-500">Need restocking</p>
            </CardContent>
          </Card>
        </div>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
            <CardDescription>
              Manage your streetwear products, inventory, and pricing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading products...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <div className="mb-4">
                  <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">No Products Yet</h3>
                <p className="text-gray-600 mb-6">
                  Start building your streetwear catalog by adding your first product.
                </p>
                <Link href="/admin/products/new">
                  <Button>
                    Add Your First Product
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Product</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Price</th>
                      <th className="text-left py-3 px-4">Inventory</th>
                      <th className="text-right py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      // Parse images - handle both string array and object array formats
                      let imageUrl = '/placeholder-product.jpg'
                      try {
                        const images = typeof product.images === 'string' 
                          ? JSON.parse(product.images) 
                          : product.images
                        
                        if (Array.isArray(images) && images.length > 0) {
                          // Handle both formats: string[] or {url: string}[]
                          imageUrl = typeof images[0] === 'string' 
                            ? images[0] 
                            : images[0]?.url || '/placeholder-product.jpg'
                        }
                      } catch (error) {
                        console.error('Error parsing images:', error)
                      }
                      
                      const totalInventory = product.variants.reduce((sum, v) => sum + v.inventory, 0)
                      
                      return (
                        <tr key={product.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              <Image
                                src={imageUrl}
                                alt={product.name}
                                width={48}
                                height={48}
                                className="rounded object-cover"
                              />
                              <div>
                                <div className="font-medium">{product.name}</div>
                                <div className="text-sm text-gray-500">{product.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              product.isActive 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {product.isActive ? 'Active' : 'Draft'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium">${product.price.toFixed(2)}</div>
                            {product.compareAtPrice && (
                              <div className="text-sm text-gray-500 line-through">
                                ${product.compareAtPrice.toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className={`font-medium ${
                              totalInventory === 0 
                                ? 'text-red-600' 
                                : totalInventory <= 5 
                                ? 'text-orange-600' 
                                : ''
                            }`}>
                              {totalInventory} units
                              {totalInventory === 0 && (
                                <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                  Out of Stock
                                </span>
                              )}
                              {totalInventory > 0 && totalInventory <= 5 && (
                                <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                  Low Stock
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{product.variants.length} variants</div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRestockModal({ isOpen: true, product })}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Package className="w-4 h-4 mr-1" />
                                Restock
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleStatus(product)}
                              >
                                {product.isActive ? 'Unpublish' : 'Publish'}
                              </Button>
                              <Link href={`/admin/products/${product.id}`}>
                                <Button variant="outline" size="sm">
                                  Edit
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(product.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
              <CardDescription>Organize your products</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" className="w-full">
                  Manage Categories
                </Button>
                <Button variant="outline" className="w-full">
                  Add New Category
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
              <CardDescription>Track stock levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" className="w-full">
                  Inventory Report
                </Button>
                <Button variant="outline" className="w-full">
                  Low Stock Alert
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import/Export</CardTitle>
              <CardDescription>Bulk operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" className="w-full">
                  Import Products
                </Button>
                <Button variant="outline" className="w-full">
                  Export Catalog
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Restock Modal */}
      {restockModal.product && (
        <RestockModal
          isOpen={restockModal.isOpen}
          onClose={() => setRestockModal({ isOpen: false, product: null })}
          productId={restockModal.product.id}
          productName={restockModal.product.name}
          variants={restockModal.product.variants}
          onSuccess={loadProducts}
        />
      )}
    </div>
  );
}