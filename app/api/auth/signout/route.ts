import { NextResponse } from 'next/server'

// POST /api/auth/signout - Sign out the current user
export async function POST() {
  const response = NextResponse.json({ 
    message: 'Signed out successfully' 
  })
  
  // Clear all auth cookies
  response.cookies.delete('auth_session')
  response.cookies.delete('auth_token')

  return response
}
