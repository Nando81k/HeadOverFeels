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

const birthdayBanner = {
  textAlign: 'center' as const,
  padding: '32px 24px',
  background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #3b82f6 100%)',
};

const birthdayEmojis = {
  fontSize: '48px',
  margin: '0 0 12px',
};

const birthdayTitle = {
  color: '#ffffff',
  fontSize: '36px',
  fontWeight: '800',
  margin: '0',
  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
};

const content = {
  backgroundColor: '#ffffff',
  padding: '32px 40px 24px',
};

const greeting = {
  color: '#374151',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 16px',
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
  margin: '0 0 12px',
};

const giftBox = {
  backgroundColor: '#fef3c7',
  borderRadius: '12px',
  padding: '32px',
  margin: '0 40px 24px',
  textAlign: 'center' as const,
  border: '2px dashed #f59e0b',
};

const giftLabel = {
  color: '#92400e',
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '2px',
  margin: '0 0 8px',
  fontWeight: '600',
};

const giftAmount = {
  color: '#78350f',
  fontSize: '42px',
  fontWeight: '800',
  margin: '0 0 8px',
};

const giftNote = {
  color: '#92400e',
  fontSize: '14px',
  margin: '0',
};

const balanceBox = {
  backgroundColor: '#ffffff',
  padding: '0 40px 24px',
};

const balanceRow = {
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
  padding: '16px 24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const balanceLabel = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0',
};

const balanceAmount = {
  color: '#111827',
  fontSize: '20px',
  fontWeight: '700',
  margin: '0',
};

const suggestionsSection = {
  backgroundColor: '#ffffff',
  padding: '0 40px 32px',
  textAlign: 'center' as const,
};

const suggestionText = {
  color: '#6b7280',
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
  backgroundColor: '#000000',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const secondaryButton = {
  backgroundColor: '#ffffff',
  borderRadius: '6px',
  color: '#000000',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  border: '2px solid #000000',
};

const divider = {
  borderColor: '#e5e7eb',
  margin: '0',
};

const funFactsBox = {
  backgroundColor: '#f0f9ff',
  padding: '24px 40px',
  textAlign: 'center' as const,
};

const funFactTitle = {
  color: '#0369a1',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 8px',
};

const funFactText = {
  color: '#0c4a6e',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
};

const footer = {
  backgroundColor: '#ffffff',
  padding: '32px 40px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#374151',
  fontSize: '15px',
  margin: '0 0 16px',
};

const footerSignature = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0 0 24px',
  lineHeight: '22px',
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
