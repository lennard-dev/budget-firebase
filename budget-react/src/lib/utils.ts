import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Currency formatting utility
export const formatCurrency = (amount: number, currency = 'EUR') => {
  return new Intl.NumberFormat('en-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

// Number formatting utility
export const formatNumber = (number: number) => {
  return new Intl.NumberFormat('en-DE').format(number)
}

// Percentage formatting utility
export const formatPercentage = (percentage: number) => {
  return new Intl.NumberFormat('en-DE', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(percentage / 100)
}