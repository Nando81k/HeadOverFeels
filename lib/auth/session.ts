import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// Generate a secret key from AUTH_SECRET — throws if env var is missing
function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is required')
  }
  return secret
}

const getSecretKey = () => new TextEncoder().encode(getAuthSecret())

export interface SessionPayload {
  userId: string
  email: string
  isAdmin: boolean
  exp?: number
}

// Create a signed JWT session token
export async function createSessionToken(payload: Omit<SessionPayload, 'exp'>): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey())
  
  return token
}

// Verify and decode a session token
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    return payload as unknown as SessionPayload
  } catch (error) {
    console.error('Session verification failed:', error)
    return null
  }
}

// Get session from cookies (for API routes)
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  
  if (!token) return null
  
  return verifySessionToken(token)
}

// Edge-compatible version that takes the token directly
export async function verifySessionFromToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  return verifySessionToken(token)
}
