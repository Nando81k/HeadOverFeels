'use client'

import { usePathname } from 'next/navigation'
import ReggieWidget from './ReggieWidget'

/**
 * Provider component that conditionally renders the ReggieWidget
 * Only shows on customer-facing pages (not admin pages)
 */
export function ReggieProvider() {
  const pathname = usePathname()
  
  // Don't show Reggie on admin pages - they have their own AdminReggie
  const isAdminPage = pathname?.startsWith('/admin')
  
  // Don't show on auth pages
  const isAuthPage = pathname?.startsWith('/auth') || pathname?.startsWith('/login')
  
  // Don't show on API routes (shouldn't happen but just in case)
  const isApiRoute = pathname?.startsWith('/api')
  
  if (isAdminPage || isAuthPage || isApiRoute) {
    return null
  }
  
  return <ReggieWidget />
}
