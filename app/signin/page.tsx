'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { LogIn, UserPlus } from 'lucide-react'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'
  const { signin, signup } = useAuth()

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Sign in form state
  const [signinEmail, setSigninEmail] = useState('')
  const [signinPassword, setSigninPassword] = useState('')

  // Sign up form state
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signin(signinEmail, signinPassword)
      router.push(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      await signup(signupEmail, signupPassword, signupName)
      router.push(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pt-32 pb-16">
      <div className="max-w-md mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#1A1A1A] mb-2">
            Welcome to Head Over Feels
          </h1>
          <p className="text-[#6B6B6B]">
            Sign in to track your orders and save your wishlist
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E5DDD5] mb-6">
          <button
            onClick={() => {
              setActiveTab('signin')
              setError('')
            }}
            className={`flex-1 py-3 text-sm font-medium tracking-wide uppercase transition-colors ${
              activeTab === 'signin'
                ? 'text-[#1A1A1A] border-b-2 border-[#1A1A1A]'
                : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setActiveTab('signup')
              setError('')
            }}
            className={`flex-1 py-3 text-sm font-medium tracking-wide uppercase transition-colors ${
              activeTab === 'signup'
                ? 'text-[#1A1A1A] border-b-2 border-[#1A1A1A]'
                : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Sign In Form */}
        {activeTab === 'signin' && (
          <form onSubmit={handleSignin} className="space-y-4">
            <div>
              <label htmlFor="signin-email" className="block text-sm font-medium text-[#1A1A1A] mb-2">
                Email
              </label>
              <input
                id="signin-email"
                type="email"
                required
                value={signinEmail}
                onChange={(e) => setSigninEmail(e.target.value)}
                className="w-full px-4 py-3 border border-[#E5DDD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] bg-white"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="signin-password" className="block text-sm font-medium text-[#1A1A1A] mb-2">
                Password
              </label>
              <input
                id="signin-password"
                type="password"
                required
                value={signinPassword}
                onChange={(e) => setSigninPassword(e.target.value)}
                className="w-full px-4 py-3 border border-[#E5DDD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] bg-white"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A1A1A] text-white py-3 rounded-lg font-medium hover:bg-[#2B2B2B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Sign Up Form */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="signup-name" className="block text-sm font-medium text-[#1A1A1A] mb-2">
                Full Name
              </label>
              <input
                id="signup-name"
                type="text"
                required
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                className="w-full px-4 py-3 border border-[#E5DDD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] bg-white"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-[#1A1A1A] mb-2">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                required
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                className="w-full px-4 py-3 border border-[#E5DDD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] bg-white"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-[#1A1A1A] mb-2">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                required
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                className="w-full px-4 py-3 border border-[#E5DDD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] bg-white"
                placeholder="••••••••"
              />
              <p className="text-xs text-[#6B6B6B] mt-1">
                Must be at least 8 characters
              </p>
            </div>

            <div>
              <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-[#1A1A1A] mb-2">
                Confirm Password
              </label>
              <input
                id="signup-confirm-password"
                type="password"
                required
                value={signupConfirmPassword}
                onChange={(e) => setSignupConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-[#E5DDD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] bg-white"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A1A1A] text-white py-3 rounded-lg font-medium hover:bg-[#2B2B2B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
          >
            ← Continue as guest
          </Link>
        </div>
      </div>
    </div>
  )
}
