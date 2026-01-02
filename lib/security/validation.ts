import { z } from 'zod'

/**
 * Security-focused validation schemas
 * Use these to validate and sanitize all user inputs
 */

// ==================== AUTH SCHEMAS ====================

export const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(5, 'Email too short')
  .max(255, 'Email too long')
  .toLowerCase()
  .trim()

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')

export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name too long')
  .trim()
  .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters')

// ==================== PRODUCT SCHEMAS ====================

export const productCreateSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  slug: z.string().min(1).max(200).toLowerCase().trim()
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  description: z.string().min(1).max(5000).trim(),
  price: z.number().positive().max(1000000),
  compareAtPrice: z.number().positive().max(1000000).optional().nullable(),
  category: z.string().min(1).max(100).trim(),
  images: z.array(z.string().url()).min(1).max(10),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isLimitedEdition: z.boolean().default(false),
  releaseDate: z.string().datetime().optional().nullable(),
  dropEndDate: z.string().datetime().optional().nullable(),
  maxQuantity: z.number().int().positive().optional().nullable(),
  variants: z.array(z.object({
    sku: z.string().min(1).max(100).trim(),
    size: z.string().min(1).max(50).trim(),
    color: z.string().min(1).max(50).trim(),
    inventory: z.number().int().min(0),
    price: z.number().positive().max(1000000).optional().nullable(),
  })).min(1),
})

export const productUpdateSchema = productCreateSchema.partial()

// ==================== COLLECTION SCHEMAS ====================

export const collectionCreateSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  slug: z.string().min(1).max(200).toLowerCase().trim()
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  description: z.string().max(2000).trim().optional().nullable(),
  image: z.string().url().optional().nullable(),
  isActive: z.boolean().default(true),
})

export const collectionUpdateSchema = collectionCreateSchema.partial()

// ==================== LOYALTY SCHEMAS ====================

export const rewardCreateSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  slug: z.string().min(1).max(200).toLowerCase().trim()
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  description: z.string().min(1).max(2000).trim(),
  type: z.enum(['discount', 'product', 'experience']),
  pointsCost: z.number().int().min(0).max(1000000),
  discountType: z.enum(['percentage', 'fixed', 'free_shipping']).optional().nullable(),
  discountValue: z.number().positive().max(1000000).optional().nullable(),
  minimumTier: z.enum(['bronze', 'silver', 'gold', 'platinum']),
  isActive: z.boolean().default(true),
  totalAvailable: z.number().int().min(0).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
})

export const rewardUpdateSchema = rewardCreateSchema.partial()

export const tierUpdateSchema = z.object({
  minAnnualSpend: z.number().min(0).max(1000000),
  pointMultiplier: z.number().positive().max(10),
  freeShipping: z.boolean(),
  earlyDropAccess: z.boolean(),
  perks: z.array(z.string().max(500)).max(20),
})

export const rewardRedemptionSchema = z.object({
  rewardId: z.string().min(1, 'Reward ID is required').trim(),
})

// ==================== ORDER SCHEMAS ====================

export const addressSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  company: z.string().max(200).trim().optional(),
  address1: z.string().min(1).max(200).trim(),
  address2: z.string().max(200).trim().optional(),
  city: z.string().min(1).max(100).trim(),
  state: z.string().min(1).max(100).trim(),
  postalCode: z.string().min(1).max(20).trim(),
  country: z.string().min(2).max(2).toUpperCase(), // ISO 3166-1 alpha-2
  phone: z.string()
    .min(14, 'Phone number must be in format (XXX) XXX-XXXX')
    .max(14, 'Phone number must be in format (XXX) XXX-XXXX')
    .regex(/^\(\d{3}\) \d{3}-\d{4}$/, 'Phone number must be in format (XXX) XXX-XXXX')
    .trim(),
})

export const orderCreateSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  email: emailSchema,
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid(),
    quantity: z.number().int().positive().max(100),
    price: z.number().positive(),
  })).min(1).max(50),
  subtotal: z.number().positive(),
  shippingCost: z.number().min(0),
  tax: z.number().min(0),
  total: z.number().positive(),
  promoCode: z.string().max(50).trim().optional().nullable(),
})

// ==================== CART SCHEMAS ====================

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(100),
})

export const cartReservationSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(100),
  expiresAt: z.string().datetime(),
})

// ==================== DROP NOTIFICATION SCHEMAS ====================

export const dropNotificationSchema = z.object({
  email: emailSchema,
  productId: z.string().uuid(),
})

// ==================== QUERY PARAMETER SCHEMAS ====================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const sortSchema = z.object({
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const productFilterSchema = z.object({
  category: z.string().max(100).optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  isLimitedEdition: z.coerce.boolean().optional(),
  search: z.string().max(200).optional(),
})

// ==================== ID VALIDATION ====================

export const uuidSchema = z.string().uuid('Invalid ID format')

export const slugSchema = z.string()
  .min(1)
  .max(200)
  .toLowerCase()
  .trim()
  .regex(/^[a-z0-9-]+$/, 'Invalid slug format')

// ==================== HELPER FUNCTIONS ====================

/**
 * Validate and parse data with a Zod schema
 * Returns parsed data or throws with user-friendly errors
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`)
      throw new Error(`Validation failed: ${messages.join(', ')}`)
    }
    throw error
  }
}

/**
 * Safely validate data without throwing
 * Returns { success: true, data } or { success: false, error }
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const messages = result.error.issues.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`)
  return { success: false, error: messages.join(', ') }
}
