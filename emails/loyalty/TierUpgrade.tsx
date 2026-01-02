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

interface TierUpgradeEmailProps {
  customerName: string;
  previousTierName: string;
  newTierName: string;
  newTierColor: string;
  pointMultiplier: string;
  freeShipping: boolean;
  earlyDropAccess: boolean;
  currentPoints: number;
}

export const TierUpgradeEmail = ({
  customerName,
  previousTierName,
  newTierName,
  newTierColor,
  pointMultiplier,
  freeShipping,
  earlyDropAccess,
  currentPoints,
}: TierUpgradeEmailProps) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com';

  return (
    <Html>
      <Head />
      <Preview>🎉 Congrats! You've been upgraded to {newTierName} tier!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>Head Over Feels</Heading>
            <Text style={tagline}>Care Points Loyalty Program</Text>
          </Section>

          {/* Celebration Banner */}
          <Section style={{ ...celebrationBanner, backgroundColor: newTierColor }}>
            <Text style={celebrationEmoji}>🎉 🌟 🎉</Text>
            <Heading style={celebrationTitle}>You&apos;ve Leveled Up!</Heading>
          </Section>

          {/* Main Message */}
          <Section style={content}>
            <Text style={text}>
              Hi {customerName},
            </Text>
            <Text style={text}>
              Amazing news! Your dedication to self-care and style has paid off.
              You&apos;ve been upgraded from <strong>{previousTierName}</strong> to our
              exclusive <strong style={{ color: newTierColor }}>{newTierName}</strong> tier!
            </Text>
          </Section>

          {/* New Benefits */}
          <Section style={benefitsBox}>
            <Heading style={h3}>Your New {newTierName} Benefits:</Heading>
            
            <div style={benefitItem}>
              <Text style={benefitIcon}>✨</Text>
              <Text style={benefitText}>
                <strong>{pointMultiplier}x Points</strong> - Earn points faster on every purchase
              </Text>
            </div>

            {freeShipping && (
              <div style={benefitItem}>
                <Text style={benefitIcon}>📦</Text>
                <Text style={benefitText}>
                  <strong>Free Shipping</strong> - On all orders, always
                </Text>
              </div>
            )}

            {earlyDropAccess && (
              <div style={benefitItem}>
                <Text style={benefitIcon}>⚡</Text>
                <Text style={benefitText}>
                  <strong>Early Drop Access</strong> - Shop limited releases before anyone else
                </Text>
              </div>
            )}

            <div style={benefitItem}>
              <Text style={benefitIcon}>🎁</Text>
              <Text style={benefitText}>
                <strong>Exclusive Rewards</strong> - Access tier-only rewards and perks
              </Text>
            </div>
          </Section>

          {/* Points Balance */}
          <Section style={pointsBox}>
            <Text style={pointsLabel}>Your Current Balance</Text>
            <Text style={pointsAmount}>{currentPoints.toLocaleString()} Care Points</Text>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Button style={ctaButton} href={`${baseUrl}/loyalty/rewards`}>
              Explore Your Rewards
            </Button>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Thank you for being part of our community. Your support means the world to us. 💙
            </Text>
            <Text style={footerLinks}>
              <Link href={`${baseUrl}/shop`} style={footerLink}>Shop</Link>
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

export default TierUpgradeEmail;

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

const celebrationBanner = {
  textAlign: 'center' as const,
  padding: '32px 24px',
};

const celebrationEmoji = {
  fontSize: '48px',
  margin: '0 0 16px',
};

const celebrationTitle = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: '800',
  margin: '0',
  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
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

const benefitsBox = {
  backgroundColor: '#ffffff',
  padding: '24px 40px 32px',
  borderTop: '1px solid #e5e7eb',
};

const benefitItem = {
  display: 'flex',
  alignItems: 'flex-start',
  marginBottom: '12px',
};

const benefitIcon = {
  fontSize: '20px',
  margin: '0 12px 0 0',
  flexShrink: 0,
};

const benefitText = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0',
};

const pointsBox = {
  backgroundColor: '#f3f4f6',
  padding: '24px 40px',
  textAlign: 'center' as const,
};

const pointsLabel = {
  color: '#6b7280',
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  margin: '0 0 4px',
};

const pointsAmount = {
  color: '#111827',
  fontSize: '32px',
  fontWeight: '800',
  margin: '0',
};

const ctaSection = {
  backgroundColor: '#ffffff',
  padding: '24px 40px 32px',
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

const divider = {
  borderColor: '#e5e7eb',
  margin: '0',
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
