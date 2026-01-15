import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Product, ProductVariant } from '@/lib/api/products'

export interface CartItem {
  product: Product
  variant: ProductVariant
  quantity: number
}

export interface AppliedCoupon {
  code: string
  redemptionId?: string // For loyalty coupons
  promotionId?: string  // For marketing promotions
  discountType: 'fixed' | 'percentage' | 'free_shipping' | 'perk'
  discountAmount: number
  description: string
  rewardName: string
  isAutoApplied?: boolean // True if auto-applied promotion
}

interface CartState {
  items: CartItem[]
  appliedCoupon: AppliedCoupon | null
  
  // Actions
  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void
  removeItem: (productId: string, variantId: string) => void
  updateQuantity: (productId: string, variantId: string, quantity: number) => void
  clearCart: () => void
  applyCoupon: (coupon: AppliedCoupon) => void
  removeCoupon: () => void
  
  // Computed values
  getTotalItems: () => number
  getTotalPrice: () => number
  getItemCount: (productId: string, variantId: string) => number
  getDiscount: () => number
  getFinalTotal: (shippingCost: number, taxRate?: number) => { subtotal: number; shipping: number; discount: number; tax: number; total: number }
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      appliedCoupon: null,

      addItem: (product, variant, quantity = 1) => {
        const items = get().items
        const existingItemIndex = items.findIndex(
          item => item.product.id === product.id && item.variant.id === variant.id
        )

        if (existingItemIndex > -1) {
          // Update quantity if item already exists
          const newItems = [...items]
          newItems[existingItemIndex].quantity += quantity
          set({ items: newItems })
        } else {
          // Add new item
          set({ items: [...items, { product, variant, quantity }] })
        }
      },

      removeItem: (productId, variantId) => {
        set({
          items: get().items.filter(
            item => !(item.product.id === productId && item.variant.id === variantId)
          ),
        })
      },

      updateQuantity: (productId, variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, variantId)
          return
        }

        const items = get().items
        const itemIndex = items.findIndex(
          item => item.product.id === productId && item.variant.id === variantId
        )

        if (itemIndex > -1) {
          const newItems = [...items]
          newItems[itemIndex].quantity = quantity
          set({ items: newItems })
        }
      },

      clearCart: () => {
        set({ items: [], appliedCoupon: null })
      },

      applyCoupon: (coupon) => {
        set({ appliedCoupon: coupon })
      },

      removeCoupon: () => {
        set({ appliedCoupon: null })
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },

      getTotalPrice: () => {
        return get().items.reduce((total, item) => {
          const price = item.variant.price || item.product.price
          return total + price * item.quantity
        }, 0)
      },

      getItemCount: (productId, variantId) => {
        const item = get().items.find(
          item => item.product.id === productId && item.variant.id === variantId
        )
        return item?.quantity || 0
      },

      getDiscount: () => {
        const coupon = get().appliedCoupon
        if (!coupon) return 0
        
        if (coupon.discountType === 'fixed') {
          return coupon.discountAmount
        }
        if (coupon.discountType === 'percentage') {
          return get().getTotalPrice() * (coupon.discountAmount / 100)
        }
        // free_shipping and perk don't affect subtotal discount
        return 0
      },

      getFinalTotal: (shippingCost, taxRate = 0.08) => {
        const subtotal = get().getTotalPrice()
        const coupon = get().appliedCoupon
        
        // Calculate discount
        let discount = 0
        let shipping = shippingCost
        
        if (coupon) {
          if (coupon.discountType === 'fixed') {
            discount = Math.min(coupon.discountAmount, subtotal) // Don't discount more than subtotal
          } else if (coupon.discountType === 'percentage') {
            discount = subtotal * (coupon.discountAmount / 100)
          } else if (coupon.discountType === 'free_shipping') {
            shipping = 0
          }
        }
        
        const discountedSubtotal = subtotal - discount
        const tax = discountedSubtotal * taxRate
        const total = discountedSubtotal + shipping + tax
        
        return {
          subtotal,
          shipping,
          discount,
          tax,
          total: Math.max(0, total),
        }
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
