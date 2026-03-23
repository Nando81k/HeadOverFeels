'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Package, TrendUp, Warning, CaretRight, CheckCircle } from '@phosphor-icons/react'
import { Product as APIProduct } from '@/lib/api/products'

interface ProductFinancial {
  revenue: number
  unitsSold: number
  marginPercent: number
  costPrice: number | null
}

interface ProductMobileCardProps {
  product: APIProduct
  financial?: ProductFinancial
  isSelected: boolean
  onSelect: () => void
  onQuickEdit: () => void
  onToggleStatus: () => void
  onRestock: () => void
  onDelete: () => void
}

export function ProductMobileCard({ 
  product, 
  financial,
  isSelected, 
  onSelect,
  onQuickEdit,
  onToggleStatus,
  onRestock,
  onDelete
}: ProductMobileCardProps) {
  // Parse images
  let imageUrl = '/placeholder-product.jpg'
  try {
    const images = typeof product.images === 'string' 
      ? JSON.parse(product.images) 
      : product.images
    
    if (Array.isArray(images) && images.length > 0) {
      imageUrl = typeof images[0] === 'string' 
        ? images[0] 
        : images[0]?.url || '/placeholder-product.jpg'
    }
  } catch {
    // Use default
  }

  const totalInventory = product.variants.reduce((sum, v) => sum + v.inventory, 0)
  const marginPercent = financial?.marginPercent || 0
  
  const getStockStatus = () => {
    if (totalInventory === 0) return { label: 'Out of Stock', color: 'text-red-400 bg-red-400/10' }
    if (totalInventory <= 10) return { label: 'Low Stock', color: 'text-amber-400 bg-amber-400/10' }
    return { label: 'In Stock', color: 'text-emerald-400 bg-emerald-400/10' }
  }

  const stockStatus = getStockStatus()

  return (
    <div className={`border-b border-white/5 last:border-0 ${isSelected ? 'bg-[#FF3131]/8' : ''}`}>
      <div className="p-3">
        {/* Product Header: Image, Name, Price */}
        <div className="flex gap-2.5 mb-2.5">
          {/* Checkbox & Image */}
          <div className="relative shrink-0">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelect()
              }}
              className={`absolute -left-1 -top-1 z-10 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                isSelected 
                  ? 'bg-[#FF3131] border-[#FF3131]' 
                  : 'border-white/20 bg-neutral-900'
              }`}
            >
              {isSelected && <CheckCircle size={12} weight="bold" className="text-white" />}
            </button>
            <Image
              src={imageUrl}
              alt={product.name}
              width={48}
              height={48}
              className="rounded object-cover"
            />
          </div>

          {/* Name & Price */}
          <div className="flex-1 min-w-0">
            <Link 
              href={`/admin/products/${product.id}`}
              className="block font-medium text-white hover:text-[#FF3131] transition-colors truncate"
            >
              {product.name}
            </Link>
            <div className="text-[11px] text-white/40 truncate mb-0.5">{product.slug}</div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">${product.price.toFixed(2)}</span>
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                product.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/50'
              }`}>
                {product.isActive ? 'Active' : 'Draft'}
              </span>
            </div>
          </div>

          {/* View Link */}
          <Link 
            href={`/admin/products/${product.id}`}
            className="self-center text-white/30"
          >
            <CaretRight size={20} weight="bold" />
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-1.5 mb-2.5">
          {/* Stock */}
          <div className="bg-white/5 rounded p-1.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Package size={12} className="text-white/40" />
              <span className={`text-xs font-bold ${
                totalInventory === 0 ? 'text-red-400' : 
                totalInventory <= 10 ? 'text-amber-400' : 'text-white'
              }`}>
                {totalInventory}
              </span>
            </div>
            <span className="text-[8px] text-white/40 uppercase tracking-wider">Stock</span>
          </div>

          {/* Revenue */}
          <div className="bg-white/5 rounded p-1.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <TrendUp size={12} className="text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">
                ${financial?.revenue ? financial.revenue.toFixed(0) : '0'}
              </span>
            </div>
            <span className="text-[8px] text-white/40 uppercase tracking-wider">Revenue</span>
          </div>

          {/* Margin */}
          <div className="bg-white/5 rounded p-1.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              {marginPercent < 20 && financial?.costPrice !== null && (
                <Warning size={12} className="text-red-400" />
              )}
              <span className={`text-xs font-bold ${
                financial?.costPrice === null || financial?.costPrice === undefined ? 'text-white/40' :
                marginPercent >= 40 ? 'text-emerald-400' :
                marginPercent >= 20 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {financial?.costPrice !== null && financial?.costPrice !== undefined ? `${marginPercent.toFixed(0)}%` : '—'}
              </span>
            </div>
            <span className="text-[8px] text-white/40 uppercase tracking-wider">Margin</span>
          </div>
        </div>

        {/* Bottom Row: Stock Badge & Quick Actions */}
        <div className="flex items-center justify-between">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${stockStatus.color}`}>
            {stockStatus.label} ({totalInventory} units)
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onRestock()
              }}
              className="px-1.5 py-1 text-[10px] font-medium bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
            >
              Restock
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleStatus()
              }}
              className="px-1.5 py-1 text-[10px] font-medium bg-white/10 text-white/70 rounded hover:bg-white/20 transition-colors"
            >
              {product.isActive ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onQuickEdit()
              }}
              className="px-1.5 py-1 text-[10px] font-medium bg-white/10 text-white/70 rounded hover:bg-white/20 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (confirm('Delete this product?')) {
                  onDelete()
                }
              }}
              className="px-1.5 py-1 text-[10px] font-medium bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
            >
              Del
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
