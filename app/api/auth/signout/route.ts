import { NextResponse } from 'next/server'

// POST /api/auth/signout - Sign out the current user
export async function POST() {
  const response = NextResponse.json({ 
    message: 'Signed out successfully' 
  })
  
  // Clear the session cookie
  response.cookies.delete('auth_session')

  return response
}
