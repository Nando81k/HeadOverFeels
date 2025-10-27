'use client'

import { AuthProvider } from '@/lib/auth/context'
import { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  console.log('✅ Providers component loaded')
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}
