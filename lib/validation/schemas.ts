import { z } from 'zod'

/**
 * Common validation schemas for UGC (User-Generated Content)
 * Used across reviews, comments, and other customer-submitted content
 */

// Sanitize user input to prevent XSS and injection attacks
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  return input
    .trim()
    .slice(0, 10000) // Max 10K characters
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
}

/**
 * Review submission validation schema
 */
export const ReviewSubmitSchema = z.object({
  productId: z.string().cuid('Invalid product ID').max(255, 'Product ID too long'),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  title: z.string().max(200, 'Title too long').optional().or(z.literal('')),
  comment: z.string()
    .min(10, 'Comment must be at least 10 characters')
    .max(5000, 'Comment too long')
    .transform(sanitizeString),
  customerName: z.string()
    .min(1, 'Customer name is required')
    .max(100, 'Customer name too long')
    .transform(sanitizeString),
  customerEmail: z.string().email('Invalid email').max(255, 'Email too long'),
  customerId: z.string().cuid('Invalid customer ID').optional().nullable(),
  orderId: z.string().cuid('Invalid order ID').optional().nullable(),
  images: z.array(z.string().url('Invalid image URL')).max(5, 'Maximum 5 images allowed').optional().nullable(),
})

/**
 * Loyalty points award validation schema
 */
export const LoyaltyPointsSchema = z.object({
  customerId: z.string().cuid('Invalid customer ID').max(255, 'Customer ID too long'),
  points: z.number().int('Points must be an integer').positive('Points must be positive'),
  type: z.enum(['PURCHASE', 'SIGNUP', 'FIRST_ORDER', 'REVIEW', 'REFERRAL', 'BONUS', 'ADMIN_ADJUSTMENT']),
  description: z.string().max(500, 'Description too long').optional(),
})

/**
 * Tier update validation schema
 */
export const TierUpdateSchema = z.object({
  name: z.string().min(1, 'Tier name required').max(100, 'Tier name too long'),
  slug: z.string()
    .min(1, 'Tier slug required')
    .max(50, 'Slug too long')
    .regex(/^[a-z0-9\-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  minAnnualSpend: z.number().nonnegative('Min spend must be non-negative'),
  pointsMultiplier: z.number().min(1, 'Multiplier must be at least 1').max(10, 'Multiplier too high'),
  benefitDescription: z.string().max(500, 'Description too long').optional(),
  isActive: z.boolean().default(true),
})

/**
 * Product creation/update validation (extends existing schema)
 */
export const ProductValidationSchema = z.object({
  name: z.string().min(1, 'Product name required').max(255, 'Product name too long'),
  description: z.string().max(5000, 'Description too long').optional(),
  price: z.number().positive('Price must be positive').max(999999, 'Price too high'),
  compareAtPrice: z.number().positive('Compare price must be positive').max(999999, 'Compare price too high').optional(),
  materials: z.string().max(500, 'Materials too long').optional(),
  careGuide: z.string().max(2000, 'Care guide too long').optional(),
  categoryId: z.string().cuid('Invalid category ID').optional().nullable(),
})

/**
 * Validates pagination parameters
 */
export const PaginationSchema = z.object({
  page: z.number().int().positive('Page must be positive').default(1),
  limit: z.number().int().min(1, 'Limit minimum 1').max(100, 'Limit maximum 100').default(10),
  offset: z.number().int().nonnegative('Offset must be non-negative').optional(),
  skip: z.number().int().nonnegative('Skip must be non-negative').optional(),
})

/**
 * Order status validation
 */
export const OrderStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
])

/**
 * Extract and validate pagination from URL query params
 */
export function getPaginationParams(searchParams: URLSearchParams) {
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '10', 10)

  // Validate and constrain
  const validatedPage = Math.max(1, Math.min(page, 10000)) // Max 10k pages
  const validatedLimit = Math.max(1, Math.min(limit, 100)) // Max 100 per page

  return {
    page: validatedPage,
    limit: validatedLimit,
    skip: (validatedPage - 1) * validatedLimit,
  }
}

/**
 * Creates a paginated response wrapper
 */
export function createPaginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit),
    },
  }
}
