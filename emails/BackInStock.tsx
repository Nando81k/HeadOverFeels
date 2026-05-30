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

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com'
const LOGO_MARK_URL = `${BASE_URL}/assets/head-over-feels-logo.png`
const WORDMARK_URL = `${BASE_URL}/assets/head-over-feels-wordmark.png`

export interface BackInStockEmailProps {
  customerName?: string
  productName: string
  productImage?: string
  productUrl: string
  unsubscribeUrl: string
}

/**
 * Back-in-stock notification email.
 *
 * Visual style matches ShippingNotification — cream page background, large
 * left-aligned display headline, brand-red CTA, minimal footer with
 * unsubscribe link.
 */
export const BackInStockEmail = ({
  customerName,
  productName,
  productImage,
  productUrl,
  unsubscribeUrl,
}: BackInStockEmailProps) => {
  const firstName = customerName?.split(' ')[0] || 'there'

  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{productName} is back in stock — grab yours before it sells out again.</Preview>
      <Body style={page}>
        <Container style={container}>
          {/* Brand band */}
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
            <Text style={kicker}>Back in stock</Text>
            <Text style={display}>Good news, {firstName}.</Text>
            <Text style={lede}>
              <strong style={ledeStrong}>{productName}</strong> is back in stock. These tend to sell
              out fast — head over now to secure yours.
            </Text>
          </Section>

          {/* Product card */}
          <Section style={cardWrapper}>
            <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={card}>
              <tr>
                <td style={cardStatusRow}>
                  <span style={statusPill}>Available Now</span>
                </td>
              </tr>
              {productImage ? (
                <tr>
                  <td style={productImageCell}>
                    <Img
                      src={productImage}
                      alt={productName}
                      width="496"
                      style={productImageStyle}
                    />
                  </td>
                </tr>
              ) : null}
              <tr>
                <td style={cardCell}>
                  <Text style={fieldLabel}>Product</Text>
                  <Text style={fieldValue}>{productName}</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* CTA */}
          <Section style={ctaWrap}>
            <table cellPadding={0} cellSpacing={0} role="presentation" style={{ margin: '0 auto' }}>
              <tr>
                <td>
                  <Link href={productUrl} style={ctaButton}>
                    Shop now &nbsp;→
                  </Link>
                </td>
              </tr>
            </table>
          </Section>

          {/* Note */}
          <Section style={noteWrap}>
            <Text style={noteText}>
              Stock is limited — this item sold out before. We can&apos;t guarantee availability
              for long.
            </Text>
          </Section>

          <Hr style={hairline} />

          {/* Footer */}
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
              Questions?{' '}
              <Link href="mailto:support@headoverfeels.com" style={footerLink}>
                support@headoverfeels.com
              </Link>
            </Text>
            <Text style={footerUnsub}>
              You received this because you signed up for back-in-stock alerts.{' '}
              <Link href={unsubscribeUrl} style={footerLink}>Unsubscribe</Link>
            </Text>
            <Text style={footerCopy}>
              © {new Date().getFullYear()} Head Over Feels. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default BackInStockEmail

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

const fontStack =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", "Inter", Helvetica, Arial, sans-serif'

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

const productImageCell: React.CSSProperties = {
  padding: '16px 0 0',
}

const productImageStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  border: 0,
  outline: 'none',
}

const cardCell: React.CSSProperties = {
  padding: '16px 20px 20px',
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
  opacity: 0.85,
}

const footerLinks: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '12px',
  color: brand.muted,
}

const footerSupport: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '12px',
  color: brand.muted,
}

const footerUnsub: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '11px',
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
