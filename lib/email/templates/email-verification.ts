interface VerificationEmailData {
  name: string
  email: string
  verificationToken: string
}

export function generateEmailVerificationEmail(data: VerificationEmailData) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const verificationUrl = `${baseUrl}/verify-email?token=${data.verificationToken}`
  
  return {
    subject: 'Verify Your Email - Head Over Feels',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9fafb;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #111827;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.5px;
    }
    h1 {
      color: #111827;
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 16px 0;
      text-align: center;
    }
    .welcome-icon {
      font-size: 48px;
      text-align: center;
      margin-bottom: 20px;
    }
    p {
      color: #4b5563;
      margin: 0 0 16px 0;
    }
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .button {
      display: inline-block;
      background-color: #111827;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
    }
    .button:hover {
      background-color: #1f2937;
    }
    .link-fallback {
      background-color: #f3f4f6;
      border-radius: 6px;
      padding: 16px;
      margin: 24px 0;
      word-break: break-all;
    }
    .link-fallback p {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #6b7280;
    }
    .link-fallback a {
      color: #111827;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      margin-top: 32px;
    }
    .footer p {
      font-size: 14px;
      color: #9ca3af;
    }
    .expiry-notice {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      margin: 24px 0;
      border-radius: 0 6px 6px 0;
    }
    .expiry-notice p {
      margin: 0;
      color: #92400e;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">HEAD OVER FEELS</div>
    </div>
    
    <div class="welcome-icon">✉️</div>
    
    <h1>Verify Your Email Address</h1>
    
    <p>Hi ${data.name || 'there'},</p>
    
    <p>Thanks for signing up for Head Over Feels! Please verify your email address to complete your registration and start shopping our exclusive collections.</p>
    
    <div class="button-container">
      <a href="${verificationUrl}" class="button">Verify Email Address</a>
    </div>
    
    <div class="expiry-notice">
      <p>⏰ This verification link will expire in 24 hours.</p>
    </div>
    
    <div class="link-fallback">
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
    </div>
    
    <p>If you didn't create an account with Head Over Feels, you can safely ignore this email.</p>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} Head Over Feels. All rights reserved.</p>
      <p>This email was sent to ${data.email}</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
Verify Your Email Address

Hi ${data.name || 'there'},

Thanks for signing up for Head Over Feels! Please verify your email address to complete your registration.

Click this link to verify your email:
${verificationUrl}

This verification link will expire in 24 hours.

If you didn't create an account with Head Over Feels, you can safely ignore this email.

© ${new Date().getFullYear()} Head Over Feels. All rights reserved.
    `.trim()
  }
}
