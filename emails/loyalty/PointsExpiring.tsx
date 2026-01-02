import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Button,
} from '@react-email/components';
import * as React from 'react';

interface PointsExpiringEmailProps {
  customerName: string;
  expiringPoints: number;
  expirationDate: string;
  daysUntilExpiration: number;
  currentPoints: number;
  suggestedRewards: Array<{
    name: string;
    pointsCost: number;
  }>;
}

export const PointsExpiringEmail = ({
  customerName,
  expiringPoints,
  expirationDate,
  daysUntilExpiration,
  currentPoints,
  suggestedRewards = [],
}: PointsExpiringEmailProps) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com';
  const urgencyColor = daysUntilExpiration <= 7 ? '#dc2626' : '#f59e0b';

  return (
    <Html>
      <Head />
      <Preview>{`⏰ ${expiringPoints.toLocaleString()} Care Points expiring in ${daysUntilExpiration} days!`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>Head Over Feels</Heading>
            <Text style={tagline}>Care Points Loyalty Program</Text>
          </Section>

          {/* Urgency Banner */}
          <Section style={{ ...urgencyBanner, backgroundColor: urgencyColor }}>
            <Text style={urgencyIcon}>⏰</Text>
            <Heading style={urgencyTitle}>
              {daysUntilExpiration <= 7 ? 'Points Expiring Soon!' : 'Reminder: Points Expiring'}
            </Heading>
          </Section>

          {/* Main Message */}
          <Section style={content}>
            <Text style={text}>
              Hi {customerName},
            </Text>
            <Text style={text}>
              {daysUntilExpiration <= 7 
                ? `Quick heads up! You have Care Points that will expire in just ${daysUntilExpiration} days. Don't let them go to waste!`
                : `Friendly reminder - some of your Care Points will be expiring on ${expirationDate}. There's still time to use them!`
              }
            </Text>
          </Section>

          {/* Points Expiring Box */}
          <Section style={expiryBox}>
            <div style={expiryRow}>
              <div style={expiryItem}>
                <Text style={expiryLabel}>Points Expiring</Text>
                <Text style={{ ...expiryAmount, color: urgencyColor }}>{expiringPoints.toLocaleString()}</Text>
              </div>
              <div style={expiryDivider}></div>
              <div style={expiryItem}>
                <Text style={expiryLabel}>Expires On</Text>
                <Text style={expiryDate}>{expirationDate}</Text>
              </div>
            </div>
            <div style={currentPointsRow}>
              <Text style={currentPointsLabel}>Your Total Balance:</Text>
              <Text style={currentPointsValue}>{currentPoints.toLocaleString()} Care Points</Text>
            </div>
          </Section>

          {/* Suggested Rewards */}
          {suggestedRewards.length > 0 && (
            <Section style={suggestionsBox}>
              <Heading style={h3}>Rewards You Can Claim:</Heading>
              {suggestedRewards.map((reward, index) => (
                <div key={index} style={rewardItem}>
                  <Text style={rewardName}>{reward.name}</Text>
                  <Text style={rewardCost}>{reward.pointsCost.toLocaleString()} pts</Text>
                </div>
              ))}
            </Section>
          )}

          {/* CTA */}
          <Section style={ctaSection}>
            <Button style={ctaButton} href={`${baseUrl}/loyalty/rewards`}>
              Redeem Your Points Now
            </Button>
            <Text style={ctaSubtext}>
              Or use them at checkout on your next purchase!
            </Text>
          </Section>

          <Hr style={divider} />

          {/* How It Works */}
          <Section style={infoBox}>
            <Heading style={h4}>How Care Points Work:</Heading>
            <Text style={infoText}>
              • Points earned from purchases expire 12 months after they&apos;re earned
            </Text>
            <Text style={infoText}>
              • Redeem points for discounts, free shipping, exclusive access, and more
            </Text>
            <Text style={infoText}>
              • Keep earning to maintain your points and tier status!
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Need help? We&apos;re here for you. Reply to this email or visit our support page.
            </Text>
            <Text style={footerLinks}>
              <Link href={`${baseUrl}/shop`} style={footerLink}>Shop Now</Link>
              {' • '}
              <Link href={`${baseUrl}/loyalty/rewards`} style={footerLink}>Rewards</Link>
              {' • '}
              <Link href={`${baseUrl}/contact`} style={footerLink}>Contact Us</Link>
            </Text>
            <Text style={footerAddress}>
              Head Over Feels | Premium Streetwear
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default PointsExpiringEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '600px',
};

const header = {
  textAlign: 'center' as const,
  padding: '32px 24px',
  backgroundColor: '#000000',
};

const h1 = {
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: '800',
  margin: '0 0 8px',
  letterSpacing: '-0.5px',
};

const tagline = {
  color: '#ffffff',
  opacity: 0.8,
  fontSize: '14px',
  margin: '0',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
};

const urgencyBanner = {
  textAlign: 'center' as const,
  padding: '24px',
};

const urgencyIcon = {
  fontSize: '40px',
  margin: '0 0 8px',
};

const urgencyTitle = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: '800',
  margin: '0',
};

const content = {
  backgroundColor: '#ffffff',
  padding: '32px 40px',
};

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
};

const h3 = {
  color: '#111827',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0 0 16px',
};

const h4 = {
  color: '#6b7280',
  fontSize: '14px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 12px',
};

const expiryBox = {
  backgroundColor: '#fef3c7',
  padding: '24px 32px',
  borderRadius: '8px',
  margin: '0 40px 24px',
};

const expiryRow = {
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  marginBottom: '16px',
};

const expiryItem = {
  textAlign: 'center' as const,
};

const expiryDivider = {
  width: '1px',
  height: '48px',
  backgroundColor: '#fbbf24',
};

const expiryLabel = {
  color: '#92400e',
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 4px',
};

const expiryAmount = {
  fontSize: '28px',
  fontWeight: '800',
  margin: '0',
};

const expiryDate = {
  color: '#92400e',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0',
};

const currentPointsRow = {
  borderTop: '1px solid #fbbf24',
  paddingTop: '12px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const currentPointsLabel = {
  color: '#92400e',
  fontSize: '14px',
  margin: '0',
};

const currentPointsValue = {
  color: '#78350f',
  fontSize: '16px',
  fontWeight: '700',
  margin: '0',
};

const suggestionsBox = {
  backgroundColor: '#ffffff',
  padding: '0 40px 24px',
};

const rewardItem = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  backgroundColor: '#f9fafb',
  borderRadius: '6px',
  marginBottom: '8px',
};

const rewardName = {
  color: '#374151',
  fontSize: '15px',
  fontWeight: '500',
  margin: '0',
};

const rewardCost = {
  color: '#6b7280',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0',
};

const ctaSection = {
  backgroundColor: '#ffffff',
  padding: '8px 40px 32px',
  textAlign: 'center' as const,
};

const ctaButton = {
  backgroundColor: '#000000',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
};

const ctaSubtext = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '16px 0 0',
};

const divider = {
  borderColor: '#e5e7eb',
  margin: '0',
};

const infoBox = {
  backgroundColor: '#f9fafb',
  padding: '24px 40px',
};

const infoText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px',
};

const footer = {
  backgroundColor: '#ffffff',
  padding: '32px 40px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0 0 16px',
};

const footerLinks = {
  margin: '0 0 16px',
};

const footerLink = {
  color: '#000000',
  fontSize: '14px',
  textDecoration: 'none',
};

const footerAddress = {
  color: '#9ca3af',
  fontSize: '12px',
  margin: '0',
};
