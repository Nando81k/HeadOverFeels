'use client'

import { SessionProvider } from 'next-auth/react'
import { AuthProvider } from '@/lib/auth/context'
import { Toaster } from 'sonner'
import { ReactNode } from 'react'
import { ReggieProvider } from '@/components/ai/ReggieProvider'
import { PopupManager } from '@/components/marketing/PopupManager'

export function Providers({ children }: { children: ReactNode }) {
  console.log('✅ Providers component loaded')
  return (
    <SessionProvider>
      <AuthProvider>
        {children}
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: '#fff',
              color: '#1f2937',
              border: '1px solid #e5e7eb',
            },
            className: 'font-medium',
            duration: 4000,
          }}
          closeButton
          richColors
        />
        {/* Reggie AI Assistant for Customer Pages */}
        <ReggieProvider />
        {/* Marketing Popups for Storefront */}
        <PopupManager />
      </AuthProvider>
    </SessionProvider>
  )
}
