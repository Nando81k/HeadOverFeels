'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cookie, X, Settings, Check } from 'lucide-react'
import { Button } from './button'

const COOKIE_CONSENT_KEY = 'hof-cookie-consent'

interface CookiePreferences {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always required
    analytics: false,
    marketing: false,
  })

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      // Delay showing the banner for better UX
      const timer = setTimeout(() => setShowBanner(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const saveConsent = (prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      preferences: prefs,
      timestamp: new Date().toISOString(),
    }))
    setShowBanner(false)
    setShowPreferences(false)
  }

  const handleAcceptAll = () => {
    saveConsent({
      necessary: true,
      analytics: true,
      marketing: true,
    })
  }

  const handleAcceptNecessary = () => {
    saveConsent({
      necessary: true,
      analytics: false,
      marketing: false,
    })
  }

  const handleSavePreferences = () => {
    saveConsent(preferences)
  }

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:p-6"
        >
          <div className="mx-auto max-w-4xl">
            <div className="relative overflow-hidden rounded-2xl border border-[#CDA09B]/30 bg-[#F6F1EE] shadow-2xl shadow-black/10">
              {/* Decorative gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-[#CDA09B]/10 pointer-events-none" />
              
              <div className="relative p-5 md:p-6">
                {/* Main Banner Content */}
                <AnimatePresence mode="wait">
                  {!showPreferences ? (
                    <motion.div
                      key="banner"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6"
                    >
                      {/* Icon & Text */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className="flex-shrink-0 p-2.5 bg-[#FF3131]/10 rounded-xl">
                          <Cookie className="w-6 h-6 text-[#FF3131]" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-[#2B2B2B] text-base mb-1">
                            We value your privacy 🍪
                          </h3>
                          <p className="text-sm text-[#666] leading-relaxed">
                            We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
                            By clicking &quot;Accept All&quot;, you consent to our use of cookies.
                          </p>
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:flex-shrink-0">
                        <button
                          onClick={() => setShowPreferences(true)}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[#666] hover:text-[#2B2B2B] hover:bg-[#E8DFD4] rounded-xl transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Preferences
                        </button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAcceptNecessary}
                          className="text-xs"
                        >
                          Necessary Only
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAcceptAll}
                          className="bg-[#FF3131] hover:bg-[#E62B2B] text-white text-xs"
                        >
                          Accept All
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="preferences"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {/* Preferences Header */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-[#FF3131]/10 rounded-xl">
                            <Settings className="w-5 h-5 text-[#FF3131]" />
                          </div>
                          <h3 className="font-semibold text-[#2B2B2B] text-base">
                            Cookie Preferences
                          </h3>
                        </div>
                        <button
                          onClick={() => setShowPreferences(false)}
                          className="p-2 hover:bg-[#E8DFD4] rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5 text-[#666]" />
                        </button>
                      </div>

                      {/* Preference Options */}
                      <div className="space-y-3 mb-5">
                        {/* Necessary Cookies */}
                        <CookieOption
                          title="Necessary Cookies"
                          description="Essential for the website to function. Cannot be disabled."
                          checked={preferences.necessary}
                          disabled
                          onChange={() => {}}
                        />
                        
                        {/* Analytics Cookies */}
                        <CookieOption
                          title="Analytics Cookies"
                          description="Help us understand how visitors interact with our website."
                          checked={preferences.analytics}
                          onChange={(checked) => setPreferences(p => ({ ...p, analytics: checked }))}
                        />
                        
                        {/* Marketing Cookies */}
                        <CookieOption
                          title="Marketing Cookies"
                          description="Used to track visitors for displaying relevant ads."
                          checked={preferences.marketing}
                          onChange={(checked) => setPreferences(p => ({ ...p, marketing: checked }))}
                        />
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-end gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPreferences(false)}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSavePreferences}
                          className="bg-[#FF3131] hover:bg-[#E62B2B] text-white text-xs"
                        >
                          <Check className="w-4 h-4" />
                          Save Preferences
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface CookieOptionProps {
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

function CookieOption({ title, description, checked, disabled, onChange }: CookieOptionProps) {
  return (
    <label className={`flex items-start gap-4 p-3 rounded-xl border transition-colors ${
      disabled 
        ? 'border-[#CDA09B]/30 bg-[#CDA09B]/5 cursor-not-allowed' 
        : 'border-[#CDA09B]/30 hover:border-[#CDA09B]/50 hover:bg-white/50 cursor-pointer'
    }`}>
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className={`w-5 h-5 rounded-md border-2 transition-colors ${
          checked 
            ? 'bg-[#FF3131] border-[#FF3131]' 
            : 'border-[#CDA09B] bg-white'
        } ${disabled ? 'opacity-60' : ''}`}>
          {checked && (
            <Check className="w-full h-full text-white p-0.5" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-[#2B2B2B]">{title}</span>
          {disabled && (
            <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-[#CDA09B]/20 text-[#666] rounded-full">
              Required
            </span>
          )}
        </div>
        <p className="text-xs text-[#666] mt-0.5">{description}</p>
      </div>
    </label>
  )
}
