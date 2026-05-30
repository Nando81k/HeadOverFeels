import type { Metadata } from "next";
import { Allura } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

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
    <html lang="en" className={`${allura.variable} ${harlow.variable}`}>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
