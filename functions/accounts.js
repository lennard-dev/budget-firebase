const admin = require("firebase-admin");

/**
 * AccountsService - Professional Chart of Accounts management
 * Provides translation layer between frontend categories and backend accounts
 */
class AccountsService {
  constructor(db) {
    this.db = db;
    // In-memory cache for account lookups (cleared every 5 minutes)
    this.accountCache = new Map();
    this.cacheTimestamp = Date.now();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }
  
  // Clear cache if it's too old
  checkCache() {
    if (Date.now() - this.cacheTimestamp > this.CACHE_TTL) {
      this.accountCache.clear();
      this.cacheTimestamp = Date.now();
    }
  }

  // ============================================
  // TRANSLATION LAYER (Frontend Compatibility)
  // ============================================

  /**
   * Get account code from category/subcategory names
   * This is the KEY function that bridges old and new systems
   */
  async getAccountFromCategory(uid, categoryName, subcategoryName = null) {
    try {
      this.checkCache();
      
      // Create cache key
      const cacheKey = `${uid}:${categoryName}:${subcategoryName || 'null'}`;
      
      // Check cache first
      if (this.accountCache.has(cacheKey)) {
        return this.accountCache.get(cacheKey);
      }
      
      let query = this.db.collection("users").doc(uid)
        .collection("chart_of_accounts");

      if (subcategoryName) {
        // Look for subcategory account
        query = query
          .where("category_name", "==", categoryName)
          .where("subcategory_name", "==", subcategoryName)
          .where("display_as", "==", "subcategory");
      } else {
        // Look for category account
        query = query
          .where("category_name", "==", categoryName)
          .where("display_as", "==", "category");
      }

      const snapshot = await query.limit(1).get();
      
      if (snapshot.empty) {
        console.warn(`Account not found for ${categoryName}/${subcategoryName}`);
        this.accountCache.set(cacheKey, null);
        return null;
      }

      const accountCode = snapshot.docs[0].data().account_code;
      this.accountCache.set(cacheKey, accountCode);
      return accountCode;
    } catch (error) {
      console.error("Error getting account from category:", error);
      return null;
    }
  }

  /**
   * Get account by legacy IDs (CAT-XXX, SUB-XXX)
   */
  async getAccountFromLegacyIds(uid, categoryId, subcategoryId = null) {
    try {
      let query = this.db.collection("users").doc(uid)
        .collection("chart_of_accounts");

      if (subcategoryId) {
        query = query
          .where("legacy_subcategory_id", "==", subcategoryId);
      } else {
        query = query
          .where("legacy_category_id", "==", categoryId)
          .where("display_as", "==", "category");
      }

      const snapshot = await query.limit(1).get();
      
      if (snapshot.empty) {
        return null;
      }

      return snapshot.docs[0].data().account_code;
    } catch (error) {
      console.error("Error getting account from legacy IDs:", error);
      return null;
    }
  }

  /**
   * Convert chart_of_accounts to frontend categories format
   */
  async getCategoresFromAccounts(uid) {
    try {
      // Get all category-level accounts (without orderBy to avoid composite index)
      const categoryAccounts = await this.db.collection("users").doc(uid)
        .collection("chart_of_accounts")
        .where("display_as", "==", "category")
        .get();

      // Sort categories by account_code manually
      const sortedCategories = categoryAccounts.docs.sort((a, b) => {
        return a.data().account_code.localeCompare(b.data().account_code);
      });

      const categories = [];

      for (const doc of sortedCategories) {
        const account = doc.data();
        
        // Get subcategories for this category (without orderBy to avoid composite index)
        const subcategoryAccounts = await this.db.collection("users").doc(uid)
          .collection("chart_of_accounts")
          .where("parent_code", "==", account.account_code)
          .where("display_as", "==", "subcategory")
          .get();

        // Sort subcategories manually
        const sortedSubcategories = subcategoryAccounts.docs.sort((a, b) => {
          return a.data().account_code.localeCompare(b.data().account_code);
        });
        
        const subcategories = sortedSubcategories.map(subDoc => {
          const subAccount = subDoc.data();
          return {
            id: subAccount.legacy_subcategory_id || `SUB-${subAccount.account_code}`,
            name: subAccount.subcategory_name || subAccount.account_name
          };
        });

        categories.push({
          id: doc.id,
          category_id: account.legacy_category_id || `CAT-${account.account_code}`,
          code: account.account_code,  // Add account code for budget mapping
          name: account.category_name || account.account_name,
          subcategories: subcategories,
          active: account.is_active !== false
        });
      }

      return categories;
    } catch (error) {
      console.error("Error converting accounts to categories:", error);
      return [];
    }
  }

  // ============================================
  // CORE ACCOUNT OPERATIONS
  // ============================================

  /**
   * Get account by code
   */
  async getAccount(uid, accountCode) {
    try {
      const doc = await this.db.collection("users").doc(uid)
        .collection("chart_of_accounts")
        .doc(accountCode)
        .get();

      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error("Error getting account:", error);
      return null;
    }
  }

  /**
   * Create new account
   */
  async createAccount(uid, accountData) {
    try {
      const accountCode = accountData.account_code;
      
      const account = {
        account_code: accountCode,
        account_name: accountData.account_name,
        account_type: accountData.account_type || "expense",
        display_as: accountData.display_as || "hidden",
        level: accountData.level || 1,
        parent_code: accountData.parent_code || null,
        
        // Frontend compatibility
        category_name: accountData.category_name || null,
        subcategory_name: accountData.subcategory_name || null,
        legacy_category_id: accountData.legacy_category_id || null,
        legacy_subcategory_id: accountData.legacy_subcategory_id || null,
        
        // Accounting fields
        normal_balance: this.getNormalBalance(accountData.account_type),
        financial_statement: this.getFinancialStatement(accountData.account_type),
        is_active: true,
        system_account: accountData.system_account || false,
        
        // Budget
        budget_monthly: accountData.budget_monthly || 0,
        budget_annual: accountData.budget_annual || 0,
        
        // Metadata
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        created_by: accountData.created_by || "system"
      };

      await this.db.collection("users").doc(uid)
        .collection("chart_of_accounts")
        .doc(accountCode)
        .set(account);

      return accountCode;
    } catch (error) {
      console.error("Error creating account:", error);
      throw error;
    }
  }

  /**
   * Update account (for renaming, etc.)
   */
  async updateAccount(uid, accountCode, updates) {
    try {
      const allowedUpdates = {};
      
      // Only allow certain fields to be updated
      const allowedFields = [
        'account_name', 'category_name', 'subcategory_name',
        'budget_monthly', 'budget_annual', 'is_active'
      ];
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          allowedUpdates[field] = updates[field];
        }
      }
      
      allowedUpdates.updated_at = admin.firestore.FieldValue.serverTimestamp();

      await this.db.collection("users").doc(uid)
        .collection("chart_of_accounts")
        .doc(accountCode)
        .update(allowedUpdates);

      return true;
    } catch (error) {
      console.error("Error updating account:", error);
      throw error;
    }
  }

  // ============================================
  // DOUBLE-ENTRY BOOKKEEPING
  // ============================================

  /**
   * Create journal entries for a transaction
   */
  createJournalEntries(transaction) {
    const entries = [];
    const amount = Math.abs(transaction.amount);

    if (transaction.type === "expense") {
      // Debit expense account, credit cash/bank
      entries.push({
        account_code: transaction.account_code,
        debit: amount,
        credit: 0,
        description: transaction.description
      });
      
      const sourceAccount = transaction.account === "bank" ? "1100" : "1000";
      entries.push({
        account_code: sourceAccount,
        debit: 0,
        credit: amount,
        description: `Payment: ${transaction.description}`
      });
    } else if (transaction.type === "income") {
      // Debit cash/bank, credit income account
      const targetAccount = transaction.account === "bank" ? "1100" : "1000";
      entries.push({
        account_code: targetAccount,
        debit: amount,
        credit: 0,
        description: transaction.description
      });
      
      entries.push({
        account_code: "4010", // Donations account
        debit: 0,
        credit: amount,
        description: transaction.description
      });
    } else if (transaction.type === "transfer") {
      // Transfer between cash and bank
      const fromAccount = transaction.fromAccount === "bank" ? "1100" : "1000";
      const toAccount = transaction.toAccount === "bank" ? "1100" : "1000";
      
      entries.push({
        account_code: fromAccount,
        debit: 0,
        credit: amount,
        description: `Transfer to ${transaction.toAccount}`
      });
      
      entries.push({
        account_code: toAccount,
        debit: amount,
        credit: 0,
        description: `Transfer from ${transaction.fromAccount}`
      });
    }

    return entries;
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  getNormalBalance(accountType) {
    // Assets and Expenses have normal debit balance
    // Liabilities, Equity, and Income have normal credit balance
    return ["asset", "expense"].includes(accountType) ? "debit" : "credit";
  }

  getFinancialStatement(accountType) {
    // Assets, Liabilities, Equity go on Balance Sheet
    // Income and Expenses go on Income Statement
    return ["asset", "liability", "equity"].includes(accountType) 
      ? "balance_sheet" 
      : "income_statement";
  }

  /**
   * Initialize default chart of accounts for new user
   */
  async initializeDefaultChart(uid) {
    const defaultAccounts = [
      // Asset accounts
      { account_code: "1000", account_name: "Cash on Hand", account_type: "asset", display_as: "hidden" },
      { account_code: "1100", account_name: "Bank Account", account_type: "asset", display_as: "hidden" },
      
      // Income accounts
      { account_code: "4000", account_name: "Income", account_type: "income", display_as: "hidden" },
      { account_code: "4010", account_name: "Donations", account_type: "income", display_as: "hidden", parent_code: "4000" },
      
      // Expense categories (visible to frontend)
      { 
        account_code: "5100", 
        account_name: "Administrative Expenses", 
        account_type: "expense",
        display_as: "category",
        category_name: "Operations",
        legacy_category_id: "CAT-001"
      }
    ];

    for (const account of defaultAccounts) {
      await this.createAccount(uid, account);
    }

    return true;
  }
}

module.exports = AccountsService;