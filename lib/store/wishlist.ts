import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WishlistItem {
  id: string
  productId: string
  productVariantId?: string | null
  customerId?: string | null
  sessionId?: string | null
  createdAt: string
}

interface WishlistStore {
  items: WishlistItem[]
  isLoaded: boolean
  isLoading: boolean
  
  // Actions
  loadWishlist: () => Promise<void>
  syncWithServer: () => Promise<void>
  isInWishlist: (productId: string, productVariantId?: string) => boolean
  addToWishlist: (productId: string, productVariantId?: string, customerId?: string) => Promise<boolean>
  removeFromWishlist: (productId: string, productVariantId?: string) => Promise<boolean>
  clearWishlist: () => void
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      isLoaded: false,
      isLoading: false,

      loadWishlist: async () => {
        const { isLoaded, isLoading } = get()
        
        // Don't reload if already loaded in this session or currently loading
        if (isLoaded || isLoading) return
        
        set({ isLoading: true })
        
        try {
          const response = await fetch('/api/wishlist')
          if (response.ok) {
            const { data } = await response.json()
            set({ 
              items: data || [], 
              isLoaded: true,
              isLoading: false 
            })
          } else {
            set({ isLoading: false, isLoaded: true })
          }
        } catch (error) {
          console.error('Error loading wishlist:', error)
          set({ isLoading: false, isLoaded: true })
        }
      },

      syncWithServer: async () => {
        // Force reload from server, bypassing isLoaded check
        set({ isLoading: true })
        
        try {
          const response = await fetch('/api/wishlist')
          if (response.ok) {
            const { data } = await response.json()
            set({ 
              items: data || [], 
              isLoaded: true,
              isLoading: false 
            })
          } else {
            set({ isLoading: false })
          }
        } catch (error) {
          console.error('Error syncing wishlist:', error)
          set({ isLoading: false })
        }
      },

      isInWishlist: (productId: string, productVariantId?: string) => {
        const { items } = get()
        return items.some(
          item => 
            item.productId === productId && 
            (productVariantId ? item.productVariantId === productVariantId : !item.productVariantId)
        )
      },

      addToWishlist: async (productId: string, productVariantId?: string, customerId?: string) => {
        try {
          const response = await fetch('/api/wishlist', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              productId,
              productVariantId,
              customerId
            })
          })

          if (response.ok) {
            const { data } = await response.json()
            // Add the new item to the store
            set(state => ({ 
              items: [...state.items, data] 
            }))
            return true
          } else if (response.status === 409) {
            // Already in wishlist - just reload to be safe
            await get().loadWishlist()
            return true
          }
          return false
        } catch (error) {
          console.error('Error adding to wishlist:', error)
          return false
        }
      },

      removeFromWishlist: async (productId: string, productVariantId?: string) => {
        const { items } = get()
        
        // Find the item
        const item = items.find(
          item => 
            item.productId === productId && 
            (productVariantId ? item.productVariantId === productVariantId : !item.productVariantId)
        )

        if (!item) return false

        try {
          const response = await fetch(`/api/wishlist/${item.id}`, {
            method: 'DELETE'
          })

          if (response.ok) {
            // Remove from local state
            set({ 
              items: items.filter(i => i.id !== item.id) 
            })
            return true
          }
          return false
        } catch (error) {
          console.error('Error removing from wishlist:', error)
          return false
        }
      },

      clearWishlist: () => {
        set({ items: [], isLoaded: false })
      }
    }),
    {
      name: 'wishlist-storage',
      // Only persist items, reload isLoaded state on mount
      partialize: (state) => ({ items: state.items })
    }
  )
)
