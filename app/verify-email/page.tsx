'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, CircleNotch, ArrowRight, Heart } from '@phosphor-icons/react'
import { Navigation } from '@/components/layout/Navigation'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('no-token')
      setMessage('No verification token provided')
      return
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await response.json()

        if (!response.ok) {
          setStatus('error')
          setMessage(data.error || 'Failed to verify email')
          return
        }

        setStatus('success')
        setMessage(data.message || 'Email verified successfully!')
      } catch (error) {
        console.error('Verification error:', error)
        setStatus('error')
        setMessage('An error occurred during verification')
      }
    }

    verifyEmail()
  }, [token])

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-[#FAF8F5]">
        {/* Hero Header */}
        <section className="relative bg-black pt-40 pb-16 -mt-24">
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white flex items-center justify-center">
                  <Heart size={32} weight="fill" className="text-black" />
                </div>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-3">
                Email Verification
              </h1>
              <p className="text-white/60 text-lg max-w-md mx-auto">
                Confirming your email address
              </p>
            </motion.div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#FAF8F5] to-transparent pointer-events-none" />
        </section>

        {/* Content */}
        <div className="max-w-md mx-auto px-4 -mt-8 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border border-black/10 p-8 text-center"
          >
            {status === 'loading' && (
              <>
                <div className="w-20 h-20 mx-auto mb-6 bg-black/5 rounded-full flex items-center justify-center">
                  <CircleNotch size={40} weight="bold" className="text-black animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-black mb-2">Verifying your email...</h2>
                <p className="text-black/60">Please wait while we confirm your email address.</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={40} weight="fill" className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-black mb-2">Email Verified!</h2>
                <p className="text-black/60 mb-8">{message}</p>
                <Link
                  href="/signin"
                  className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 font-bold text-sm uppercase tracking-wider hover:bg-black/80 transition-all"
                >
                  Sign In Now
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle size={40} weight="fill" className="text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-black mb-2">Verification Failed</h2>
                <p className="text-black/60 mb-8">{message}</p>
                <div className="space-y-4">
                  <Link
                    href="/signin"
                    className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 font-bold text-sm uppercase tracking-wider hover:bg-black/80 transition-all w-full justify-center"
                  >
                    Back to Sign In
                    <ArrowRight size={16} weight="bold" />
                  </Link>
                  <p className="text-sm text-black/50">
                    Need a new verification link?{' '}
                    <Link href="/signin" className="text-black underline">
                      Sign in to request one
                    </Link>
                  </p>
                </div>
              </>
            )}

            {status === 'no-token' && (
              <>
                <div className="w-20 h-20 mx-auto mb-6 bg-yellow-100 rounded-full flex items-center justify-center">
                  <XCircle size={40} weight="fill" className="text-yellow-600" />
                </div>
                <h2 className="text-xl font-bold text-black mb-2">Invalid Link</h2>
                <p className="text-black/60 mb-8">{message}</p>
                <Link
                  href="/signin"
                  className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 font-bold text-sm uppercase tracking-wider hover:bg-black/80 transition-all"
                >
                  Back to Sign In
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="w-20 h-20 bg-black flex items-center justify-center">
          <CircleNotch size={32} weight="bold" className="animate-spin text-white" />
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
