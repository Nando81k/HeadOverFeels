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
    const isAuto = appliedCoupon.isAutoApplied
    return (
      <div
        className={`flex items-center justify-between gap-3 border-l-2 py-3 pl-3 pr-2 ${
          isAuto ? 'border-amber-500 bg-amber-50/60' : 'border-black bg-black/2'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`shrink-0 inline-flex h-8 w-8 items-center justify-center ${
              isAuto ? 'bg-amber-100 text-amber-700' : 'bg-black text-white'
            }`}
          >
            {isAuto ? (
              <Lightning className="w-3.5 h-3.5" weight="fill" />
            ) : (
              <Check className="w-3.5 h-3.5" weight="bold" />
            )}
          </div>
          <div className="min-w-0">
            <p className={`text-[11px] font-black uppercase tracking-[0.14em] truncate ${isAuto ? 'text-amber-900' : 'text-black'}`}>
              {appliedCoupon.rewardName}
              {isAuto && (
                <span className="ml-2 text-[10px] font-bold tracking-[0.12em] text-amber-700/80">Auto</span>
              )}
            </p>
            <p className={`text-[11px] truncate ${isAuto ? 'text-amber-800/80' : 'text-black/60'}`}>
              {appliedCoupon.code} · {appliedCoupon.description}
            </p>
          </div>
        </div>
        <button
          onClick={removeCoupon}
          className="shrink-0 inline-flex h-8 w-8 items-center justify-center text-black/45 hover:text-black transition-colors"
          aria-label="Remove coupon"
        >
          <X className="w-3.5 h-3.5" weight="bold" />
        </button>
      </div>
    )
  }

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-black/60 hover:text-black transition-colors"
      >
        <Tag className="w-3.5 h-3.5" weight="bold" />
        <span>Promo or rewards code</span>
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setError(null)
          }}
          placeholder="ENTER CODE"
          className="flex-1 min-w-0 h-11 px-3 border border-black/15 border-r-0 text-xs font-bold tracking-[0.12em] bg-white text-black placeholder:text-black/35 focus:outline-none focus:border-black focus:ring-1 focus:ring-black uppercase transition-colors rounded-none"
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
          className="h-11 px-4 bg-black text-white text-[11px] font-black uppercase tracking-[0.16em] hover:brightness-90 disabled:bg-black/20 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <Spinner className="w-3.5 h-3.5 animate-spin" />
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
          className="h-11 w-10 inline-flex items-center justify-center text-black/40 hover:text-black hover:bg-black/5 transition-colors"
          aria-label="Cancel"
        >
          <X className="w-3.5 h-3.5" weight="bold" />
        </button>
      </div>
      {error && (
        <p className="border-l-2 border-[#FF3131] bg-[#FF3131]/4 py-1.5 pl-2.5 text-xs text-[#FF3131] font-medium">{error}</p>
      )}
    </div>
  )
}
