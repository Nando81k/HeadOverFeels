'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  CaretDown,
  CaretUp,
  ChartLineUp,
  CurrencyDollar,
  Funnel,
  MagnifyingGlass,
  Package,
  PencilSimple,
  Percent,
  Plus,
  ShoppingCart,
  TrendUp,
  X,
} from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ProductMobileCard } from '@/components/admin/ProductMobileCard'
import { ProductSlideOver } from '@/components/admin/ProductSlideOver'
import { RestockModal } from '@/components/admin/RestockModal'
import {
  buildVariantInventoryUpdatePayload,
  filterProducts,
  formatVariantLabel,
  getActiveFilterChips,
  getProductInventory,
  getProductPrimaryImage,
  getQuickFilterFromState,
  getStateFromQuickFilter,
  ProductManagementSortDirection,
  ProductManagementSortField,
  ProductQuickFilter,
  sortProducts,
} from '@/components/admin/products/product-management'
import { EmptyState } from '@/components/ui/EmptyState'
import { InlineEdit } from '@/components/ui/InlineEdit'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatsGridSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import { productApi, Product } from '@/lib/api/products'
import { toast } from '@/lib/toast'

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

interface ProductStats {
  total: number
  active: number
  draft: number
  lowStock: number
}

const QUICK_FILTERS: Array<{ key: ProductQuickFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'lowStock', label: 'Low Stock' },
  { key: 'outOfStock', label: 'Out of Stock' },
]

const SORT_OPTIONS: Array<{ value: ProductManagementSortField; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'price', label: 'Price' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'margin', label: 'Margin' },
  { value: 'unitsSold', label: 'Units Sold' },
]

function deriveStats(products: Product[]): ProductStats {
  const active = products.filter((product) => product.isActive).length
  const draft = products.length - active
  const lowStock = products.filter((product) => getProductInventory(product) < 10).length

  return {
    total: products.length,
    active,
    draft,
    lowStock,
  }
}

export function AdminProductsV1() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ProductStats>({
    total: 0,
    active: 0,
    draft: 0,
    lowStock: 0,
  })

  const [restockModal, setRestockModal] = useState<{ isOpen: boolean; product: Product | null }>({
    isOpen: false,
    product: null,
  })
  const [slideOver, setSlideOver] = useState<{ isOpen: boolean; product: Product | null }>({
    isOpen: false,
    product: null,
  })
  const [expandedStockProductId, setExpandedStockProductId] = useState<string | null>(null)

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  const [financials, setFinancials] = useState<Map<string, ProductFinancial>>(new Map())
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null)
  const [financialPeriod, setFinancialPeriod] = useState<'7' | '30' | '90'>('30')
  const [financialLoading, setFinancialLoading] = useState(false)
  const [showPerformanceSnapshot, setShowPerformanceSnapshot] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [quickFilter, setQuickFilter] = useState<ProductQuickFilter>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'inStock'>('all')
  const [marginFilter, setMarginFilter] = useState<'all' | 'low' | 'healthy' | 'high'>('all')

  const [sortField, setSortField] = useState<ProductManagementSortField>('name')
  const [sortDirection, setSortDirection] = useState<ProductManagementSortDirection>('asc')

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAppliedSearchQuery(searchQuery.trim())
    }, 250)

    return () => clearTimeout(timeout)
  }, [searchQuery])

  const loadProducts = useCallback(async () => {
    setLoading(true)

    try {
      const result = await productApi.getAll({ limit: 50 })
      if (result.data?.data) {
        setProducts(result.data.data)
        setStats(deriveStats(result.data.data))
      }
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setLoading(false)
    }
  }, [])

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
  }, [loadProducts, loadFinancials])

  useEffect(() => {
    setQuickFilter(getQuickFilterFromState(statusFilter, stockFilter))
  }, [statusFilter, stockFilter])

  const filteredProducts = useMemo(
    () =>
      filterProducts(products, financials, {
        search: appliedSearchQuery,
        status: statusFilter,
        stock: stockFilter,
        margin: marginFilter,
      }),
    [products, financials, appliedSearchQuery, statusFilter, stockFilter, marginFilter]
  )

  const sortedProducts = useMemo(
    () => sortProducts(filteredProducts, financials, sortField, sortDirection),
    [filteredProducts, financials, sortField, sortDirection]
  )

  const filteredProductIds = useMemo(() => new Set(sortedProducts.map((product) => product.id)), [sortedProducts])
  const activeChips = useMemo(
    () =>
      getActiveFilterChips({
        search: appliedSearchQuery,
        status: statusFilter,
        stock: stockFilter,
        margin: marginFilter,
      }),
    [appliedSearchQuery, statusFilter, stockFilter, marginFilter]
  )

  useEffect(() => {
    setSelectedProducts((previous) => {
      const next = new Set(Array.from(previous).filter((id) => filteredProductIds.has(id)))
      if (next.size === previous.size) {
        return previous
      }
      return next
    })
  }, [filteredProductIds])

  const hasActiveFilters = activeChips.length > 0

  const toggleSelectAll = () => {
    if (selectedProducts.size === sortedProducts.length) {
      setSelectedProducts(new Set())
      return
    }

    setSelectedProducts(new Set(sortedProducts.map((product) => product.id)))
  }

  const toggleSelectProduct = (productId: string) => {
    setSelectedProducts((previous) => {
      const next = new Set(previous)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  const clearAllFilters = () => {
    setSearchQuery('')
    setAppliedSearchQuery('')
    setStatusFilter('all')
    setStockFilter('all')
    setMarginFilter('all')
  }

  const handleQuickFilter = (key: ProductQuickFilter) => {
    setQuickFilter(key)
    const mapped = getStateFromQuickFilter(key)
    setStatusFilter(mapped.status)
    setStockFilter(mapped.stock)
  }

  const removeFilterChip = (key: 'search' | 'status' | 'stock' | 'margin') => {
    if (key === 'search') {
      setSearchQuery('')
      setAppliedSearchQuery('')
      return
    }
    if (key === 'status') {
      setStatusFilter('all')
      return
    }
    if (key === 'stock') {
      setStockFilter('all')
      return
    }
    setMarginFilter('all')
  }

  const toggleSortDirection = () => {
    setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return
    }

    const previousProducts = products
    const nextProducts = products.filter((product) => product.id !== id)
    setProducts(nextProducts)
    setStats(deriveStats(nextProducts))

    const loadingToast = toast.loading('Deleting product...')
    const result = await productApi.delete(id)
    toast.dismiss(loadingToast)

    if (result.error) {
      setProducts(previousProducts)
      setStats(deriveStats(previousProducts))

      if (result.error.includes('existing orders')) {
        toast.error('Cannot delete product', 'This product has existing orders and will be marked as inactive instead.')
        await productApi.update(id, { isActive: false })
      } else {
        toast.error('Failed to delete product', result.error)
      }
      return
    }

    toast.success('Product deleted successfully')
    setSelectedProducts((previous) => {
      const next = new Set(previous)
      next.delete(id)
      return next
    })
  }

  const toggleStatus = async (product: Product) => {
    const nextStatus = !product.isActive
    const previousProducts = products

    setProducts((previous) => {
      const next = previous.map((item) => (item.id === product.id ? { ...item, isActive: nextStatus } : item))
      setStats(deriveStats(next))
      return next
    })

    const loadingToast = toast.loading(`${nextStatus ? 'Activating' : 'Deactivating'} product...`)
    const result = await productApi.update(product.id, { isActive: nextStatus })
    toast.dismiss(loadingToast)

    if (result.error) {
      setProducts(previousProducts)
      setStats(deriveStats(previousProducts))
      toast.error('Failed to update product', result.error)
      return
    }

    toast.success(`Product ${nextStatus ? 'activated' : 'deactivated'} successfully`)
  }

  const handleUpdatePrice = async (productId: string, newPrice: string) => {
    const parsedPrice = parseFloat(newPrice)
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      throw new Error('Invalid price')
    }

    const previousProducts = products
    setProducts((previous) => previous.map((product) => (product.id === productId ? { ...product, price: parsedPrice } : product)))

    const loadingToast = toast.loading('Updating price...')
    const result = await productApi.update(productId, { price: parsedPrice })
    toast.dismiss(loadingToast)

    if (result.error) {
      setProducts(previousProducts)
      toast.error('Failed to update price', result.error)
      throw new Error(result.error)
    }

    toast.success('Price updated successfully')
  }

  const handleUpdateInventory = async (productId: string, variantId: string, newInventory: string) => {
    const inventory = parseInt(newInventory, 10)
    if (Number.isNaN(inventory) || inventory < 0) {
      throw new Error('Invalid inventory')
    }

    const product = products.find((item) => item.id === productId)
    if (!product) {
      throw new Error('Product not found')
    }

    const previousProducts = products
    const updatedVariants = buildVariantInventoryUpdatePayload(product.variants, variantId, inventory)
    const optimisticProducts = products.map((item) =>
      item.id === productId
        ? {
            ...item,
            variants: updatedVariants,
          }
        : item
    )

    setProducts(optimisticProducts)
    setStats(deriveStats(optimisticProducts))

    const loadingToast = toast.loading('Updating inventory...')
    const result = await productApi.update(productId, { variants: updatedVariants })
    toast.dismiss(loadingToast)

    if (result.error) {
      setProducts(previousProducts)
      setStats(deriveStats(previousProducts))
      toast.error('Failed to update inventory', result.error)
      throw new Error(result.error)
    }

    toast.success('Inventory updated successfully')
  }

  const handleBulkStatusChange = async (isActive: boolean) => {
    if (selectedProducts.size === 0) {
      return
    }

    setBulkActionLoading(true)
    const loadingToast = toast.loading(`${isActive ? 'Activating' : 'Deactivating'} ${selectedProducts.size} products...`)

    let successCount = 0
    let errorCount = 0

    for (const productId of selectedProducts) {
      const result = await productApi.update(productId, { isActive })
      if (result.error) {
        errorCount += 1
      } else {
        successCount += 1
      }
    }

    toast.dismiss(loadingToast)
    setBulkActionLoading(false)
    setSelectedProducts(new Set())

    if (successCount > 0) {
      toast.success('Bulk update completed', `${successCount} product(s) updated${errorCount > 0 ? `, ${errorCount} failed` : ''}`)
      loadProducts()
      return
    }

    toast.error('Bulk update failed', 'Could not update any products')
  }

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) {
      return
    }

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
        errorCount += 1
      } else {
        successCount += 1
      }
    }

    toast.dismiss(loadingToast)
    setBulkActionLoading(false)
    setSelectedProducts(new Set())

    if (successCount > 0) {
      toast.success('Bulk delete completed', `${successCount} product(s) deleted${errorCount > 0 ? `, ${errorCount} failed` : ''}`)
      loadProducts()
      return
    }

    toast.error('Bulk delete failed', 'Could not delete any products')
  }

  return (
    <>
      <AdminLayout
        title="Product Management"
        subtitle="Operator-focused catalog and inventory control"
        headerActions={
          <Button onClick={() => setSlideOver({ isOpen: true, product: null })} className="bg-[#FF3131] hover:bg-[#E02828]">
            <Plus size={16} weight="bold" className="mr-2" />
            Add Product
          </Button>
        }
      >
        <div className="sticky top-0 z-30 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 pb-3 bg-neutral-950/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/75">
          <Card variant="dark" className="border-white/10">
            <CardContent className="p-3 sm:p-4 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search products or slugs..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full h-10 bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-[#FF3131]/45 focus:border-[#FF3131]/45"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={sortField}
                    onChange={(event) => setSortField(event.target.value as ProductManagementSortField)}
                    className="h-10 bg-white/5 border border-white/10 rounded-lg px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#FF3131]/45"
                    aria-label="Sort products"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        Sort: {option.label}
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleSortDirection}
                    className="h-10 px-3 bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                    aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {sortDirection === 'asc' ? <CaretUp size={15} /> : <CaretDown size={15} />}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters((previous) => !previous)}
                    className={`h-10 px-3 bg-white/5 border-white/10 hover:bg-white/10 ${
                      hasActiveFilters ? 'text-[#FF3131] border-[#FF3131]/35' : 'text-white/80'
                    }`}
                  >
                    <Funnel size={14} className="mr-2" />
                    Filters
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {QUICK_FILTERS.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => handleQuickFilter(chip.key)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      quickFilter === chip.key
                        ? 'bg-white text-neutral-900'
                        : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {showFilters && (
                <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                      className="w-full h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#FF3131]/45"
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5">Stock Level</label>
                    <select
                      value={stockFilter}
                      onChange={(event) => setStockFilter(event.target.value as typeof stockFilter)}
                      className="w-full h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#FF3131]/45"
                    >
                      <option value="all">All</option>
                      <option value="inStock">In Stock (&gt;10)</option>
                      <option value="low">Low (1-10)</option>
                      <option value="out">Out of Stock</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5">Margin</label>
                    <select
                      value={marginFilter}
                      onChange={(event) => setMarginFilter(event.target.value as typeof marginFilter)}
                      className="w-full h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#FF3131]/45"
                    >
                      <option value="all">All</option>
                      <option value="high">High (&gt;40%)</option>
                      <option value="healthy">Healthy (20-40%)</option>
                      <option value="low">Low (&lt;20%)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-white/50">{sortedProducts.length} results</span>
                <span className="text-white/20">•</span>
                <span className="text-white/50">{selectedProducts.size} selected</span>
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => removeFilterChip(chip.key)}
                    className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-white/80 hover:bg-white/15"
                  >
                    {chip.label}
                    <X size={11} />
                  </button>
                ))}
                {hasActiveFilters && (
                  <button type="button" onClick={clearAllFilters} className="text-[#FF3131] hover:text-[#FF3131]/80 ml-1">
                    Clear all
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <StatsGridSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Card variant="dark">
              <CardHeader className="pb-2 px-3 pt-3">
                <CardTitle className="text-[10px] uppercase tracking-[0.15em] text-white/40 flex items-center gap-1">
                  <Package size={11} />
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-xl font-semibold text-white">{stats.total}</div>
                <p className="text-[11px] text-white/40">Products</p>
              </CardContent>
            </Card>

            <Card variant="dark">
              <CardHeader className="pb-2 px-3 pt-3">
                <CardTitle className="text-[10px] uppercase tracking-[0.15em] text-white/40">Active</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-xl font-semibold text-emerald-400">{stats.active}</div>
                <p className="text-[11px] text-white/40">Published</p>
              </CardContent>
            </Card>

            <Card variant="dark">
              <CardHeader className="pb-2 px-3 pt-3">
                <CardTitle className="text-[10px] uppercase tracking-[0.15em] text-white/40">Draft</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-xl font-semibold text-white/75">{stats.draft}</div>
                <p className="text-[11px] text-white/40">Unpublished</p>
              </CardContent>
            </Card>

            <Card variant="dark">
              <CardHeader className="pb-2 px-3 pt-3">
                <CardTitle className="text-[10px] uppercase tracking-[0.15em] text-white/40">Low Stock</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-xl font-semibold text-amber-400">{stats.lowStock}</div>
                <p className="text-[11px] text-white/40">Needs restock</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card variant="dark" className="mb-4">
          <button
            type="button"
            onClick={() => setShowPerformanceSnapshot((previous) => !previous)}
            className="w-full text-left p-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors rounded-t-xl"
          >
            <div className="flex items-center gap-2">
              <ChartLineUp size={16} className="text-[#FF3131]" />
              <span className="text-sm font-medium text-white">Performance Snapshot</span>
            </div>
            {showPerformanceSnapshot ? <CaretUp size={16} className="text-white/40" /> : <CaretDown size={16} className="text-white/40" />}
          </button>

          {showPerformanceSnapshot && (
            <CardContent className="pt-0 pb-3 px-3 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3 mt-3">
                <span className="text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">Period</span>
                <div className="flex bg-white/5 rounded-md p-0.5">
                  {(['7', '30', '90'] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setFinancialPeriod(period)}
                      className={`px-2.5 py-1 rounded text-xs ${
                        financialPeriod === period ? 'bg-[#FF3131] text-white' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {period}d
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-white/40 flex items-center gap-1">
                    <CurrencyDollar size={12} /> Revenue
                  </div>
                  <div className="text-lg font-semibold text-emerald-400 mt-1">
                    ${financialLoading ? '...' : ((financialSummary?.totalRevenue || 0) / 1000).toFixed(1)}k
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-white/40 flex items-center gap-1">
                    <ShoppingCart size={12} /> Units Sold
                  </div>
                  <div className="text-lg font-semibold text-blue-400 mt-1">
                    {financialLoading ? '...' : financialSummary?.totalUnitsSold || 0}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-white/40 flex items-center gap-1">
                    <Percent size={12} /> Avg Margin
                  </div>
                  <div className="text-lg font-semibold text-white mt-1">
                    {financialLoading ? '...' : `${(financialSummary?.avgMarginPercent || 0).toFixed(0)}%`}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-white/40 flex items-center gap-1">
                    <TrendUp size={12} /> Best Seller
                  </div>
                  <div className="text-sm font-semibold text-[#FF3131] mt-1 truncate" title={financialSummary?.bestSeller?.productName}>
                    {financialLoading ? '...' : financialSummary?.bestSeller?.productName || 'N/A'}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card variant="dark">
          <CardHeader className="p-3 sm:p-4 border-b border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg text-white">Products ({sortedProducts.length})</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {hasActiveFilters ? `Showing ${sortedProducts.length} of ${products.length} products` : 'Manage inventory and pricing'}
                </CardDescription>
              </div>
              {selectedProducts.size > 0 && (
                <div className="text-xs text-white/60">{selectedProducts.size} selected for bulk action</div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {selectedProducts.size > 0 && (
              <div className="sticky top-[86px] z-20 px-3 py-2 border-b border-white/10 bg-neutral-950/95 backdrop-blur flex flex-wrap items-center gap-2">
                <span className="text-xs text-white/70">{selectedProducts.size} selected</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusChange(true)}
                  disabled={bulkActionLoading}
                  className="h-8 bg-white/5 border-white/10 text-white/75 hover:bg-white/10 text-xs"
                >
                  Activate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusChange(false)}
                  disabled={bulkActionLoading}
                  className="h-8 bg-white/5 border-white/10 text-white/75 hover:bg-white/10 text-xs"
                >
                  Deactivate
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading}
                  className="h-8 bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0 text-xs"
                >
                  Delete
                </Button>
                <button type="button" onClick={() => setSelectedProducts(new Set())} className="text-xs text-white/50 hover:text-white">
                  Clear selection
                </button>
              </div>
            )}

            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={6} columns={8} />
              </div>
            ) : sortedProducts.length === 0 ? (
              hasActiveFilters ? (
                <div className="py-12 text-center px-4">
                  <MagnifyingGlass size={40} className="mx-auto text-white/20 mb-4" />
                  <h3 className="text-base font-medium text-white mb-2">No products match current filters</h3>
                  <p className="text-sm text-white/40 mb-4">Try broadening your criteria.</p>
                  <Button variant="outline" onClick={clearAllFilters} className="bg-white/5 border-white/10 text-white/80 hover:bg-white/10">
                    Clear all filters
                  </Button>
                </div>
              ) : (
                <div className="px-4 py-6">
                  <EmptyState
                    icon={Package}
                    title="No Products Yet"
                    description="Start building your catalog by adding your first product."
                    action={{
                      label: 'Add Your First Product',
                      onClick: () => setSlideOver({ isOpen: true, product: null }),
                    }}
                  />
                </div>
              )
            ) : (
              <>
                <div className="lg:hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                    <button type="button" onClick={toggleSelectAll} className="text-sm text-white/75 hover:text-white">
                      {selectedProducts.size === sortedProducts.length ? 'Deselect all' : 'Select all'}
                    </button>
                    <span className="text-xs text-white/40">{sortedProducts.length} products</span>
                  </div>
                  <div className="divide-y divide-white/10">
                    {sortedProducts.map((product) => (
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

                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-900/90 sticky top-0 z-10">
                      <tr>
                        <th className="text-left py-2.5 px-3 w-10">
                          <input
                            type="checkbox"
                            checked={selectedProducts.size === sortedProducts.length && sortedProducts.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded border-white/10 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]"
                          />
                        </th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.14em] text-white/40">Product</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.14em] text-white/40">Status</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.14em] text-white/40">Price</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.14em] text-white/40">Margin</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.14em] text-white/40">Stock</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.14em] text-white/40">Revenue</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.14em] text-white/40">Sold</th>
                        <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-[0.14em] text-white/40">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {sortedProducts.map((product) => {
                        const totalInventory = getProductInventory(product)
                        const financial = financials.get(product.id)
                        const marginPercent = financial?.marginPercent || 0

                        return (
                          <Fragment key={product.id}>
                            <tr key={product.id} className="hover:bg-white/[0.03] transition-colors">
                              <td className="py-2.5 px-3 align-top">
                                <input
                                  type="checkbox"
                                  checked={selectedProducts.has(product.id)}
                                  onChange={() => toggleSelectProduct(product.id)}
                                  className="rounded border-white/10 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]"
                                />
                              </td>

                              <td className="py-2.5 px-3 align-top">
                                <div className="flex items-center gap-2.5">
                                  <Image src={getProductPrimaryImage(product)} alt={product.name} width={42} height={42} className="rounded object-cover" />
                                  <div className="min-w-0">
                                    <Link href={`/admin/products/${product.id}`} className="font-medium text-white hover:text-[#FF3131] transition-colors">
                                      {product.name}
                                    </Link>
                                    <div className="text-xs text-white/40 truncate">{product.slug}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 align-top">
                                <button
                                  type="button"
                                  onClick={() => toggleStatus(product)}
                                  className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${
                                    product.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/65'
                                  }`}
                                >
                                  {product.isActive ? 'Active' : 'Draft'}
                                </button>
                              </td>

                              <td className="py-2.5 px-3 align-top">
                                <InlineEdit
                                  value={product.price}
                                  onSave={(value) => handleUpdatePrice(product.id, value)}
                                  type="number"
                                  prefix="$"
                                  min={0}
                                  className="font-medium text-white"
                                />
                              </td>

                              <td className="py-2.5 px-3 align-top">
                                {financial?.costPrice !== null && financial?.costPrice !== undefined ? (
                                  <span
                                    className={`text-sm font-medium ${
                                      marginPercent >= 40 ? 'text-emerald-400' : marginPercent >= 20 ? 'text-amber-400' : 'text-red-400'
                                    }`}
                                  >
                                    {marginPercent.toFixed(0)}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-white/35">No cost</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 align-top">
                                <button
                                  type="button"
                                  onClick={() => setExpandedStockProductId((previous) => (previous === product.id ? null : product.id))}
                                  className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${
                                    totalInventory === 0
                                      ? 'border-red-500/40 bg-red-500/10 text-red-300'
                                      : totalInventory <= 10
                                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                      : 'border-white/15 bg-white/5 text-white/80'
                                  }`}
                                >
                                  {totalInventory}
                                  <span className="text-[10px] text-white/45">{product.variants.length} vars</span>
                                </button>
                              </td>

                              <td className="py-2.5 px-3 align-top">
                                {financial && financial.revenue > 0 ? (
                                  <span className="text-sm font-medium text-emerald-400">${financial.revenue.toFixed(0)}</span>
                                ) : (
                                  <span className="text-xs text-white/30">$0</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 align-top">
                                {financial && financial.unitsSold > 0 ? (
                                  <span className="text-sm font-medium text-blue-400">{financial.unitsSold}</span>
                                ) : (
                                  <span className="text-xs text-white/30">0</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-right align-top">
                                <div className="inline-flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setRestockModal({ isOpen: true, product })}
                                    className="h-8 px-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border-0"
                                    title="Restock"
                                  >
                                    <Package size={13} />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSlideOver({ isOpen: true, product })}
                                    className="h-8 px-2 bg-white/5 border-white/10 text-white/75 hover:bg-white/10"
                                    title="Quick Edit"
                                  >
                                    <PencilSimple size={13} />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDelete(product.id)}
                                    className="h-8 px-2 bg-red-500/20 text-red-300 hover:bg-red-500/30 border-0"
                                    title="Delete"
                                  >
                                    <X size={13} />
                                  </Button>
                                </div>
                              </td>
                            </tr>

                            {expandedStockProductId === product.id && (
                              <tr className="bg-white/[0.02]">
                                <td colSpan={9} className="px-3 py-3">
                                  <div className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-2">Variant Inventory</div>
                                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
                                    {product.variants.map((variant) => (
                                      <div key={variant.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="text-sm text-white font-medium truncate">{formatVariantLabel(variant)}</div>
                                          <div className="text-[11px] text-white/35 truncate">{variant.sku}</div>
                                        </div>
                                        <InlineEdit
                                          value={variant.inventory}
                                          onSave={(value) => handleUpdateInventory(product.id, variant.id, value)}
                                          type="number"
                                          min={0}
                                          className="font-medium text-white"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </AdminLayout>

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

      <ProductSlideOver
        isOpen={slideOver.isOpen}
        onClose={() => setSlideOver({ isOpen: false, product: null })}
        product={slideOver.product}
        onSuccess={() => {
          loadProducts()
          loadFinancials()
        }}
      />

      <button
        type="button"
        onClick={() => setSlideOver({ isOpen: true, product: null })}
        className="sm:hidden fixed bottom-24 right-4 z-40 w-14 h-14 bg-[#FF3131] hover:bg-[#E02828] text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        aria-label="Add Product"
      >
        <Plus size={24} weight="bold" />
      </button>
    </>
  )
}
