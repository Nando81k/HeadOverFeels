import { Archivo, Inter } from 'next/font/google'

/**
 * Storefront typefaces (design spec §5.1 "Fonts").
 *
 * Archivo is the display face — variable weight with the `wdth` axis so the
 * condensed headline settings (font-stretch 75–100) are available.
 * Inter is the body face. Both expose CSS variables consumed by
 * `--font-display` / `--font-body` in styles/storefront/tokens.css.
 */
export const archivo = Archivo({
  subsets: ['latin'],
  weight: 'variable',
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
})

export const inter = Inter({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-inter',
  display: 'swap',
})

/** Class string to spread onto <html> so both variables are in scope. */
export const storefrontFontVariables = `${archivo.variable} ${inter.variable}`
