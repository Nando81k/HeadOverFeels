import type { Metadata } from "next";
import { Allura } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { storefrontFontVariables } from "@/lib/storefront/fonts";

// Load Allura font for logo - self-hosted through Next.js for consistent production rendering
const allura = Allura({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-allura",
  display: "swap",
});

// Self-hosted Harlow Solid Italic - eliminates render-blocking CDN request and FOIT
const harlow = localFont({
  src: "./fonts/HarlowSolidItalic.woff",
  variable: "--font-harlow",
  display: "swap",
  weight: "400",
  style: "italic",
});

export const metadata: Metadata = {
  title: "Head Over Feels - Premium Streetwear",
  description: "Modern streetwear brand focused on authentic expression and premium quality. Shop our latest collection of hoodies, tees, and accessories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${allura.variable} ${harlow.variable} ${storefrontFontVariables}`}>
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ring"
        >
          Skip to main content
        </a>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
