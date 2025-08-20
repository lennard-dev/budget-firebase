import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Number formatting
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Date formatting
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
};

export const formatDateShort = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'short'
  }).format(d);
};

// Transaction type colors and icons
export const getTransactionTypeConfig = (type) => {
  const configs = {
    'donation': { color: 'info', icon: 'Gift' },
    'deposit': { color: 'success', icon: 'ArrowDownCircle' },
    'withdrawal': { color: 'danger', icon: 'ArrowUpCircle' },
    'expense': { color: 'neutral', icon: 'Banknote' },
    'cash_expense': { color: 'neutral', icon: 'Banknote' }
  };
  return configs[type?.toLowerCase()] || configs.expense;
};

// Status colors
export const getStatusColor = (status) => {
  const colors = {
    'reconciled': 'success',
    'pending': 'warning',
    'failed': 'danger',
    'confirmed': 'success',
    'overdue': 'danger'
  };
  return colors[status?.toLowerCase()] || 'neutral';
};