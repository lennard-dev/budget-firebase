// Global admin functions that can be called from any page
// These functions are used by both the admin-tools page and settings page

/*
 * ARCHITECTURE DECISION: SEPARATE COLLECTIONS APPROACH
 * ====================================================
 * 
 * This system uses SEPARATE collections for expenses and cash movements:
 * 
 * 1. EXPENSES COLLECTION (users/{uid}/transactions):
 *    - Contains ALL expenses regardless of payment method (Cash, Card, Bank Transfer)
 *    - Cash expenses are stored here with paymentMethod: 'Cash'
 *    - No duplication or mirroring to cash-movements collection
 * 
 * 2. CASH MOVEMENTS COLLECTION (users/{uid}/cash-movements):
 *    - Contains ONLY operational cash flow events:
 *      • 'deposit' - Money coming into cash from bank
 *      • 'withdrawal' - Money going from bank to cash
 *      • 'donation' - External money coming in (cash or bank)
 *    - Does NOT contain 'cash-expense' entries (legacy only)
 * 
 * 3. BALANCE TRACKING:
 *    - Both collections have balance_after fields
 *    - Cash expenses affect cash balance directly in expenses collection
 *    - Cash movements affect both cash and bank balances as appropriate
 * 
 * 4. LEGACY CLEANUP:
 *    - Old system created 'cash-expense' entries in cash-movements
 *    - These are considered duplicates and should be removed
 *    - Use cleanupCashExpenses() to remove these legacy entries
 * 
 * This approach provides:
 * ✅ Clean separation of concerns
 * ✅ No data duplication
 * ✅ Easier maintenance and querying
 * ✅ Professional accounting practices
 */

// LEGACY CLEANUP: Remove cash-expense entries from cash-movements collection
// These are duplicates from the old mirroring approach and should not exist
window.cleanupCashExpenses = async function() {
  const statusEl = document.getElementById('cleanup-status');
  if (!statusEl) {
    console.error('Status element not found');
    return;
  }
  
  statusEl.className = 'status-message';
  statusEl.textContent = 'Cleaning up legacy cash-expense entries from cash movements...';
  statusEl.style.display = 'block';
  
  try {
    // Get all cash movements to find legacy cash-expense entries
    const response = await window.callApi('/cash-movements?limit=1000');
    if (response.success && response.data) {
      let deletedCount = 0;
      let checkedCount = 0;
      
      // Find and delete ONLY cash-expense entries (legacy duplicates)
      // These should not exist in cash-movements as per our architecture
      for (const movement of response.data) {
        checkedCount++;
        if (movement.type === 'cash-expense') {
          // This is a legacy duplicate - the real expense should be in expenses collection
          console.log(`Removing legacy cash-expense movement: ${movement.id} (${movement.description})`);
          await window.callApi(`/cash-movements/${movement.id}`, { method: 'DELETE' });
          deletedCount++;
        }
      }
      
      statusEl.className = 'status-message success';
      statusEl.textContent = `✅ Cleanup complete! Checked ${checkedCount} movements, removed ${deletedCount} legacy cash-expense entries. Cash movements now contain only operational flows (deposits, withdrawals, donations).`;
    }
  } catch (error) {
    statusEl.className = 'status-message error';
    statusEl.textContent = `❌ Cleanup failed: ${error.message}`;
  }
}

window.analyzeCashData = async function() {
  const resultsEl = document.getElementById('analysis-results');
  const contentEl = document.getElementById('analysis-content');
  
  if (!resultsEl || !contentEl) {
    console.error('Analysis elements not found');
    return;
  }
  
  try {
    // Fetch all data
    const [expensesRes, movementsRes] = await Promise.all([
      window.callApi('/expenses?limit=1000'),
      window.callApi('/cash-movements?limit=1000')
    ]);
    
    let analysis = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">';
    
    // Left column - Expenses Summary
    analysis += '<div>';
    analysis += '<h4 style="margin-top: 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">💰 Expenses Summary</h4>';
    analysis += '<table class="table" style="width: 100%;">';
    analysis += '<tr><th>Type</th><th>Count</th><th>Total Amount</th></tr>';
    
    if (expensesRes.success && expensesRes.data) {
      const expenses = expensesRes.data;
      const cashExpenses = expenses.filter(e => e.paymentMethod === 'Cash');
      const cardExpenses = expenses.filter(e => e.paymentMethod === 'Card');
      const bankExpenses = expenses.filter(e => e.paymentMethod === 'Bank Transfer');
      const otherExpenses = expenses.filter(e => !['Cash', 'Card', 'Bank Transfer'].includes(e.paymentMethod));
      
      // Calculate totals
      const totalAmount = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const cashTotal = cashExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const cardTotal = cardExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const bankTotal = bankExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const otherTotal = otherExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      
      analysis += `<tr style="font-weight: bold;"><td>All Expenses</td><td>${expenses.length}</td><td>€${totalAmount.toFixed(2)}</td></tr>`;
      analysis += `<tr><td>&nbsp;&nbsp;💵 Cash</td><td>${cashExpenses.length}</td><td>€${cashTotal.toFixed(2)}</td></tr>`;
      analysis += `<tr><td>&nbsp;&nbsp;💳 Card</td><td>${cardExpenses.length}</td><td>€${cardTotal.toFixed(2)}</td></tr>`;
      analysis += `<tr><td>&nbsp;&nbsp;🏦 Bank Transfer</td><td>${bankExpenses.length}</td><td>€${bankTotal.toFixed(2)}</td></tr>`;
      if (otherExpenses.length > 0) {
        analysis += `<tr><td>&nbsp;&nbsp;📋 Other</td><td>${otherExpenses.length}</td><td>€${otherTotal.toFixed(2)}</td></tr>`;
      }
      
      // Show categories breakdown
      const byCategory = {};
      expenses.forEach(e => {
        if (!byCategory[e.category]) {
          byCategory[e.category] = { count: 0, total: 0 };
        }
        byCategory[e.category].count++;
        byCategory[e.category].total += parseFloat(e.amount) || 0;
      });
      
      analysis += '<tr><td colspan="3" style="padding-top: 10px;"><strong>By Category:</strong></td></tr>';
      Object.entries(byCategory)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5)
        .forEach(([category, data]) => {
          analysis += `<tr><td>&nbsp;&nbsp;${category}</td><td>${data.count}</td><td>€${data.total.toFixed(2)}</td></tr>`;
        });
    } else {
      analysis += '<tr><td colspan="3">No expense data available</td></tr>';
    }
    
    analysis += '</table>';
    analysis += '</div>';
    
    // Right column - Cash Movements Summary
    analysis += '<div>';
    analysis += '<h4 style="margin-top: 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">🏦 Cash Movements Summary</h4>';
    analysis += '<table class="table" style="width: 100%;">';
    analysis += '<tr><th>Type</th><th>Count</th><th>Total Amount</th></tr>';
    
    if (movementsRes.success && movementsRes.data) {
      const movements = movementsRes.data;
      const byType = {};
      let totalIn = 0;
      let totalOut = 0;
      
      movements.forEach(m => {
        if (!byType[m.type]) {
          byType[m.type] = { count: 0, totalIn: 0, totalOut: 0 };
        }
        byType[m.type].count++;
        const amount = parseFloat(m.amount) || 0;
        
        // Determine if money is coming in or going out
        if (m.type === 'deposit' || m.type === 'donation' || m.type === 'cash-in') {
          byType[m.type].totalIn += amount;
          totalIn += amount;
        } else if (m.type === 'withdrawal' || m.type === 'cash-expense' || m.type === 'cash-out') {
          byType[m.type].totalOut += amount;
          totalOut += amount;
        } else {
          // For unknown types, check if amount is positive or negative
          if (amount > 0) {
            byType[m.type].totalIn += amount;
            totalIn += amount;
          } else {
            byType[m.type].totalOut += Math.abs(amount);
            totalOut += Math.abs(amount);
          }
        }
      });
      
      analysis += `<tr style="font-weight: bold;"><td>All Movements</td><td>${movements.length}</td><td>-</td></tr>`;
      analysis += `<tr style="color: green;"><td>&nbsp;&nbsp;📈 Total In</td><td>-</td><td>€${totalIn.toFixed(2)}</td></tr>`;
      analysis += `<tr style="color: red;"><td>&nbsp;&nbsp;📉 Total Out</td><td>-</td><td>€${totalOut.toFixed(2)}</td></tr>`;
      analysis += `<tr style="font-weight: bold;"><td>&nbsp;&nbsp;💼 Net Balance</td><td>-</td><td>€${(totalIn - totalOut).toFixed(2)}</td></tr>`;
      
      analysis += '<tr><td colspan="3" style="padding-top: 10px;"><strong>Movement Types:</strong></td></tr>';
      
      if (Object.keys(byType).length === 0) {
        analysis += '<tr><td colspan="3" style="color: #666; font-style: italic;">&nbsp;&nbsp;No real cash movements in database</td></tr>';
        analysis += '<tr><td colspan="3" style="color: #666; font-style: italic;">&nbsp;&nbsp;(Cash & Banking page shows sample data)</td></tr>';
      } else {
        for (const [type, data] of Object.entries(byType)) {
          const flag = type === 'cash-expense' ? ' ⚠️' : '';
          const total = data.totalIn > 0 ? data.totalIn : data.totalOut;
          const sign = data.totalIn > 0 ? '+' : '-';
          const color = data.totalIn > 0 ? 'green' : 'red';
          analysis += `<tr><td>&nbsp;&nbsp;${type}${flag}</td><td>${data.count}</td><td style="color: ${color};">${sign}€${total.toFixed(2)}</td></tr>`;
        }
      }
      
      // Show recent movements
      const recentMovements = movements
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);
      
      if (recentMovements.length > 0) {
        analysis += '<tr><td colspan="3" style="padding-top: 10px;"><strong>Recent Movements:</strong></td></tr>';
        recentMovements.forEach(m => {
          const date = new Date(m.date).toLocaleDateString();
          const amount = parseFloat(m.amount) || 0;
          const isIncoming = m.type === 'deposit' || m.type === 'donation' || m.type === 'cash-in';
          const sign = isIncoming ? '+' : '-';
          const color = isIncoming ? 'green' : 'red';
          analysis += `<tr><td>&nbsp;&nbsp;${date}</td><td>${m.type}</td><td style="color: ${color};">${sign}€${Math.abs(amount).toFixed(2)}</td></tr>`;
        });
      }
    } else {
      analysis += '<tr><td colspan="3">No cash movement data available</td></tr>';
    }
    
    analysis += '</table>';
    analysis += '</div>';
    analysis += '</div>';
    
    // Add warning if duplicate cash expenses are found
    if (movementsRes.success && movementsRes.data) {
      const cashExpenseMovements = movementsRes.data.filter(m => m.type === 'cash-expense');
      if (cashExpenseMovements.length > 0) {
        analysis += `<div style="margin-top: 20px; padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
          <strong>⚠️ Warning:</strong> Found ${cashExpenseMovements.length} duplicate cash expense entries in movements. 
          Use the "Remove Duplicate Cash Expenses" button above to clean these up.
        </div>`;
      }
    }
    
    contentEl.innerHTML = analysis;
    resultsEl.style.display = 'block';
    
  } catch (error) {
    contentEl.innerHTML = `<p class="text-danger">Error analyzing data: ${error.message}</p>`;
    resultsEl.style.display = 'block';
  }
}

window.generateCleanTestData = async function() {
  const statusEl = document.getElementById('generate-status');
  if (!statusEl) {
    console.error('Status element not found');
    return;
  }
  
  statusEl.className = 'status-message';
  statusEl.textContent = 'Generating clean test data...';
  statusEl.style.display = 'block';
  
  try {
    // First clear existing data
    await window.clearAllData(true);
    
    // Generate new clean data
    const response = await window.callApi('/create-dummy-data', { method: 'POST' });
    
    if (response.success) {
      statusEl.className = 'status-message success';
      statusEl.textContent = 'Successfully generated clean test data. Cash expenses are only in the expenses table.';
      
      // Run analysis to show results
      setTimeout(window.analyzeCashData, 1000);
    }
  } catch (error) {
    statusEl.className = 'status-message error';
    statusEl.textContent = `Error: ${error.message}`;
  }
}

window.clearAllData = async function(silent = false) {
  if (!silent && !confirm('Are you sure? This will delete ALL data including expenses, cash movements, budgets, etc.')) {
    return;
  }
  
  const statusEl = document.getElementById('generate-status');
  if (statusEl && !silent) {
    statusEl.className = 'status-message';
    statusEl.textContent = 'Clearing all data...';
    statusEl.style.display = 'block';
  }
  
  try {
    // Get and delete all expenses
    const expensesRes = await window.callApi('/expenses?limit=1000');
    if (expensesRes.success && expensesRes.data) {
      for (const expense of expensesRes.data) {
        await window.callApi(`/expenses/${expense.id}`, { method: 'DELETE' });
      }
    }
    
    // Get and delete all cash movements
    const movementsRes = await window.callApi('/cash-movements?limit=1000');
    if (movementsRes.success && movementsRes.data) {
      for (const movement of movementsRes.data) {
        await window.callApi(`/cash-movements/${movement.id}`, { method: 'DELETE' });
      }
    }
    
    if (statusEl && !silent) {
      statusEl.className = 'status-message success';
      statusEl.textContent = 'All data cleared successfully.';
    }
  } catch (error) {
    if (statusEl && !silent) {
      statusEl.className = 'status-message error';
      statusEl.textContent = `Error: ${error.message}`;
    }
  }
}

// REMOVED: syncCashExpensesToMovements function
// This function was part of the old mirroring approach and is no longer needed.
// With our separate collections architecture, cash expenses live only in the 
// expenses collection and should NOT be duplicated to cash-movements.

// Migration function to add balance tracking to existing transactions
window.migrateToBalanceTracking = async function() {
  const statusEl = document.getElementById('migrate-status') || document.getElementById('sync-status') || document.getElementById('cleanup-status');
  if (!statusEl) {
    console.error('Status element not found');
    return;
  }
  
  statusEl.className = 'status-message';
  statusEl.textContent = 'Starting balance tracking migration...';
  statusEl.style.display = 'block';
  
  try {
    // Step 1: Get ALL transactions
    statusEl.textContent = 'Loading all transactions...';
    const [expensesRes, movementsRes] = await Promise.all([
      window.callApi('/expenses?limit=10000'),
      window.callApi('/cash-movements?limit=10000')
    ]);
    
    const expenses = expensesRes.data || [];
    const movements = movementsRes.data || [];
    
    statusEl.textContent = `Found ${expenses.length} expenses and ${movements.length} movements. Processing...`;
    
    // Step 2: Build complete transaction history
    const allTransactions = [];
    
    // Add expenses with metadata
    expenses.forEach(exp => {
      allTransactions.push({
        ...exp,
        transactionType: 'expense',
        sortDate: new Date(exp.date),
        accountAffected: exp.paymentMethod === 'Cash' ? 'cash' : 'bank'
      });
    });
    
    // Add movements with metadata
    movements.forEach(mov => {
      let accountsAffected = [];
      if (mov.type === 'withdrawal') {
        accountsAffected = ['cash', 'bank']; // Both affected
      } else if (mov.type === 'deposit') {
        accountsAffected = ['cash', 'bank']; // Both affected
      } else if (mov.type === 'donation') {
        accountsAffected = [mov.toBank ? 'bank' : 'cash'];
      } else if (mov.type === 'cash-expense') {
        accountsAffected = ['cash'];
      }
      
      allTransactions.push({
        ...mov,
        transactionType: 'movement',
        sortDate: new Date(mov.date),
        accountsAffected: accountsAffected
      });
    });
    
    // Step 3: Sort by date (oldest first)
    allTransactions.sort((a, b) => a.sortDate - b.sortDate);
    
    statusEl.textContent = `Sorted ${allTransactions.length} transactions. Calculating balances...`;
    
    // Step 4: Calculate running balances
    // TODO: Replace with backend calculation - this is legacy migration code
    let cashBalance = 15000; // Initial cash balance
    let bankBalance = 50000; // Initial bank balance
    let updatedCount = 0;
    let auditCount = 0;
    
    for (const transaction of allTransactions) {
      const oldCashBalance = cashBalance;
      const oldBankBalance = bankBalance;
      
      // Calculate new balances based on transaction type
      if (transaction.transactionType === 'expense') {
        if (transaction.paymentMethod === 'Cash') {
          cashBalance -= Math.abs(transaction.amount);
          transaction.cash_balance_after = cashBalance;
        } else if (transaction.paymentMethod === 'Card' || transaction.paymentMethod === 'Bank Transfer') {
          bankBalance -= Math.abs(transaction.amount);
          transaction.bank_balance_after = bankBalance;
        }
      } else if (transaction.transactionType === 'movement') {
        switch(transaction.type) {
          case 'withdrawal':
            bankBalance -= Math.abs(transaction.amount);
            cashBalance += Math.abs(transaction.amount);
            transaction.bank_balance_after = bankBalance;
            transaction.cash_balance_after = cashBalance;
            break;
          case 'deposit':
            cashBalance -= Math.abs(transaction.amount);
            bankBalance += Math.abs(transaction.amount);
            transaction.cash_balance_after = cashBalance;
            transaction.bank_balance_after = bankBalance;
            break;
          case 'donation':
            if (transaction.toBank) {
              bankBalance += Math.abs(transaction.amount);
              transaction.bank_balance_after = bankBalance;
            } else {
              cashBalance += Math.abs(transaction.amount);
              transaction.cash_balance_after = cashBalance;
            }
            break;
          case 'cash-expense':
            cashBalance -= Math.abs(transaction.amount);
            transaction.cash_balance_after = cashBalance;
            break;
        }
      }
      
      // Step 5: Update transaction with balance_after fields
      if (!transaction.cash_balance_after && !transaction.bank_balance_after) {
        console.warn('Transaction has no balance updates:', transaction);
        continue;
      }
      
      try {
        const endpoint = transaction.transactionType === 'expense' 
          ? `/expenses/${transaction.id}`
          : `/cash-movements/${transaction.id}`;
        
        // Create update payload with only balance fields
        const updatePayload = {};
        if (transaction.cash_balance_after !== undefined) {
          updatePayload.cash_balance_after = transaction.cash_balance_after;
        }
        if (transaction.bank_balance_after !== undefined) {
          updatePayload.bank_balance_after = transaction.bank_balance_after;
        }
        
        await window.callApi(endpoint, {
          method: 'PATCH',
          body: JSON.stringify(updatePayload)
        });
        
        updatedCount++;
        
        // Step 6: Create audit log entry
        if (window.BalanceManager) {
          // Create audit logs for affected accounts
          if (transaction.cash_balance_after !== undefined && oldCashBalance !== transaction.cash_balance_after) {
            await window.BalanceManager.createAuditLog({
              transaction_id: transaction.id,
              transaction_type: transaction.transactionType,
              account: 'cash',
              balance_before: oldCashBalance,
              balance_after: transaction.cash_balance_after,
              change_amount: transaction.cash_balance_after - oldCashBalance,
              description: transaction.description || `${transaction.category} - ${transaction.subcategory}`,
              date: transaction.date,
              timestamp: new Date().toISOString(),
              is_migration: true
            });
            auditCount++;
          }
          
          if (transaction.bank_balance_after !== undefined && oldBankBalance !== transaction.bank_balance_after) {
            await window.BalanceManager.createAuditLog({
              transaction_id: transaction.id,
              transaction_type: transaction.transactionType,
              account: 'bank',
              balance_before: oldBankBalance,
              balance_after: transaction.bank_balance_after,
              change_amount: transaction.bank_balance_after - oldBankBalance,
              description: transaction.description || `${transaction.category} - ${transaction.subcategory}`,
              date: transaction.date,
              timestamp: new Date().toISOString(),
              is_migration: true
            });
            auditCount++;
          }
        }
        
        // Update status periodically
        if (updatedCount % 10 === 0) {
          statusEl.textContent = `Migrated ${updatedCount} of ${allTransactions.length} transactions...`;
        }
        
      } catch (error) {
        console.error(`Failed to update transaction ${transaction.id}:`, error);
      }
    }
    
    // Step 7: Create final balance snapshots
    if (window.BalanceManager) {
      await window.BalanceManager.updateBalanceSnapshot('cash', cashBalance);
      await window.BalanceManager.updateBalanceSnapshot('bank', bankBalance);
    }
    
    statusEl.className = 'status-message success';
    statusEl.textContent = `Migration complete! Updated ${updatedCount} transactions with balance tracking. Created ${auditCount} audit log entries. Final balances - Cash: €${cashBalance.toFixed(2)}, Bank: €${bankBalance.toFixed(2)}`;
    
    // Refresh the page data
    if (window.analyzeCashData) {
      setTimeout(() => window.analyzeCashData(), 1000);
    }
    
  } catch (error) {
    statusEl.className = 'status-message error';
    statusEl.textContent = `Migration failed: ${error.message}`;
    console.error('Migration error:', error);
  }
}

// Professional migration function using PATCH API endpoints
window.migrateToBalanceTracking = async function() {
  const statusEl = document.getElementById('migrate-status');
  if (!statusEl) {
    console.error('Status element not found');
    return;
  }
  
  statusEl.className = 'status-message';
  statusEl.textContent = 'Starting professional balance tracking migration...';
  statusEl.style.display = 'block';
  
  try {
    // Step 1: Get ALL transactions
    statusEl.textContent = 'Loading all transactions...';
    const [expensesRes, movementsRes] = await Promise.all([
      window.callApi('/expenses?limit=10000'),
      window.callApi('/cash-movements?limit=10000')
    ]);
    
    const expenses = expensesRes.data || [];
    const movements = movementsRes.data || [];
    
    statusEl.textContent = `Found ${expenses.length} expenses and ${movements.length} movements. Processing...`;
    
    // Step 2: Build complete transaction history
    const allTransactions = [];
    
    // Add expenses with metadata
    expenses.forEach(exp => {
      allTransactions.push({
        ...exp,
        transactionType: 'expense',
        sortDate: new Date(exp.date),
        accountAffected: exp.paymentMethod === 'Cash' ? 'cash' : 'bank'
      });
    });
    
    // Add movements with metadata
    movements.forEach(mov => {
      let accountsAffected = [];
      if (mov.type === 'withdrawal') {
        accountsAffected = ['cash', 'bank']; // Both affected
      } else if (mov.type === 'deposit') {
        accountsAffected = ['cash', 'bank']; // Both affected
      } else if (mov.type === 'donation') {
        accountsAffected = [mov.toBank ? 'bank' : 'cash'];
      } else if (mov.type === 'cash-expense') {
        accountsAffected = ['cash'];
      } else {
        accountsAffected = ['cash']; // Default to cash for unknown types
      }
      
      allTransactions.push({
        ...mov,
        transactionType: 'movement',
        sortDate: new Date(mov.date),
        accountsAffected: accountsAffected
      });
    });
    
    // Step 3: Sort by date (oldest first)
    allTransactions.sort((a, b) => {
      const dateDiff = a.sortDate - b.sortDate;
      if (dateDiff !== 0) return dateDiff;
      // Use createdAt as tiebreaker if available
      if (a.createdAt && b.createdAt) {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      return 0;
    });
    
    statusEl.textContent = `Sorted ${allTransactions.length} transactions. Calculating balances...`;
    
    // Step 4: Calculate running balances
    // TODO: Replace with backend calculation - this is legacy migration code
    let cashBalance = 15000; // Initial cash balance
    let bankBalance = 50000; // Initial bank balance
    let updatedCount = 0;
    let auditCount = 0;
    let snapshotCount = 0;
    
    for (const transaction of allTransactions) {
      const oldCashBalance = cashBalance;
      const oldBankBalance = bankBalance;
      
      // Calculate new balances based on transaction type
      if (transaction.transactionType === 'expense') {
        if (transaction.paymentMethod === 'Cash') {
          cashBalance -= Math.abs(transaction.amount);
          transaction.cash_balance_after = cashBalance;
        } else if (transaction.paymentMethod === 'Card' || transaction.paymentMethod === 'Bank Transfer') {
          bankBalance -= Math.abs(transaction.amount);
          transaction.bank_balance_after = bankBalance;
        }
      } else if (transaction.transactionType === 'movement') {
        switch(transaction.type) {
          case 'withdrawal':
            bankBalance -= Math.abs(transaction.amount);
            cashBalance += Math.abs(transaction.amount);
            transaction.bank_balance_after = bankBalance;
            transaction.cash_balance_after = cashBalance;
            break;
          case 'deposit':
            cashBalance -= Math.abs(transaction.amount);
            bankBalance += Math.abs(transaction.amount);
            transaction.cash_balance_after = cashBalance;
            transaction.bank_balance_after = bankBalance;
            break;
          case 'donation':
            if (transaction.toBank) {
              bankBalance += Math.abs(transaction.amount);
              transaction.bank_balance_after = bankBalance;
            } else {
              cashBalance += Math.abs(transaction.amount);
              transaction.cash_balance_after = cashBalance;
            }
            break;
          case 'cash-expense':
            cashBalance -= Math.abs(transaction.amount);
            transaction.cash_balance_after = cashBalance;
            break;
          default:
            // For unknown movement types, assume cash outflow
            cashBalance -= Math.abs(transaction.amount);
            transaction.cash_balance_after = cashBalance;
            break;
        }
      }
      
      // Step 5: Update transaction with balance_after fields using PATCH
      if (transaction.cash_balance_after !== undefined || transaction.bank_balance_after !== undefined) {
        try {
          const endpoint = transaction.transactionType === 'expense' 
            ? `/expenses/${transaction.id}`
            : `/cash-movements/${transaction.id}`;
          
          // Create update payload with only balance fields
          const updatePayload = {};
          if (transaction.cash_balance_after !== undefined) {
            updatePayload.cash_balance_after = transaction.cash_balance_after;
          }
          if (transaction.bank_balance_after !== undefined) {
            updatePayload.bank_balance_after = transaction.bank_balance_after;
          }
          
          // Try PATCH first, fallback to POST if not supported
          let updateSuccess = false;
          try {
            await window.callApi(endpoint, {
              method: 'PATCH',
              body: JSON.stringify(updatePayload)
            });
            updateSuccess = true;
            updatedCount++;
          } catch (patchError) {
            console.warn(`PATCH failed for ${transaction.id}, trying POST fallback:`, patchError.message);
            
            // Fallback: try updating with POST (full record)
            try {
              const fullPayload = { ...transaction, ...updatePayload };
              delete fullPayload.transactionType;
              delete fullPayload.sortDate;
              delete fullPayload.accountAffected;
              delete fullPayload.accountsAffected;
              
              await window.callApi(endpoint, {
                method: 'POST',
                body: JSON.stringify(fullPayload)
              });
              updateSuccess = true;
              updatedCount++;
              console.log(`POST fallback successful for ${transaction.id}`);
            } catch (postError) {
              console.error(`Both PATCH and POST failed for ${transaction.id}:`, postError.message);
              // Continue with other transactions
            }
          }
          
          // Step 6: Create audit log entries (only if update was successful)
          if (updateSuccess) {
            try {
              if (transaction.cash_balance_after !== undefined && oldCashBalance !== transaction.cash_balance_after) {
                await window.callApi('/audit-logs', {
                  method: 'POST',
                  body: JSON.stringify({
                    transaction_id: transaction.id,
                    transaction_type: transaction.transactionType,
                    account: 'cash',
                    balance_before: oldCashBalance,
                    balance_after: transaction.cash_balance_after,
                    change_amount: transaction.cash_balance_after - oldCashBalance,
                    description: transaction.description || `${transaction.category || transaction.type} - ${transaction.subcategory || 'N/A'}`,
                    date: transaction.date,
                    is_migration: true
                  })
                });
                auditCount++;
              }
              
              if (transaction.bank_balance_after !== undefined && oldBankBalance !== transaction.bank_balance_after) {
                await window.callApi('/audit-logs', {
                  method: 'POST',
                  body: JSON.stringify({
                    transaction_id: transaction.id,
                    transaction_type: transaction.transactionType,
                    account: 'bank',
                    balance_before: oldBankBalance,
                    balance_after: transaction.bank_balance_after,
                    change_amount: transaction.bank_balance_after - oldBankBalance,
                    description: transaction.description || `${transaction.category || transaction.type} - ${transaction.subcategory || 'N/A'}`,
                    date: transaction.date,
                    is_migration: true
                  })
                });
                auditCount++;
              }
            } catch (auditError) {
              console.warn(`Failed to create audit log for ${transaction.id}:`, auditError.message);
              // Continue even if audit logs fail
            }
          }
          
          // Update status periodically
          if (updatedCount % 10 === 0) {
            statusEl.textContent = `Migrated ${updatedCount} of ${allTransactions.length} transactions...`;
          }
          
        } catch (error) {
          console.error(`Failed to update transaction ${transaction.id}:`, error);
        }
      }
    }
    
    // Step 7: Create final balance snapshots
    try {
      await window.callApi('/balance-snapshots', {
        method: 'POST',
        body: JSON.stringify({
          account: 'cash',
          balance: cashBalance,
          transaction_id: 'migration_final'
        })
      });
      snapshotCount++;
      
      await window.callApi('/balance-snapshots', {
        method: 'POST',
        body: JSON.stringify({
          account: 'bank',
          balance: bankBalance,
          transaction_id: 'migration_final'
        })
      });
      snapshotCount++;
    } catch (error) {
      console.error('Failed to create balance snapshots:', error);
    }
    
    statusEl.className = 'status-message success';
    statusEl.textContent = `🎉 Professional migration complete! Updated ${updatedCount} transactions, created ${auditCount} audit logs, and ${snapshotCount} balance snapshots. Final balances - Cash: €${cashBalance.toFixed(2)}, Bank: €${bankBalance.toFixed(2)}`;
    
    // Show comprehensive success alert
    alert(`Professional Balance Tracking Migration Complete! 🎉\n\nResults:\n• ${updatedCount} transactions updated with balance_after fields\n• ${auditCount} audit log entries created\n• ${snapshotCount} balance snapshots created\n• Final Cash Balance: €${cashBalance.toFixed(2)}\n• Final Bank Balance: €${bankBalance.toFixed(2)}\n\nYour system now has QuickBooks-style balance tracking!`);
    
    // Refresh the page data
    if (window.analyzeCashData) {
      setTimeout(() => window.analyzeCashData(), 1000);
    }
    
  } catch (error) {
    statusEl.className = 'status-message error';
    statusEl.textContent = `❌ Migration failed: ${error.message}`;
    console.error('Migration error:', error);
  }
};

console.log('Admin functions loaded and available globally');