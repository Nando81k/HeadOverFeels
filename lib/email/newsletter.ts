import { emailConfig, resend } from '@/lib/email/config'
import { normalizeNewsletterEmail } from '@/lib/newsletter/types'

export interface NewsletterTemplateInput {
  subject: string
  preheader?: string | null
  heroImageUrl?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  bodyMarkdown: string
  recipientEmail: string
}

interface SendNewsletterEmailParams extends NewsletterTemplateInput {
  testMode?: boolean
}

interface SendNewsletterEmailResult {
  success: boolean
  messageId: string | null
  error: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderSimpleMarkdown(markdown: string): string {
  const escaped = escapeHtml(markdown)
  const linked = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#111111;text-decoration:underline;">$1</a>')
  const bold = linked.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  return bold
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 14px 0;line-height:1.6;color:#111111;font-size:15px;">${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('')
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com'
}

function toAbsoluteUrl(url: string): string {
  if (url.startsWith('/')) {
    return `${getBaseUrl()}${url}`
  }

  try {
    return new URL(url).toString()
  } catch {
    return `${getBaseUrl()}/${url.replace(/^\/+/, '')}`
  }
}

function getUnsubscribeUrl(email: string): string {
  return `${getBaseUrl()}/api/newsletter?email=${encodeURIComponent(email)}&reason=newsletter_email_link`
}

export function renderNewsletterEmailTemplate(input: NewsletterTemplateInput) {
  const recipientEmail = normalizeNewsletterEmail(input.recipientEmail)
  const preheader = input.preheader?.trim() || 'Latest updates from Head Over Feels'
  const htmlBody = renderSimpleMarkdown(input.bodyMarkdown || '')
  const unsubscribeUrl = getUnsubscribeUrl(recipientEmail)
  const resolvedCtaUrl = input.ctaUrl ? toAbsoluteUrl(input.ctaUrl) : null
  const resolvedHeroImageUrl = input.heroImageUrl ? toAbsoluteUrl(input.heroImageUrl) : null

  const ctaButton = input.ctaLabel && resolvedCtaUrl
    ? `<div style="margin:22px 0 20px 0;"><a href="${escapeHtml(resolvedCtaUrl)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:12px 18px;font-weight:700;letter-spacing:0.02em;">${escapeHtml(input.ctaLabel)}</a></div>`
    : ''

  const heroImage = resolvedHeroImageUrl
    ? `<div style="margin:0 0 20px 0;"><img src="${escapeHtml(resolvedHeroImageUrl)}" alt="Newsletter hero" style="display:block;width:100%;height:auto;border:1px solid #e5e5e5;" /></div>`
    : ''

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(input.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e5e5;">
            <tr>
              <td style="padding:28px 24px 24px 24px;">
                <p style="margin:0 0 14px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#666666;">Head Over Feels</p>
                <h1 style="margin:0 0 18px 0;font-size:28px;line-height:1.2;color:#111111;">${escapeHtml(input.subject)}</h1>
                ${heroImage}
                ${htmlBody}
                ${ctaButton}
                <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0 14px 0;" />
                <p style="margin:0;color:#666666;font-size:12px;line-height:1.5;">
                  You are receiving this email because you subscribed to Head Over Feels updates.
                  <a href="${unsubscribeUrl}" style="color:#111111;text-decoration:underline;">Unsubscribe</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = `${input.subject}\n\n${input.bodyMarkdown}\n\n${input.ctaLabel && resolvedCtaUrl ? `${input.ctaLabel}: ${resolvedCtaUrl}\n\n` : ''}Unsubscribe: ${unsubscribeUrl}`

  return {
    subject: input.subject,
    html,
    text,
    preheader,
    unsubscribeUrl,
  }
}

function isRetryableSendError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('rate') ||
    message.includes('429') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('temporary')
  )
}

export async function sendNewsletterEmail(params: SendNewsletterEmailParams): Promise<SendNewsletterEmailResult> {
  const recipientEmail = normalizeNewsletterEmail(params.recipientEmail)
  const rendered = renderNewsletterEmailTemplate({
    subject: params.subject,
    preheader: params.preheader,
    heroImageUrl: params.heroImageUrl,
    ctaLabel: params.ctaLabel,
    ctaUrl: params.ctaUrl,
    bodyMarkdown: params.bodyMarkdown,
    recipientEmail,
  })

  let lastError: string | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await resend.emails.send({
        from: emailConfig.from,
        to: recipientEmail,
        replyTo: emailConfig.replyTo,
        subject: params.testMode ? `[TEST] ${rendered.subject}` : rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          'List-Unsubscribe': `<${rendered.unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }) as { data?: { id?: string | null } | null; error?: { message?: string | null } | null }

      if (response.error?.message) {
        throw new Error(response.error.message)
      }

      return {
        success: true,
        messageId: response.data?.id || null,
        error: null,
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      const canRetry = attempt === 0 && isRetryableSendError(error)
      if (!canRetry) {
        break
      }
    }
  }

  return {
    success: false,
    messageId: null,
    error: lastError || 'Failed to send newsletter email',
  }
}
