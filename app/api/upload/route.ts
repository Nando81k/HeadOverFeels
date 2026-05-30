import { NextRequest, NextResponse } from 'next/server'
import { uploadImage } from '@/lib/cloudinary/config'
import { checkRateLimit, rateLimitResponse, getClientIdentifier, RATE_LIMITS } from '@/lib/security/rateLimit'
import { verifyAdmin } from '@/lib/auth/admin'

export const runtime = 'nodejs'

// File upload security constraints
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_IMAGE_DIMENSIONS = 4000 // 4000x4000 pixels max

/**
 * Validates file size, MIME type, and extension
 */
function validateFileUpload(file: File): { valid: boolean; error?: string } {
  // Check file size (5 MB max)
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
    }
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Only JPEG, PNG, and WebP images are allowed',
    }
  }

  // Check file extension
  const fileName = file.name.toLowerCase()
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
    fileName.endsWith(ext)
  )

  if (!hasValidExtension) {
    return {
      valid: false,
      error: 'Invalid file extension. Use .jpg, .png, or .webp',
    }
  }

  return { valid: true }
}

/**
 * Validates image dimensions
 */
async function validateImageDimensions(
  buffer: Buffer
): Promise<{ valid: boolean; width?: number; height?: number; error?: string }> {
  // Use sharp for lightweight dimension checking (only if needed)
  // For now, we'll validate dimensions from Cloudinary response
  return { valid: true }
}

// POST /api/upload - Upload image to Cloudinary
export async function POST(request: NextRequest) {
  try {
    // Auth check: require admin before consuming any rate-limit budget
    const sessionId = request.cookies.get('auth_session')?.value
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Rate limit file uploads: 20 per minute per IP
    const clientIp = getClientIdentifier(request.headers)
    const rateLimit = checkRateLimit(
      clientIp,
      RATE_LIMITS.upload.maxRequests,
      RATE_LIMITS.upload.windowMs
    )

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfter)
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file upload
    const validation = validateFileUpload(file)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Convert file to base64 for Cloudinary
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64String = `data:${file.type};base64,${buffer.toString('base64')}`

    // Upload to Cloudinary with dimension constraints
    const result = await uploadImage(base64String, {
      folder: 'head-over-feels/products',
      transformation: {
        max_width: MAX_IMAGE_DIMENSIONS,
        max_height: MAX_IMAGE_DIMENSIONS,
        quality: 'auto', // Auto-optimize
        fetch_format: 'auto', // Serve optimal format
      },
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Upload failed' },
        { status: 500 }
      )
    }

    // Validate dimensions from Cloudinary response
    if (
      result.width &&
      result.height &&
      (result.width > MAX_IMAGE_DIMENSIONS || result.height > MAX_IMAGE_DIMENSIONS)
    ) {
      return NextResponse.json(
        {
          error: `Image dimensions exceed ${MAX_IMAGE_DIMENSIONS}x${MAX_IMAGE_DIMENSIONS} limit`,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      url: result.url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    )
  }
}

// DELETE /api/upload - Delete image from Cloudinary
export async function DELETE(request: NextRequest) {
  try {
    // Auth check: require admin before consuming any rate-limit budget
    const sessionId = request.cookies.get('auth_session')?.value
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Rate limit delete operations
    const clientIp = getClientIdentifier(request.headers)
    const rateLimit = checkRateLimit(
      clientIp,
      RATE_LIMITS.upload.maxRequests,
      RATE_LIMITS.upload.windowMs
    )

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfter)
    }

    const { searchParams } = new URL(request.url)
    const publicId = searchParams.get('public_id')

    if (!publicId || typeof publicId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid public_id provided' },
        { status: 400 }
      )
    }

    // Validate public_id format (prevent injection)
    if (!publicId.match(/^[a-zA-Z0-9\-_/]+$/)) {
      return NextResponse.json(
        { error: 'Invalid public_id format' },
        { status: 400 }
      )
    }

    const { deleteImage } = await import('@/lib/cloudinary/config')
    const result = await deleteImage(publicId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Delete failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    )
  }
}