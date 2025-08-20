import type { User as FirebaseUser } from 'firebase/auth';

export interface User extends FirebaseUser {
  role?: 'admin' | 'user';
}

export interface Transaction {
  id: string;
  date: string;
  timestamp: number;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  description: string;
  category?: string;
  subcategory?: string;
  payment_method?: string;
  receipt_url?: string;
  account?: 'cash' | 'bank';
  metadata?: Record<string, any>;
}

export interface Category {
  id: string;
  name: string;
  code?: string;
  description?: string;
  color?: string;
  subcategories?: Array<{ id: string; name: string }>;
}

export interface Budget {
  id: string;
  category: string;
  subcategory?: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  notes?: string;
}