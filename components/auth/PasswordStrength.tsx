'use client'

import { useMemo } from 'react'
import { Check, X } from '@phosphor-icons/react'

interface PasswordStrengthProps {
  password: string
  showRequirements?: boolean
}

interface PasswordRequirement {
  label: string
  met: boolean
}

export function PasswordStrength({ password, showRequirements = true }: PasswordStrengthProps) {
  const requirements = useMemo<PasswordRequirement[]>(() => {
    return [
      {
        label: 'At least 8 characters',
        met: password.length >= 8,
      },
      {
        label: 'Contains uppercase letter',
        met: /[A-Z]/.test(password),
      },
      {
        label: 'Contains lowercase letter',
        met: /[a-z]/.test(password),
      },
      {
        label: 'Contains number',
        met: /[0-9]/.test(password),
      },
      {
        label: 'Contains special character (!@#$%^&*)',
        met: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      },
    ]
  }, [password])

  const strength = useMemo(() => {
    const metCount = requirements.filter((r) => r.met).length
    const percentage = (metCount / requirements.length) * 100

    if (percentage === 0) return { level: 'none', color: 'bg-gray-200', label: '' }
    if (percentage < 40) return { level: 'weak', color: 'bg-red-500', label: 'Weak' }
    if (percentage < 60) return { level: 'fair', color: 'bg-orange-500', label: 'Fair' }
    if (percentage < 80) return { level: 'good', color: 'bg-yellow-500', label: 'Good' }
    return { level: 'strong', color: 'bg-green-500', label: 'Strong' }
  }, [requirements])

  const metCount = requirements.filter((r) => r.met).length

  if (!password) return null

  return (
    <div className="space-y-3">
      {/* Strength Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-[#6B6B6B]">Password Strength</span>
          {strength.label && (
            <span
              className={`font-medium ${
                strength.level === 'weak'
                  ? 'text-red-600'
                  : strength.level === 'fair'
                  ? 'text-orange-600'
                  : strength.level === 'good'
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`}
            >
              {strength.label}
            </span>
          )}
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${strength.color}`}
            style={{ width: `${(metCount / requirements.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Requirements List */}
      {showRequirements && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#6B6B6B]">Password Requirements:</p>
          <ul className="space-y-1">
            {requirements.map((req, index) => (
              <li
                key={index}
                className={`flex items-center gap-2 text-xs transition-colors ${
                  req.met ? 'text-green-600' : 'text-[#6B6B6B]'
                }`}
              >
                {req.met ? (
                  <Check size={24} weight="bold" className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <X size={24} weight="bold" className="w-3.5 h-3.5 flex-shrink-0 opacity-30" />
                )}
                <span>{req.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
