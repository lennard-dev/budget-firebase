import { getCurrentUserToken } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://budget-v01.web.app/api';

interface Transaction {
  id?: string;
  transaction_id?: string;
  date: string;
  timestamp?: number;
  type: string;
  subtype?: string;
  account?: string;
  amount: number;
  description: string;
  category?: string;
  paymentMethod?: string;
  metadata?: any;
}

interface LedgerEntry {
  id?: string;
  transaction_id: string;
  account: string;
  date: string;
  timestamp: number;
  type: string;
  subtype?: string;
  paymentMethod?: string;
  description: string;
  change_amount: number;
  balance_before: number;
  balance_after: number;
  display_balance?: number;
}

interface Filters {
  startDate?: string;
  endDate?: string;
  category?: string;
  type?: string;
  account?: string;
  limit?: number | string;
}

interface DashboardKPIs {
  monthExpenses: number;
  budgetRemaining: number;
  cashOnHand: number;
  bankBalance: number;
  pendingDonations: number;
  recentTransactions: Transaction[];
}

interface Balances {
  cash: number;
  bank: number;
}

class TransactionServiceClass {
  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
    let headers: HeadersInit;
    
    // Check if using mock auth
    const useMockAuth = localStorage.getItem('useMockAuth') === 'true';
    
    if (useMockAuth) {
      // Use mock headers with actual user ID
      headers = {
        'Content-Type': 'application/json',
        'X-User-ID': '7QGvBNZJKYgTD7NdlCrgSoMhujz2',  // Your actual Firebase user ID
        'Authorization': 'Bearer mock-test-token-' + Date.now(),
        ...options.headers
      };
    } else {
      // Use Firebase auth
      const token = await getCurrentUserToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      };
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async getDashboardKPIs(): Promise<DashboardKPIs> {
    try {
      const [balances, recentTransactions] = await Promise.all([
        this.fetchWithAuth('/balances'),
        this.fetchWithAuth('/transactions?limit=5')
      ]);

      // Calculate month expenses from recent transactions
      const thisMonth = new Date();
      const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).toISOString().split('T')[0];
      const monthTransactions = await this.getList({
        type: 'expense',
        startDate: monthStart,
        limit: 1000
      });
      const monthExpenses = monthTransactions.reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

      return {
        monthExpenses: monthExpenses,
        budgetRemaining: 10000 - monthExpenses, // Assuming 10k budget for now
        cashOnHand: balances.data?.cash || 0,
        bankBalance: balances.data?.bank || 0,
        pendingDonations: 0, // To be implemented with expected income
        recentTransactions: recentTransactions.data || recentTransactions.transactions || []
      };
    } catch (error) {
      console.error('Error fetching dashboard KPIs:', error);
      return {
        monthExpenses: 0,
        budgetRemaining: 0,
        cashOnHand: 0,
        bankBalance: 0,
        pendingDonations: 0,
        recentTransactions: []
      };
    }
  }

  async getBalances(): Promise<Balances> {
    try {
      const result = await this.fetchWithAuth('/balances');
      if (result.success && result.data) {
        return {
          cash: result.data.cash || 0,
          bank: result.data.bank || 0
        };
      }
      return { cash: 0, bank: 0 };
    } catch (error) {
      console.error('Error fetching balances:', error);
      return { cash: 0, bank: 0 };
    }
  }

  async getList(filters: Filters = {}): Promise<Transaction[]> {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.category) params.append('category', filters.category);
    if (filters.type) params.append('type', filters.type);
    if (filters.account) params.append('account', filters.account);
    if (filters.limit) params.append('limit', filters.limit.toString());

    const result = await this.fetchWithAuth(`/transactions?${params.toString()}`);
    // Handle both 'data' and 'transactions' response formats
    return result.data || result.transactions || [];
  }

  async getLedger(account: string, params: any = {}): Promise<LedgerEntry[]> {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const result = await this.fetchWithAuth(`/ledger/${account}?${queryParams.toString()}`);
    // Handle both 'data' and 'entries' response formats
    return result.data || result.entries || [];
  }

  async getById(id: string): Promise<Transaction | null> {
    try {
      const result = await this.fetchWithAuth(`/transactions/${id}`);
      // Handle response that wraps data in success/data structure
      if (result.success && result.data) {
        return result.data;
      }
      // Fallback to direct result if it's already the transaction
      return result;
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return null;
    }
  }

  async create(type: string, data: any): Promise<Transaction> {
    const transaction = {
      ...data,
      type,
      timestamp: Date.now()
    };
    return this.fetchWithAuth('/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction)
    });
  }

  async update(id: string, type: string, data: any): Promise<Transaction> {
    const updates = {
      ...data,
      type
    };
    return this.fetchWithAuth(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async delete(id: string): Promise<void> {
    return this.fetchWithAuth(`/transactions/${id}`, {
      method: 'DELETE'
    });
  }

  async getCategories(): Promise<any[]> {
    const result = await this.fetchWithAuth('/categories');
    return result.categories || [];
  }

  async getBudgetData(): Promise<any> {
    return this.fetchWithAuth('/budget');
  }

  async getSpendingTrends(months: number = 12): Promise<any> {
    return this.fetchWithAuth(`/trends?months=${months}`);
  }
}

export const TransactionService = new TransactionServiceClass();