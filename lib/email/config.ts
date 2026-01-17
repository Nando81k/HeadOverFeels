import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not defined in environment variables')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

// In development/testing, use Resend's test sender. In production, use your verified domain.
const defaultFrom = process.env.NODE_ENV === 'production' 
  ? 'Head Over Feels <orders@headoverfeels.com>'
  : 'Head Over Feels <onboarding@resend.dev>'

export const emailConfig = {
  from: process.env.EMAIL_FROM || defaultFrom,
  replyTo: process.env.EMAIL_REPLY_TO || 'support@headoverfeels.com',
}
