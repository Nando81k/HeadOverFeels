'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  UserPlus,
  Share,
  Copy,
  Check,
  Gift,
  Users,
  Trophy,
  ArrowLeft,
  Heart,
  Sparkle,
  CaretRight,
  FacebookLogo,
  TwitterLogo,
  Envelope,
  CircleNotch,
} from '@phosphor-icons/react'

interface ReferralData {
  code: string
  timesUsed: number
  totalReferrals: number
  totalPointsEarned: number
  shareUrl: string
  recentReferrals: {
    id: string
    points: number
    description: string
    createdAt: string
  }[]
}

const REFERRAL_BONUS_NEW_USER = 50
const REFERRAL_BONUS_REFERRER = 100

export default function ReferralsPage() {
  const [referralData, setReferralData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const fetchReferralData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/loyalty/referrals')
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Please sign in to access your referral code')
          return
        }
        throw new Error('Failed to fetch referral data')
      }

      const data = await response.json()
      setReferralData(data)
    } catch (err) {
      console.error('Error fetching referral data:', err)
      setError('Failed to load referral information')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReferralData()
  }, [fetchReferralData])

  const copyCode = async () => {
    if (!referralData) return
    
    try {
      await navigator.clipboard.writeText(referralData.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  const copyUrl = async () => {
    if (!referralData) return
    
    try {
      await navigator.clipboard.writeText(referralData.shareUrl)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  const shareOnFacebook = () => {
    if (!referralData) return
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralData.shareUrl)}&quote=${encodeURIComponent(`Join Head Over Feels and get ${REFERRAL_BONUS_NEW_USER} bonus points! Use my referral code: ${referralData.code}`)}`
    window.open(url, '_blank', 'width=600,height=400')
  }

  const shareOnTwitter = () => {
    if (!referralData) return
    const text = `Join @HeadOverFeels and get ${REFERRAL_BONUS_NEW_USER} bonus points! Use my referral code: ${referralData.code}`
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralData.shareUrl)}`
    window.open(url, '_blank', 'width=600,height=400')
  }

  const shareViaEmail = () => {
    if (!referralData) return
    const subject = `Join Head Over Feels and get ${REFERRAL_BONUS_NEW_USER} bonus points!`
    const body = `Hey!\n\nI've been shopping at Head Over Feels and thought you might like it too. If you sign up using my referral code, you'll get ${REFERRAL_BONUS_NEW_USER} bonus points to use on your first purchase!\n\nReferral Code: ${referralData.code}\nSign up here: ${referralData.shareUrl}\n\nSee you there!`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <UserPlus size={64} className="mx-auto text-black/30 mb-4" />
          <h2 className="text-2xl font-black text-black mb-2">Access Required</h2>
          <p className="text-black/60 mb-6">{error}</p>
          <Link
            href="/signin"
            className="inline-flex items-center gap-2 bg-black hover:bg-black/90 text-white px-6 py-3 font-bold transition-colors"
          >
            Sign In
            <CaretRight weight="bold" />
          </Link>
        </div>
      </div>
    )
  }

  if (!referralData) {
    return null
  }

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-black/60 hover:text-black transition-colors mb-6 group"
        >
          <ArrowLeft size={20} weight="bold" className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Profile</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-black flex items-center justify-center">
              <UserPlus size={24} weight="fill" className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-black">Refer Friends</h1>
              <p className="text-black/60">Share the love and earn bonus points together!</p>
            </div>
          </div>
        </div>

        {/* Referral Code Card */}
        <div className="bg-white border border-black/10 p-6 mb-6">
          <div className="text-center mb-6">
            <p className="text-black/60 text-sm uppercase tracking-wider mb-2">Your Referral Code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-black text-black tracking-wider">
                {referralData.code}
              </span>
              <button
                onClick={copyCode}
                className={`p-3 transition-all ${
                  copied 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-black/5 hover:bg-black/10 text-black'
                }`}
              >
                {copied ? <Check weight="bold" /> : <Copy weight="bold" />}
              </button>
            </div>
          </div>

          {/* Share URL */}
          <div className="bg-black/5 p-4 mb-6">
            <p className="text-black/60 text-sm mb-2">Or share this link:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border border-black/10 px-4 py-2 text-sm text-black truncate">
                {referralData.shareUrl}
              </code>
              <button
                onClick={copyUrl}
                className={`px-4 py-2 transition-all font-medium ${
                  copiedUrl 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-black text-white hover:bg-black/90'
                }`}
              >
                {copiedUrl ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Social Share Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={shareOnFacebook}
              className="flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white py-3 px-4 font-semibold transition-colors"
            >
              <FacebookLogo weight="fill" size={20} />
              <span className="hidden sm:inline">Facebook</span>
            </button>
            <button
              onClick={shareOnTwitter}
              className="flex items-center justify-center gap-2 bg-black hover:bg-black/90 text-white py-3 px-4 font-semibold transition-colors"
            >
              <TwitterLogo weight="fill" size={20} />
              <span className="hidden sm:inline">Twitter</span>
            </button>
            <button
              onClick={shareViaEmail}
              className="flex items-center justify-center gap-2 bg-black/10 hover:bg-black/20 text-black py-3 px-4 font-semibold transition-colors"
            >
              <Envelope weight="fill" size={20} />
              <span className="hidden sm:inline">Email</span>
            </button>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white border border-black/10 p-6 mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
            <Sparkle weight="fill" className="text-black" />
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-black/5 flex items-center justify-center mx-auto mb-3">
                <Share weight="fill" size={32} className="text-black" />
              </div>
              <h3 className="font-bold mb-1">1. Share Your Code</h3>
              <p className="text-sm text-black/60">
                Send your unique referral code or link to friends
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-black/5 flex items-center justify-center mx-auto mb-3">
                <UserPlus weight="fill" size={32} className="text-black" />
              </div>
              <h3 className="font-bold mb-1">2. They Sign Up</h3>
              <p className="text-sm text-black/60">
                Your friend joins using your code and gets <span className="text-green-600 font-bold">{REFERRAL_BONUS_NEW_USER} points</span>
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-black/5 flex items-center justify-center mx-auto mb-3">
                <Gift weight="fill" size={32} className="text-black" />
              </div>
              <h3 className="font-bold mb-1">3. You Both Win!</h3>
              <p className="text-sm text-black/60">
                You earn <span className="text-green-600 font-bold">{REFERRAL_BONUS_REFERRER} points</span> when they join
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-black/10 p-4 text-center">
            <Users weight="fill" size={28} className="text-black mx-auto mb-2" />
            <p className="text-2xl font-bold text-black">{referralData.totalReferrals}</p>
            <p className="text-xs text-black/60">Friends Referred</p>
          </div>
          <div className="bg-white border border-black/10 p-4 text-center">
            <Trophy weight="fill" size={28} className="text-black mx-auto mb-2" />
            <p className="text-2xl font-bold text-black">{referralData.timesUsed}</p>
            <p className="text-xs text-black/60">Code Uses</p>
          </div>
          <div className="bg-white border border-black/10 p-4 text-center">
            <Heart weight="fill" size={28} className="text-black mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{referralData.totalPointsEarned}</p>
            <p className="text-xs text-black/60">Points Earned</p>
          </div>
        </div>

        {/* Recent Referrals */}
        {referralData.recentReferrals.length > 0 && (
          <div className="bg-white border border-black/10 p-6 mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Gift weight="fill" className="text-black" />
              Referral History
            </h2>
            <div className="space-y-3">
              {referralData.recentReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-3 bg-black/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 flex items-center justify-center">
                      <UserPlus weight="fill" className="text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-black">{referral.description}</p>
                      <p className="text-sm text-black/60">
                        {new Date(referral.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="text-green-600 font-bold">+{referral.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {referralData.recentReferrals.length === 0 && (
          <div className="bg-white border border-black/10 p-8 text-center mb-6">
            <Users weight="duotone" size={64} className="text-black/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No referrals yet</h3>
            <p className="text-black/60 max-w-md mx-auto">
              Share your referral code with friends and family to start earning bonus points!
              You&apos;ll get {REFERRAL_BONUS_REFERRER} points for each friend who joins.
            </p>
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/loyalty/rewards"
            className="flex items-center justify-between p-4 bg-white border border-black/10 hover:bg-black/5 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Gift weight="fill" className="text-black" />
              <span className="font-medium">Browse Rewards</span>
            </div>
            <CaretRight className="text-black/40 group-hover:text-black transition-colors" />
          </Link>
          <Link
            href="/loyalty/points"
            className="flex items-center justify-between p-4 bg-white border border-black/10 hover:bg-black/5 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Heart weight="fill" className="text-black" />
              <span className="font-medium">Points History</span>
            </div>
            <CaretRight className="text-black/40 group-hover:text-black transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  )
}
