export interface HomeColorCue {
  label: string
  hex: string
  previewImageUrl?: string
}

export interface HomeProductCard {
  id: string
  name: string
  slug: string
  price: number
  compareAtPrice: number | null
  imageUrl: string
  categoryName?: string
  isSoldOut: boolean
  lowStockLabel?: string
  colorCues: HomeColorCue[]
}

export interface HomeCategoryCard {
  id: string
  name: string
  slug: string
  href: string
  imageUrl: string
  productCount: number
}

export interface HomeReviewSummary {
  averageRating: number
  totalReviews: number
}

export interface HomeReviewHighlight {
  id: string
  productName: string
  productSlug: string
  customerName: string
  rating: number
  snippet: string
}

export interface HomePageData {
  bestSellers: HomeProductCard[]
  newArrivals: HomeProductCard[]
  trending: HomeProductCard[]
  categories: HomeCategoryCard[]
  reviewSummary: HomeReviewSummary
  reviewHighlights: HomeReviewHighlight[]
}
