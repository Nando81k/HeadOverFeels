interface WelcomeEmailData {
  name: string
  email: string
}

export function generateWelcomeEmail(data: WelcomeEmailData) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  
  return {
    subject: 'Welcome to Head Over Feels! 💕',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Head Over Feels</title>
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
      font-size: 28px;
      font-weight: 600;
      margin: 0 0 16px 0;
      text-align: center;
    }
    .welcome-icon {
      font-size: 64px;
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
    .features {
      background-color: #f9fafb;
      border-radius: 8px;
      padding: 24px;
      margin: 24px 0;
    }
    .features h2 {
      color: #111827;
      font-size: 18px;
      margin: 0 0 16px 0;
    }
    .feature-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .feature-icon {
      font-size: 20px;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .feature-text {
      color: #4b5563;
      font-size: 14px;
    }
    .points-banner {
      background: linear-gradient(135deg, #111827 0%, #374151 100%);
      border-radius: 8px;
      padding: 24px;
      margin: 24px 0;
      text-align: center;
      color: #ffffff;
    }
    .points-banner h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
    }
    .points-number {
      font-size: 36px;
      font-weight: 700;
      margin: 8px 0;
    }
    .points-banner p {
      color: #d1d5db;
      font-size: 14px;
      margin: 0;
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
    .social-links {
      margin: 16px 0;
    }
    .social-links a {
      display: inline-block;
      margin: 0 8px;
      color: #6b7280;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">HEAD OVER FEELS</div>
    </div>
    
    <div class="welcome-icon">🎉</div>
    
    <h1>Welcome to the Family!</h1>
    
    <p>Hi ${data.name || 'there'},</p>
    
    <p>Thank you for joining Head Over Feels! We're thrilled to have you as part of our community. Get ready to discover unique, emotionally expressive fashion that speaks to your soul.</p>
    
    <div class="points-banner">
      <h3>🎁 Welcome Gift</h3>
      <div class="points-number">100</div>
      <p>Loyalty points have been added to your account!</p>
    </div>
    
    <div class="features">
      <h2>What's waiting for you:</h2>
      <div class="feature-item">
        <span class="feature-icon">🛍️</span>
        <span class="feature-text"><strong>Exclusive Collections</strong> - Shop our unique designs that express all the feels</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">⚡</span>
        <span class="feature-text"><strong>Limited Edition Drops</strong> - Be first to know about our exclusive releases</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">💎</span>
        <span class="feature-text"><strong>Loyalty Rewards</strong> - Earn points on every purchase and unlock perks</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">📦</span>
        <span class="feature-text"><strong>Fast Shipping</strong> - Quick delivery on all orders</span>
      </div>
    </div>
    
    <div class="button-container">
      <a href="${baseUrl}/products" class="button">Start Shopping</a>
    </div>
    
    <p style="text-align: center; font-size: 14px; color: #6b7280;">Questions? Reply to this email and we'll be happy to help!</p>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} Head Over Feels. All rights reserved.</p>
      <p>This email was sent to ${data.email}</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
Welcome to Head Over Feels! 🎉

Hi ${data.name || 'there'},

Thank you for joining Head Over Feels! We're thrilled to have you as part of our community.

🎁 WELCOME GIFT: 100 loyalty points have been added to your account!

What's waiting for you:
• Exclusive Collections - Shop our unique designs that express all the feels
• Limited Edition Drops - Be first to know about our exclusive releases  
• Loyalty Rewards - Earn points on every purchase and unlock perks
• Fast Shipping - Quick delivery on all orders

Start shopping: ${baseUrl}/products

Questions? Reply to this email and we'll be happy to help!

© ${new Date().getFullYear()} Head Over Feels. All rights reserved.
    `.trim()
  }
}
