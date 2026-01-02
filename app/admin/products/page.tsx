'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { productApi, Product } from '@/lib/api/products'
import { RestockModal } from '@/components/admin/RestockModal'
import { Package, Plus } from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatsGridSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/lib/toast'
import { InlineEdit } from '@/components/ui/InlineEdit'

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
  
  // Bulk actions state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

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
    if (!confirm('Are you sure you want to delete this product?')) {
      return
    }

    // Optimistically remove from UI immediately
    const deletedProduct = products.find(p => p.id === id)
    setProducts(prevProducts => prevProducts.filter(p => p.id !== id))
    
    // Show loading toast
    const loadingToast = toast.loading('Deleting product...')
    
    // Update stats optimistically
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
    
    toast.dismiss(loadingToast)
    
    if (result.error) {
      // Show user-friendly error message
      if (result.error.includes('existing orders')) {
        toast.error('Cannot delete product', 'This product has existing orders and will be marked as inactive instead.')
        // Mark as inactive instead
        await productApi.update(id, { isActive: false })
      } else {
        toast.error('Failed to delete product', result.error)
      }
      // Reload products to revert optimistic update and show correct state
      loadProducts()
    } else {
      toast.success('Product deleted successfully')
    }
  }

  const toggleStatus = async (product: Product) => {
    const newStatus = !product.isActive
    const loadingToast = toast.loading(`${newStatus ? 'Activating' : 'Deactivating'} product...`)
    
    const result = await productApi.update(product.id, {
      isActive: newStatus
    })
    
    toast.dismiss(loadingToast)
    
    if (result.error) {
      toast.error('Failed to update product', result.error)
    } else {
      toast.success(`Product ${newStatus ? 'activated' : 'deactivated'} successfully`)
      loadProducts() // Reload products
    }
  }

  // Bulk action handlers
  const toggleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)))
    }
  }

  const toggleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return
    
    if (!confirm(`Are you sure you want to delete ${selectedProducts.size} product(s)?`)) {
      return
    }

    setBulkActionLoading(true)
    const loadingToast = toast.loading(`Deleting ${selectedProducts.size} products...`)
    
    let successCount = 0
    let errorCount = 0

    for (const productId of selectedProducts) {
      const result = await productApi.delete(productId)
      if (result.error) {
        errorCount++
      } else {
        successCount++
      }
    }

    toast.dismiss(loadingToast)
    setBulkActionLoading(false)
    setSelectedProducts(new Set())
    
    if (successCount > 0) {
      toast.success('Bulk delete completed', `${successCount} product(s) deleted successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`)
    } else {
      toast.error('Bulk delete failed', 'Could not delete any products')
    }
    
    loadProducts()
  }

  const handleBulkStatusChange = async (isActive: boolean) => {
    if (selectedProducts.size === 0) return

    setBulkActionLoading(true)
    const loadingToast = toast.loading(`${isActive ? 'Activating' : 'Deactivating'} ${selectedProducts.size} products...`)
    
    let successCount = 0
    let errorCount = 0

    for (const productId of selectedProducts) {
      const result = await productApi.update(productId, { isActive })
      if (result.error) {
        errorCount++
      } else {
        successCount++
      }
    }

    toast.dismiss(loadingToast)
    setBulkActionLoading(false)
    setSelectedProducts(new Set())
    
    if (successCount > 0) {
      toast.success('Bulk update completed', `${successCount} product(s) updated${errorCount > 0 ? `, ${errorCount} failed` : ''}`)
    } else {
      toast.error('Bulk update failed', 'Could not update any products')
    }
    
    loadProducts()
  }

  // Inline edit handlers
  const handleUpdatePrice = async (productId: string, newPrice: string) => {
    const price = parseFloat(newPrice)
    const loadingToast = toast.loading('Updating price...')
    
    const result = await productApi.update(productId, { price })
    
    toast.dismiss(loadingToast)
    
    if (result.error) {
      toast.error('Failed to update price', result.error)
      throw new Error(result.error)
    } else {
      toast.success('Price updated successfully')
      loadProducts()
    }
  }

  const handleUpdateInventory = async (productId: string, variantId: string, newInventory: string) => {
    const inventory = parseInt(newInventory, 10)
    const loadingToast = toast.loading('Updating inventory...')
    
    try {
      // Update via product API
      const product = products.find(p => p.id === productId)
      if (!product) throw new Error('Product not found')
      
      const updatedVariants = product.variants.map(v => 
        v.id === variantId 
          ? { ...v, inventory }
          : v
      )
      
      const result = await productApi.update(productId, { 
        variants: updatedVariants 
      })
      
      toast.dismiss(loadingToast)
      
      if (result.error) {
        toast.error('Failed to update inventory', result.error)
        throw new Error(result.error)
      } else {
        toast.success('Inventory updated successfully')
        loadProducts()
      }
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error('Failed to update inventory', 'Please try again')
      throw error
    }
  }

  return (
    <>
      <AdminLayout
        title="Product Management"
        subtitle="Manage your streetwear products, inventory, and pricing"
        headerActions={
          <Link href="/admin/products/new">
            <Button className="bg-[#FF3131] hover:bg-[#E02828]">
              <Plus size={16} weight="bold" className="mr-2" />
              Add Product
            </Button>
          </Link>
        }
      >
      {/* Stats */}
      {loading ? (
        <StatsGridSkeleton count={4} />
      ) : (
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">Total Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.total}</div>
              <p className="text-sm text-white/40">All products</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-400">{stats.active}</div>
              <p className="text-sm text-white/40">Published products</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">Drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white/70">{stats.draft}</div>
              <p className="text-sm text-white/40">Unpublished products</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">Low Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-400">{stats.lowStock}</div>
              <p className="text-sm text-white/40">Need restocking</p>
            </CardContent>
          </Card>
        </div>
      )}

        {/* Products Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Products</CardTitle>
                <CardDescription>
                  Manage your streetwear products, inventory, and pricing
                </CardDescription>
              </div>
              
              {/* Bulk Actions Bar */}
              {selectedProducts.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/70">
                    {selectedProducts.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusChange(true)}
                    disabled={bulkActionLoading}
                    className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20"
                  >
                    Activate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusChange(false)}
                    disabled={bulkActionLoading}
                    className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20"
                  >
                    Deactivate
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkActionLoading}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0"
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : products.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No Products Yet"
                description="Start building your streetwear catalog by adding your first product. Create products with variants, manage inventory, and set pricing."
                action={{
                  label: 'Add Your First Product',
                  href: '/admin/products/new',
                }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left py-3 px-4 w-12">
                        <input
                          type="checkbox"
                          checked={selectedProducts.size === products.length && products.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-white/10 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]"
                        />
                      </th>
                      <th className="text-left py-3 px-4 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Product</th>
                      <th className="text-left py-3 px-4 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Status</th>
                      <th className="text-left py-3 px-4 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Price</th>
                      <th className="text-left py-3 px-4 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Inventory</th>
                      <th className="text-right py-3 px-4 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
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
                        <tr key={product.id} className="hover:bg-white/5">
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedProducts.has(product.id)}
                              onChange={() => toggleSelectProduct(product.id)}
                              className="rounded border-white/10 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]"
                            />
                          </td>
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
                                <div className="font-medium text-white">{product.name}</div>
                                <div className="text-sm text-white/40">{product.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs ${
                              product.isActive 
                                ? 'bg-emerald-500/20 text-emerald-400' 
                                : 'bg-white/10 text-white/70'
                            }`}>
                              {product.isActive ? 'Active' : 'Draft'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <InlineEdit
                              value={product.price}
                              onSave={(value) => handleUpdatePrice(product.id, value)}
                              type="number"
                              prefix="$"
                              min={0}
                              className="font-medium text-white"
                            />
                            {product.compareAtPrice && (
                              <div className="text-sm text-white/40 line-through">
                                ${product.compareAtPrice.toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className={`${
                              totalInventory === 0 
                                ? 'text-red-400' 
                                : totalInventory <= 5 
                                ? 'text-amber-400' 
                                : 'text-white'
                            }`}>
                              <InlineEdit
                                value={totalInventory}
                                onSave={(value) => handleUpdateInventory(product.id, product.variants[0].id, value)}
                                type="number"
                                suffix=" units"
                                min={0}
                                className="font-medium"
                              />
                              {totalInventory === 0 && (
                                <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-2 py-0.5">
                                  Out of Stock
                                </span>
                              )}
                              {totalInventory > 0 && totalInventory <= 5 && (
                                <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5">
                                  Low Stock
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-white/40">{product.variants.length} variants</div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRestockModal({ isOpen: true, product })}
                                className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-0"
                              >
                                <Package size={16} weight="bold" className="mr-1" />
                                Restock
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleStatus(product)}
                                className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20"
                              >
                                {product.isActive ? 'Unpublish' : 'Publish'}
                              </Button>
                              <Link href={`/admin/products/${product.id}`}>
                                <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20">
                                  Edit
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(product.id)}
                                className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0"
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
              <CardTitle className="text-lg text-white">Categories</CardTitle>
              <CardDescription>Organize your products</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20">
                  Manage Categories
                </Button>
                <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20">
                  Add New Category
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-white">Inventory</CardTitle>
              <CardDescription>Track stock levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20">
                  Inventory Report
                </Button>
                <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20">
                  Low Stock Alert
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-white">Import/Export</CardTitle>
              <CardDescription>Bulk operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20">
                  Import Products
                </Button>
                <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20">
                  Export Catalog
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>

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
    </>
  );
}