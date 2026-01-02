'use client'

import Link from 'next/link';
import { Warning, Package } from '@phosphor-icons/react';
import { useState } from 'react';
import { RestockModal } from './RestockModal';

interface LowStockProduct {
  id: string;
  name: string;
  slug: string;
  variants: Array<{
    id: string;
    size: string | null;
    color: string | null;
    inventory: number;
  }>;
}

interface LowStockAlertsProps {
  products: LowStockProduct[];
  threshold?: number;
}

export default function LowStockAlerts({ products, threshold = 5 }: LowStockAlertsProps) {
  const [selectedProduct, setSelectedProduct] = useState<LowStockProduct | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleRestock = (product: LowStockProduct, e: React.MouseEvent) => {
    e.preventDefault() // Prevent Link navigation
    setSelectedProduct(product)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedProduct(null)
  }

  const handleRestockSuccess = () => {
    // Reload the page to show updated inventory
    window.location.reload()
  }

  if (products.length === 0) {
    return null;
  }

  const totalLowStockVariants = products.reduce(
    (sum, product) => sum + product.variants.filter(v => v.inventory < threshold).length,
    0
  );

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 p-5">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <Warning size={24} weight="bold" className="text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium tracking-[0.1em] text-white uppercase">Low Stock Alert</h3>
              <p className="text-xs text-white/50 mt-1">
                {totalLowStockVariants} variant{totalLowStockVariants !== 1 ? 's' : ''} running low (below {threshold} units)
              </p>
            </div>
            <Link
              href="/admin/products"
              className="text-xs text-amber-400 hover:text-amber-300 font-medium uppercase tracking-wide"
            >
              View All →
            </Link>
          </div>

          <div className="space-y-2">
            {products.slice(0, 5).map((product) => (
              <div
                key={product.id}
                className="block p-4 bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <Link href={`/admin/products/${product.id}`} className="flex-1">
                    <div>
                      <h4 className="font-medium text-white hover:text-amber-400 transition-colors">
                        {product.name}
                      </h4>
                      <div className="flex gap-2 mt-2">
                        {product.variants
                          .filter(v => v.inventory < threshold)
                          .map((variant) => (
                            <span
                              key={variant.id}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium uppercase tracking-wide bg-amber-500/20 text-amber-400"
                            >
                              {variant.size && <span>{variant.size}</span>}
                              {variant.size && variant.color && <span>•</span>}
                              {variant.color && <span>{variant.color}</span>}
                              <span className="font-bold">({variant.inventory})</span>
                            </span>
                          ))}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xl font-bold text-amber-400">
                        {product.variants.reduce((sum, v) => sum + v.inventory, 0)}
                      </span>
                      <p className="text-[10px] text-white/40 uppercase tracking-wide mt-1">Total</p>
                    </div>
                    <button
                      onClick={(e) => handleRestock(product, e)}
                      className="px-3 py-2 bg-white text-black hover:bg-white/90 transition-colors flex items-center gap-2 text-xs font-medium uppercase tracking-wide"
                      title="Restock Product"
                    >
                      <Package size={14} weight="bold" />
                      Restock
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {products.length > 5 && (
            <p className="text-xs text-white/40 mt-4 text-center">
              And {products.length - 5} more product{products.length - 5 !== 1 ? 's' : ''} with low stock
            </p>
          )}
        </div>
      </div>

      {/* Restock Modal */}
      {selectedProduct && (
        <RestockModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSuccess={handleRestockSuccess}
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          variants={selectedProduct.variants.map(v => ({
            id: v.id,
            sku: `${v.size || ''}-${v.color || ''}`.replace(/^-|-$/g, '') || 'default',
            size: v.size || undefined,
            color: v.color || undefined,
            inventory: v.inventory,
          }))}
        />
      )}
    </div>
  );
}
