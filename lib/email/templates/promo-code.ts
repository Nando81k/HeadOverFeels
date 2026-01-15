interface PromoCodeEmailParams {
  promoCode: string
  discountDescription: string
  promoName: string
  expiresAt?: Date | null
  minimumPurchase?: number | null
}

export function generatePromoCodeEmail(params: PromoCodeEmailParams): string {
  const { promoCode, discountDescription, promoName, expiresAt, minimumPurchase } = params
  
  const expiryText = expiresAt 
    ? `Expires: ${new Date(expiresAt).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`
    : 'No expiration'
    
  const minPurchaseText = minimumPurchase 
    ? `Minimum purchase: $${minimumPurchase.toFixed(2)}`
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Exclusive Discount Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1A1A1A 0%, #333333 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
                HEAD OVER FEELS
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">
                Exclusive discount just for you
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <div style="text-align: center;">
                <p style="margin: 0 0 10px; font-size: 16px; color: #666666;">
                  🎉 Congratulations!
                </p>
                <h2 style="margin: 0 0 30px; font-size: 24px; color: #1A1A1A; font-weight: 700;">
                  ${promoName}
                </h2>
                
                <!-- Promo Code Box -->
                <div style="background: linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%); border: 2px dashed #FFB300; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
                  <p style="margin: 0 0 10px; font-size: 14px; color: #666666; text-transform: uppercase; letter-spacing: 1px;">
                    Your Exclusive Code
                  </p>
                  <p style="margin: 0; font-size: 36px; font-weight: 800; color: #1A1A1A; letter-spacing: 4px; font-family: monospace;">
                    ${promoCode}
                  </p>
                  <p style="margin: 15px 0 0; font-size: 18px; color: #FF6B00; font-weight: 600;">
                    ${discountDescription}
                  </p>
                </div>
                
                <!-- CTA Button -->
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://headoverfeels.com'}" 
                   style="display: inline-block; background-color: #1A1A1A; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; margin-bottom: 30px;">
                  Shop Now →
                </a>
                
                <!-- Terms -->
                <div style="border-top: 1px solid #eeeeee; padding-top: 20px; margin-top: 10px;">
                  <p style="margin: 0; font-size: 13px; color: #999999;">
                    ${expiryText}
                    ${minPurchaseText ? ` • ${minPurchaseText}` : ''}
                  </p>
                  <p style="margin: 10px 0 0; font-size: 12px; color: #bbbbbb;">
                    Enter this code at checkout to apply your discount.
                    Cannot be combined with other offers.
                  </p>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; font-size: 12px; color: #999999;">
                You received this email because you signed up for updates from Head Over Feels.
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #999999;">
                © ${new Date().getFullYear()} Head Over Feels. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
