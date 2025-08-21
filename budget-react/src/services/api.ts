// API Configuration and Service
import axios from 'axios';
import { getCurrentUserToken } from './firebase';

// Base URL configuration
const API_BASE_URL = import.meta.env.PROD 
  ? '/api'  // Production: use relative path
  : 'http://localhost:5000/api'; // Development: proxy to local functions

// Create axios instance with base configuration
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for Firebase Auth cookies
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      // Check if using mock auth
      const useMockAuth = localStorage.getItem('useMockAuth') === 'true';
      
      if (useMockAuth) {
        // Use mock token with actual user ID
        config.headers['X-User-ID'] = '7QGvBNZJKYgTD7NdlCrgSoMhujz2';  // Your actual Firebase user ID
        config.headers.Authorization = 'Bearer mock-test-token-' + Date.now();
      } else {
        // Get Firebase auth token
        const token = await getCurrentUserToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.error('Unauthorized access - redirecting to login');
      // TODO: Redirect to login or show auth modal
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const endpoints = {
  // Transactions
  transactions: {
    list: (params?: any) => api.get('/transactions', { params }),
    get: (id: string) => api.get(`/transactions/${id}`),
    create: (data: any) => api.post('/transactions', data),
    update: (id: string, data: any) => api.put(`/transactions/${id}`, data),
    delete: (id: string) => api.delete(`/transactions/${id}`),
  },
  
  // Chart of Accounts (Professional accounting system)
  chartOfAccounts: {
    list: () => api.get('/chart-of-accounts'),
    get: (code: string) => api.get(`/chart-of-accounts/${code}`),
    create: (data: any) => api.post('/chart-of-accounts', data),
    update: (code: string, data: any) => api.put(`/chart-of-accounts/${code}`, data),
  },
  
  // Categories (DEPRECATED - use chartOfAccounts)
  categories: {
    list: () => api.get('/categories'),
    get: (id: string) => api.get(`/categories/${id}`),
    create: (data: any) => api.post('/categories', data),
    update: (id: string, data: any) => api.put(`/categories/${id}`, data),
    delete: (id: string) => api.delete(`/categories/${id}`),
  },
  
  // Ledger
  ledger: {
    cash: (params?: any) => api.get('/ledger/cash', { params }),
    bank: (params?: any) => api.get('/ledger/bank', { params }),
  },
  
  // Balances
  balances: {
    get: () => api.get('/balances'),
  },
  
  // Expected Income
  expectedIncome: {
    list: () => api.get('/expected-income'),
    create: (data: any) => api.post('/expected-income', data),
    markReceived: (id: string) => api.put(`/expected-income/${id}/received`),
    delete: (id: string) => api.delete(`/expected-income/${id}`),
  },
  
  // Budget
  budget: {
    list: () => api.get('/budget'),
    update: (categoryId: string, data: any) => api.put(`/budget/${categoryId}`, data),
  },
  
  // Reports
  reports: {
    monthly: (month: string, year: number) => api.get('/reports/monthly', { params: { month, year } }),
    categoryBreakdown: (params?: any) => api.get('/reports/category-breakdown', { params }),
  },
  
  // Migration
  migration: {
    completeAccountsMigration: () => api.post('/migration/complete-accounts-migration'),
  },
};

// Transaction helper functions
export const createTransaction = async (data: any) => {
  // Ensure account_code is provided for expenses
  if (data.type === 'expense' && !data.account_code) {
    throw new Error('account_code is required for expense transactions');
  }
  
  const response = await endpoints.transactions.create(data);
  return response.data;
};

export const updateTransaction = async (id: string, data: any) => {
  // Ensure account_code is provided if updating category
  if ((data.category || data.subcategory) && !data.account_code) {
    throw new Error('account_code is required when updating expense categories');
  }
  
  const response = await endpoints.transactions.update(id, data);
  return response.data;
};

export const getChartOfAccounts = async () => {
  const response = await endpoints.chartOfAccounts.list();
  return response.data;
};

export default api;