'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { 
  SignIn as SignInIcon, 
  UserPlus, 
  CircleNotch, 
  Heart, 
  Lock, 
  Envelope, 
  User, 
  ArrowRight,
  Sparkle,
  Star,
  Crown,
  Lightning,
  Check,
  X,
  Eye,
  EyeSlash
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navigation } from '@/components/layout/Navigation'

function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin'
  const initialEmail = searchParams.get('email') || ''
  const { setUserData } = useAuth()

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(initialTab)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [requiresVerification, setRequiresVerification] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Sign in form state
  const [signinEmail, setSigninEmail] = useState('')
  const [signinPassword, setSigninPassword] = useState('')

  // Sign up form state
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState(initialEmail)
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  
  // Field validation state (for inline errors)
  const [touchedFields, setTouchedFields] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  })

  // Password validation
  const passwordRequirements = {
    length: signupPassword.length >= 8,
    uppercase: /[A-Z]/.test(signupPassword),
    lowercase: /[a-z]/.test(signupPassword),
    number: /[0-9]/.test(signupPassword),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(signupPassword),
  }

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean)
  
  // Inline validation helpers
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const getNameError = () => {
    if (!touchedFields.name || !signupName) return null
    if (signupName.trim().length < 2) return 'Name must be at least 2 characters'
    return null
  }
  
  const getEmailError = () => {
    if (!touchedFields.email || !signupEmail) return null
    if (!emailRegex.test(signupEmail)) return 'Please enter a valid email address'
    return null
  }

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return
    setResendLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification email')
      }
      
      setSuccessMessage('Verification email sent! Please check your inbox.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification email')
    } finally {
      setResendLoading(false)
    }
  }

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setRequiresVerification(false)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signinEmail, password: signinPassword }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        if (data.requiresVerification) {
          setRequiresVerification(true)
          setUnverifiedEmail(data.email || signinEmail)
          throw new Error('Please verify your email address before signing in')
        }
        throw new Error(data.error || 'Failed to sign in')
      }
      
      setUserData(data.data)
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
    setSuccessMessage('')
    
    if (!isPasswordValid) {
      setError('Please ensure your password meets all requirements')
      return
    }
    
    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (!termsAccepted) {
      setError('Please accept the Terms of Service and Privacy Policy')
      return
    }
    
    // Additional client-side validation
    if (!signupName || signupName.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters)')
      return
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!signupEmail || !emailRegex.test(signupEmail)) {
      setError('Please enter a valid email address')
      return
    }
    
    setLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail.toLowerCase().trim(),
          password: signupPassword,
          name: signupName.trim(),
          termsAccepted: true,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        // Handle specific error cases
        if (data.error === 'Unable to create account. Please try again.') {
          // This is likely a duplicate email (vague for security)
          setError('An account with this email may already exist. Try signing in instead, or use a different email address.')
        } else if (data.issues && Array.isArray(data.issues)) {
          // Zod validation errors - format them nicely
          const errorMessages = data.issues.map((issue: { message: string }) => issue.message).join('. ')
          setError(errorMessages)
        } else {
          setError(data.error || 'Failed to create account. Please check your information and try again.')
        }
        return
      }
      
      // Auto-sign in the user with the returned session data
      if (data.data) {
        setUserData(data.data)
      }
      
      // Show success message and redirect
      setSuccessMessage('Account created! Please check your email to verify your account and earn 50 Care Points.')
      
      // Redirect to home after a short delay so user sees the success message
      setTimeout(() => {
        router.push(redirectTo)
      }, 1500)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to create account. Please check your internet connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const benefits = [
    { icon: Crown, title: 'Loyalty Rewards', desc: 'Earn points on every purchase' },
    { icon: Lightning, title: 'Early Access', desc: 'Be first to shop new drops' },
    { icon: Star, title: 'Exclusive Offers', desc: 'Members-only discounts' },
  ]

  return (
    <>
      <Navigation />
      <div className="min-h-[100svh] bg-white">
        <div className="flex min-h-[calc(100svh-4.5rem)] flex-col lg:min-h-[calc(100svh-5rem)] lg:flex-row">
          {/* Left Side - Brand Panel */}
          <div className="hidden lg:flex lg:w-1/2 bg-black relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.03]">
              <div className="absolute inset-0" style={{
                backgroundImage: 'repeating-linear-gradient(0deg, white 0px, white 1px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, white 0px, white 1px, transparent 1px, transparent 60px)'
              }} />
            </div>

            {/* Corner accents */}
            <motion.div 
              className="absolute top-8 left-8 w-20 h-20 border-l-2 border-t-2 border-white/20"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
            />
            <motion.div 
              className="absolute bottom-8 right-8 w-20 h-20 border-r-2 border-b-2 border-white/20"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
            />

            <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="w-16 h-16 bg-white flex items-center justify-center mb-8">
                  <Heart size={32} weight="fill" className="text-black" />
                </div>
                
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-4">Welcome to</p>
                <h1 className="text-5xl xl:text-6xl font-black text-white tracking-tight mb-6">
                  Head Over<br />Feels
                </h1>
                <p className="text-lg text-white/60 max-w-md mb-12 leading-relaxed">
                  Join our community and unlock exclusive benefits, early access to drops, and personalized recommendations.
                </p>

                {/* Benefits */}
                <div className="space-y-6">
                  {benefits.map((benefit, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="flex items-center gap-4"
                    >
                      <div className="w-12 h-12 border border-white/20 flex items-center justify-center">
                        <benefit.icon size={22} weight="bold" className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-wide">{benefit.title}</p>
                        <p className="text-xs text-white/50">{benefit.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Floating elements */}
            <motion.div
              animate={{ y: [-10, 10, -10], rotate: [0, 5, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
              className="absolute top-1/4 right-12"
            >
              <Sparkle size={40} weight="fill" className="text-white/10" />
            </motion.div>
          </div>

          {/* Right Side - Form Panel */}
          <div className="flex-1 flex items-start justify-center px-3 pt-3 pb-4 sm:px-4 sm:pt-4 sm:pb-6 lg:items-center lg:px-4 lg:py-0">
            <div className="w-full max-w-md">
              {/* Mobile Brand Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:hidden text-center mb-3"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black flex items-center justify-center mx-auto mb-2">
                  <Heart size={20} weight="fill" className="text-white" />
                </div>
                <h1 className="text-lg sm:text-xl font-black text-black tracking-tight">
                  {activeTab === 'signin' ? 'Welcome Back' : 'Join the Family'}
                </h1>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {/* Tab Switcher */}
                <div className="relative border-b border-black/10 mb-4 sm:mb-6">
                  <div className="flex">
                    <button
                      onClick={() => {
                        setActiveTab('signin')
                        setError('')
                        setSuccessMessage('')
                        setRequiresVerification(false)
                      }}
                      className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-black tracking-widest uppercase transition-all ${activeTab === 'signin'
                          ? 'text-black'
                          : 'text-black/30 hover:text-black/50'
                        }`}
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('signup')
                        setError('')
                        setSuccessMessage('')
                        setRequiresVerification(false)
                      }}
                      className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-black tracking-widest uppercase transition-all ${activeTab === 'signup'
                          ? 'text-black'
                          : 'text-black/30 hover:text-black/50'
                        }`}
                    >
                      Create Account
                    </button>
                  </div>
                  {/* Sliding underline */}
                  <motion.div
                    className="absolute bottom-0 h-0.5 bg-black"
                    initial={false}
                    animate={{
                      left: activeTab === 'signin' ? '0%' : '50%',
                      width: '50%',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                </div>

                {/* Error Message */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-3 sm:mb-4 p-2.5 sm:p-3 border border-red-200 bg-red-50"
                    >
                      <p className="text-xs sm:text-sm text-red-600 font-medium">{error}</p>
                      {requiresVerification && (
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={resendLoading}
                          className="mt-2 text-xs font-bold text-red-700 uppercase tracking-wider underline hover:no-underline disabled:opacity-50"
                        >
                          {resendLoading ? 'Sending...' : 'Resend verification email'}
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Success Message */}
                <AnimatePresence mode="wait">
                  {successMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-3 sm:mb-4 p-2.5 sm:p-3 border border-green-200 bg-green-50"
                    >
                      <p className="text-xs sm:text-sm text-green-600 font-medium">{successMessage}</p>
                      {requiresVerification && (
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={resendLoading}
                          className="mt-2 text-xs font-bold text-green-700 uppercase tracking-wider underline hover:no-underline disabled:opacity-50"
                        >
                          {resendLoading ? 'Sending...' : 'Resend verification email'}
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Sign In Form */}
                {activeTab === 'signin' && (
                  <motion.form
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onSubmit={handleSignin}
                    className="space-y-3 sm:space-y-4"
                  >
                    <div>
                      <label htmlFor="signin-email" className="block text-[10px] font-black text-black/60 uppercase tracking-[0.15em] mb-1 sm:mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <Envelope size={16} weight="bold" className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-black/30" />
                        <input
                          id="signin-email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          required
                          value={signinEmail}
                          onChange={(e) => setSigninEmail(e.target.value)}
                          className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 border border-black/10 focus:outline-none focus:border-black bg-white text-black text-sm font-medium transition-colors"
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="signin-password" className="block text-[10px] font-black text-black/60 uppercase tracking-[0.15em] mb-1 sm:mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <Lock size={16} weight="bold" className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-black/30" />
                        <input
                          id="signin-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          required
                          value={signinPassword}
                          onChange={(e) => setSigninPassword(e.target.value)}
                          className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-2.5 sm:py-3 border border-black/10 focus:outline-none focus:border-black bg-white text-black text-sm font-medium transition-colors"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-black/30 hover:text-black transition-colors"
                        >
                          {showPassword ? <EyeSlash size={16} weight="bold" /> : <Eye size={16} weight="bold" />}
                        </button>
                      </div>
                      <div className="mt-1.5 text-right">
                        <Link
                          href="/forgot-password"
                          className="text-xs font-medium text-black/50 hover:text-black transition-colors"
                        >
                          Forgot your password?
                        </Link>
                      </div>
                    </div>

                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: loading ? 1 : 1.01 }}
                      whileTap={{ scale: loading ? 1 : 0.99 }}
                      className="w-full bg-black text-white py-2.5 sm:py-3 font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-black/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
                    >
                      {loading ? (
                        <CircleNotch size={18} weight="bold" className="animate-spin" />
                      ) : (
                        <SignInIcon size={18} weight="bold" />
                      )}
                      {loading ? 'Signing In...' : 'Sign In'}
                      {!loading && <ArrowRight size={14} weight="bold" />}
                    </motion.button>
                  </motion.form>
                )}

                {/* Sign Up Form */}
                {activeTab === 'signup' && (
                  <motion.form
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onSubmit={handleSignup}
                    className="space-y-3 sm:space-y-4"
                  >
                    <div>
                      <label htmlFor="signup-name" className="block text-[10px] font-black text-black/60 uppercase tracking-[0.15em] mb-1 sm:mb-2">
                        Full Name
                      </label>
                      <div className="relative">
                        <User size={16} weight="bold" className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-black/30" />
                        <input
                          id="signup-name"
                          type="text"
                          autoComplete="name"
                          required
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          onBlur={() => setTouchedFields(prev => ({ ...prev, name: true }))}
                          className={`w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 border focus:outline-none bg-white text-black text-sm font-medium transition-colors ${
                            getNameError()
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-black/10 focus:border-black'
                          }`}
                          placeholder="John Doe"
                        />
                      </div>
                      {getNameError() && (
                        <p className="text-xs text-red-500 mt-1">{getNameError()}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="signup-email" className="block text-[10px] font-black text-black/60 uppercase tracking-[0.15em] mb-1 sm:mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <Envelope size={16} weight="bold" className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-black/30" />
                        <input
                          id="signup-email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          required
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          onBlur={() => setTouchedFields(prev => ({ ...prev, email: true }))}
                          className={`w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 border focus:outline-none bg-white text-black text-sm font-medium transition-colors ${
                            getEmailError()
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-black/10 focus:border-black'
                          }`}
                          placeholder="you@example.com"
                        />
                      </div>
                      {getEmailError() && (
                        <p className="text-xs text-red-500 mt-1">{getEmailError()}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="signup-password" className="block text-[10px] font-black text-black/60 uppercase tracking-[0.15em] mb-1 sm:mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <Lock size={16} weight="bold" className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-black/30" />
                        <input
                          id="signup-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-2.5 sm:py-3 border border-black/10 focus:outline-none focus:border-black bg-white text-black text-sm font-medium transition-colors"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-black/30 hover:text-black transition-colors"
                        >
                          {showPassword ? <EyeSlash size={16} weight="bold" /> : <Eye size={16} weight="bold" />}
                        </button>
                      </div>
                      
                      {/* Password Requirements */}
                      {signupPassword && (
                        <div className="mt-2 p-2.5 sm:p-3 bg-black/5 border border-black/10">
                          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.12em] sm:tracking-[0.15em] text-black/60 mb-2">Password Requirements</p>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { key: 'length', label: '8+ characters' },
                              { key: 'uppercase', label: 'Uppercase' },
                              { key: 'lowercase', label: 'Lowercase' },
                              { key: 'number', label: 'Number' },
                              { key: 'special', label: 'Special char' },
                            ].map((req) => (
                              <div key={req.key} className="flex items-center gap-2">
                                {passwordRequirements[req.key as keyof typeof passwordRequirements] ? (
                                  <Check size={12} weight="bold" className="text-green-600" />
                                ) : (
                                  <X size={12} weight="bold" className="text-black/30" />
                                )}
                                <span className={`text-xs ${
                                  passwordRequirements[req.key as keyof typeof passwordRequirements]
                                    ? 'text-green-600'
                                    : 'text-black/40'
                                }`}>
                                  {req.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="signup-confirm-password" className="block text-[10px] font-black text-black/60 uppercase tracking-[0.15em] mb-1 sm:mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock size={16} weight="bold" className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-black/30" />
                        <input
                          id="signup-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                          value={signupConfirmPassword}
                          onChange={(e) => setSignupConfirmPassword(e.target.value)}
                          className={`w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-2.5 sm:py-3 border focus:outline-none bg-white text-black text-sm font-medium transition-colors ${
                            signupConfirmPassword && signupConfirmPassword !== signupPassword
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-black/10 focus:border-black'
                          }`}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-black/30 hover:text-black transition-colors"
                        >
                          {showConfirmPassword ? <EyeSlash size={16} weight="bold" /> : <Eye size={16} weight="bold" />}
                        </button>
                      </div>
                      {signupConfirmPassword && signupConfirmPassword !== signupPassword && (
                        <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                      )}
                    </div>

                    {/* Terms */}
                    <div className="flex items-start gap-3">
                      <input
                        id="terms-checkbox"
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-1 w-4 h-4 border-black/20 text-black focus:ring-black focus:ring-offset-0 cursor-pointer"
                      />
                      <label htmlFor="terms-checkbox" className="text-xs sm:text-sm text-black/60 cursor-pointer leading-snug sm:leading-relaxed">
                        I agree to the{' '}
                        <Link href="/terms" className="text-black font-medium underline hover:no-underline">
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link href="/privacy" className="text-black font-medium underline hover:no-underline">
                          Privacy Policy
                        </Link>
                      </label>
                    </div>

                    <motion.button
                      type="submit"
                      disabled={loading || !isPasswordValid || signupPassword !== signupConfirmPassword}
                      whileHover={{ scale: loading ? 1 : 1.01 }}
                      whileTap={{ scale: loading ? 1 : 0.99 }}
                      className="w-full bg-black text-white py-2.5 sm:py-3 font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-black/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
                    >
                      {loading ? (
                        <CircleNotch size={18} weight="bold" className="animate-spin" />
                      ) : (
                        <UserPlus size={18} weight="bold" />
                      )}
                      {loading ? 'Creating Account...' : 'Create Account'}
                      {!loading && <ArrowRight size={14} weight="bold" />}
                    </motion.button>
                  </motion.form>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 bg-black flex items-center justify-center">
            <Heart size={28} weight="fill" className="text-white" />
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-2 border-2 border-black/10 border-t-black"
          />
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  )
}
