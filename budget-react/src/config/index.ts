// Application Configuration

export const config = {
  // API Configuration
  api: {
    baseUrl: import.meta.env.PROD ? '/api' : 'http://localhost:5000/api',
    timeout: 30000,
  },
  
  // Firebase Configuration
  firebase: {
    // These will be auto-configured in production via /__/firebase/init.js
    // For development, add your config here or use environment variables
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  },
  
  // App Configuration
  app: {
    name: 'Budget Management',
    version: '2.0.0',
    environment: import.meta.env.MODE,
    baseUrl: import.meta.env.BASE_URL,
  },
  
  // Feature Flags
  features: {
    authentication: false, // Set to true when ready to enable auth
    mockData: import.meta.env.DEV, // Use mock data in development
    debugMode: import.meta.env.DEV,
  },
  
  // Routes
  routes: {
    dashboard: '/',
    expenses: '/expenses',
    cashBanking: '/cash-banking',
    budget: '/budget',
    reports: '/reports',
    settings: '/settings',
    admin: '/admin',
  },
  
  // Legacy App URL
  legacyUrl: '/legacy/',
};

export default config;