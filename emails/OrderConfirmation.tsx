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
} from '@react-email/components';
import * as React from 'react';

interface OrderItem {
  productName: string;
  variantDetails: string;
  quantity: number;
  price: number;
}

interface OrderConfirmationEmailProps {
  orderNumber: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export const OrderConfirmationEmail = ({
  orderNumber,
  customerName,
  items,
  subtotal,
  shipping,
  tax,
  total,
  shippingAddress,
}: OrderConfirmationEmailProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Html>
      <Head />
      <Preview>Your Head Over Feels order {orderNumber} has been confirmed!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>Head Over Feels</Heading>
            <Text style={tagline}>Premium Streetwear</Text>
          </Section>

          {/* Thank You Message */}
          <Section style={content}>
            <Heading style={h2}>Thank You for Your Order!</Heading>
            <Text style={text}>
              Hi {customerName},
            </Text>
            <Text style={text}>
              We&apos;ve received your order and we&apos;re getting it ready. We&apos;ll send you a
              shipping confirmation email with tracking information as soon as your
              order ships.
            </Text>
          </Section>

          {/* Order Details */}
          <Section style={orderBox}>
            <Text style={orderNumberStyle}>Order #{orderNumber}</Text>
          </Section>

          {/* Items */}
          <Section style={content}>
            <Heading style={h3}>Order Items</Heading>
            {items.map((item, index) => (
              <div key={index} style={itemRow}>
                <div style={itemDetails}>
                  <Text style={itemName}>{item.productName}</Text>
                  <Text style={itemVariant}>{item.variantDetails}</Text>
                  <Text style={itemQuantity}>Quantity: {item.quantity}</Text>
                </div>
                <Text style={itemPrice}>{formatCurrency(item.price * item.quantity)}</Text>
              </div>
            ))}
          </Section>

          <Hr style={divider} />

          {/* Totals */}
          <Section style={content}>
            <div style={totalRow}>
              <Text style={totalLabel}>Subtotal:</Text>
              <Text style={totalValue}>{formatCurrency(subtotal)}</Text>
            </div>
            <div style={totalRow}>
              <Text style={totalLabel}>Shipping:</Text>
              <Text style={totalValue}>{formatCurrency(shipping)}</Text>
            </div>
            <div style={totalRow}>
              <Text style={totalLabel}>Tax:</Text>
              <Text style={totalValue}>{formatCurrency(tax)}</Text>
            </div>
            <Hr style={divider} />
            <div style={totalRow}>
              <Text style={totalLabelBold}>Total:</Text>
              <Text style={totalValueBold}>{formatCurrency(total)}</Text>
            </div>
          </Section>

          <Hr style={divider} />

          {/* Shipping Address */}
          <Section style={content}>
            <Heading style={h3}>Shipping Address</Heading>
            <Text style={address}>
              {shippingAddress.addressLine1}
              {shippingAddress.addressLine2 && (
                <>
                  <br />
                  {shippingAddress.addressLine2}
                </>
              )}
              <br />
              {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}
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

export default OrderConfirmationEmail;

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
  fontWeight: 'bold',
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
  fontWeight: 'bold',
  margin: '32px 0 16px',
};

const h3 = {
  color: '#000000',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '24px 0 12px',
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

const itemRow = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '16px 0',
  borderBottom: '1px solid #e6e6e6',
};

const itemDetails = {
  flex: '1',
};

const itemName = {
  color: '#000000',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 4px',
};

const itemVariant = {
  color: '#666666',
  fontSize: '14px',
  margin: '0 0 4px',
};

const itemQuantity = {
  color: '#666666',
  fontSize: '14px',
  margin: '0',
};

const itemPrice = {
  color: '#000000',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
  textAlign: 'right' as const,
};

const divider = {
  borderColor: '#e6e6e6',
  margin: '24px 0',
};

const totalRow = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 0',
};

const totalLabel = {
  color: '#666666',
  fontSize: '16px',
  margin: '0',
};

const totalValue = {
  color: '#000000',
  fontSize: '16px',
  margin: '0',
  textAlign: 'right' as const,
};

const totalLabelBold = {
  color: '#000000',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0',
};

const totalValueBold = {
  color: '#000000',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0',
  textAlign: 'right' as const,
};

const address = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
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
