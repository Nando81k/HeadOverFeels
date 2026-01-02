/**
 * Formats a phone number to (XXX) XXX-XXXX format
 * Removes all non-numeric characters and formats as user types
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, '')
  
  // Return empty string if no numbers
  if (!numbers) return ''
  
  // Format based on length
  if (numbers.length <= 3) {
    return `(${numbers}`
  } else if (numbers.length <= 6) {
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`
  } else {
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
  }
}

/**
 * Extracts just the numeric digits from a formatted phone number
 */
export function extractPhoneDigits(formattedPhone: string): string {
  return formattedPhone.replace(/\D/g, '')
}

/**
 * Validates if a phone number has exactly 10 digits
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = extractPhoneDigits(phone)
  return digits.length === 10
}
