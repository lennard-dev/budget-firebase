(function() {
  'use strict';

  const tbody = () => document.getElementById('tbody');

  async function fetchFilters() {
    // Can be extended to load categories/payment methods for filter dropdowns
  }

  async function loadExpenses() {
    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;
    
    // Use TransactionService to get expenses
    const filters = {
      type: 'expense',
      limit: 1000
    };
    if (start) filters.startDate = start;
    if (end) filters.endDate = end;
    
    const expenses = await window.TransactionService.getList(filters);
    renderExpenses(expenses || []);
  }

  function renderExpenses(expenses) {
    const body = tbody();
    body.innerHTML = '';
    expenses.forEach(exp => {
      const tr = document.createElement('tr');
      // Extract receipt ID from metadata
      const receiptId = exp.metadata?.receiptId || '';
      const paymentMethod = exp.metadata?.paymentMethod || (exp.account === 'cash' ? 'Cash' : 'Bank Transfer');
      
      tr.innerHTML = `
        <td>${exp.date}</td>
        <td><code>${receiptId}</code></td>
        <td>${exp.category || ''}</td>
        <td>${exp.subcategory || ''}</td>
        <td>${(exp.description||'').replace(/</g,'&lt;')}</td>
        <td style="text-align:right;">€${Math.abs(exp.amount||0).toFixed(2)}</td>
        <td>${paymentMethod}</td>
        <td><button data-id="${exp.id}" class="del">Delete</button></td>
      `;
      body.appendChild(tr);
    });
    document.querySelectorAll('.del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!confirm('Delete expense?')) return;
        // For now, voiding transaction
        await window.TransactionService.update(id, { voided: true });
        await loadExpenses();
      });
    });
  }

  async function addRandomExpense() {
    const today = new Date().toISOString().slice(0,10);
    await window.TransactionService.create('expense', {
      date: today,
      amount: Math.round(Math.random()*10000)/100,
      description: 'Sample expense',
      category: 'Other',
      subcategory: 'General',
      paymentMethod: 'Bank Transfer',
      receiptId: ''
    });
    await loadExpenses();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const loadBtn = document.getElementById('load');
    const addBtn = document.getElementById('add');
    if (loadBtn) loadBtn.addEventListener('click', loadExpenses);
    if (addBtn) addBtn.addEventListener('click', addRandomExpense);
    auth.onAuthStateChanged((u) => { if (u) loadExpenses(); });
  });

  // expose when needed
  window.loadExpenses = loadExpenses;
})();


