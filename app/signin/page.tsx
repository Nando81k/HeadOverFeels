'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useAuth } from '@/lib/auth/context'
import { SignIn as SignInIcon, UserPlus, GoogleLogo, GithubLogo, CircleNotch, ArrowLeft, Heart, Lock, Envelope, User, ArrowRight } from '@phosphor-icons/react'
import { PasswordStrength } from '@/components/auth/PasswordStrength'
import { motion } from 'framer-motion'
import { Navigation } from '@/components/layout/Navigation'

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
    <>
      <Navigation />
      <div className="min-h-screen bg-[#FAF8F5]">
        {/* Hero Header */}
        <section className="relative bg-black pt-40 pb-16 -mt-24">
          {/* Grain overlay */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
          
          {/* Corner accents */}
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
                href="/"
                className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium mb-8"
              >
                <ArrowLeft size={16} weight="bold" />
                Back to home
              </Link>
              
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white flex items-center justify-center">
                  <Heart size={32} weight="fill" className="text-black" />
                </div>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-3">
                {activeTab === 'signin' ? 'Welcome Back' : 'Join the Family'}
              </h1>
              <p className="text-white/60 text-lg max-w-md mx-auto">
                {activeTab === 'signin' 
                  ? 'Sign in to track orders, earn points, and access exclusive drops'
                  : 'Create an account to start earning rewards and get early access'
                }
              </p>
            </motion.div>
          </div>
          
          {/* Bottom gradient fade */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#FAF8F5] to-transparent pointer-events-none" />
        </section>

        {/* Auth Form Section */}
        <div className="max-w-md mx-auto px-4 -mt-8 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border border-black/10 p-8"
          >
            {/* Tabs */}
            <div className="flex border-b border-black/10 mb-8">
              <button
                onClick={() => {
                  setActiveTab('signin')
                  setError('')
                }}
                className={`flex-1 py-4 text-sm font-bold tracking-wider uppercase transition-all ${
                  activeTab === 'signin'
                    ? 'text-black border-b-2 border-black'
                    : 'text-black/40 hover:text-black/60'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setActiveTab('signup')
                  setError('')
                }}
                className={`flex-1 py-4 text-sm font-bold tracking-wider uppercase transition-all ${
                  activeTab === 'signup'
                    ? 'text-black border-b-2 border-black'
                    : 'text-black/40 hover:text-black/60'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-50 border border-red-200"
              >
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </motion.div>
            )}

            {/* Sign In Form */}
            {activeTab === 'signin' && (
              <form onSubmit={handleSignin} className="space-y-5">
                <div>
                  <label htmlFor="signin-email" className="block text-xs font-bold text-black/70 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Envelope size={20} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                    <input
                      id="signin-email"
                      type="email"
                      required
                      value={signinEmail}
                      onChange={(e) => setSigninEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 border border-black/10 focus:outline-none focus:border-black bg-[#FAF8F5] text-black font-medium transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signin-password" className="block text-xs font-bold text-black/70 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={20} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                    <input
                      id="signin-password"
                      type="password"
                      required
                      value={signinPassword}
                      onChange={(e) => setSigninPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 border border-black/10 focus:outline-none focus:border-black bg-[#FAF8F5] text-black font-medium transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
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
                    <SignInIcon size={20} weight="bold" />
                  )}
                  {loading ? 'Signing In...' : 'Sign In'}
                  {!loading && <ArrowRight size={16} weight="bold" />}
                </motion.button>

                {/* Divider */}
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-black/10"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-xs font-bold text-black/40 uppercase tracking-wider">Or continue with</span>
                  </div>
                </div>

                {/* Social Login Buttons */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('google')}
                    disabled={socialLoading !== null}
                    className="flex items-center justify-center gap-2 px-4 py-4 border border-black/10 bg-white hover:bg-black/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {socialLoading === 'google' ? (
                      <CircleNotch size={20} weight="bold" className="animate-spin" />
                    ) : (
                      <GoogleLogo size={20} weight="bold" className="text-[#4285F4]" />
                    )}
                    <span className="text-sm font-bold text-black">Google</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('github')}
                    disabled={socialLoading !== null}
                    className="flex items-center justify-center gap-2 px-4 py-4 border border-black/10 bg-white hover:bg-black/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {socialLoading === 'github' ? (
                      <CircleNotch size={20} weight="bold" className="animate-spin" />
                    ) : (
                      <GithubLogo size={20} weight="bold" className="text-black" />
                    )}
                    <span className="text-sm font-bold text-black">GitHub</span>
                  </button>
                </div>
              </form>
            )}

            {/* Sign Up Form */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-5">
                <div>
                  <label htmlFor="signup-name" className="block text-xs font-bold text-black/70 uppercase tracking-wider mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User size={20} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                    <input
                      id="signup-name"
                      type="text"
                      required
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 border border-black/10 focus:outline-none focus:border-black bg-[#FAF8F5] text-black font-medium transition-colors"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-email" className="block text-xs font-bold text-black/70 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Envelope size={20} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                    <input
                      id="signup-email"
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 border border-black/10 focus:outline-none focus:border-black bg-[#FAF8F5] text-black font-medium transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-password" className="block text-xs font-bold text-black/70 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={20} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                    <input
                      id="signup-password"
                      type="password"
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 border border-black/10 focus:outline-none focus:border-black bg-[#FAF8F5] text-black font-medium transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {signupPassword && (
                    <div className="mt-4">
                      <PasswordStrength password={signupPassword} showRequirements={true} />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="signup-confirm-password" className="block text-xs font-bold text-black/70 uppercase tracking-wider mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock size={20} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                    <input
                      id="signup-confirm-password"
                      type="password"
                      required
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 border border-black/10 focus:outline-none focus:border-black bg-[#FAF8F5] text-black font-medium transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
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
                    <UserPlus size={20} weight="bold" />
                  )}
                  {loading ? 'Creating Account...' : 'Create Account'}
                  {!loading && <ArrowRight size={16} weight="bold" />}
                </motion.button>

                {/* Divider */}
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-black/10"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-xs font-bold text-black/40 uppercase tracking-wider">Or sign up with</span>
                  </div>
                </div>

                {/* Social Login Buttons */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('google')}
                    disabled={socialLoading !== null}
                    className="flex items-center justify-center gap-2 px-4 py-4 border border-black/10 bg-white hover:bg-black/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {socialLoading === 'google' ? (
                      <CircleNotch size={20} weight="bold" className="animate-spin" />
                    ) : (
                      <GoogleLogo size={20} weight="bold" className="text-[#4285F4]" />
                    )}
                    <span className="text-sm font-bold text-black">Google</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('github')}
                    disabled={socialLoading !== null}
                    className="flex items-center justify-center gap-2 px-4 py-4 border border-black/10 bg-white hover:bg-black/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {socialLoading === 'github' ? (
                      <CircleNotch size={20} weight="bold" className="animate-spin" />
                    ) : (
                      <GithubLogo size={20} weight="bold" className="text-black" />
                    )}
                    <span className="text-sm font-bold text-black">GitHub</span>
                  </button>
                </div>
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
              href="/"
              className="inline-flex items-center gap-2 text-sm text-black/50 hover:text-black transition-colors font-medium"
            >
              <ArrowLeft size={16} weight="bold" />
              Continue as guest
            </Link>
          </motion.div>
        </div>
      </div>
    </>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="w-20 h-20 bg-black flex items-center justify-center">
          <CircleNotch size={32} weight="bold" className="animate-spin text-white" />
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  )
}
