import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

// Email clients won't resolve relative paths — every brand asset has to be
// served from an absolute URL. NEXT_PUBLIC_BASE_URL is the same env the rest
// of the email package uses (newsletter, order-confirmation, etc.).
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com'
const LOGO_MARK_URL = `${BASE_URL}/assets/head-over-feels-logo.png`
const WORDMARK_URL = `${BASE_URL}/assets/head-over-feels-wordmark.png`

interface ShippingNotificationEmailProps {
  orderNumber: string
  customerName: string
  trackingNumber: string
  shippingMethod: string
  trackingUrl?: string
  carrier?: string
  estimatedDelivery?: string | null
  shipToCity?: string | null
}

/**
 * Editorial customer-facing shipping notification.
 *
 * Designed to mirror the storefront's "premium streetwear" feel — cream
 * page background, large left-aligned display headline, a single dark
 * details card with monospace tracking, brand-red CTA, minimal footer.
 * Deliberately distinct from the dark workbench drawer (operator-only) so
 * the email reads as a brand artefact, not an internal tool.
 */
export const ShippingNotificationEmail = ({
  orderNumber,
  customerName,
  trackingNumber,
  shippingMethod,
  trackingUrl,
  carrier,
  estimatedDelivery,
  shipToCity,
}: ShippingNotificationEmailProps) => {
  const resolvedTrackingUrl = (() => {
    if (trackingUrl) return trackingUrl
    const method = (carrier || shippingMethod || '').toLowerCase()
    if (method.includes('usps'))
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`
    if (method.includes('ups'))
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`
    if (method.includes('fedex'))
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`
    if (method.includes('dhl'))
      return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trackingNumber)}`
    return '#'
  })()

  const formattedEta = (() => {
    if (!estimatedDelivery) return null
    const date = new Date(estimatedDelivery)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  })()

  const carrierLabel = carrier
    ? `${carrier}${shippingMethod && !shippingMethod.toLowerCase().includes(carrier.toLowerCase()) ? ` · ${shippingMethod}` : ''}`
    : shippingMethod
  const firstName = customerName?.split(' ')[0] || 'there'
  const destination = shipToCity ? ` heading to ${shipToCity}` : ' on its way'

  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>
        Order {orderNumber} is on the way{formattedEta ? ` — arrives ${formattedEta}` : ''}
      </Preview>
      <Body style={page}>
        <Container style={container}>
          {/* Brand mark band — real logo + wordmark images, absolute URLs so
              they resolve in any email client. Width/height attributes are
              required for Outlook to render at the right scale. */}
          <Section style={brandBand}>
            <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
              <tr>
                <td style={brandMarkCell}>
                  <Img
                    src={LOGO_MARK_URL}
                    alt="Head Over Feels"
                    width="36"
                    height="36"
                    style={brandMarkImg}
                  />
                </td>
                <td style={brandWordmarkCell}>
                  <Img
                    src={WORDMARK_URL}
                    alt="Head Over Feels"
                    width="140"
                    height="21"
                    style={brandWordmarkImg}
                  />
                </td>
              </tr>
            </table>
          </Section>

          <Hr style={hairline} />

          {/* Hero */}
          <Section style={hero}>
            <Text style={kicker}>Shipping update</Text>
            <Text style={display}>Your order is{' '}on the way.</Text>
            <Text style={lede}>
              Hi {firstName} — {carrierLabel || 'your carrier'} picked up your order and it&apos;s
              {destination}.
              {formattedEta ? (
                <>
                  {' '}Estimated arrival <strong style={ledeStrong}>{formattedEta}</strong>.
                </>
              ) : null}
            </Text>
          </Section>

          {/* Order details card */}
          <Section style={cardWrapper}>
            <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={card}>
              <tr>
                <td style={cardStatusRow}>
                  <span style={statusPill}>Shipped</span>
                </td>
              </tr>
              <tr>
                <td style={cardCell}>
                  <Text style={fieldLabel}>Order</Text>
                  <Text style={fieldValueMono}>{orderNumber}</Text>
                </td>
              </tr>
              <tr>
                <td style={cardCellTop}>
                  <Text style={fieldLabel}>Tracking number</Text>
                  <Text style={fieldValueTracking}>{trackingNumber}</Text>
                </td>
              </tr>
              <tr>
                <td style={cardCellTop}>
                  <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
                    <tr>
                      <td style={fieldHalf}>
                        <Text style={fieldLabel}>Carrier</Text>
                        <Text style={fieldValue}>{carrierLabel || 'Standard'}</Text>
                      </td>
                      <td style={fieldHalfRight}>
                        <Text style={fieldLabel}>Arrives</Text>
                        <Text style={fieldValue}>{formattedEta || 'Soon'}</Text>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </Section>

          {/* CTA */}
          <Section style={ctaWrap}>
            <table cellPadding={0} cellSpacing={0} role="presentation" style={{ margin: '0 auto' }}>
              <tr>
                <td>
                  <Link href={resolvedTrackingUrl} style={ctaButton}>
                    Track package &nbsp;→
                  </Link>
                </td>
              </tr>
            </table>
          </Section>

          {/* Helper note */}
          <Section style={noteWrap}>
            <Text style={noteText}>
              Tracking can take a few hours to populate after pickup. We&apos;ll email you again
              when it&apos;s out for delivery.
            </Text>
          </Section>

          <Hr style={hairline} />

          {/* Footer — wordmark closer + utility links. */}
          <Section style={footer}>
            <Img
              src={WORDMARK_URL}
              alt="Head Over Feels"
              width="160"
              height="24"
              style={footerWordmark}
            />
            <Text style={footerLinks}>
              <Link href={`${BASE_URL}/help`} style={footerLink}>Help</Link>
              {'  ·  '}
              <Link href={`${BASE_URL}/returns`} style={footerLink}>Returns</Link>
              {'  ·  '}
              <Link href={`${BASE_URL}/privacy`} style={footerLink}>Privacy</Link>
            </Text>
            <Text style={footerSupport}>
              Questions? <Link href="mailto:support@headoverfeels.com" style={footerLink}>support@headoverfeels.com</Link>
            </Text>
            <Text style={footerCopy}>© {new Date().getFullYear()} Head Over Feels. All rights reserved.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default ShippingNotificationEmail

// ===== Brand tokens =====

const brand = {
  red: '#FF3131',
  ink: '#0A0A0A',
  cream: '#F6F1EE',
  paper: '#FFFFFF',
  hairline: '#E8E0DA',
  muted: '#6B635C',
  body: '#1F1B17',
  cardBg: '#FBF7F4',
  pillBg: '#0A0A0A',
}

// Use system font stack so emails render consistently without web-font fetch.
const fontStack =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", "Inter", Helvetica, Arial, sans-serif'
const monoStack = 'ui-monospace, "SFMono-Regular", "Menlo", "Consolas", monospace'

// ===== Layout =====

const page: React.CSSProperties = {
  margin: 0,
  padding: '32px 16px',
  backgroundColor: brand.cream,
  fontFamily: fontStack,
  color: brand.body,
}

const container: React.CSSProperties = {
  margin: '0 auto',
  maxWidth: '560px',
  backgroundColor: brand.paper,
  // Sharp corners — matches the storefront's editorial cards. No box shadow.
}

const brandBand: React.CSSProperties = {
  padding: '24px 32px',
}

const brandMarkCell: React.CSSProperties = {
  width: '36px',
  verticalAlign: 'middle',
}

const brandMarkImg: React.CSSProperties = {
  display: 'block',
  width: '36px',
  height: '36px',
  border: 0,
  outline: 'none',
  textDecoration: 'none',
}

const brandWordmarkCell: React.CSSProperties = {
  paddingLeft: '12px',
  verticalAlign: 'middle',
}

const brandWordmarkImg: React.CSSProperties = {
  display: 'block',
  width: '140px',
  height: '21px',
  border: 0,
  outline: 'none',
}

const hairline: React.CSSProperties = {
  borderColor: brand.hairline,
  borderWidth: '0 0 1px',
  margin: 0,
}

const hero: React.CSSProperties = {
  padding: '32px 32px 8px',
}

const kicker: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: '11px',
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: brand.red,
  fontWeight: 700,
}

const display: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '36px',
  lineHeight: '1.05',
  letterSpacing: '-0.02em',
  fontWeight: 800,
  color: brand.ink,
}

const lede: React.CSSProperties = {
  margin: '0',
  fontSize: '16px',
  lineHeight: '1.55',
  color: brand.body,
}

const ledeStrong: React.CSSProperties = {
  color: brand.ink,
  fontWeight: 700,
}

const cardWrapper: React.CSSProperties = {
  padding: '24px 32px 0',
}

const card: React.CSSProperties = {
  border: `1px solid ${brand.hairline}`,
  backgroundColor: brand.cardBg,
}

const cardStatusRow: React.CSSProperties = {
  padding: '16px 20px 0',
}

const statusPill: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  border: `1px solid ${brand.ink}`,
  backgroundColor: brand.pillBg,
  color: brand.paper,
  fontSize: '10px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  fontWeight: 700,
}

const cardCell: React.CSSProperties = {
  padding: '16px 20px 0',
}

const cardCellTop: React.CSSProperties = {
  padding: '12px 20px 0',
}

const fieldLabel: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: '10px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: brand.muted,
  fontWeight: 700,
}

const fieldValue: React.CSSProperties = {
  margin: 0,
  fontSize: '15px',
  fontWeight: 600,
  color: brand.ink,
}

const fieldValueMono: React.CSSProperties = {
  margin: 0,
  fontSize: '15px',
  fontFamily: monoStack,
  letterSpacing: '0.04em',
  color: brand.ink,
  fontWeight: 600,
}

const fieldValueTracking: React.CSSProperties = {
  margin: 0,
  fontSize: '20px',
  fontFamily: monoStack,
  letterSpacing: '0.06em',
  color: brand.ink,
  fontWeight: 700,
}

const fieldHalf: React.CSSProperties = {
  width: '50%',
  paddingRight: '8px',
  paddingBottom: '20px',
  verticalAlign: 'top',
}

const fieldHalfRight: React.CSSProperties = {
  width: '50%',
  paddingLeft: '8px',
  paddingBottom: '20px',
  verticalAlign: 'top',
}

const ctaWrap: React.CSSProperties = {
  padding: '24px 32px 8px',
  textAlign: 'center',
}

const ctaButton: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: brand.red,
  color: brand.paper,
  textDecoration: 'none',
  padding: '14px 28px',
  fontSize: '12px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  fontWeight: 800,
  // Sharp corners.
}

const noteWrap: React.CSSProperties = {
  padding: '8px 32px 24px',
}

const noteText: React.CSSProperties = {
  margin: 0,
  fontSize: '12px',
  lineHeight: '1.55',
  color: brand.muted,
  textAlign: 'center',
}

const footer: React.CSSProperties = {
  padding: '24px 32px 32px',
  textAlign: 'center',
}

const footerWordmark: React.CSSProperties = {
  display: 'block',
  width: '160px',
  height: '24px',
  margin: '0 auto 16px',
  border: 0,
  outline: 'none',
  // Slight desaturation so the wordmark feels like a sign-off rather than
  // competing with the hero brand presence at the top.
  opacity: 0.85,
}

const footerLinks: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '12px',
  color: brand.muted,
}

const footerSupport: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '12px',
  color: brand.muted,
}

const footerLink: React.CSSProperties = {
  color: brand.ink,
  textDecoration: 'underline',
}

const footerCopy: React.CSSProperties = {
  margin: 0,
  fontSize: '11px',
  color: brand.muted,
}
