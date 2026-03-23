'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Clock, Package, TrendUp, Warning, Lock, Star, Sparkle, ArrowRight } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/lib/store/cart';
import { CountdownTimer } from '@/components/products/CountdownTimer';
import { useSession } from 'next-auth/react';

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

interface EarlyAccessStatus {
  hasAccess: boolean;
  reason: string;
  canUnlock: boolean;
  pointsCost: number | null;
  currentPoints?: number;
  hasEnoughPoints?: boolean;
  earlyAccessEnds?: string;
  tierName?: string;
  publicReleaseDate?: string;
}

interface ExclusiveDropPageProps {
  product: Product;
}

export default function ExclusiveDropPage({ product }: ExclusiveDropPageProps) {
  const { data: session } = useSession();
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [earlyAccessStatus, setEarlyAccessStatus] = useState<EarlyAccessStatus | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  // Calculate if drop is live based on dates
  const now = new Date().getTime();
  const releaseTime = product.releaseDate ? new Date(product.releaseDate).getTime() : now;
  const endTime = product.dropEndDate ? new Date(product.dropEndDate).getTime() : Infinity;
  const isPubliclyLive = now >= releaseTime && now < endTime;
  const isUpcoming = now < releaseTime;

  // Check early access status
  useEffect(() => {
    async function checkEarlyAccess() {
      setCheckingAccess(true);
      try {
        const response = await fetch(`/api/drops/early-access/check?productId=${product.id}`);
        if (response.ok) {
          const data = await response.json();
          setEarlyAccessStatus(data);
        }
      } catch (error) {
        console.error('Failed to check early access:', error);
      } finally {
        setCheckingAccess(false);
      }
    }
    
    checkEarlyAccess();
  }, [product.id, session]);

  // Determine if user can purchase
  const canPurchase = isPubliclyLive || 
    (earlyAccessStatus?.hasAccess && earlyAccessStatus.reason !== 'not_available');

  // Calculate total inventory and sold count
  const totalInventory = product.variants.reduce((sum, v) => sum + v.inventory, 0);
  const maxQty = product.maxQuantity || totalInventory;
  const soldCount = maxQty - totalInventory;
  const soldPercentage = Math.min(100, Math.max(0, ((soldCount) / maxQty) * 100));

  // Size order for proper sorting (S to XL)
  const sizeOrder: Record<string, number> = {
    'XXS': 0, 'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5, 'XXL': 6, '2XL': 6, 'XXXL': 7, '3XL': 7,
    '0': 10, '2': 11, '4': 12, '6': 13, '8': 14, '10': 15, '12': 16, '14': 17, '16': 18,
    'ONE SIZE': 100, 'OS': 100, 'ONESIZE': 100
  };
  
  // Sort variants by size
  const sortedVariants = [...product.variants].sort((a, b) => {
    const sizeA = (a.size || '').toUpperCase();
    const sizeB = (b.size || '').toUpperCase();
    const orderA = sizeOrder[sizeA] ?? 50;
    const orderB = sizeOrder[sizeB] ?? 50;
    return orderA - orderB;
  });

  const handleUnlockEarlyAccess = async () => {
    if (!earlyAccessStatus?.canUnlock || !earlyAccessStatus?.hasEnoughPoints) return;
    
    setUnlocking(true);
    try {
      const response = await fetch('/api/drops/early-access/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id })
      });
      
      if (response.ok) {
        // Refresh early access status
        const checkResponse = await fetch(`/api/drops/early-access/check?productId=${product.id}`);
        if (checkResponse.ok) {
          const data = await checkResponse.json();
          setEarlyAccessStatus(data);
        }
      } else {
        const error = await response.json();
        console.error('Failed to unlock:', error);
      }
    } catch (error) {
      console.error('Failed to unlock early access:', error);
    } finally {
      setUnlocking(false);
    }
  };

  const handleAddToCart = () => {
    if (!selectedVariant || selectedVariant.inventory <= 0 || !canPurchase) return;

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
              {!canPurchase && !checkingAccess && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center space-y-3 px-4">
                    {earlyAccessStatus?.canUnlock ? (
                      <>
                        <Lock size={48} weight="bold" className="mx-auto text-amber-500" />
                        <p className="text-lg font-bold text-black">Early Access Available</p>
                        <p className="text-sm text-black/60">Unlock with care points or wait for public release</p>
                      </>
                    ) : isUpcoming ? (
                      <>
                        <Clock size={48} weight="bold" className="mx-auto text-black/40" />
                        <p className="text-lg font-bold text-black">Coming Soon</p>
                        {earlyAccessStatus?.publicReleaseDate && (
                          <p className="text-sm text-black/60">
                            Public release: {new Date(earlyAccessStatus.publicReleaseDate).toLocaleDateString()}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <Clock size={48} weight="bold" className="mx-auto text-black/40" />
                        <p className="text-lg font-bold text-black">Drop Ended</p>
                      </>
                    )}
                  </div>
                </div>
              )}
              {/* Early Access Badge */}
              {canPurchase && earlyAccessStatus?.hasAccess && !isPubliclyLive && (
                <div className="absolute top-4 left-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg">
                  <Star size={14} weight="fill" />
                  Early Access
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
              <h1 className="text-4xl lg:text-5xl leading-tight logo-font mb-4">
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
              <p className="text-xs text-black/60">{soldCount} sold of {maxQty}</p>
            </div>

            {/* Description */}
            <div>
              <p className="text-black/70 leading-relaxed font-medium">{product.description}</p>
            </div>

            {/* Variant Selection */}
            <div className="space-y-3">
              <h3 className="font-black text-black text-sm uppercase tracking-wider">Select Size</h3>
              <div className="grid grid-cols-4 gap-2">
                {sortedVariants.map((variant) => (
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
            {canPurchase ? (
              <Button
                onClick={handleAddToCart}
                disabled={selectedVariant.inventory <= 0}
                size="lg"
                className="w-full py-5 text-base font-black bg-black hover:bg-black/85 text-white border-0 rounded-xl transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {selectedVariant.inventory <= 0 ? (
                  'Sold Out'
                ) : (
                  <>
                    <Package size={18} weight="bold" className="mr-2" />
                    Add to Cart
                  </>
                )}
              </Button>
            ) : earlyAccessStatus?.canUnlock ? (
              <div className="space-y-3">
                {/* Unlock with Points Button */}
                <Button
                  onClick={handleUnlockEarlyAccess}
                  disabled={unlocking || !earlyAccessStatus.hasEnoughPoints}
                  size="lg"
                  className="w-full py-5 text-base font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 rounded-xl transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {unlocking ? (
                    'Unlocking...'
                  ) : earlyAccessStatus.hasEnoughPoints ? (
                    <>
                      <Sparkle size={18} weight="fill" className="mr-2" />
                      Unlock Early Access ({earlyAccessStatus.pointsCost} points)
                    </>
                  ) : (
                    <>
                      <Lock size={18} weight="bold" className="mr-2" />
                      Need {earlyAccessStatus.pointsCost} points ({earlyAccessStatus.currentPoints} available)
                    </>
                  )}
                </Button>
                
                {!earlyAccessStatus.hasEnoughPoints && (
                  <Link href="/loyalty/rewards" className="block">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full py-4 text-sm font-bold border-black/20 text-black hover:bg-black/5 rounded-xl"
                    >
                      Earn More Points
                      <ArrowRight size={16} className="ml-2" />
                    </Button>
                  </Link>
                )}

                <p className="text-xs text-center text-black/50">
                  Or wait until public release on {product.releaseDate ? new Date(product.releaseDate).toLocaleDateString() : 'TBA'}
                </p>
              </div>
            ) : !session ? (
              <div className="space-y-3">
                <Link href="/signin" className="block">
                  <Button
                    size="lg"
                    className="w-full py-5 text-base font-black bg-black hover:bg-black/85 text-white border-0 rounded-xl transition-all hover:scale-[1.01]"
                  >
                    Sign In for Early Access
                  </Button>
                </Link>
                <p className="text-xs text-center text-black/50">
                  Loyalty members can unlock early access to this drop
                </p>
              </div>
            ) : (
              <Button
                disabled
                size="lg"
                className="w-full py-5 text-base font-black bg-black/30 text-white border-0 rounded-xl cursor-not-allowed"
              >
                {isUpcoming ? 'Drop Not Started' : 'Drop Ended'}
              </Button>
            )}

            {/* Early Access Status Banner */}
            {earlyAccessStatus?.hasAccess && !isPubliclyLive && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <Star size={18} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-bold text-amber-800">You Have Early Access!</p>
                  <p className="text-amber-700">
                    {earlyAccessStatus.reason === 'tier_benefit' 
                      ? `As a ${earlyAccessStatus.tierName} member, you can shop this drop before the public release.`
                      : 'You\'ve unlocked early access to this exclusive drop.'}
                  </p>
                </div>
              </div>
            )}

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
