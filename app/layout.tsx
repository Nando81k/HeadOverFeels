import type { Metadata } from "next";
import { Allura } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Load Allura font for logo - self-hosted through Next.js for consistent production rendering
const allura = Allura({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-allura",
  display: "swap",
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
    <html lang="en" className={allura.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.cdnfonts.com/css/harlow-solid-italic"
        />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
