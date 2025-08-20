// API Configuration and Service
import axios from 'axios';

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
    // If using Firebase Auth, get the token
    try {
      // TODO: Add Firebase auth token when auth is implemented
      // const auth = getAuth();
      // const user = auth.currentUser;
      // if (user) {
      //   const token = await user.getIdToken();
      //   config.headers.Authorization = `Bearer ${token}`;
      // }
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
  
  // Categories
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
};

export default api;