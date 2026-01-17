'use client'

import { motion } from 'framer-motion'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 mb-8">Last updated: January 16, 2026</p>

          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-600 mb-4">
                Head Over Feels (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information 
                when you visit our website and make purchases.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">Personal Information</h3>
              <p className="text-gray-600 mb-4">We may collect the following personal information:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li>Name and contact information (email address, phone number)</li>
                <li>Billing and shipping addresses</li>
                <li>Payment information (processed securely through Stripe)</li>
                <li>Account credentials (email and password)</li>
                <li>Order history and preferences</li>
                <li>Birthday (if provided, for loyalty rewards)</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">Automatically Collected Information</h3>
              <p className="text-gray-600 mb-4">When you visit our website, we may automatically collect:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li>IP address and browser type</li>
                <li>Device information</li>
                <li>Pages visited and time spent on pages</li>
                <li>Referring website addresses</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-600 mb-4">We use your information to:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li>Process and fulfill your orders</li>
                <li>Send order confirmations and shipping updates</li>
                <li>Manage your account and loyalty rewards</li>
                <li>Provide customer support</li>
                <li>Send promotional emails (with your consent)</li>
                <li>Improve our website and services</li>
                <li>Detect and prevent fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Information Sharing</h2>
              <p className="text-gray-600 mb-4">We may share your information with:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li><strong>Service Providers:</strong> Companies that help us operate our business (payment processors, shipping carriers, email services)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              </ul>
              <p className="text-gray-600 mt-4">
                We do not sell your personal information to third parties.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Security</h2>
              <p className="text-gray-600 mb-4">
                We implement appropriate security measures to protect your personal information, including:
              </p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li>SSL encryption for data transmission</li>
                <li>Secure password hashing</li>
                <li>Regular security assessments</li>
                <li>Limited access to personal information</li>
              </ul>
              <p className="text-gray-600 mt-4">
                However, no method of transmission over the Internet is 100% secure. We cannot guarantee 
                absolute security of your data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Cookies</h2>
              <p className="text-gray-600 mb-4">
                We use cookies and similar technologies to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li>Remember your preferences and cart contents</li>
                <li>Keep you signed in to your account</li>
                <li>Analyze website traffic and usage</li>
                <li>Personalize your experience</li>
              </ul>
              <p className="text-gray-600 mt-4">
                You can control cookies through your browser settings. Disabling cookies may affect 
                website functionality.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Rights</h2>
              <p className="text-gray-600 mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal information</li>
                <li><strong>Correction:</strong> Request correction of inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
                <li><strong>Data Portability:</strong> Request your data in a portable format</li>
              </ul>
              <p className="text-gray-600 mt-4">
                To exercise these rights, please contact us using the information below.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Third-Party Services</h2>
              <p className="text-gray-600 mb-4">
                Our website may use third-party services including:
              </p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li><strong>Stripe:</strong> For secure payment processing</li>
                <li><strong>Cloudinary:</strong> For image hosting</li>
                <li><strong>Resend:</strong> For transactional emails</li>
                <li><strong>Vercel:</strong> For website hosting</li>
              </ul>
              <p className="text-gray-600 mt-4">
                These services have their own privacy policies governing the use of your information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Children&apos;s Privacy</h2>
              <p className="text-gray-600 mb-4">
                Our website is not intended for children under 13 years of age. We do not knowingly 
                collect personal information from children under 13. If you believe we have collected 
                such information, please contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Changes to This Policy</h2>
              <p className="text-gray-600 mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any changes 
                by posting the new policy on this page and updating the &quot;Last updated&quot; date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contact Us</h2>
              <p className="text-gray-600 mb-4">
                If you have questions about this Privacy Policy or wish to exercise your rights, 
                please contact us at:
              </p>
              <p className="text-gray-600">
                <strong>Email:</strong> privacy@headoverfeels.com<br />
                <strong>Address:</strong> Head Over Feels, Privacy Department
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
