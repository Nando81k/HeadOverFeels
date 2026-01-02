'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useAuth } from '@/lib/auth/context'
import { SignIn as SignInIcon, UserPlus, GoogleLogo, GithubLogo, Spinner } from '@phosphor-icons/react'
import { PasswordStrength } from '@/components/auth/PasswordStrength'

function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'
  const { signin, signup } = useAuth()

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<string | null>(null)
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

    // Check password requirements
    const passwordChecks = {
      length: signupPassword.length >= 8,
      uppercase: /[A-Z]/.test(signupPassword),
      lowercase: /[a-z]/.test(signupPassword),
      number: /[0-9]/.test(signupPassword),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(signupPassword),
    }

    const unmetRequirements = []
    if (!passwordChecks.length) unmetRequirements.push('at least 8 characters')
    if (!passwordChecks.uppercase) unmetRequirements.push('an uppercase letter')
    if (!passwordChecks.lowercase) unmetRequirements.push('a lowercase letter')
    if (!passwordChecks.number) unmetRequirements.push('a number')
    if (!passwordChecks.special) unmetRequirements.push('a special character')

    if (unmetRequirements.length > 0) {
      setError(`Password must contain ${unmetRequirements.join(', ')}`)
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

  // Social login handlers
  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setError('')
    setSocialLoading(provider)
    try {
      await signIn(provider, { callbackUrl: redirectTo })
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to sign in with ${provider}`)
      setSocialLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pt-32 pb-16">
      <div className="max-w-md mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-[#1A1A1A] mb-2 logo-font">
            Welcome Back
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
              <SignInIcon size={20} weight="bold" />
              {loading ? 'Signing In...' : 'Sign In'}
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E5DDD5]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#FAF8F5] text-[#6B6B6B]">or continue with</span>
              </div>
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={socialLoading !== null}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-[#E5DDD5] rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {socialLoading === 'google' ? (
                  <Spinner size={20} className="animate-spin" />
                ) : (
                  <GoogleLogo size={20} weight="bold" className="text-[#4285F4]" />
                )}
                <span className="text-sm font-medium text-[#1A1A1A]">Google</span>
              </button>
              
              <button
                type="button"
                onClick={() => handleSocialLogin('github')}
                disabled={socialLoading !== null}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-[#E5DDD5] rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {socialLoading === 'github' ? (
                  <Spinner size={20} className="animate-spin" />
                ) : (
                  <GithubLogo size={20} weight="bold" className="text-[#1A1A1A]" />
                )}
                <span className="text-sm font-medium text-[#1A1A1A]">GitHub</span>
              </button>
            </div>
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
              
              {/* Password Strength Indicator */}
              {signupPassword && (
                <div className="mt-3">
                  <PasswordStrength password={signupPassword} showRequirements={true} />
                </div>
              )}
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
              <UserPlus size={20} weight="bold" />
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E5DDD5]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#FAF8F5] text-[#6B6B6B]">or sign up with</span>
              </div>
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={socialLoading !== null}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-[#E5DDD5] rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {socialLoading === 'google' ? (
                  <Spinner size={20} className="animate-spin" />
                ) : (
                  <GoogleLogo size={20} weight="bold" className="text-[#4285F4]" />
                )}
                <span className="text-sm font-medium text-[#1A1A1A]">Google</span>
              </button>
              
              <button
                type="button"
                onClick={() => handleSocialLogin('github')}
                disabled={socialLoading !== null}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-[#E5DDD5] rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {socialLoading === 'github' ? (
                  <Spinner size={20} className="animate-spin" />
                ) : (
                  <GithubLogo size={20} weight="bold" className="text-[#1A1A1A]" />
                )}
                <span className="text-sm font-medium text-[#1A1A1A]">GitHub</span>
              </button>
            </div>
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

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF3131]"></div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  )
}
