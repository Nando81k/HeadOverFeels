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

interface ReferralSuccessEmailProps {
  referrerName: string;
  referredName: string;
  pointsEarned: number;
  currentPoints: number;
  totalReferrals: number;
}

export const ReferralSuccessEmail = ({
  referrerName,
  referredName,
  pointsEarned,
  currentPoints,
  totalReferrals,
}: ReferralSuccessEmailProps) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com';

  return (
    <Html>
      <Head />
      <Preview>{`🎉 ${referredName} used your referral code! You earned ${pointsEarned} Care Points!`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>Head Over Feels</Heading>
            <Text style={tagline}>Care Points Loyalty Program</Text>
          </Section>

          {/* Success Banner */}
          <Section style={successBanner}>
            <Text style={successEmoji}>🎉</Text>
            <Heading style={successTitle}>Referral Success!</Heading>
            <Text style={successSubtitle}>Someone used your code</Text>
          </Section>

          {/* Main Message */}
          <Section style={content}>
            <Text style={text}>
              Hi {referrerName}!
            </Text>
            <Text style={text}>
              Great news! <strong>{referredName}</strong> just made their first purchase
              using your referral code. Thanks for spreading the love! 💙
            </Text>
          </Section>

          {/* Points Earned Box */}
          <Section style={earningsBox}>
            <div style={earningsContent}>
              <Text style={earningsLabel}>You Earned</Text>
              <Text style={earningsAmount}>+{pointsEarned}</Text>
              <Text style={earningsUnit}>Care Points</Text>
            </div>
          </Section>

          {/* Stats Row */}
          <Section style={statsSection}>
            <div style={statsRow}>
              <div style={statItem}>
                <Text style={statValue}>{currentPoints.toLocaleString()}</Text>
                <Text style={statLabel}>Total Points</Text>
              </div>
              <div style={statDivider}></div>
              <div style={statItem}>
                <Text style={statValue}>{totalReferrals}</Text>
                <Text style={statLabel}>Friends Referred</Text>
              </div>
            </div>
          </Section>

          {/* Keep Sharing CTA */}
          <Section style={ctaSection}>
            <Heading style={h3}>Keep Sharing, Keep Earning!</Heading>
            <Text style={ctaText}>
              Every friend who signs up and makes a purchase earns you {pointsEarned} Care Points.
              There&apos;s no limit!
            </Text>
            <Button style={ctaButton} href={`${baseUrl}/profile/referrals`}>
              Get Your Referral Link
            </Button>
          </Section>

          <Hr style={divider} />

          {/* How It Works */}
          <Section style={howItWorksBox}>
            <Heading style={h4}>How Referrals Work:</Heading>
            <div style={stepRow}>
              <div style={step}>
                <Text style={stepNumber}>1</Text>
                <Text style={stepText}>Share your unique code</Text>
              </div>
              <div style={step}>
                <Text style={stepNumber}>2</Text>
                <Text style={stepText}>Friend signs up & shops</Text>
              </div>
              <div style={step}>
                <Text style={stepNumber}>3</Text>
                <Text style={stepText}>You both earn points!</Text>
              </div>
            </div>
            <Text style={benefitNote}>
              💡 Your friend also got <strong>100 bonus points</strong> when they signed up!
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Thanks for helping us grow our community. You&apos;re the best! 🙌
            </Text>
            <Text style={footerLinks}>
              <Link href={`${baseUrl}/shop`} style={footerLink}>Shop</Link>
              {' • '}
              <Link href={`${baseUrl}/loyalty/rewards`} style={footerLink}>Rewards</Link>
              {' • '}
              <Link href={`${baseUrl}/profile/referrals`} style={footerLink}>My Referrals</Link>
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

export default ReferralSuccessEmail;

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

const successBanner = {
  textAlign: 'center' as const,
  padding: '32px 24px',
  background: `linear-gradient(135deg, ${brandColors.primary} 0%, #FF6B6B 100%)`,
};

const successEmoji = {
  fontSize: '48px',
  margin: '0 0 8px',
};

const successTitle = {
  color: brandColors.white,
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0 0 4px',
};

const successSubtitle = {
  color: brandColors.white,
  opacity: 0.9,
  fontSize: '16px',
  margin: '0',
};

const content = {
  backgroundColor: brandColors.white,
  padding: '32px 40px 24px',
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

const h4 = {
  color: '#666666',
  fontSize: '14px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const earningsBox = {
  padding: '0 40px 24px',
  backgroundColor: brandColors.white,
};

const earningsContent = {
  backgroundColor: brandColors.background,
  borderRadius: '12px',
  padding: '32px',
  textAlign: 'center' as const,
  border: `2px dashed ${brandColors.tertiary}`,
};

const earningsLabel = {
  color: '#666666',
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '2px',
  margin: '0 0 4px',
  fontWeight: '600',
};

const earningsAmount = {
  color: brandColors.primary,
  fontSize: '52px',
  fontWeight: 'bold',
  margin: '0',
  lineHeight: '1',
};

const earningsUnit = {
  color: '#666666',
  fontSize: '16px',
  margin: '8px 0 0',
  fontWeight: '500',
};

const statsSection = {
  backgroundColor: brandColors.white,
  padding: '0 40px 24px',
};

const statsRow = {
  backgroundColor: brandColors.background,
  borderRadius: '8px',
  padding: '20px',
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
};

const statItem = {
  textAlign: 'center' as const,
};

const statDivider = {
  width: '1px',
  height: '40px',
  backgroundColor: brandColors.tertiary,
};

const statValue = {
  color: brandColors.primary,
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 4px',
};

const statLabel = {
  color: '#666666',
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  margin: '0',
};

const ctaSection = {
  backgroundColor: brandColors.white,
  padding: '0 40px 32px',
  textAlign: 'center' as const,
};

const ctaText = {
  color: '#666666',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 20px',
};

const ctaButton = {
  backgroundColor: brandColors.primary,
  borderRadius: '6px',
  color: brandColors.white,
  fontSize: '15px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
};

const divider = {
  borderColor: brandColors.tertiary,
  margin: '0',
};

const howItWorksBox = {
  backgroundColor: brandColors.background,
  padding: '24px 40px',
};

const stepRow = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '16px',
};

const step = {
  flex: 1,
  textAlign: 'center' as const,
};

const stepNumber = {
  backgroundColor: brandColors.primary,
  color: brandColors.white,
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '14px',
  fontWeight: 'bold',
  margin: '0 auto 8px',
};

const stepText = {
  color: '#333333',
  fontSize: '13px',
  margin: '0',
  lineHeight: '18px',
};

const benefitNote = {
  color: brandColors.primary,
  fontSize: '14px',
  textAlign: 'center' as const,
  margin: '0',
  padding: '12px 16px',
  backgroundColor: brandColors.white,
  borderRadius: '6px',
  border: `1px solid ${brandColors.tertiary}`,
};

const footer = {
  backgroundColor: brandColors.background,
  padding: '32px 40px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#333333',
  fontSize: '14px',
  margin: '0 0 16px',
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
