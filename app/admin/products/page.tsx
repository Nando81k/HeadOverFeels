'use client'

import { useState, useEffect, useCallback, FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { productApi, Product } from '@/lib/api/products'
import { RestockModal } from '@/components/admin/RestockModal'
import { ProductSlideOver } from '@/components/admin/ProductSlideOver'
import { 
  Package, Plus, MagnifyingGlass, Funnel, TrendUp, CurrencyDollar, 
  CaretUp, CaretDown, ChartLineUp, Percent, ShoppingCart, X, ArrowsDownUp,
  PencilSimple
} from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatsGridSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/lib/toast'
import { InlineEdit } from '@/components/ui/InlineEdit'
import { ProductMobileCard } from '@/components/admin/ProductMobileCard'
import { CheckSquare, Square } from '@phosphor-icons/react'

// Financial data types
interface ProductFinancial {
  productId: string
  productName: string
  unitsSold: number
  revenue: number
  costOfGoods: number
  grossProfit: number
  marginPercent: number
  currentPrice: number
  costPrice: number | null
  currentInventory: number
  isActive: boolean
  isLimitedEdition: boolean
}

interface FinancialSummary {
  totalRevenue: number
  totalUnitsSold: number
  totalCostOfGoods: number
  totalGrossProfit: number
  avgMarginPercent: number
  bestSeller: {
    productId: string
    productName: string
    revenue: number
    unitsSold: number
  } | null
  lowMarginCount: number
}

type SortField = 'name' | 'price' | 'inventory' | 'revenue' | 'margin' | 'unitsSold'
type SortDirection = 'asc' | 'desc'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [restockModal, setRestockModal] = useState<{
    isOpen: boolean
    product: Product | null
  }>({ isOpen: false, product: null })
  
  // Product slide-over state for inline add/edit
  const [slideOver, setSlideOver] = useState<{
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

  // Financial data state
  const [financials, setFinancials] = useState<Map<string, ProductFinancial>>(new Map())
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null)
  const [financialPeriod, setFinancialPeriod] = useState<'7' | '30' | '90'>('30')
  const [financialLoading, setFinancialLoading] = useState(false)

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'inStock'>('all')
  const [marginFilter, setMarginFilter] = useState<'all' | 'low' | 'healthy' | 'high'>('all')

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const loadFinancials = useCallback(async () => {
    setFinancialLoading(true)
    try {
      const response = await fetch(`/api/admin/products/financial?period=${financialPeriod}`)
      const result = await response.json()
      
      if (result.success && result.data) {
        const financialMap = new Map<string, ProductFinancial>()
        for (const product of result.data.products) {
          financialMap.set(product.productId, product)
        }
        setFinancials(financialMap)
        setFinancialSummary(result.data.summary)
      }
    } catch (error) {
      console.error('Failed to load financials:', error)
    } finally {
      setFinancialLoading(false)
    }
  }, [financialPeriod])

  useEffect(() => {
    loadProducts()
    loadFinancials()
  }, [loadFinancials])

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

  // Search submit handler
  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    setAppliedSearchQuery(searchQuery)
  }

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('')
    setAppliedSearchQuery('')
    setStatusFilter('all')
    setStockFilter('all')
    setMarginFilter('all')
  }

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowsDownUp size={12} className="ml-1 text-white/30" />
    return sortDirection === 'asc' 
      ? <CaretUp size={12} weight="fill" className="ml-1 text-[#FF3131]" />
      : <CaretDown size={12} weight="fill" className="ml-1 text-[#FF3131]" />
  }

  // Filtered and sorted products
  const filteredProducts = products
    .filter(product => {
      // Search filter
      if (appliedSearchQuery) {
        const query = appliedSearchQuery.toLowerCase()
        const matchesName = product.name.toLowerCase().includes(query)
        const matchesSlug = product.slug.toLowerCase().includes(query)
        if (!matchesName && !matchesSlug) return false
      }
      
      // Status filter
      if (statusFilter === 'active' && !product.isActive) return false
      if (statusFilter === 'draft' && product.isActive) return false
      
      // Stock filter
      const totalInventory = product.variants.reduce((sum, v) => sum + v.inventory, 0)
      if (stockFilter === 'out' && totalInventory > 0) return false
      if (stockFilter === 'low' && (totalInventory === 0 || totalInventory > 10)) return false
      if (stockFilter === 'inStock' && totalInventory <= 10) return false
      
      // Margin filter
      const financial = financials.get(product.id)
      if (marginFilter !== 'all' && financial) {
        const margin = financial.marginPercent
        if (marginFilter === 'low' && margin >= 20) return false
        if (marginFilter === 'healthy' && (margin < 20 || margin >= 40)) return false
        if (marginFilter === 'high' && margin < 40) return false
      }
      
      return true
    })
    .sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1
      const finA = financials.get(a.id)
      const finB = financials.get(b.id)
      
      switch (sortField) {
        case 'name':
          return direction * a.name.localeCompare(b.name)
        case 'price':
          return direction * (a.price - b.price)
        case 'inventory':
          const invA = a.variants.reduce((sum, v) => sum + v.inventory, 0)
          const invB = b.variants.reduce((sum, v) => sum + v.inventory, 0)
          return direction * (invA - invB)
        case 'revenue':
          return direction * ((finA?.revenue || 0) - (finB?.revenue || 0))
        case 'margin':
          return direction * ((finA?.marginPercent || 0) - (finB?.marginPercent || 0))
        case 'unitsSold':
          return direction * ((finA?.unitsSold || 0) - (finB?.unitsSold || 0))
        default:
          return 0
      }
    })

  // Check if any filters are active
  const hasActiveFilters = appliedSearchQuery || statusFilter !== 'all' || stockFilter !== 'all' || marginFilter !== 'all'

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
          <Button 
            onClick={() => setSlideOver({ isOpen: true, product: null })}
            className="bg-[#FF3131] hover:bg-[#E02828]"
          >
            <Plus size={16} weight="bold" className="mr-2" />
            Add Product
          </Button>
        }
      >
      {/* Stats Grid - Product & Financial Metrics */}
      {loading ? (
        <StatsGridSkeleton count={8} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-4 mb-4 sm:mb-8">
          {/* Product Stats */}
          <Card className="col-span-1">
            <CardHeader className="pb-1 sm:pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
              <CardTitle className="text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 flex items-center gap-1">
                <Package size={10} className="sm:w-3 sm:h-3" />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="text-xl sm:text-2xl font-bold text-white">{stats.total}</div>
              <p className="text-[10px] sm:text-xs text-white/40">Products</p>
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader className="pb-1 sm:pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
              <CardTitle className="text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">Active</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="text-xl sm:text-2xl font-bold text-emerald-400">{stats.active}</div>
              <p className="text-[10px] sm:text-xs text-white/40">Published</p>
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader className="pb-1 sm:pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
              <CardTitle className="text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">Drafts</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="text-xl sm:text-2xl font-bold text-white/70">{stats.draft}</div>
              <p className="text-[10px] sm:text-xs text-white/40">Unpublished</p>
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader className="pb-1 sm:pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
              <CardTitle className="text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">Low Stock</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="text-xl sm:text-2xl font-bold text-amber-400">{stats.lowStock}</div>
              <p className="text-[10px] sm:text-xs text-white/40">Need restock</p>
            </CardContent>
          </Card>

          {/* Financial Stats */}
          <Card className="col-span-1">
            <CardHeader className="pb-1 sm:pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
              <CardTitle className="text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 flex items-center gap-1">
                <CurrencyDollar size={10} className="sm:w-3 sm:h-3" />
                Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="text-xl sm:text-2xl font-bold text-emerald-400">
                ${financialLoading ? '...' : ((financialSummary?.totalRevenue || 0) / 1000).toFixed(1)}k
              </div>
              <p className="text-[10px] sm:text-xs text-white/40">{financialPeriod}d period</p>
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader className="pb-1 sm:pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
              <CardTitle className="text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 flex items-center gap-1">
                <ShoppingCart size={10} className="sm:w-3 sm:h-3" />
                Sold
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="text-xl sm:text-2xl font-bold text-blue-400">
                {financialLoading ? '...' : (financialSummary?.totalUnitsSold || 0)}
              </div>
              <p className="text-[10px] sm:text-xs text-white/40">Units</p>
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader className="pb-1 sm:pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
              <CardTitle className="text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 flex items-center gap-1">
                <Percent size={10} className="sm:w-3 sm:h-3" />
                Avg Margin
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
              <div className={`text-xl sm:text-2xl font-bold ${
                (financialSummary?.avgMarginPercent || 0) >= 40 ? 'text-emerald-400' :
                (financialSummary?.avgMarginPercent || 0) >= 20 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {financialLoading ? '...' : `${(financialSummary?.avgMarginPercent || 0).toFixed(0)}%`}
              </div>
              <p className="text-[10px] sm:text-xs text-white/40">Gross</p>
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader className="pb-1 sm:pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
              <CardTitle className="text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.15em] text-white/40 flex items-center gap-1">
                <TrendUp size={10} className="sm:w-3 sm:h-3" />
                Best Seller
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="text-xs sm:text-sm font-bold text-[#FF3131] truncate" title={financialSummary?.bestSeller?.productName}>
                {financialLoading ? '...' : (financialSummary?.bestSeller?.productName?.split(' ')[0] || 'N/A')}
              </div>
              <p className="text-[10px] sm:text-xs text-white/40">
                {financialLoading ? '' : `$${(financialSummary?.bestSeller?.revenue || 0).toFixed(0)}`}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Period Selector */}
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <span className="text-[9px] sm:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Period:</span>
        <div className="flex bg-white/5 rounded-lg p-0.5 sm:p-1">
          {(['7', '30', '90'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setFinancialPeriod(period)}
              className={`px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded transition-colors ${
                financialPeriod === period
                  ? 'bg-[#FF3131] text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {period}d
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filter Bar */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Search Form */}
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 sm:w-[18px] sm:h-[18px]" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 sm:py-2.5 pl-9 sm:pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/50"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1 sm:flex-none bg-[#FF3131] hover:bg-[#E02828] px-4 sm:px-6 text-sm"
                >
                  Search
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex-1 sm:flex-none bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-sm ${
                    hasActiveFilters ? 'text-[#FF3131] border-[#FF3131]/30' : 'text-white/70'
                  }`}
                >
                  <Funnel size={14} weight={hasActiveFilters ? 'fill' : 'regular'} className="mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Filters</span>
                  {hasActiveFilters && (
                    <span className="ml-1 sm:ml-2 bg-[#FF3131] text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {[appliedSearchQuery, statusFilter !== 'all', stockFilter !== 'all', marginFilter !== 'all'].filter(Boolean).length}
                    </span>
                  )}
                </Button>
              </div>
            </form>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="pt-3 sm:pt-4 border-t border-white/10">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {/* Status Filter */}
                <div>
                  <label className="text-[9px] sm:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 sm:mb-2 block">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 sm:py-2.5 px-3 text-sm text-white focus:outline-none focus:border-[#FF3131]/50"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>

                {/* Stock Filter */}
                <div>
                  <label className="text-[9px] sm:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 sm:mb-2 block">
                    Stock Level
                  </label>
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 sm:py-2.5 px-3 text-sm text-white focus:outline-none focus:border-[#FF3131]/50"
                  >
                    <option value="all">All Stock</option>
                    <option value="inStock">In Stock (&gt;10)</option>
                    <option value="low">Low Stock (1-10)</option>
                    <option value="out">Out of Stock</option>
                  </select>
                </div>

                {/* Margin Filter */}
                <div>
                  <label className="text-[9px] sm:text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5 sm:mb-2 block">
                    Profit Margin
                  </label>
                  <select
                    value={marginFilter}
                    onChange={(e) => setMarginFilter(e.target.value as typeof marginFilter)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 sm:py-2.5 px-3 text-sm text-white focus:outline-none focus:border-[#FF3131]/50"
                  >
                    <option value="all">All Margins</option>
                    <option value="high">High (&gt;40%)</option>
                    <option value="healthy">Healthy (20-40%)</option>
                    <option value="low">Low (&lt;20%)</option>
                  </select>
                </div>
              </div>

              {/* Active Filters Summary */}
              {hasActiveFilters && (
                <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] sm:text-xs text-white/40">Active:</span>
                  
                  {appliedSearchQuery && (
                    <span className="inline-flex items-center gap-1 bg-white/10 text-white/70 text-[10px] sm:text-xs px-2 py-1 rounded">
                      Search: {appliedSearchQuery}
                      <button onClick={() => { setSearchQuery(''); setAppliedSearchQuery('') }} className="text-white/40 hover:text-white">
                        <X size={10} className="sm:w-3 sm:h-3" />
                      </button>
                    </span>
                  )}
                  
                  {statusFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 bg-white/10 text-white/70 text-[10px] sm:text-xs px-2 py-1 rounded">
                      Status: {statusFilter}
                      <button onClick={() => setStatusFilter('all')} className="text-white/40 hover:text-white">
                        <X size={10} className="sm:w-3 sm:h-3" />
                      </button>
                    </span>
                  )}
                  
                  {stockFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 bg-white/10 text-white/70 text-[10px] sm:text-xs px-2 py-1 rounded">
                      Stock: {stockFilter}
                      <button onClick={() => setStockFilter('all')} className="text-white/40 hover:text-white">
                        <X size={10} className="sm:w-3 sm:h-3" />
                      </button>
                    </span>
                  )}
                  
                  {marginFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 bg-white/10 text-white/70 text-[10px] sm:text-xs px-2 py-1 rounded">
                      Margin: {marginFilter}
                      <button onClick={() => setMarginFilter('all')} className="text-white/40 hover:text-white">
                        <X size={10} className="sm:w-3 sm:h-3" />
                      </button>
                    </span>
                  )}
                  
                  <button
                    onClick={clearAllFilters}
                    className="text-[10px] sm:text-xs text-[#FF3131] hover:text-[#FF3131]/80 ml-1 sm:ml-2"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}
          </div>
        </CardContent>
      </Card>

        {/* Products Table */}
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg">Products ({filteredProducts.length})</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {hasActiveFilters 
                    ? `Showing ${filteredProducts.length} of ${products.length} products`
                    : 'Manage inventory and financials'
                  }
                </CardDescription>
              </div>
              
              {/* Bulk Actions Bar */}
              {selectedProducts.size > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm text-white/70">
                    {selectedProducts.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusChange(true)}
                    disabled={bulkActionLoading}
                    className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 text-xs px-2 py-1"
                  >
                    Activate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusChange(false)}
                    disabled={bulkActionLoading}
                    className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 text-xs px-2 py-1"
                  >
                    Deactivate
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkActionLoading}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0 text-xs px-2 py-1"
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {loading ? (
              <div className="p-4 sm:p-0">
                <TableSkeleton rows={5} columns={9} />
              </div>
            ) : filteredProducts.length === 0 ? (
              hasActiveFilters ? (
                <div className="py-8 sm:py-12 text-center px-4">
                  <MagnifyingGlass size={40} className="mx-auto text-white/20 mb-4 sm:w-12 sm:h-12" />
                  <h3 className="text-base sm:text-lg font-medium text-white mb-2">No products match your filters</h3>
                  <p className="text-white/40 mb-4 text-sm">Try adjusting your search or filter criteria</p>
                  <Button
                    variant="outline"
                    onClick={clearAllFilters}
                    className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                  >
                    Clear all filters
                  </Button>
                </div>
              ) : (
                <div className="px-4 sm:px-0">
                  <EmptyState
                    icon={Package}
                    title="No Products Yet"
                    description="Start building your streetwear catalog by adding your first product."
                    action={{
                      label: 'Add Your First Product',
                      onClick: () => setSlideOver({ isOpen: true, product: null }),
                    }}
                  />
                </div>
              )
            ) : (
              <>
                {/* Mobile Cards View */}
                <div className="lg:hidden">
                  {/* Mobile bulk select header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-2 text-sm text-white/70"
                    >
                      {selectedProducts.size === filteredProducts.length && filteredProducts.length > 0 ? (
                        <CheckSquare size={20} weight="fill" className="text-[#FF3131]" />
                      ) : (
                        <Square size={20} weight="regular" />
                      )}
                      <span>{selectedProducts.size > 0 ? `${selectedProducts.size} selected` : 'Select all'}</span>
                    </button>
                    <span className="text-xs text-white/40">{filteredProducts.length} products</span>
                  </div>
                  
                  {/* Mobile cards list */}
                  <div className="divide-y divide-white/10">
                    {filteredProducts.map((product) => (
                      <ProductMobileCard
                        key={product.id}
                        product={product}
                        financial={financials.get(product.id)}
                        isSelected={selectedProducts.has(product.id)}
                        onSelect={() => toggleSelectProduct(product.id)}
                        onQuickEdit={() => setSlideOver({ isOpen: true, product })}
                        onToggleStatus={() => toggleStatus(product)}
                        onRestock={() => setRestockModal({ isOpen: true, product })}
                        onDelete={() => handleDelete(product.id)}
                      />
                    ))}
                  </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left py-3 px-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-white/10 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]"
                        />
                      </th>
                      <th 
                        className="text-left py-3 px-3 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] cursor-pointer hover:text-white/60"
                        onClick={() => handleSort('name')}
                      >
                        <span className="flex items-center">
                          Product
                          {getSortIcon('name')}
                        </span>
                      </th>
                      <th className="text-left py-3 px-3 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Status</th>
                      <th 
                        className="text-left py-3 px-3 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] cursor-pointer hover:text-white/60"
                        onClick={() => handleSort('price')}
                      >
                        <span className="flex items-center">
                          Price
                          {getSortIcon('price')}
                        </span>
                      </th>
                      <th className="text-left py-3 px-3 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Cost</th>
                      <th 
                        className="text-left py-3 px-3 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] cursor-pointer hover:text-white/60"
                        onClick={() => handleSort('margin')}
                      >
                        <span className="flex items-center">
                          Margin
                          {getSortIcon('margin')}
                        </span>
                      </th>
                      <th 
                        className="text-left py-3 px-3 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] cursor-pointer hover:text-white/60"
                        onClick={() => handleSort('inventory')}
                      >
                        <span className="flex items-center">
                          Stock
                          {getSortIcon('inventory')}
                        </span>
                      </th>
                      <th 
                        className="text-left py-3 px-3 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] cursor-pointer hover:text-white/60"
                        onClick={() => handleSort('revenue')}
                      >
                        <span className="flex items-center">
                          Revenue
                          {getSortIcon('revenue')}
                        </span>
                      </th>
                      <th 
                        className="text-left py-3 px-3 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] cursor-pointer hover:text-white/60"
                        onClick={() => handleSort('unitsSold')}
                      >
                        <span className="flex items-center">
                          Sold
                          {getSortIcon('unitsSold')}
                        </span>
                      </th>
                      <th className="text-right py-3 px-3 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredProducts.map((product) => {
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
                      const financial = financials.get(product.id)
                      const marginPercent = financial?.marginPercent || 0
                      const costPrice = financial?.costPrice
                      
                      return (
                        <tr key={product.id} className="hover:bg-white/5">
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={selectedProducts.has(product.id)}
                              onChange={() => toggleSelectProduct(product.id)}
                              className="rounded border-white/10 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-3">
                              <Image
                                src={imageUrl}
                                alt={product.name}
                                width={40}
                                height={40}
                                className="rounded object-cover"
                              />
                              <div>
                                <Link 
                                  href={`/admin/products/${product.id}`}
                                  className="font-medium text-white hover:text-[#FF3131] transition-colors"
                                >
                                  {product.name}
                                </Link>
                                <div className="text-xs text-white/40">{product.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-1 text-xs rounded ${
                              product.isActive 
                                ? 'bg-emerald-500/20 text-emerald-400' 
                                : 'bg-white/10 text-white/70'
                            }`}>
                              {product.isActive ? 'Active' : 'Draft'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <InlineEdit
                              value={product.price}
                              onSave={(value) => handleUpdatePrice(product.id, value)}
                              type="number"
                              prefix="$"
                              min={0}
                              className="font-medium text-white"
                            />
                          </td>
                          <td className="py-3 px-3">
                            {costPrice !== null && costPrice !== undefined ? (
                              <span className="text-white/70">${costPrice.toFixed(2)}</span>
                            ) : (
                              <span className="text-white/30 text-xs">Not set</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {costPrice !== null && costPrice !== undefined ? (
                              <span className={`font-medium ${
                                marginPercent >= 40 ? 'text-emerald-400' :
                                marginPercent >= 20 ? 'text-amber-400' : 'text-red-400'
                              }`}>
                                {marginPercent.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-white/30 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className={`${
                              totalInventory === 0 
                                ? 'text-red-400' 
                                : totalInventory <= 10 
                                ? 'text-amber-400' 
                                : 'text-white'
                            }`}>
                              <InlineEdit
                                value={totalInventory}
                                onSave={(value) => handleUpdateInventory(product.id, product.variants[0].id, value)}
                                type="number"
                                min={0}
                                className="font-medium"
                              />
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {financial && financial.revenue > 0 ? (
                              <div>
                                <span className="font-medium text-emerald-400">${financial.revenue.toFixed(0)}</span>
                              </div>
                            ) : (
                              <span className="text-white/30 text-xs">$0</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {financial && financial.unitsSold > 0 ? (
                              <span className="font-medium text-blue-400">{financial.unitsSold}</span>
                            ) : (
                              <span className="text-white/30 text-xs">0</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex justify-end space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRestockModal({ isOpen: true, product })}
                                className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-0 px-2"
                                title="Restock"
                              >
                                <Package size={14} weight="bold" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleStatus(product)}
                                className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 px-2"
                                title={product.isActive ? 'Unpublish' : 'Publish'}
                              >
                                {product.isActive ? 'Off' : 'On'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSlideOver({ isOpen: true, product })}
                                className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 px-2"
                                title="Quick Edit"
                              >
                                <PencilSimple size={14} weight="bold" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(product.id)}
                                className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0 px-2"
                                title="Delete"
                              >
                                <X size={14} weight="bold" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg text-white flex items-center gap-2">
                <ChartLineUp size={18} className="text-[#FF3131] sm:w-5 sm:h-5" />
                Financial Reports
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Analyze product profitability</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="space-y-2 sm:space-y-3">
                <Link href="/admin/accounting/analytics">
                  <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 text-xs sm:text-sm">
                    Profit Analysis
                  </Button>
                </Link>
                <Link href="/admin/accounting">
                  <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 text-xs sm:text-sm">
                    Accounting Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg text-white flex items-center gap-2">
                <Package size={18} className="text-amber-400 sm:w-5 sm:h-5" />
                Inventory
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Track stock levels</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="space-y-2 sm:space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 text-xs sm:text-sm"
                  onClick={() => { setStockFilter('low'); setShowFilters(true) }}
                >
                  View Low Stock ({stats.lowStock})
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 text-xs sm:text-sm"
                  onClick={() => { setStockFilter('out'); setShowFilters(true) }}
                >
                  Out of Stock Items
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg text-white flex items-center gap-2">
                <Percent size={18} className="text-emerald-400 sm:w-5 sm:h-5" />
                Margin Alerts
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Products needing attention</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="space-y-2 sm:space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 text-xs sm:text-sm"
                  onClick={() => { setMarginFilter('low'); setShowFilters(true) }}
                >
                  Low Margin Products ({financialSummary?.lowMarginCount || 0})
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 text-xs sm:text-sm"
                  onClick={() => { setMarginFilter('high'); setShowFilters(true) }}
                >
                  High Performers
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

      {/* Product Slide Over - Add/Edit */}
      <ProductSlideOver
        isOpen={slideOver.isOpen}
        onClose={() => setSlideOver({ isOpen: false, product: null })}
        product={slideOver.product}
        onSuccess={() => {
          loadProducts()
          loadFinancials()
        }}
      />

      {/* Mobile Floating Add Button */}
      <button
        onClick={() => setSlideOver({ isOpen: true, product: null })}
        className="sm:hidden fixed bottom-24 right-4 z-40 w-14 h-14 bg-[#FF3131] hover:bg-[#E02828] text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        aria-label="Add Product"
      >
        <Plus size={24} weight="bold" />
      </button>
    </>
  );
}