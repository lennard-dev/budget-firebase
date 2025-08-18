/**
 * Unified Transaction Service
 * Single service for all transaction operations
 * Works with the clean QuickBooks-style backend
 */

window.TransactionService = {
  /**
   * Create a new transaction
   * @param {string} type - 'expense', 'income', or 'transfer'
   * @param {Object} data - Transaction data
   */
  async create(type, data) {
    // Prepare transaction based on type
    const transaction = {
      date: data.date || new Date().toISOString().split('T')[0],
      type: type,
      description: data.description || '',
      category: data.category || null,
      subcategory: data.subcategory || null,
      metadata: {}
    };

    // Handle different transaction types
    switch(type) {
      case 'expense':
        transaction.account = data.paymentMethod === 'Cash' ? 'cash' : 'bank';
        transaction.amount = Math.abs(Number(data.amount)); // Backend will handle making it negative
        transaction.paymentMethod = data.paymentMethod; // Store at top level for backend
        // Merge with existing metadata instead of replacing
        transaction.metadata = {
          ...transaction.metadata,
          paymentMethod: data.paymentMethod,
          vendor: data.vendor || null,
          receiptId: data.receiptId || null
        };
        break;
        
      case 'income':
        transaction.account = data.account || 'bank';
        transaction.amount = Math.abs(Number(data.amount));
        // Merge with existing metadata instead of replacing
        transaction.metadata = {
          ...transaction.metadata,
          source: data.source || data.donor || null,
          reference: data.reference || null
        };
        break;
        
      case 'transfer':
        transaction.subtype = data.subtype; // 'withdrawal' or 'deposit'
        transaction.amount = Math.abs(Number(data.amount));
        // Account is determined by subtype in backend
        break;
        
      default:
        throw new Error(`Unknown transaction type: ${type}`);
    }

    // Add any additional metadata
    if (data.notes) transaction.metadata.notes = data.notes;
    if (data.tags) transaction.metadata.tags = data.tags;

    // Call API
    const response = await window.callApi('/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction)
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to create transaction');
    }

    return response.data;
  },

  /**
   * Get filtered list of transactions
   * @param {Object} filters - Query filters
   */
  async getList(filters = {}) {
    const params = new URLSearchParams();
    
    // Add filters
    if (filters.type) params.set('type', filters.type);
    if (filters.account) params.set('account', filters.account);
    if (filters.category) params.set('category', filters.category);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.limit) params.set('limit', filters.limit);

    const response = await window.callApi(`/transactions?${params.toString()}`);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch transactions');
    }

    return response.data;
  },

  /**
   * Delete a transaction permanently
   * @param {string} id - Transaction ID to delete
   */
  async delete(id) {
    const response = await window.callApi(`/transactions/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete transaction');
    }
    
    return response;
  },

  /**
   * Get ledger entries for an account
   * @param {string} account - 'cash' or 'bank'
   * @param {Object} filters - Optional filters
   */
  async getLedger(account, filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.limit) params.set('limit', filters.limit);

    const response = await window.callApi(`/ledger/${account}?${params.toString()}`);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch ledger');
    }

    return response.data;
  },

  /**
   * Get current account balances
   */
  async getBalances() {
    const response = await window.callApi('/balances');
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch balances');
    }

    return response.data;
  },

  /**
   * Update an existing transaction
   * @param {string} id - Transaction ID
   * @param {Object} updates - Fields to update
   */
  async update(id, updates) {
    const response = await window.callApi(`/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to update transaction');
    }

    return response.data;
  },

  /**
   * Rebuild the entire ledger from transactions
   * Admin function - use with caution
   */
  async rebuildLedger() {
    const response = await window.callApi('/rebuild-ledger', {
      method: 'POST'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to rebuild ledger');
    }

    return response.data;
  },

  /**
   * Helper: Format amount for display
   */
  formatAmount(amount) {
    return `€${Math.abs(amount).toFixed(2)}`;
  },

  /**
   * Helper: Format amount with sign
   */
  formatAmountWithSign(amount) {
    const sign = amount < 0 ? '-' : '+';
    return `${sign}€${Math.abs(amount).toFixed(2)}`;
  },

  /**
   * Helper: Get transaction type label
   */
  getTypeLabel(type, subtype) {
    if (type === 'transfer') {
      return subtype === 'withdrawal' ? 'Withdrawal' : 'Deposit';
    }
    return type.charAt(0).toUpperCase() + type.slice(1);
  },

  /**
   * Helper: Get transaction icon
   */
  getTypeIcon(type, subtype) {
    if (type === 'expense') return '💳';
    if (type === 'income') return '💰';
    if (type === 'transfer') {
      return subtype === 'withdrawal' ? '🏧' : '🏦';
    }
    return '📝';
  }
};

// Make service available globally
window.TransactionService = TransactionService;