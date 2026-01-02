'use client'

import { useState } from 'react'
import { useCartStore, AppliedCoupon } from '@/lib/store/cart'
import { Tag, X, Check, Spinner } from '@phosphor-icons/react'

export function CouponInput() {
  const { appliedCoupon, applyCoupon, removeCoupon } = useCartStore()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInput, setShowInput] = useState(false)

  const handleApplyCoupon = async () => {
    if (!code.trim()) {
      setError('Please enter a coupon code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })

      const data = await response.json()

      if (!response.ok || !data.valid) {
        setError(data.error || 'Invalid coupon code')
        return
      }

      // Apply the coupon to cart
      const coupon: AppliedCoupon = {
        code: data.coupon.code,
        redemptionId: data.coupon.redemptionId,
        discountType: data.coupon.discountType,
        discountAmount: data.coupon.discountAmount,
        description: data.coupon.description,
        rewardName: data.coupon.reward.name,
      }

      applyCoupon(coupon)
      setCode('')
      setShowInput(false)
    } catch {
      setError('Failed to validate coupon. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (appliedCoupon) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 rounded-full p-2">
              <Check className="w-4 h-4 text-green-600" weight="bold" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">
                {appliedCoupon.rewardName}
              </p>
              <p className="text-xs text-green-600">
                Code: {appliedCoupon.code} • {appliedCoupon.description}
              </p>
            </div>
          </div>
          <button
            onClick={removeCoupon}
            className="text-green-600 hover:text-green-800 p-1.5 rounded-full hover:bg-green-100 transition-colors"
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
        <span>Have a rewards coupon?</span>
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
          placeholder="Enter coupon code"
          className="flex-1 px-4 py-3 border border-black/10 rounded-xl text-sm bg-white text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent uppercase transition-all"
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
          className="px-5 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-black/80 disabled:bg-black/20 disabled:cursor-not-allowed transition-all"
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
          className="p-3 text-black/40 hover:text-black hover:bg-black/5 rounded-xl transition-colors"
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
