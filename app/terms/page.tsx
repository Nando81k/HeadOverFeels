'use client'

import { motion } from 'framer-motion'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-gray-500 mb-8">Last updated: January 16, 2026</p>

          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-600 mb-4">
                By accessing and using Head Over Feels (&quot;the Website&quot;), you accept and agree to be bound by 
                these Terms of Service. If you do not agree to these terms, please do not use our Website.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Use of the Website</h2>
              <p className="text-gray-600 mb-4">
                You agree to use the Website only for lawful purposes and in accordance with these Terms. 
                You agree not to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li>Use the Website in any way that violates any applicable law or regulation</li>
                <li>Attempt to gain unauthorized access to any part of the Website</li>
                <li>Use the Website to transmit any harmful or malicious code</li>
                <li>Interfere with or disrupt the Website or servers connected to it</li>
                <li>Use automated systems to access the Website without our permission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Account Registration</h2>
              <p className="text-gray-600 mb-4">
                To make purchases, you may need to create an account. You are responsible for:
              </p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li>Providing accurate and complete registration information</li>
                <li>Maintaining the security of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Products and Pricing</h2>
              <p className="text-gray-600 mb-4">
                We strive to provide accurate product descriptions and pricing. However:
              </p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li>Colors may vary slightly due to monitor settings</li>
                <li>We reserve the right to correct pricing errors</li>
                <li>Product availability is subject to change without notice</li>
                <li>Limited edition items are sold on a first-come, first-served basis</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Orders and Payment</h2>
              <p className="text-gray-600 mb-4">
                By placing an order, you agree that:
              </p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li>You are authorized to use the payment method provided</li>
                <li>All information you provide is accurate and complete</li>
                <li>We may cancel orders suspected of fraud</li>
                <li>Order confirmation does not guarantee availability</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Shipping and Delivery</h2>
              <p className="text-gray-600 mb-4">
                Shipping times are estimates and not guaranteed. We are not responsible for delays 
                caused by shipping carriers, customs, or circumstances beyond our control.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Returns and Refunds</h2>
              <p className="text-gray-600 mb-4">
                Please refer to our Return Policy for information about returns, exchanges, and refunds. 
                Limited edition items may have different return policies.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Intellectual Property</h2>
              <p className="text-gray-600 mb-4">
                All content on this Website, including text, graphics, logos, images, and software, 
                is the property of Head Over Feels and is protected by copyright and trademark laws. 
                You may not reproduce, distribute, or create derivative works without our permission.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Limitation of Liability</h2>
              <p className="text-gray-600 mb-4">
                Head Over Feels shall not be liable for any indirect, incidental, special, consequential, 
                or punitive damages arising from your use of the Website or products purchased through it.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Changes to Terms</h2>
              <p className="text-gray-600 mb-4">
                We reserve the right to modify these Terms at any time. Changes will be effective 
                immediately upon posting. Your continued use of the Website constitutes acceptance 
                of the modified Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contact Us</h2>
              <p className="text-gray-600 mb-4">
                If you have questions about these Terms of Service, please contact us at:
              </p>
              <p className="text-gray-600">
                <strong>Email:</strong> support@headoverfeels.com<br />
                <strong>Address:</strong> Head Over Feels, Customer Service
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
