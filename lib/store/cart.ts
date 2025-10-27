import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Product, ProductVariant } from '@/lib/api/products'

export interface CartItem {
  product: Product
  variant: ProductVariant
  quantity: number
}

interface CartState {
  items: CartItem[]
  
  // Actions
  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void
  removeItem: (productId: string, variantId: string) => void
  updateQuantity: (productId: string, variantId: string, quantity: number) => void
  clearCart: () => void
  
  // Computed values
  getTotalItems: () => number
  getTotalPrice: () => number
  getItemCount: (productId: string, variantId: string) => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

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
        set({ items: [] })
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
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
