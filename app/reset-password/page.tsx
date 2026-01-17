'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CircleNotch, ArrowLeft, Heart, Lock, ArrowRight, CheckCircle, XCircle } from '@phosphor-icons/react'
import { Navigation } from '@/components/layout/Navigation'
import { PasswordStrength } from '@/components/auth/PasswordStrength'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [validatingToken, setValidatingToken] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenEmail, setTokenEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setValidatingToken(false)
      setTokenValid(false)
      setError('No reset token provided')
      return
    }

    const validateToken = async () => {
      try {
        const response = await fetch(`/api/auth/reset-password?token=${token}`)
        const data = await response.json()

        if (!response.ok || !data.valid) {
          setTokenValid(false)
          setError(data.error || 'Invalid or expired reset token')
        } else {
          setTokenValid(true)
          setTokenEmail(data.email)
        }
      } catch (err) {
        console.error('Token validation error:', err)
        setTokenValid(false)
        setError('Failed to validate reset token')
      } finally {
        setValidatingToken(false)
      }
    }

    validateToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password requirements
    const passwordChecks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
    }

    const unmetRequirements = []
    if (!passwordChecks.length) unmetRequirements.push('at least 8 characters')
    if (!passwordChecks.uppercase) unmetRequirements.push('an uppercase letter')
    if (!passwordChecks.lowercase) unmetRequirements.push('a lowercase letter')
    if (!passwordChecks.number) unmetRequirements.push('a number')

    if (unmetRequirements.length > 0) {
      setError(`Password must contain ${unmetRequirements.join(', ')}`)
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

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
          
          <motion.div 
            className="absolute top-28 left-8 w-16 h-16 border-l border-t border-white/10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
          />
          <motion.div 
            className="absolute top-28 right-8 w-16 h-16 border-r border-t border-white/10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
          />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium mb-8"
              >
                <ArrowLeft size={16} weight="bold" />
                Back to sign in
              </Link>
              
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white flex items-center justify-center">
                  <Heart size={32} weight="fill" className="text-black" />
                </div>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-3">
                Create New Password
              </h1>
              <p className="text-white/60 text-lg max-w-md mx-auto">
                Enter your new password below
              </p>
            </motion.div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#FAF8F5] to-transparent pointer-events-none" />
        </section>

        {/* Form Section */}
        <div className="max-w-md mx-auto px-4 -mt-8 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border border-black/10 p-8"
          >
            {validatingToken ? (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 bg-black/5 rounded-full flex items-center justify-center">
                  <CircleNotch size={40} weight="bold" className="text-black animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-black mb-2">Validating link...</h2>
                <p className="text-black/60">Please wait while we verify your reset link.</p>
              </div>
            ) : success ? (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={40} weight="fill" className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-black mb-2">Password Reset!</h2>
                <p className="text-black/60 mb-8">
                  Your password has been successfully reset. You can now sign in with your new password.
                </p>
                <Link
                  href="/signin"
                  className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 font-bold text-sm uppercase tracking-wider hover:bg-black/80 transition-all"
                >
                  Sign In Now
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </div>
            ) : !tokenValid ? (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle size={40} weight="fill" className="text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-black mb-2">Invalid Reset Link</h2>
                <p className="text-black/60 mb-8">{error}</p>
                <Link
                  href="/forgot-password"
                  className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 font-bold text-sm uppercase tracking-wider hover:bg-black/80 transition-all"
                >
                  Request New Link
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {tokenEmail && (
                  <div className="p-4 bg-black/5 border border-black/10 mb-6">
                    <p className="text-sm text-black/70">
                      Resetting password for: <strong>{tokenEmail}</strong>
                    </p>
                  </div>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-50 border border-red-200"
                  >
                    <p className="text-sm text-red-600 font-medium">{error}</p>
                  </motion.div>
                )}

                <div>
                  <label htmlFor="password" className="block text-xs font-bold text-black/70 uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock size={20} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 border border-black/10 focus:outline-none focus:border-black bg-[#FAF8F5] text-black font-medium transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                  
                  {password && (
                    <div className="mt-4">
                      <PasswordStrength password={password} showRequirements={true} />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-xs font-bold text-black/70 uppercase tracking-wider mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock size={20} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 border border-black/10 focus:outline-none focus:border-black bg-[#FAF8F5] text-black font-medium transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="mt-2 text-sm text-red-600">Passwords do not match</p>
                  )}
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.01 }}
                  whileTap={{ scale: loading ? 1 : 0.99 }}
                  className="w-full bg-black text-white py-4 font-bold text-sm uppercase tracking-wider hover:bg-black/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <CircleNotch size={20} weight="bold" className="animate-spin" />
                  ) : (
                    <Lock size={20} weight="bold" />
                  )}
                  {loading ? 'Resetting...' : 'Reset Password'}
                  {!loading && <ArrowRight size={16} weight="bold" />}
                </motion.button>
              </form>
            )}
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-center"
          >
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 text-sm text-black/50 hover:text-black transition-colors font-medium"
            >
              <ArrowLeft size={16} weight="bold" />
              Back to sign in
            </Link>
          </motion.div>
        </div>
      </div>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="w-20 h-20 bg-black flex items-center justify-center">
          <CircleNotch size={32} weight="bold" className="animate-spin text-white" />
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
