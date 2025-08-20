(function() {
  'use strict';

  async function loadSettings() {
    const res = await window.callApi('/settings');
    const s = res.data || {};
    document.getElementById('org').value = s.orgName || 'Paréa Lesvos';
    document.getElementById('cur').value = s.currency || 'EUR';
    document.getElementById('fys').value = s.fiscalYearStart || '1';
  }

  async function saveSettings() {
    await window.callApi('/settings', {
      method: 'POST',
      body: JSON.stringify({
        orgName: document.getElementById('org').value,
        currency: document.getElementById('cur').value,
        fiscalYearStart: document.getElementById('fys').value
      })
    });
    alert('Saved');
  }

  // ===== Categories =====
  async function loadCategories() {
    const res = await window.callApi('/categories');
    const list = res.data || [];
    const tbody = document.getElementById('categories');
    tbody.innerHTML = list.map(cat => `
      <tr>
        <td>${escapeHtml(cat.name)}</td>
        <td><code>${escapeHtml(cat.code||'')}</code></td>
        <td><small>${(cat.subcategories||[]).map(escapeHtml).join(', ')}</small></td>
        <td>${cat.active !== false ? 'Active' : 'Inactive'}</td>
        <td>
          <button data-action="edit-cat" data-id="${cat.id}">Edit</button>
          <button data-action="toggle-cat" data-id="${cat.id}">${cat.active !== false ? 'Deactivate' : 'Activate'}</button>
        </td>
      </tr>
    `).join('');
  }

  async function addOrEditCategory(existing) {
    const name = prompt('Category name', existing?.name || '');
    if (!name) return;
    const code = prompt('Category code (2-3 letters)', existing?.code || '');
    if (!code) return;
    const sub = prompt('Subcategories (comma separated)', (existing?.subcategories||[]).join(', '));
    const body = { id: existing?.id, name, code: code.toUpperCase(), subcategories: (sub||'').split(',').map(s=>s.trim()).filter(Boolean), active: existing?.active !== false };
    await window.callApi('/categories', { method:'POST', body: JSON.stringify(body) });
    await loadCategories();
  }

  async function toggleCategory(id, newStatus) {
    await window.callApi(`/categories/${id}/status`, { method:'PATCH', body: JSON.stringify({ active: newStatus }) });
    await loadCategories();
  }

  // ===== Payment Methods =====
  async function loadPayments() {
    const res = await window.callApi('/paymentMethods');
    const list = res.data || [];
    const tbody = document.getElementById('payments');
    tbody.innerHTML = list.map(pm => `
      <tr>
        <td>${escapeHtml(pm.name)}</td>
        <td>${pm.sortOrder||0}</td>
        <td>${pm.active !== false ? 'Active' : 'Inactive'}</td>
        <td>
          <button data-action="edit-pm" data-id="${pm.id}">Edit</button>
          <button data-action="toggle-pm" data-id="${pm.id}">${pm.active !== false ? 'Deactivate' : 'Activate'}</button>
        </td>
      </tr>
    `).join('');
  }

  async function addOrEditPayment(existing) {
    const name = prompt('Method name', existing?.name || '');
    if (!name) return;
    const sort = Number(prompt('Sort order (number)', existing?.sortOrder ?? 999)) || 999;
    const body = { id: existing?.id, name, sortOrder: sort, active: existing?.active !== false };
    await window.callApi('/paymentMethods', { method:'POST', body: JSON.stringify(body) });
    await loadPayments();
  }

  async function togglePayment(id, newStatus) {
    await window.callApi(`/paymentMethods/${id}/status`, { method:'PATCH', body: JSON.stringify({ active: newStatus }) });
    await loadPayments();
  }

  // ===== Donors =====
  async function loadDonors() {
    const res = await window.callApi('/donors');
    const list = res.data || [];
    const tbody = document.getElementById('donors');
    tbody.innerHTML = list.map(d => `
      <tr>
        <td>${escapeHtml(d.name)}</td>
        <td>${escapeHtml(d.organization||'')}</td>
        <td>${escapeHtml(d.email||'')}</td>
        <td>${escapeHtml(d.phone||'')}</td>
        <td>${d.active !== false ? 'Active' : 'Inactive'}</td>
        <td>
          <button data-action="edit-donor" data-id="${d.id}">Edit</button>
          <button data-action="toggle-donor" data-id="${d.id}">${d.active !== false ? 'Deactivate' : 'Activate'}</button>
        </td>
      </tr>
    `).join('');
  }

  async function addOrEditDonor(existing) {
    const name = prompt('Donor name', existing?.name || '');
    if (!name) return;
    const organization = prompt('Organization', existing?.organization || '') || '';
    const email = prompt('Email', existing?.email || '') || '';
    const phone = prompt('Phone', existing?.phone || '') || '';
    const notes = prompt('Notes', existing?.notes || '') || '';
    const body = { id: existing?.id, name, organization, email, phone, notes, active: existing?.active !== false };
    await window.callApi('/donors', { method:'POST', body: JSON.stringify(body) });
    await loadDonors();
  }

  async function toggleDonor(id, newStatus) {
    await window.callApi(`/donors/${id}/status`, { method:'PATCH', body: JSON.stringify({ active: newStatus }) });
    await loadDonors();
  }

  // Utility
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const saveBtn = document.getElementById('save');
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);
    // Add buttons
    document.getElementById('addCategory')?.addEventListener('click', () => addOrEditCategory());
    document.getElementById('addPayment')?.addEventListener('click', () => addOrEditPayment());
    document.getElementById('addDonor')?.addEventListener('click', () => addOrEditDonor());

    // Row button delegation
    document.addEventListener('click', async (e) => {
      const el = e.target;
      const id = el.getAttribute('data-id');
      const action = el.getAttribute('data-action');
      if (!action) return;
      if (action === 'edit-cat') {
        // Load existing row data from DOM
        const tr = el.closest('tr');
        const existing = {
          id,
          name: tr.children[0].textContent,
          code: tr.children[1].textContent,
          subcategories: tr.children[2].textContent.split(',').map(s=>s.trim()).filter(Boolean),
          active: tr.children[3].textContent === 'Active'
        };
        await addOrEditCategory(existing);
      }
      if (action === 'toggle-cat') {
        const active = el.textContent === 'Deactivate';
        await toggleCategory(id, !active);
      }
      if (action === 'edit-pm') {
        const tr = el.closest('tr');
        const existing = {
          id,
          name: tr.children[0].textContent,
          sortOrder: Number(tr.children[1].textContent)||999,
          active: tr.children[2].textContent === 'Active'
        };
        await addOrEditPayment(existing);
      }
      if (action === 'toggle-pm') {
        const active = el.textContent === 'Deactivate';
        await togglePayment(id, !active);
      }
      if (action === 'edit-donor') {
        const tr = el.closest('tr');
        const existing = {
          id,
          name: tr.children[0].textContent,
          organization: tr.children[1].textContent,
          email: tr.children[2].textContent,
          phone: tr.children[3].textContent,
          active: tr.children[4].textContent === 'Active'
        };
        await addOrEditDonor(existing);
      }
      if (action === 'toggle-donor') {
        const active = el.textContent === 'Deactivate';
        await toggleDonor(id, !active);
      }
    });

    auth.onAuthStateChanged(async (u) => {
      if (u) {
        await loadSettings();
        await Promise.all([loadCategories(), loadPayments(), loadDonors()]);
      }
    });
  });
})();


