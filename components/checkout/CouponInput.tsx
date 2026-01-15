'use client'

import { useState, useEffect } from 'react'
import { useCartStore, AppliedCoupon } from '@/lib/store/cart'
import { Tag, X, Check, Spinner, Lightning } from '@phosphor-icons/react'

export function CouponInput() {
  const { appliedCoupon, applyCoupon, removeCoupon, getTotalPrice, items } = useCartStore()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInput, setShowInput] = useState(false)

  // Auto-apply promotions on cart change
  useEffect(() => {
    // Don't auto-apply if user already has a coupon (manual or auto)
    if (appliedCoupon) return
    
    const checkAutoApply = async () => {
      try {
        const cartTotal = getTotalPrice()
        const productIds = items.map(item => item.product.id)
        
        const response = await fetch('/api/promotions/auto-apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cartTotal, 
            productIds,
          }),
        })
        
        const data = await response.json()
        
        if (data.promotion) {
          const coupon: AppliedCoupon = {
            code: data.promotion.code,
            promotionId: data.promotion.id,
            discountType: data.promotion.freeShipping ? 'free_shipping' : 
                          (data.promotion.type === 'percentage' ? 'percentage' : 'fixed'),
            discountAmount: data.promotion.discountAmount,
            description: data.promotion.discountDescription,
            rewardName: data.promotion.name,
            isAutoApplied: true,
          }
          applyCoupon(coupon)
        }
      } catch {
        // Silently fail auto-apply
      }
    }
    
    if (items.length > 0) {
      checkAutoApply()
    }
  }, [items, getTotalPrice, appliedCoupon, applyCoupon])

  const handleApplyCoupon = async () => {
    if (!code.trim()) {
      setError('Please enter a coupon code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // First try loyalty coupons
      const loyaltyResponse = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })

      const loyaltyData = await loyaltyResponse.json()

      if (loyaltyResponse.ok && loyaltyData.valid) {
        // Apply loyalty coupon
        const coupon: AppliedCoupon = {
          code: loyaltyData.coupon.code,
          redemptionId: loyaltyData.coupon.redemptionId,
          discountType: loyaltyData.coupon.discountType,
          discountAmount: loyaltyData.coupon.discountAmount,
          description: loyaltyData.coupon.description,
          rewardName: loyaltyData.coupon.reward.name,
        }

        applyCoupon(coupon)
        setCode('')
        setShowInput(false)
        return
      }

      // Try marketing promotions
      const promoResponse = await fetch('/api/promotions/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: code.trim(),
          cartTotal: getTotalPrice(),
          productIds: items.map(item => item.product.id),
        }),
      })

      const promoData = await promoResponse.json()

      if (promoResponse.ok && promoData.valid) {
        // Apply marketing promotion
        const coupon: AppliedCoupon = {
          code: promoData.promotion.code || code.trim(),
          promotionId: promoData.promotion.id,
          discountType: promoData.promotion.freeShipping ? 'free_shipping' : 
                        (promoData.promotion.type === 'percentage' ? 'percentage' : 'fixed'),
          discountAmount: promoData.promotion.discount,
          description: promoData.promotion.discountDescription,
          rewardName: promoData.promotion.name,
        }

        applyCoupon(coupon)
        setCode('')
        setShowInput(false)
        return
      }

      // Neither worked
      setError(promoData.error || loyaltyData.error || 'Invalid coupon code')
    } catch {
      setError('Failed to validate coupon. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (appliedCoupon) {
    return (
      <div className={`${appliedCoupon.isAutoApplied ? 'bg-amber-50 border-amber-200' : 'bg-black/[0.02] border-black/10'} border p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${appliedCoupon.isAutoApplied ? 'bg-amber-100' : 'bg-black/10'} p-2`}>
              {appliedCoupon.isAutoApplied ? (
                <Lightning className="w-4 h-4 text-amber-600" weight="fill" />
              ) : (
                <Check className="w-4 h-4 text-black" weight="bold" />
              )}
            </div>
            <div>
              <p className={`text-sm font-bold ${appliedCoupon.isAutoApplied ? 'text-amber-800' : 'text-black'}`}>
                {appliedCoupon.rewardName}
                {appliedCoupon.isAutoApplied && (
                  <span className="ml-2 text-xs font-normal text-amber-600">(Auto-applied)</span>
                )}
              </p>
              <p className={`text-xs ${appliedCoupon.isAutoApplied ? 'text-amber-600' : 'text-black/60'}`}>
                Code: {appliedCoupon.code} • {appliedCoupon.description}
              </p>
            </div>
          </div>
          <button
            onClick={removeCoupon}
            className={`${appliedCoupon.isAutoApplied ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-100' : 'text-black/60 hover:text-black hover:bg-black/10'} p-1.5 transition-colors`}
            aria-label="Remove coupon"
          >
            <X className="w-4 h-4" weight="bold" />
          </button>
        </div>
      </div>
    )
  }

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className="flex items-center gap-2 text-sm font-medium text-black/60 hover:text-black transition-colors"
      >
        <Tag className="w-4 h-4" weight="bold" />
        <span>Have a promo or rewards code?</span>
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setError(null)
          }}
          placeholder="Enter promo or rewards code"
          className="flex-1 px-4 py-3 border border-black/10 text-sm bg-white text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent uppercase transition-all"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleApplyCoupon()
            }
          }}
        />
        <button
          onClick={handleApplyCoupon}
          disabled={loading || !code.trim()}
          className="px-5 py-3 bg-black text-white text-sm font-bold hover:bg-black/80 disabled:bg-black/20 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <Spinner className="w-4 h-4 animate-spin" />
          ) : (
            'Apply'
          )}
        </button>
        <button
          onClick={() => {
            setShowInput(false)
            setCode('')
            setError(null)
          }}
          className="p-3 text-black/40 hover:text-black hover:bg-black/5 transition-colors"
        >
          <X className="w-4 h-4" weight="bold" />
        </button>
      </div>
      {error && (
        <p className="text-sm text-[#FF3131] font-medium">{error}</p>
      )}
    </div>
  )
}
