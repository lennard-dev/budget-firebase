const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://budget-v01.web.app/api';

class TransactionService {
  constructor() {
    // Use mock user for now
    this.mockUser = {
      uid: 'demo-user',
      email: 'demo@parea-lesvos.org',
      displayName: 'Demo User'
    };
    // Set mock token
    this.token = 'mock-token-demo-user';
  }

  async fetchWithAuth(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-User-ID': this.mockUser.uid,
      ...options.headers
    };

    // Add mock auth header
    headers['Authorization'] = `Bearer ${this.token}`;

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Dashboard KPIs
  async getDashboardKPIs() {
    try {
      const [summary, recentTransactions] = await Promise.all([
        this.fetchWithAuth('/summary'),
        this.fetchWithAuth('/transactions?limit=5')
      ]);

      return {
        monthExpenses: summary.monthExpenses || 0,
        budgetRemaining: summary.budgetRemaining || 0,
        cashOnHand: summary.cashBalance || 0,
        bankBalance: summary.bankBalance || 0,
        pendingDonations: summary.pendingDonations || 0,
        recentTransactions: recentTransactions.transactions || []
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

  // Get transactions
  async getTransactions(filters = {}) {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.category) params.append('category', filters.category);
    if (filters.type) params.append('type', filters.type);
    if (filters.account) params.append('account', filters.account);
    if (filters.limit) params.append('limit', filters.limit);

    return this.fetchWithAuth(`/transactions?${params.toString()}`);
  }

  // Get ledger entries
  async getLedgerEntries(account, limit = 50) {
    return this.fetchWithAuth(`/ledger/${account}?limit=${limit}`);
  }

  // Create transaction
  async createTransaction(transaction) {
    return this.fetchWithAuth('/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction)
    });
  }

  // Update transaction
  async updateTransaction(id, updates) {
    return this.fetchWithAuth(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  // Delete transaction
  async deleteTransaction(id) {
    return this.fetchWithAuth(`/transactions/${id}`, {
      method: 'DELETE'
    });
  }

  // Get categories
  async getCategories() {
    return this.fetchWithAuth('/categories');
  }

  // Get budget data
  async getBudgetData() {
    return this.fetchWithAuth('/budget');
  }

  // Get spending trends
  async getSpendingTrends(months = 12) {
    return this.fetchWithAuth(`/trends?months=${months}`);
  }
}

export default new TransactionService();