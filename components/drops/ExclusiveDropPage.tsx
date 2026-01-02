'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Clock, Package, TrendUp, Warning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/lib/store/cart';
import { CountdownTimer } from '@/components/products/CountdownTimer';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number | null;
  images: string[];
  releaseDate?: Date | null;
  dropEndDate?: Date | null;
  maxQuantity?: number | null;
  variants: Array<{
    id: string;
    sku: string;
    size?: string | null;
    color?: string | null;
    inventory: number;
  }>;
}

interface ExclusiveDropPageProps {
  product: Product;
}

export default function ExclusiveDropPage({ product }: ExclusiveDropPageProps) {
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const addItem = useCartStore((state) => state.addItem);

  // Calculate if drop is live based on dates
  const now = new Date().getTime();
  const releaseTime = product.releaseDate ? new Date(product.releaseDate).getTime() : now;
  const endTime = product.dropEndDate ? new Date(product.dropEndDate).getTime() : Infinity;
  const isDropLive = now >= releaseTime && now < endTime;
  const isUpcoming = now < releaseTime;

  // Calculate total inventory and sold percentage
  const totalInventory = product.variants.reduce((sum, v) => sum + v.inventory, 0);
  const maxQty = product.maxQuantity || totalInventory;
  const soldPercentage = ((maxQty - totalInventory) / maxQty) * 100;

  const handleAddToCart = () => {
    if (!selectedVariant || selectedVariant.inventory <= 0) return;

    const productForCart = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compareAtPrice || undefined,
      images: JSON.stringify(product.images),
      isActive: true,
      isFeatured: false,
      isLimitedEdition: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      variants: product.variants.map(v => ({
        ...v,
        size: v.size || undefined,
        color: v.color || undefined,
        isActive: true
      })),
    };

    const variantForCart = {
      ...selectedVariant,
      size: selectedVariant.size || undefined,
      color: selectedVariant.color || undefined,
      isActive: true
    };

    addItem(productForCart, variantForCart, quantity);
  };

  return (
    <div className="min-h-screen bg-white text-black pt-20">
      {/* Exclusive Banner */}
      <div className="border-b border-black/10 py-4 text-center">
        <p className="text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 text-black/70">
          <TrendUp size={14} weight="bold" />
          Limited Edition Drop • Exclusive Release
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery Section */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-white border border-black/10">
              <Image
                src={product.images[currentImageIndex] || '/placeholder-product.jpg'}
                alt={product.name}
                fill
                className="object-cover"
                priority
              />
              {!isDropLive && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <Clock size={48} weight="bold" className="mx-auto text-black/40" />
                    <p className="text-lg font-bold text-black">Coming Soon</p>
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnail Gallery */}
            <div className="grid grid-cols-4 gap-3">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`relative aspect-square rounded-lg overflow-hidden border transition-all ${
                    currentImageIndex === index
                      ? 'border-black scale-100'
                      : 'border-black/10 hover:border-black/30'
                  }`}
                >
                  <Image 
                    src={image} 
                    alt={`${product.name} ${index + 1}`} 
                    fill 
                    className="object-cover"
                    sizes="(max-width: 768px) 25vw, 10vw"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Product Details Section */}
          <div className="flex flex-col justify-center space-y-6">
            {/* Title & Price */}
            <div>
              <h1 className="text-4xl lg:text-5xl font-black text-black leading-tight logo-font mb-4">
                {product.name}
              </h1>
              <div className="flex items-baseline gap-4">
                <span className="text-3xl md:text-4xl font-black text-black">${product.price.toFixed(2)}</span>
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <span className="text-lg text-black/40 line-through font-medium">
                    ${product.compareAtPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {/* Countdown Timer */}
            {product.releaseDate && product.dropEndDate && (
              <div className="bg-white border border-black/10 rounded-xl p-6">
                <CountdownTimer
                  targetDate={isUpcoming ? product.releaseDate : product.dropEndDate}
                />
              </div>
            )}

            {/* Stock Indicator */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-black/70 font-medium">Availability</span>
                <span className="font-black text-black">
                  {totalInventory > 0 ? `${totalInventory} units left` : 'Sold Out'}
                </span>
              </div>
              <div className="h-2 bg-black/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-black rounded-full transition-all duration-300"
                  style={{ width: `${soldPercentage}%` }}
                />
              </div>
              <p className="text-xs text-black/60">{soldPercentage.toFixed(0)}% claimed</p>
            </div>

            {/* Description */}
            <div>
              <p className="text-black/70 leading-relaxed font-medium">{product.description}</p>
            </div>

            {/* Variant Selection */}
            <div className="space-y-3">
              <h3 className="font-black text-black text-sm uppercase tracking-wider">Select Size</h3>
              <div className="grid grid-cols-4 gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariant(variant)}
                    disabled={variant.inventory <= 0}
                    className={`py-2 px-3 rounded-lg border transition-all font-bold text-xs uppercase tracking-wider ${
                      selectedVariant.id === variant.id
                        ? 'border-black bg-black text-white'
                        : variant.inventory > 0
                        ? 'border-black/10 text-black hover:border-black/30'
                        : 'border-black/5 text-black/30 cursor-not-allowed'
                    }`}
                  >
                    {variant.size || variant.sku}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="space-y-3">
              <h3 className="font-black text-black text-sm uppercase tracking-wider">Quantity</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-lg border border-black/10 hover:border-black/30 text-black font-bold transition-colors flex items-center justify-center"
                >
                  −
                </button>
                <span className="text-xl font-black text-black w-8 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(selectedVariant.inventory, quantity + 1))}
                  className="w-10 h-10 rounded-lg border border-black/10 hover:border-black/30 text-black font-bold transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            {/* Add to Cart Button */}
            <Button
              onClick={handleAddToCart}
              disabled={!isDropLive || selectedVariant.inventory <= 0}
              size="lg"
              className="w-full py-5 text-base font-black bg-black hover:bg-black/85 text-white border-0 rounded-xl transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {!isDropLive ? (
                'Drop Not Started'
              ) : selectedVariant.inventory <= 0 ? (
                'Sold Out'
              ) : (
                <>
                  <Package size={18} weight="bold" className="mr-2" />
                  Add to Cart
                </>
              )}
            </Button>

            {/* Exclusive Notice */}
            <div className="bg-black/2 border border-black/10 rounded-lg p-4 flex items-start gap-3">
              <Warning size={18} weight="bold" className="text-black/60 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-bold text-black">Limited Edition Drop</p>
                <p className="text-black/70">
                  This is an exclusive release with limited quantities. Once sold out, it will not be restocked.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
