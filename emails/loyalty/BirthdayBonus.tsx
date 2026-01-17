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

interface BirthdayBonusEmailProps {
  customerName: string;
  pointsAwarded: number;
  currentPoints: number;
  tierName: string;
}

export const BirthdayBonusEmail = ({
  customerName,
  pointsAwarded,
  currentPoints,
  tierName,
}: BirthdayBonusEmailProps) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com';

  return (
    <Html>
      <Head />
      <Preview>🎂 Happy Birthday, {customerName}! Here&apos;s a special gift from us!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>Head Over Feels</Heading>
            <Text style={tagline}>Care Points Loyalty Program</Text>
          </Section>

          {/* Birthday Banner */}
          <Section style={birthdayBanner}>
            <Text style={birthdayEmojis}>🎂 🎉 🎁 🎈</Text>
            <Heading style={birthdayTitle}>Happy Birthday!</Heading>
          </Section>

          {/* Main Message */}
          <Section style={content}>
            <Text style={greeting}>
              Dear {customerName},
            </Text>
            <Text style={text}>
              It&apos;s your special day and we couldn&apos;t let it pass without celebrating YOU!
              Thank you for being an amazing part of the Head Over Feels family.
            </Text>
            <Text style={text}>
              As a birthday treat, we&apos;ve added some extra Care Points to your account. 💙
            </Text>
          </Section>

          {/* Points Gift Box */}
          <Section style={giftBox}>
            <Text style={giftLabel}>Your Birthday Gift</Text>
            <Text style={giftAmount}>+{pointsAwarded} Care Points</Text>
            <Text style={giftNote}>Added to your {tierName} account</Text>
          </Section>

          {/* New Balance */}
          <Section style={balanceBox}>
            <div style={balanceRow}>
              <Text style={balanceLabel}>Your New Balance:</Text>
              <Text style={balanceAmount}>{currentPoints.toLocaleString()} pts</Text>
            </div>
          </Section>

          {/* Birthday Suggestions */}
          <Section style={suggestionsSection}>
            <Heading style={h3}>Treat Yourself Today 🎁</Heading>
            <Text style={suggestionText}>
              Your birthday is the perfect excuse for a little self-care.
              Browse our collection or redeem your points for something special!
            </Text>
            
            <div style={buttonRow}>
              <Button style={primaryButton} href={`${baseUrl}/shop`}>
                Shop Collection
              </Button>
              <Button style={secondaryButton} href={`${baseUrl}/loyalty/rewards`}>
                View Rewards
              </Button>
            </div>
          </Section>

          <Hr style={divider} />

          {/* Fun Facts */}
          <Section style={funFactsBox}>
            <Text style={funFactTitle}>Did you know?</Text>
            <Text style={funFactText}>
              🌟 You&apos;re part of an exclusive community of people who prioritize self-expression and mental wellness through fashion.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Wishing you a day filled with joy, love, and everything that makes you smile! 🎉
            </Text>
            <Text style={footerSignature}>
              With love,<br />
              The Head Over Feels Team
            </Text>
            <Text style={footerLinks}>
              <Link href={`${baseUrl}/shop`} style={footerLink}>Shop</Link>
              {' • '}
              <Link href={`${baseUrl}/loyalty/rewards`} style={footerLink}>Rewards</Link>
              {' • '}
              <Link href={`${baseUrl}/contact`} style={footerLink}>Contact</Link>
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

export default BirthdayBonusEmail;

// Brand Colors
const brandColors = {
  primary: '#FF3131',      // Red accent
  background: '#F6F1EE',   // Cream background
  tertiary: '#CDA09B',     // Rose/muted
  black: '#000000',
  white: '#FFFFFF',
};

// Styles
const main = {
  backgroundColor: brandColors.background,
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
};

const header = {
  textAlign: 'center' as const,
  padding: '40px 32px',
  backgroundColor: brandColors.black,
};

const h1 = {
  color: brandColors.white,
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0 0 8px',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
};

const tagline = {
  color: brandColors.tertiary,
  fontSize: '12px',
  margin: '0',
  letterSpacing: '3px',
  textTransform: 'uppercase' as const,
};

const birthdayBanner = {
  textAlign: 'center' as const,
  padding: '32px 24px',
  background: `linear-gradient(135deg, ${brandColors.primary} 0%, #FF6B6B 100%)`,
};

const birthdayEmojis = {
  fontSize: '48px',
  margin: '0 0 12px',
};

const birthdayTitle = {
  color: brandColors.white,
  fontSize: '36px',
  fontWeight: 'bold',
  margin: '0',
};

const content = {
  backgroundColor: brandColors.white,
  padding: '32px 40px 24px',
};

const greeting = {
  color: '#333333',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 16px',
};

const text = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
};

const h3 = {
  color: brandColors.black,
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
};

const giftBox = {
  backgroundColor: brandColors.background,
  borderRadius: '12px',
  padding: '32px',
  margin: '0 40px 24px',
  textAlign: 'center' as const,
  border: `2px dashed ${brandColors.tertiary}`,
};

const giftLabel = {
  color: '#666666',
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '2px',
  margin: '0 0 8px',
  fontWeight: '600',
};

const giftAmount = {
  color: brandColors.primary,
  fontSize: '42px',
  fontWeight: 'bold',
  margin: '0 0 8px',
};

const giftNote = {
  color: '#666666',
  fontSize: '14px',
  margin: '0',
};

const balanceBox = {
  backgroundColor: brandColors.white,
  padding: '0 40px 24px',
};

const balanceRow = {
  backgroundColor: brandColors.background,
  borderRadius: '8px',
  padding: '16px 24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const balanceLabel = {
  color: '#666666',
  fontSize: '14px',
  margin: '0',
};

const balanceAmount = {
  color: brandColors.primary,
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0',
};

const suggestionsSection = {
  backgroundColor: brandColors.white,
  padding: '0 40px 32px',
  textAlign: 'center' as const,
};

const suggestionText = {
  color: '#666666',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 24px',
};

const buttonRow = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'center',
};

const primaryButton = {
  backgroundColor: brandColors.primary,
  borderRadius: '6px',
  color: brandColors.white,
  fontSize: '15px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
};

const secondaryButton = {
  backgroundColor: brandColors.white,
  borderRadius: '6px',
  color: brandColors.black,
  fontSize: '15px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  border: `2px solid ${brandColors.black}`,
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
};

const divider = {
  borderColor: brandColors.tertiary,
  margin: '0',
};

const funFactsBox = {
  backgroundColor: brandColors.background,
  padding: '24px 40px',
  textAlign: 'center' as const,
};

const funFactTitle = {
  color: brandColors.primary,
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 8px',
};

const funFactText = {
  color: '#333333',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
};

const footer = {
  backgroundColor: brandColors.background,
  padding: '32px 40px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#333333',
  fontSize: '15px',
  margin: '0 0 16px',
};

const footerSignature = {
  color: '#666666',
  fontSize: '14px',
  margin: '0 0 24px',
  lineHeight: '22px',
};

const footerLinks = {
  margin: '0 0 16px',
};

const footerLink = {
  color: brandColors.primary,
  fontSize: '14px',
  textDecoration: 'none',
};

const footerAddress = {
  color: '#999999',
  fontSize: '12px',
  margin: '0',
};
