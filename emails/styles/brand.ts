// Head Over Feels Brand Email Styles
// Consistent styling across all email templates

export const brandColors = {
  primary: '#FF3131',      // Red accent
  background: '#F6F1EE',   // Cream background
  tertiary: '#CDA09B',     // Rose/muted
  black: '#000000',
  white: '#FFFFFF',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  }
};

// Base layout styles
export const mainStyle = {
  backgroundColor: brandColors.background,
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
};

export const containerStyle = {
  backgroundColor: brandColors.white,
  margin: '0 auto',
  padding: '0',
  marginBottom: '64px',
  maxWidth: '600px',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
};

// Header styles
export const headerStyle = {
  backgroundColor: brandColors.black,
  padding: '40px 32px',
  textAlign: 'center' as const,
};

export const h1Style = {
  color: brandColors.white,
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
  padding: '0',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
};

export const taglineStyle = {
  color: brandColors.tertiary,
  fontSize: '12px',
  margin: '12px 0 0',
  padding: '0',
  letterSpacing: '3px',
  textTransform: 'uppercase' as const,
};

// Content styles
export const contentStyle = {
  padding: '0 32px',
};

export const h2Style = {
  color: brandColors.black,
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '32px 0 16px',
};

export const h3Style = {
  color: brandColors.black,
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '24px 0 12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
};

export const textStyle = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
};

// Highlight box (for order numbers, etc.)
export const highlightBoxStyle = {
  backgroundColor: brandColors.primary,
  padding: '20px 32px',
  margin: '24px 0',
};

export const highlightTextStyle = {
  color: brandColors.white,
  fontSize: '18px',
  fontWeight: 'bold' as const,
  margin: '0',
  textAlign: 'center' as const,
  letterSpacing: '2px',
};

// Button styles
export const buttonContainerStyle = {
  padding: '0 32px',
  textAlign: 'center' as const,
  margin: '24px 0',
};

export const primaryButtonStyle = {
  backgroundColor: brandColors.primary,
  borderRadius: '6px',
  color: brandColors.white,
  fontSize: '16px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 36px',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
};

export const secondaryButtonStyle = {
  backgroundColor: brandColors.black,
  borderRadius: '6px',
  color: brandColors.white,
  fontSize: '16px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 36px',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
};

// Divider
export const dividerStyle = {
  borderColor: brandColors.tertiary,
  margin: '24px 0',
};

// Footer styles
export const footerStyle = {
  backgroundColor: brandColors.background,
  padding: '32px',
  textAlign: 'center' as const,
};

export const footerTextStyle = {
  color: '#666666',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '8px 0',
};

export const linkStyle = {
  color: brandColors.primary,
  textDecoration: 'underline',
};

// Points/Balance box
export const pointsBoxStyle = {
  backgroundColor: brandColors.background,
  padding: '24px 32px',
  margin: '24px 0',
  textAlign: 'center' as const,
  borderRadius: '8px',
};

export const pointsLabelStyle = {
  color: '#666666',
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  margin: '0 0 8px',
};

export const pointsAmountStyle = {
  color: brandColors.primary,
  fontSize: '32px',
  fontWeight: 'bold' as const,
  margin: '0',
};

// Benefits list
export const benefitsBoxStyle = {
  backgroundColor: brandColors.white,
  padding: '24px 32px',
};

export const benefitItemStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  marginBottom: '16px',
};

export const benefitIconStyle = {
  fontSize: '20px',
  margin: '0 12px 0 0',
  flexShrink: 0,
};

export const benefitTextStyle = {
  color: '#333333',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0',
};

// Celebration banner (for tier upgrades, etc.)
export const celebrationBannerStyle = {
  backgroundColor: brandColors.primary,
  textAlign: 'center' as const,
  padding: '32px 24px',
};

export const celebrationEmojiStyle = {
  fontSize: '48px',
  margin: '0 0 16px',
};

export const celebrationTitleStyle = {
  color: brandColors.white,
  fontSize: '28px',
  fontWeight: 'bold' as const,
  margin: '0',
};
