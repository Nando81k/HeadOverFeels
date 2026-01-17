import { resend, emailConfig } from './config'
import { generateEmailVerificationEmail } from './templates/email-verification'
import { generatePasswordResetEmail } from './templates/password-reset'
import { generateWelcomeEmail } from './templates/welcome'

interface SendVerificationEmailParams {
  email: string
  name: string
  verificationToken: string
}

interface SendPasswordResetEmailParams {
  email: string
  name: string
  resetToken: string
}

interface SendWelcomeEmailParams {
  email: string
  name: string
}

export async function sendVerificationEmail(params: SendVerificationEmailParams) {
  const { email, name, verificationToken } = params
  
  const emailContent = generateEmailVerificationEmail({
    name,
    email,
    verificationToken,
  })

  try {
    const { data, error } = await resend.emails.send({
      from: emailConfig.from,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    })

    if (error) {
      console.error('Failed to send verification email:', error)
      throw new Error(`Failed to send verification email: ${error.message}`)
    }

    console.log(`Verification email sent to ${email}`, data)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Error sending verification email:', error)
    throw error
  }
}

export async function sendPasswordResetEmail(params: SendPasswordResetEmailParams) {
  const { email, name, resetToken } = params
  
  const emailContent = generatePasswordResetEmail({
    name,
    email,
    resetToken,
  })

  try {
    const { data, error } = await resend.emails.send({
      from: emailConfig.from,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    })

    if (error) {
      console.error('Failed to send password reset email:', error)
      throw new Error(`Failed to send password reset email: ${error.message}`)
    }

    console.log(`Password reset email sent to ${email}`, data)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Error sending password reset email:', error)
    throw error
  }
}

export async function sendWelcomeEmail(params: SendWelcomeEmailParams) {
  const { email, name } = params
  
  const emailContent = generateWelcomeEmail({
    name,
    email,
  })

  try {
    const { data, error } = await resend.emails.send({
      from: emailConfig.from,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    })

    if (error) {
      console.error('Failed to send welcome email:', error)
      // Don't throw for welcome emails - they're not critical
      return { success: false, error: error.message }
    }

    console.log(`Welcome email sent to ${email}`, data)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Error sending welcome email:', error)
    // Don't throw for welcome emails - they're not critical
    return { success: false, error: String(error) }
  }
}
