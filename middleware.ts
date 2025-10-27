import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Only protect /admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const sessionId = request.cookies.get('auth_session')?.value

    console.log('🔍 Middleware Debug:')
    console.log('   Path:', request.nextUrl.pathname)
    console.log('   Session ID:', sessionId)

    // No session - redirect to signin
    if (!sessionId) {
      console.log('   ❌ No session found - redirecting to signin')
      const url = new URL('/signin', request.url)
      url.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }

    try {
      // Call API route to check admin status (Edge Runtime compatible)
      const apiUrl = new URL('/api/auth/check-admin', request.url)
      const response = await fetch(apiUrl, {
        headers: {
          Cookie: `auth_session=${sessionId}`,
        },
      })

      const data = await response.json()
      console.log('   Admin check response:', data)

      if (!response.ok || !data.isAdmin) {
        // Not an admin - redirect to home
        console.log('   ❌ Not an admin - redirecting to home')
        const url = new URL('/', request.url)
        return NextResponse.redirect(url)
      }

      console.log('   ✅ Admin access granted')
    } catch (error) {
      console.error('   ❌ Middleware auth check failed:', error)
      const url = new URL('/signin', request.url)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/admin'],
}
