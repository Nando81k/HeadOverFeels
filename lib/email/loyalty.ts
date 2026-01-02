import { Resend } from 'resend'
import { render } from '@react-email/components'
import TierUpgradeEmail from '@/emails/loyalty/TierUpgrade'
import PointsExpiringEmail from '@/emails/loyalty/PointsExpiring'
import BirthdayBonusEmail from '@/emails/loyalty/BirthdayBonus'
import ReferralSuccessEmail from '@/emails/loyalty/ReferralSuccess'
import { prisma } from '@/lib/prisma'

// Initialize Resend client - only if API key is available
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const fromAddress = process.env.EMAIL_FROM || 'Head Over Feels <loyalty@headoverfeels.com>'

// ===== TIER UPGRADE NOTIFICATION =====

interface SendTierUpgradeParams {
  customerEmail: string
  customerName: string
  previousTierName: string
  newTierName: string
  newTierColor: string
  pointMultiplier: number
  freeShipping: boolean
  earlyDropAccess: boolean
  currentPoints: number
}

export async function sendTierUpgradeEmail(params: SendTierUpgradeParams) {
  if (!resend) {
    console.warn('Resend API key not configured - skipping tier upgrade email')
    return { success: false, data: null }
  }

  try {
    const emailHtml = await render(
      TierUpgradeEmail({
        customerName: params.customerName,
        previousTierName: params.previousTierName,
        newTierName: params.newTierName,
        newTierColor: params.newTierColor,
        pointMultiplier: params.pointMultiplier.toFixed(2),
        freeShipping: params.freeShipping,
        earlyDropAccess: params.earlyDropAccess,
        currentPoints: params.currentPoints,
      })
    )

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: params.customerEmail,
      subject: `🎉 Congrats! You've been upgraded to ${params.newTierName} tier!`,
      html: emailHtml,
    })

    if (error) {
      console.error('Error sending tier upgrade email:', error)
      throw new Error(`Failed to send tier upgrade email: ${error.message}`)
    }

    console.log(`Tier upgrade email sent to ${params.customerEmail}:`, data)
    return { success: true, data }
  } catch (error) {
    console.error('Failed to send tier upgrade email:', error)
    return { success: false, error }
  }
}

// ===== POINTS EXPIRING NOTIFICATION =====

interface SendPointsExpiringParams {
  customerEmail: string
  customerName: string
  expiringPoints: number
  expirationDate: Date
  daysUntilExpiration: number
  currentPoints: number
}

export async function sendPointsExpiringEmail(params: SendPointsExpiringParams) {
  if (!resend) {
    console.warn('Resend API key not configured - skipping points expiring email')
    return { success: false, data: null }
  }

  try {
    // Get available rewards for suggestions
    const rewards = await prisma.reward.findMany({
      where: {
        isActive: true,
        pointsCost: { lte: params.currentPoints },
      },
      orderBy: { pointsCost: 'desc' },
      take: 3,
    })

    const suggestedRewards = rewards.map(r => ({
      name: r.name,
      pointsCost: r.pointsCost,
    }))

    const formattedDate = params.expirationDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    const emailHtml = await render(
      PointsExpiringEmail({
        customerName: params.customerName,
        expiringPoints: params.expiringPoints,
        expirationDate: formattedDate,
        daysUntilExpiration: params.daysUntilExpiration,
        currentPoints: params.currentPoints,
        suggestedRewards,
      })
    )

    const urgencyEmoji = params.daysUntilExpiration <= 7 ? '⚠️' : '⏰'
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: params.customerEmail,
      subject: `${urgencyEmoji} ${params.expiringPoints.toLocaleString()} Care Points expiring in ${params.daysUntilExpiration} days!`,
      html: emailHtml,
    })

    if (error) {
      console.error('Error sending points expiring email:', error)
      throw new Error(`Failed to send points expiring email: ${error.message}`)
    }

    console.log(`Points expiring email sent to ${params.customerEmail}:`, data)
    return { success: true, data }
  } catch (error) {
    console.error('Failed to send points expiring email:', error)
    return { success: false, error }
  }
}

// ===== BIRTHDAY BONUS NOTIFICATION =====

interface SendBirthdayBonusParams {
  customerEmail: string
  customerName: string
  pointsAwarded: number
  currentPoints: number
  tierName: string
}

export async function sendBirthdayBonusEmail(params: SendBirthdayBonusParams) {
  if (!resend) {
    console.warn('Resend API key not configured - skipping birthday bonus email')
    return { success: false, data: null }
  }

  try {
    const emailHtml = await render(
      BirthdayBonusEmail({
        customerName: params.customerName,
        pointsAwarded: params.pointsAwarded,
        currentPoints: params.currentPoints,
        tierName: params.tierName,
      })
    )

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: params.customerEmail,
      subject: `🎂 Happy Birthday, ${params.customerName}! Here's a gift from us!`,
      html: emailHtml,
    })

    if (error) {
      console.error('Error sending birthday bonus email:', error)
      throw new Error(`Failed to send birthday bonus email: ${error.message}`)
    }

    console.log(`Birthday bonus email sent to ${params.customerEmail}:`, data)
    return { success: true, data }
  } catch (error) {
    console.error('Failed to send birthday bonus email:', error)
    return { success: false, error }
  }
}

// ===== REFERRAL SUCCESS NOTIFICATION =====

interface SendReferralSuccessParams {
  referrerEmail: string
  referrerName: string
  referredName: string
  pointsEarned: number
  currentPoints: number
}

export async function sendReferralSuccessEmail(params: SendReferralSuccessParams) {
  if (!resend) {
    console.warn('Resend API key not configured - skipping referral success email')
    return { success: false, data: null }
  }

  try {
    // Get referrer's customer ID to count total referrals
    const referrer = await prisma.customer.findUnique({
      where: { email: params.referrerEmail },
      select: { id: true },
    })

    // Get total referral count (customers who have this referrer's ID)
    const totalReferrals = referrer ? await prisma.customer.count({
      where: {
        referredBy: referrer.id,
      },
    }) : 1

    const emailHtml = await render(
      ReferralSuccessEmail({
        referrerName: params.referrerName,
        referredName: params.referredName,
        pointsEarned: params.pointsEarned,
        currentPoints: params.currentPoints,
        totalReferrals: totalReferrals || 1, // At least 1 since we just had one
      })
    )

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: params.referrerEmail,
      subject: `🎉 ${params.referredName} used your referral code! +${params.pointsEarned} Care Points`,
      html: emailHtml,
    })

    if (error) {
      console.error('Error sending referral success email:', error)
      throw new Error(`Failed to send referral success email: ${error.message}`)
    }

    console.log(`Referral success email sent to ${params.referrerEmail}:`, data)
    return { success: true, data }
  } catch (error) {
    console.error('Failed to send referral success email:', error)
    return { success: false, error }
  }
}

// ===== HELPER: TIER COLORS =====
export const TIER_COLORS: Record<string, string> = {
  head: '#6b7280',      // Gray
  heart: '#ec4899',     // Pink
  mind: '#8b5cf6',      // Purple
  overdrive: '#f59e0b', // Amber/Gold
}

export function getTierColor(tierSlug: string): string {
  return TIER_COLORS[tierSlug.toLowerCase()] || '#000000'
}
