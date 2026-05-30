'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CircleNotch, Envelope, ArrowRight, CheckCircle } from '@phosphor-icons/react'
import { Navigation } from '@/components/layout/Navigation'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok && response.status !== 429) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      if (response.status === 429) {
        throw new Error(data.error || 'Please wait before requesting another email')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-[#FAF8F5] pt-28 pb-16">
        <div className="max-w-md mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-black text-black tracking-tight mb-2">
              {submitted ? 'Check Your Email' : 'Reset Password'}
            </h1>
            <p className="text-black/60">
              {submitted 
                ? 'We sent you a password reset link'
                : 'Enter your email and we\'ll send you a reset link'
              }
            </p>
          </motion.div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white border border-black/10 p-8"
          >
            {submitted ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-6 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={32} weight="fill" className="text-emerald-600" />
                </div>
                <p className="text-black/60 mb-2 text-sm">
                  If an account exists with <strong className="text-black">{email}</strong>, you&apos;ll receive a password reset link shortly.
                </p>
                <p className="text-xs text-black/40 mb-6">
                  Didn&apos;t receive an email? Check your spam folder or try again in a few minutes.
                </p>
                <Link
                  href="/signin"
                  className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 font-bold text-sm uppercase tracking-wider hover:bg-black/80 transition-all"
                >
                  Back to Sign In
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 border border-red-200 text-sm text-red-600 font-medium"
                  >
                    {error}
                  </motion.div>
                )}

                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-black/70 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Envelope size={18} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                    <input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-black/10 focus:outline-none focus:border-black bg-[#FAF8F5] text-black font-medium transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.01 }}
                  whileTap={{ scale: loading ? 1 : 0.99 }}
                  className="w-full bg-black text-white py-4 font-bold text-sm uppercase tracking-wider hover:bg-black/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <CircleNotch size={18} weight="bold" className="animate-spin" />
                  ) : null}
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </motion.button>
              </form>
            )}
          </motion.div>

          {/* Footer link */}
          {!submitted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center mt-6"
            >
              <Link
                href="/signin"
                className="text-sm text-black/50 hover:text-black transition-colors"
              >
                Remember your password? <span className="font-bold text-black">Sign in</span>
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </>
  )
}
