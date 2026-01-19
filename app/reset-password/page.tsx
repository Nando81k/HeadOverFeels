'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  CircleNotch, 
  Lock, 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  Eye, 
  EyeSlash,
  Check
} from '@phosphor-icons/react'
import { Navigation } from '@/components/layout/Navigation'

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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Password requirements
  const passwordRequirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  }

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean)
  const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0

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

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!isPasswordValid) {
      setError('Please ensure your password meets all requirements')
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
      <div className="min-h-screen bg-[#FAF8F5] pt-28 pb-16">
        <div className="max-w-md mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-black text-black tracking-tight mb-2">
              {success ? 'Password Reset!' : validatingToken ? 'Validating...' : !tokenValid ? 'Invalid Link' : 'Create New Password'}
            </h1>
            <p className="text-black/60">
              {success 
                ? 'You can now sign in with your new password' 
                : validatingToken 
                  ? 'Please wait while we verify your reset link'
                  : !tokenValid 
                    ? 'This link is invalid or has expired'
                    : 'Enter your new password below'
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
            {validatingToken ? (
              <div className="text-center py-8">
                <CircleNotch size={40} weight="bold" className="text-black animate-spin mx-auto" />
              </div>
            ) : success ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-6 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={32} weight="fill" className="text-emerald-600" />
                </div>
                <Link
                  href="/signin"
                  className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 font-bold text-sm uppercase tracking-wider hover:bg-black/80 transition-all"
                >
                  Sign In Now
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </div>
            ) : !tokenValid ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle size={32} weight="fill" className="text-red-600" />
                </div>
                <p className="text-black/60 mb-6 text-sm">{error}</p>
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
                  <div className="p-3 bg-black/5 border border-black/10 text-sm text-black/70">
                    Resetting password for: <strong className="text-black">{tokenEmail}</strong>
                  </div>
                )}

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
                  <label htmlFor="password" className="block text-xs font-bold text-black/70 uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock size={18} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 border border-black/10 focus:outline-none focus:border-black bg-[#FAF8F5] text-black font-medium transition-colors"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-black/40 hover:text-black transition-colors"
                    >
                      {showPassword ? <EyeSlash size={18} weight="bold" /> : <Eye size={18} weight="bold" />}
                    </button>
                  </div>
                  
                  {/* Password Requirements */}
                  {password && (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                      {[
                        { key: 'length', label: '8+ chars' },
                        { key: 'uppercase', label: 'Uppercase' },
                        { key: 'lowercase', label: 'Lowercase' },
                        { key: 'number', label: 'Number' },
                      ].map(({ key, label }) => (
                        <span 
                          key={key}
                          className={`flex items-center gap-1 text-xs ${
                            passwordRequirements[key as keyof typeof passwordRequirements] 
                              ? 'text-emerald-600' 
                              : 'text-black/40'
                          }`}
                        >
                          <Check size={12} weight="bold" />
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-xs font-bold text-black/70 uppercase tracking-wider mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock size={18} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full pl-11 pr-11 py-3 border focus:outline-none bg-[#FAF8F5] text-black font-medium transition-colors ${
                        confirmPassword && !doPasswordsMatch 
                          ? 'border-red-300 focus:border-red-500' 
                          : confirmPassword && doPasswordsMatch 
                            ? 'border-emerald-300 focus:border-emerald-500'
                            : 'border-black/10 focus:border-black'
                      }`}
                      placeholder="Confirm password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-black/40 hover:text-black transition-colors"
                    >
                      {showConfirmPassword ? <EyeSlash size={18} weight="bold" /> : <Eye size={18} weight="bold" />}
                    </button>
                  </div>
                  {confirmPassword && (
                    <p className={`mt-2 text-xs flex items-center gap-1 ${doPasswordsMatch ? 'text-emerald-600' : 'text-red-600'}`}>
                      {doPasswordsMatch ? <CheckCircle size={12} weight="fill" /> : <XCircle size={12} weight="fill" />}
                      {doPasswordsMatch ? 'Passwords match' : 'Passwords do not match'}
                    </p>
                  )}
                </div>

                <motion.button
                  type="submit"
                  disabled={loading || !isPasswordValid || !doPasswordsMatch}
                  whileHover={{ scale: loading ? 1 : 1.01 }}
                  whileTap={{ scale: loading ? 1 : 0.99 }}
                  className="w-full bg-black text-white py-4 font-bold text-sm uppercase tracking-wider hover:bg-black/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <CircleNotch size={18} weight="bold" className="animate-spin" />
                  ) : null}
                  {loading ? 'Resetting...' : 'Reset Password'}
                </motion.button>
              </form>
            )}
          </motion.div>

          {/* Footer link */}
          {!success && !validatingToken && tokenValid && (
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
