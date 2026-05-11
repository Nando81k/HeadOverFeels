import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth/auth'
import { uploadImage, deleteImage } from '@/lib/cloudinary/config'
import { checkRateLimit, rateLimitResponse, getClientIdentifier, RATE_LIMITS } from '@/lib/security/rateLimit'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const session = await auth()
  if (session?.user?.id) return session.user.id
  return request.cookies.get('auth_session')?.value ?? null
}

// POST /api/profile/avatar — upload a new profile picture
export async function POST(request: NextRequest) {
  const clientIp = getClientIdentifier(request.headers)
  const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.upload.maxRequests, RATE_LIMITS.upload.windowMs)
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)

  const userId = await getAuthenticatedUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 400 })
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, and WebP are allowed' }, { status: 400 })
  }
  const fileName = file.name.toLowerCase()
  if (!ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext))) {
    return NextResponse.json({ error: 'Invalid file extension' }, { status: 400 })
  }

  // Fetch current avatar to delete the old one after upload
  const customer = await prisma.customer.findUnique({
    where: { id: userId },
    select: { profilePictureUrl: true },
  })

  const bytes = await file.arrayBuffer()
  const base64 = `data:${file.type};base64,${Buffer.from(bytes).toString('base64')}`

  const result = await uploadImage(base64, {
    folder: 'head-over-feels/avatars',
    // Crop to square, resize to 400px — keeps avatar files small
    transformation: { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto', fetch_format: 'auto' },
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Upload failed' }, { status: 500 })
  }

  await prisma.customer.update({
    where: { id: userId },
    data: { profilePictureUrl: result.url },
  })

  // Delete old image from Cloudinary (best-effort — don't fail the request if it errors)
  if (customer?.profilePictureUrl) {
    const oldPublicId = extractPublicId(customer.profilePictureUrl)
    if (oldPublicId) {
      deleteImage(oldPublicId).catch(() => {})
    }
  }

  return NextResponse.json({ url: result.url })
}

// DELETE /api/profile/avatar — remove profile picture
export async function DELETE(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const customer = await prisma.customer.findUnique({
    where: { id: userId },
    select: { profilePictureUrl: true },
  })

  if (customer?.profilePictureUrl) {
    const publicId = extractPublicId(customer.profilePictureUrl)
    if (publicId) deleteImage(publicId).catch(() => {})
  }

  await prisma.customer.update({
    where: { id: userId },
    data: { profilePictureUrl: null },
  })

  return NextResponse.json({ success: true })
}

function extractPublicId(cloudinaryUrl: string): string | null {
  try {
    // e.g. https://res.cloudinary.com/<cloud>/image/upload/v123/head-over-feels/avatars/xyz.webp
    const match = cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}
