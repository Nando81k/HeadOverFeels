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

interface ShippingNotificationEmailProps {
  orderNumber: string;
  customerName: string;
  trackingNumber: string;
  shippingMethod: string;
  trackingUrl?: string;
}

export const ShippingNotificationEmail = ({
  orderNumber,
  customerName,
  trackingNumber,
  shippingMethod,
  trackingUrl,
}: ShippingNotificationEmailProps) => {
  // Generate tracking URL based on shipping method if not provided
  const getTrackingUrl = () => {
    if (trackingUrl) return trackingUrl;
    
    // Common carrier tracking URLs
    if (shippingMethod.toLowerCase().includes('usps')) {
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
    } else if (shippingMethod.toLowerCase().includes('ups')) {
      return `https://www.ups.com/track?tracknum=${trackingNumber}`;
    } else if (shippingMethod.toLowerCase().includes('fedex')) {
      return `https://www.fedex.com/fedextrack/?tracknumbers=${trackingNumber}`;
    }
    return '#';
  };

  return (
    <Html>
      <Head />
      <Preview>Your Head Over Feels order {orderNumber} has shipped!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>Head Over Feels</Heading>
            <Text style={tagline}>Premium Streetwear</Text>
          </Section>

          {/* Main Message */}
          <Section style={content}>
            <Heading style={h2}>Your Order Has Shipped! 📦</Heading>
            <Text style={text}>
              Hi {customerName},
            </Text>
            <Text style={text}>
              Great news! Your order is on its way. You can track your package using the
              information below.
            </Text>
          </Section>

          {/* Order Details */}
          <Section style={orderBox}>
            <Text style={orderNumberStyle}>Order #{orderNumber}</Text>
          </Section>

          {/* Tracking Info */}
          <Section style={trackingBox}>
            <Text style={trackingLabel}>Tracking Number</Text>
            <Text style={trackingNumberStyle}>{trackingNumber}</Text>
            <Text style={trackingLabel}>Shipping Method</Text>
            <Text style={shippingMethodText}>{shippingMethod}</Text>
          </Section>

          {/* Track Button */}
          <Section style={buttonContainer}>
            <Button href={getTrackingUrl()} style={button}>
              Track Your Package
            </Button>
          </Section>

          <Hr style={divider} />

          {/* Help Text */}
          <Section style={content}>
            <Text style={helpText}>
              Tracking information may take a few hours to update. If you have any
              questions about your delivery, please don&apos;t hesitate to contact us.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Questions? Contact us at{' '}
              <Link href="mailto:support@headoverfeels.com" style={link}>
                support@headoverfeels.com
              </Link>
            </Text>
            <Text style={footerText}>
              © {new Date().getFullYear()} Head Over Feels. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default ShippingNotificationEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '32px 32px 0',
  textAlign: 'center' as const,
};

const h1 = {
  color: '#000000',
  fontSize: '32px',
  fontWeight: 'bold' as const,
  margin: '0',
  padding: '0',
};

const tagline = {
  color: '#666666',
  fontSize: '14px',
  margin: '8px 0 0',
  padding: '0',
};

const content = {
  padding: '0 32px',
};

const h2 = {
  color: '#000000',
  fontSize: '24px',
  fontWeight: 'bold' as const,
  margin: '32px 0 16px',
};

const text = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const orderBox = {
  backgroundColor: '#f6f9fc',
  padding: '16px 32px',
  margin: '24px 0',
};

const orderNumberStyle = {
  color: '#000000',
  fontSize: '20px',
  fontWeight: 'bold' as const,
  margin: '0',
  textAlign: 'center' as const,
};

const trackingBox = {
  backgroundColor: '#f0f4ff',
  padding: '24px 32px',
  margin: '24px 0',
  borderRadius: '8px',
  textAlign: 'center' as const,
};

const trackingLabel = {
  color: '#666666',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0 0 8px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const trackingNumberStyle = {
  color: '#000000',
  fontSize: '24px',
  fontWeight: 'bold' as const,
  margin: '0 0 24px',
  fontFamily: 'monospace',
};

const shippingMethodText = {
  color: '#000000',
  fontSize: '18px',
  fontWeight: '600' as const,
  margin: '0',
};

const buttonContainer = {
  padding: '0 32px',
  textAlign: 'center' as const,
  margin: '24px 0',
};

const button = {
  backgroundColor: '#000000',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
};

const divider = {
  borderColor: '#e6e6e6',
  margin: '32px 0',
};

const helpText = {
  color: '#666666',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
  textAlign: 'center' as const,
};

const footer = {
  padding: '32px 32px 0',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#999999',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
};

const link = {
  color: '#0066cc',
  textDecoration: 'underline',
};
