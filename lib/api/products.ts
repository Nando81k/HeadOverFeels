// API utility functions for client-side requests

export interface ApiResponse<T> {
  data?: T
  error?: string
  details?: Array<{ message: string; path: string[] }>
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface Product {
  id: string
  name: string
  slug: string
  description?: string
  price: number
  compareAtPrice?: number
  images: string
  materials?: string
  careGuide?: string
  isActive: boolean
  isFeatured: boolean
  isFeaturedNewArrival?: boolean
  categoryId?: string
  isLimitedEdition?: boolean
  releaseDate?: Date | string | null
  dropEndDate?: Date | string | null
  maxQuantity?: number | null
  category?: {
    id: string
    name: string
    slug: string
  }
  variants: ProductVariant[]
  createdAt: string
  updatedAt: string
}

export interface ProductVariant {
  id: string
  sku: string
  size?: string
  color?: string
  colorHex?: string
  images?: string
  price?: number
  inventory: number
  isActive: boolean
}

export interface CreateProductData {
  name: string
  description?: string
  price: number
  compareAtPrice?: number
  images?: string
  materials?: string
  careGuide?: string
  isActive?: boolean
  isFeatured?: boolean
  isFeaturedNewArrival?: boolean
  categoryId?: string
  isLimitedEdition?: boolean
  releaseDate?: string
  dropEndDate?: string
  maxQuantity?: number
  variants?: Array<{
    sku: string
    size?: string
    color?: string
    price?: number
    inventory?: number
    isActive?: boolean
  }>
}

// Product API functions
export const productApi = {
  // Get all products
  async getAll(params?: {
    page?: number
    limit?: number
    isActive?: boolean
    isFeatured?: boolean
    search?: string
  }): Promise<ApiResponse<PaginatedResponse<Product>>> {
    try {
      const searchParams = new URLSearchParams()
      if (params?.page) searchParams.set('page', params.page.toString())
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      if (params?.isActive) searchParams.set('isActive', 'true')
      if (params?.isFeatured) searchParams.set('isFeatured', 'true')
      if (params?.search) searchParams.set('search', params.search)

      const response = await fetch(`/api/products?${searchParams}`)
      const data = await response.json()

      if (!response.ok) {
        return { error: data.error || 'Failed to fetch products' }
      }

      return { data }
    } catch {
      return { error: 'Network error while fetching products' }
    }
  },

  // Get single product
  async getById(id: string): Promise<ApiResponse<Product>> {
    try {
      const response = await fetch(`/api/products/${id}`)
      const data = await response.json()

      if (!response.ok) {
        return { error: data.error || 'Failed to fetch product' }
      }

      return { data }
    } catch {
      return { error: 'Network error while fetching product' }
    }
  },

  // Create new product
  async create(productData: CreateProductData): Promise<ApiResponse<Product>> {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
      })

      const data = await response.json()

      if (!response.ok) {
        return { 
          error: data.error || 'Failed to create product',
          details: data.details 
        }
      }

      return { data }
    } catch {
      return { error: 'Network error while creating product' }
    }
  },

  // Update product
  async update(id: string, productData: Partial<CreateProductData>): Promise<ApiResponse<Product>> {
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
      })

      const data = await response.json()

      if (!response.ok) {
        return { 
          error: data.error || 'Failed to update product',
          details: data.details 
        }
      }

      return { data }
    } catch {
      return { error: 'Network error while updating product' }
    }
  },

  // Delete product
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        return { error: data.error || 'Failed to delete product' }
      }

      return { data }
    } catch {
      return { error: 'Network error while deleting product' }
    }
  }
}