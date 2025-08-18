// Minimal frontend bootstrap: Auth + API helper with polished sign-in UX

let currentUser = null;

function select(selector) {
  return document.querySelector(selector);
}

function apiBase() {
  // Check if we're in a development environment (non-standard ports)
  const port = window.location.port;
  const hostname = window.location.hostname;

  // If running on localhost with non-standard port (not 5000), point to Firebase hosting
  if (hostname === 'localhost' && port && port !== '5000' && port !== '80' && port !== '443') {
    console.log('Development environment detected, using Firebase hosting API base');
    return "http://localhost:5000/api";
  }

  // Production, Firebase hosting, or standard ports - functions are exposed at /api via rewrite
  return "/api";
}

async function callApi(path, options = {}) {
  try {
    // Ensure we always work with a fresh user reference
    let user = currentUser || (firebase.auth && firebase.auth().currentUser);

    // If no user, wait a moment and try again (for race conditions)
    if (!user && firebase.auth) {
      await new Promise(resolve => setTimeout(resolve, 200));
      user = currentUser || firebase.auth().currentUser;
    }

    if (!user) throw new Error("Not signed in");

    const token = await user.getIdToken(true); // Force refresh token

    // Add timestamp to bypass cache
    const separator = path.includes('?') ? '&' : '?';
    const cacheBuster = `${separator}_t=${Date.now()}`;

    const url = `${apiBase()}${path}${cacheBuster}`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache", // Force no cache
      "X-Dev-Mode": window.location.hostname === 'localhost' ? 'true' : 'false',
      ...(options.headers || {}),
    };

    console.log('Making API request to:', url);
    console.log('Request headers:', headers);
    console.log('Token being sent:', token.substring(0, 20) + '...');

    const res = await fetch(url, {
      ...options,
      cache: "no-cache", // Disable cache
      headers,
    });

    console.log('API response status:', res.status, res.statusText);

    if (!res.ok) {
      let errorMessage;
      try {
        const text = await res.text();
        errorMessage = text || res.statusText;
      } catch (e) {
        errorMessage = res.statusText;
      }
      console.error('API error:', errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const data = await res.json();
      console.log('API success:', path, data);
      return data;
    } catch (e) {
      console.error('Failed to parse JSON response:', e);
      throw new Error('Invalid JSON response from server');
    }
  } catch (error) {
    console.error('callApi error for', path, ':', error);
    throw error;
  }
}

function show(el) { if (el) el.style.display = ""; }
function hide(el) { if (el) el.style.display = "none"; }
function setText(el, text) { if (el) el.textContent = text; }

// Test API connectivity
async function testApiConnectivity() {
  const baseUrl = apiBase();
  console.log('Testing API connectivity to:', baseUrl);

  try {
    // Try a simple fetch to the base API URL
    const response = await fetch(baseUrl.replace('/api', '/'), {
      method: 'GET',
      mode: 'cors'
    });
    console.log('Base URL test response:', response.status);
    return true;
  } catch (error) {
    console.error('API connectivity test failed:', error);
    return false;
  }
}

function setAuthLoading(loading) {
  const btn = select('#google-signin');
  const spinner = select('#auth-spinner');
  if (btn) btn.disabled = !!loading;
  if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
}

function renderError(message) {
  const err = select('#auth-error');
  if (err) {
    err.textContent = message || '';
    err.style.display = message ? 'block' : 'none';
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log('DOM loaded, waiting for Firebase to initialize...');

  // Wait for Firebase to be fully initialized
  let retries = 0;
  while ((!window.firebase || !window.firebase.auth) && retries < 20) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }

  // If Firebase didn't load or initialize properly, try fallback
  if (!window.firebase || !window.firebase.auth) {
    console.log('Auto-initialization failed, trying fallback configuration...');
    try {
      if (window.initializeFirebaseWithFallback) {
        await window.initializeFirebaseWithFallback();
        console.log('Firebase initialized with fallback configuration');
      } else {
        throw new Error('Fallback configuration not available');
      }
    } catch (e) {
      console.error('Firebase initialization failed:', e);
      renderError('Failed to initialize authentication. Please refresh the page or check your network connection.');
      return;
    }
  }
  
  console.log('Firebase initialized, setting up auth...');
  const auth = firebase.auth();
  const provider = new firebase.auth.GoogleAuthProvider();

  // Set persistence before doing anything else
  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    console.log('Auth persistence set to LOCAL');
  } catch (e) {
    console.error('Failed to set persistence:', e);
  }

  // Check for redirect result AFTER persistence is set
  try {
    console.log('Checking for redirect result...');
    const result = await auth.getRedirectResult();
    if (result && result.user) {
      console.log('Redirect sign-in successful:', result.user.email);
      currentUser = result.user;
      // The onAuthStateChanged listener will handle the UI update
    } else {
      console.log('No redirect result found');
    }
  } catch (e) {
    console.error('Redirect sign-in error:', e);
    renderError(prettyAuthError(e));
  }

  const btn = select('#google-signin');
  if (btn) {
    btn.addEventListener('click', async () => {
      console.log('Sign-in button clicked');
      renderError('');
      setAuthLoading(true);
      try {
        // Try popup first, fallback to redirect if it fails
        try {
          console.log('Attempting popup sign-in...');
          const result = await auth.signInWithPopup(provider);
          console.log('Popup sign-in successful:', result.user.email);
          setAuthLoading(false);
        } catch (popupError) {
          console.log('Popup failed, trying redirect...', popupError.code);
          // If popup fails, use redirect
          if (popupError.code === 'auth/popup-blocked' || 
              popupError.code === 'auth/popup-closed-by-user' ||
              popupError.code === 'auth/cancelled-popup-request' ||
              popupError.message.includes('popup')) {
            console.log('Using redirect authentication...');
            await auth.signInWithRedirect(provider);
          } else {
            throw popupError;
          }
        }
      } catch (e) {
        console.error('Sign-in failed:', e);
        renderError(prettyAuthError(e));
        setAuthLoading(false);
      }
    });
  }

  // Test login button for local emulator - bypasses Firebase auth completely
  const testBtn = select('#test-signin');
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      console.log('Test sign-in button clicked');
      renderError('');
      setAuthLoading(true);
      
      // Check if we're running on localhost or emulator
      const isLocal = window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('localhost');

      if (!isLocal) {
        renderError('Test login is only available on localhost for security reasons');
        setAuthLoading(false);
        return;
      }

      // Create a mock user object that mimics Firebase auth user
      const mockUser = {
        uid: 'test-admin-user-001',
        email: 'admin@test.local',
        displayName: 'Admin User (Test Mode)',
        photoURL: null,
        emailVerified: true,
        isAnonymous: false,
        // Mock the getIdToken method for API calls
        getIdToken: async () => {
          // Return a mock token that identifies this as a test user
          return 'mock-test-token-' + Date.now();
        },
        // Add other Firebase user methods as needed
        updateProfile: async (profile) => {
          Object.assign(mockUser, profile);
          return Promise.resolve();
        }
      };

      // Set the mock user as current user
      currentUser = mockUser;
      console.log('Test mode activated with mock admin user');
      
      // Hide auth screen and show content
      const authEl = select('#auth');
      const contentEl = select('#content');
      
      if (authEl) hide(authEl);
      if (contentEl) show(contentEl);
      
      // Initialize app shell
      if (!window._appShellReady) {
        try {
          await initializeAppShell();
          console.log('App shell initialized in test mode');
        } catch (e) {
          console.error('Failed to initialize app shell:', e);
        }
      } else {
        window.switchPage(defaultRoute());
      }
      
      setAuthLoading(false);
      
      // Set a flag to indicate test mode
      window._testMode = true;
    });
  }

  const signout = select('#signout');
  if (signout) {
    signout.addEventListener('click', async () => {
      console.log('Signing out...');
      try { 
        await auth.signOut();
        console.log('Sign out successful');
      } catch (e) { 
        console.error('Sign out error:', e); 
      }
    });
  }

  // Track initialization state
  let authInitialized = false;
  
  // Set up auth state listener
  auth.onAuthStateChanged(async (user) => {
    console.log('Auth state changed:', user ? user.email : 'null', 'Initialized:', authInitialized);
    
    // Prevent multiple rapid state changes from causing issues
    if (authInitialized && currentUser === user) {
      console.log('Auth state unchanged, skipping update');
      return;
    }
    
    currentUser = user;
    const authEl = select('#auth');
    const contentEl = select('#content');
    
    if (user) {
      console.log('User authenticated, showing content...');
      // Clear any auth errors
      renderError('');
      setAuthLoading(false);
      
      if (authEl) hide(authEl);
      if (contentEl) show(contentEl);
      
      // Only initialize app shell once
      if (!window._appShellReady) {
        try { 
          await initializeAppShell(); 
          console.log('App shell initialized');
        } catch (e) { 
          console.error('Failed to initialize app shell:', e); 
        }
      } else {
        // Just switch to the default route if already initialized
        window.switchPage(defaultRoute());
      }
    } else {
      console.log('No user, showing auth screen...');
      if (authEl) show(authEl);
      if (contentEl) hide(contentEl);
      // Reset app shell state when signed out
      window._appShellReady = false;
    }
    
    authInitialized = true;
  });
  
  // Wait a moment for auth state to settle
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Check current user after listener is set up
  const currentAuthUser = auth.currentUser;
  if (currentAuthUser) {
    console.log('Current user already exists:', currentAuthUser.email);
    currentUser = currentAuthUser;
  } else {
    console.log('No current user on initial check');
  }

  // Debug helper - add to window for manual testing
  window.debugAuth = {
    signOut: () => auth.signOut(),
    getCurrentUser: () => auth.currentUser,
    clearCache: () => {
      localStorage.clear();
      sessionStorage.clear();
      location.reload();
    }
  };
});

function prettyAuthError(err) {
  const raw = (err && (err.message || err.code)) || '';
  const msg = raw.toLowerCase();
  if (msg.includes('configuration') && msg.includes('not') && msg.includes('found')) {
    return 'Authentication is not fully configured for this site. Please ensure Google Sign-In is enabled and this domain is authorized in Firebase Authentication settings.';
  }
  if (msg.includes('unauthorized domain')) {
    return 'This domain is not authorized for OAuth in Firebase Authentication. Add your domain in Firebase Console → Authentication → Settings → Authorized domains.';
  }
  if (msg.includes('popup')) {
    return 'The browser blocked the sign-in popup. Please allow popups for this site or try again.';
  }
  return 'Sign-in failed. Please try again.';
}

// Expose helpers for other pages
window.callApi = callApi;
window.getCurrentUser = () => currentUser;

// ================= SPA Shell =================
window.pageInitializers = {};
window.registerPageInitializer = function(page, fn) { window.pageInitializers[page] = fn; };
window.appDataCache = window.appDataCache || {};

async function fetchText(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.text();
}

// Execute inline <script> tags inside a container so page/modals can register initializers
function executeEmbeddedScripts(container) {
  if (!container) return;
  const nodes = Array.from(container.querySelectorAll('script'));
  const inlineScripts = [];
  // Collect inline code blocks to execute; ignore external scripts to avoid COOP/CSP and parse issues
  nodes.forEach((old) => {
    const isExternal = !!old.src;
    if (!isExternal) {
      inlineScripts.push(old.textContent || '');
    }
    // Remove the original node from the container
    old.parentNode && old.parentNode.removeChild(old);
  });
  // Execute inline scripts without injecting DOM nodes to avoid appendChild parsing errors
  inlineScripts.forEach((code) => {
    try {
      if (!code || !code.trim()) return;
      // Sanitize potential CDATA/comments
      const cleaned = code.replace(/^[\s\S]*?<\!\[CDATA\[/, '').replace(/\]\]>[\s\S]*?$/, '');
      const wrapped = `(function(){\n${cleaned}\n}).call(window);`;
      // Construct a function in global scope and execute
      // eslint-disable-next-line no-new-func
      new Function(wrapped)();
    } catch (e) {
      console.error('Error executing page script:', e);
    }
  });
}

async function loadPartials() {
  console.log('Loading page partials...');
  
  // Load pages in parallel
  const pages = [
    { id: 'dashboard', file: '/pages/dashboard.html' },
    { id: 'expenses', file: '/pages/expenses.html' },
    { id: 'budget', file: '/pages/budget.html' },
    { id: 'cash-banking', file: '/pages/cash-banking.html' },
    { id: 'reports', file: '/pages/reports.html' },
    { id: 'settings', file: '/pages/settings.html' },
    { id: 'admin-tools', file: '/pages/admin-tools.html' },
  ];
  
  const root = select('#page-root');
  if (!root) {
    console.error('Page root element not found');
    throw new Error('Page root element not found');
  }
  
  // Load all pages, with fallback for missing pages
  const results = await Promise.all(pages.map(p => 
    fetchText(p.file).catch((err) => {
      console.warn(`Failed to load ${p.file}:`, err);
      return `<div class="page-placeholder"><h2>${p.id.charAt(0).toUpperCase() + p.id.slice(1)} Page</h2><p>This page is being developed.</p></div>`;
    })
  ));
  
  results.forEach((html, i) => {
    const wrap = document.createElement('div');
    wrap.id = `${pages[i].id}-page`;
    wrap.className = 'app-container';
    wrap.style.display = 'none';
    wrap.innerHTML = html;
    root.appendChild(wrap);
    // Execute any scripts embedded in the partial so initializers register
    try {
      executeEmbeddedScripts(wrap);
    } catch (e) {
      console.error(`Error executing scripts for ${pages[i].id}:`, e);
    }
  });
  
  // Load modals once
  const modals = ['/modals/add-expense.html','/modals/edit-expense.html','/modals/edit-category.html','/modals/edit-payment.html','/modals/edit-donor.html'];
  const modalRoot = select('#modal-root');
  if (modalRoot) {
    const modalHtml = await Promise.all(modals.map(m => 
      fetchText(m).catch((err) => {
        console.warn(`Failed to load modal ${m}:`, err);
        return '';
      })
    ));
    modalHtml.forEach((h, i) => { 
      if (h) {
        const div = document.createElement('div');
        div.innerHTML = h;
        modalRoot.appendChild(div);
        try {
          executeEmbeddedScripts(div);
        } catch (e) {
          console.error(`Error executing scripts for modal ${modals[i]}:`, e);
        }
      }
    });
  }
  
  console.log('All partials loaded');
}

function hideAllPages() {
  document.querySelectorAll('#page-root .app-container').forEach(el => el.style.display = 'none');
  // Clear old navigation active states
  document.querySelectorAll('.nav-link, .sidebar-link').forEach(a => a.classList.remove('active'));
}

window.switchPage = function(page) {
  hideAllPages();
  const el = select(`#${page}-page`);
  if (el) el.style.display = '';
  // highlight nav using centralized function
  updateNavActiveState(page);
  // init
  const init = window.pageInitializers[page];
  if (typeof init === 'function') {
    try { init(); } catch (e) { console.error(e); }
  }
}

function defaultRoute() {
  const hash = (location.hash || '').replace(/^#/, '');
  const allowed = ['dashboard','expenses','budget','cash-banking','reports','settings','admin-tools'];
  return allowed.includes(hash) ? hash : 'dashboard';
}

async function initializeAppShell() {
  if (window._appShellReady) {
    console.log('App shell already ready, switching to default route');
    window.switchPage(defaultRoute());
    return;
  }
  
  console.log('Initializing app shell...');
  try {
    await loadPartials();
    console.log('Partials loaded successfully');
  } catch (e) {
    console.error('Failed to load partials:', e);
    // Don't mark as ready if partials failed to load
    return;
  }
  
  // Mark as ready only after successful load
  window._appShellReady = true;
  
  // Initialize Google app style navigation
  initializeGoogleAppNavigation();
  
  // attach nav clicks to use hash routing
  document.querySelectorAll('.sidebar-link, .mobile-nav-item').forEach(a => {
    a.addEventListener('click', (e) => {
      // keep standard navigation for now but also update SPA
      const page = a.getAttribute('data-page');
      if (page) {
        e.preventDefault();
        location.hash = page;
        window.switchPage(page);
        
        // Close mobile sidebar if open
        closeSidebar();
      }
    });
  });
  window.addEventListener('hashchange', () => window.switchPage(defaultRoute()));
  // Initial route
  window.switchPage(defaultRoute());
}

// Google App Style Navigation Management
function initializeGoogleAppNavigation() {
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userDropdown = document.getElementById('user-dropdown');
  
  // Sidebar toggle functionality
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleSidebar);
  }
  
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }
  
  // User menu functionality
  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      userDropdown.classList.remove('show');
    });
  }
  
  // Handle escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSidebar();
      if (userDropdown) userDropdown.classList.remove('show');
    }
  });
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeSidebar();
    }
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (sidebar && overlay) {
    const isOpen = sidebar.classList.contains('open');
    
    if (isOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }
}

function openSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (sidebar && overlay) {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling on mobile
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (sidebar && overlay) {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
  }
}

// Update active navigation state
function updateNavActiveState(page) {
  // Update sidebar navigation
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-page') === page) {
      link.classList.add('active');
    }
  });
  
  // Update mobile bottom navigation
  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-page') === page) {
      item.classList.add('active');
    }
  });
}

// ================= Utility Functions =================

// Button loading state helper
window.setButtonLoading = function(button, loading) {
  if (!button) return;
  
  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = '<span class="spinner" style="display:inline-block;width:16px;height:16px;border:2px solid #f3f4f6;border-top-color:#6b7280;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:8px;"></span>Loading...';
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent.replace('Loading...', '').trim();
  }
};

// Page progress indicator
window.showPageProgress = function(percent) {
  let progressBar = document.getElementById('page-progress');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.id = 'page-progress';
    progressBar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;background:#e2e8f0;z-index:10000;';
    const fill = document.createElement('div');
    fill.style.cssText = 'height:100%;background:var(--color-primary);transition:width 0.3s ease;width:0;';
    progressBar.appendChild(fill);
    document.body.appendChild(progressBar);
  }
  
  const fill = progressBar.children[0];
  fill.style.width = percent + '%';
  
  if (percent >= 100) {
    setTimeout(() => {
      if (progressBar) progressBar.remove();
    }, 300);
  }
};

// Table skeleton loader
window.showTableSkeleton = function(tbody, rows, cols) {
  if (!tbody) return;
  
  tbody.innerHTML = '';
  for (let i = 0; i < rows; i++) {
    const tr = document.createElement('tr');
    for (let j = 0; j < cols; j++) {
      const td = document.createElement('td');
      const skeleton = document.createElement('div');
      skeleton.style.cssText = 'height:20px;background:#f1f5f9;border-radius:4px;animation:pulse 1.5s ease-in-out infinite;';
      skeleton.style.animationDelay = (i * 0.1 + j * 0.05) + 's';
      td.appendChild(skeleton);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
};

// Empty state helper
window.showEmptyState = function(container, icon, title, subtitle) {
  if (!container) return;
  
  container.innerHTML = `
    <tr>
      <td colspan="20" class="text-center" style="padding:40px;">
        <div style="font-size:48px;margin-bottom:16px;opacity:0.5;">${icon}</div>
        <div style="font-size:18px;font-weight:600;color:#374151;margin-bottom:8px;">${title}</div>
        <div style="font-size:14px;color:#6b7280;">${subtitle}</div>
      </td>
    </tr>
  `;
};

// Loading overlay helper
window.showLoading = function(container, message) {
  if (!container) return null;
  
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.8);display:flex;align-items:center;justify-content:center;z-index:1000;';
  overlay.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
      <div class="spinner" style="width:24px;height:24px;border:3px solid #f3f4f6;border-top-color:var(--color-primary);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <div style="font-size:14px;color:#6b7280;">${message || 'Loading...'}</div>
    </div>
  `;
  
  container.style.position = 'relative';
  container.appendChild(overlay);
  return overlay;
};

window.hideLoading = function(container) {
  if (!container) return;
  const overlay = container.querySelector('.loading-overlay');
  if (overlay) overlay.remove();
};

// Pagination helper
window.createSearchablePagination = function(items, searchTerm, filters, currentPage, itemsPerPage, handlePageChange, handlePageSizeChange) {
  // Apply search filter
  let filteredItems = items;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredItems = items.filter(item => {
      return Object.values(item).some(val => 
        String(val).toLowerCase().includes(term)
      );
    });
  }
  
  // Apply other filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      filteredItems = filteredItems.filter(item => item[key] === value);
    }
  });
  
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const validCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageItems = filteredItems.slice(startIndex, endIndex);
  
  // Create pagination controls
  const paginationEl = document.createElement('div');
  paginationEl.className = 'pagination-container';
  paginationEl.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:16px;background:#f8fafc;border-top:1px solid #e2e8f0;';
  
  const paginationInfo = document.createElement('div');
  paginationInfo.style.cssText = 'font-size:14px;color:#6b7280;';
  paginationInfo.textContent = totalItems > 0 ? 
    `Showing ${startIndex + 1}-${Math.min(endIndex, totalItems)} of ${totalItems} items` : 
    'No items found';
  
  const paginationControls = document.createElement('div');
  paginationControls.style.cssText = 'display:flex;align-items:center;gap:8px;';
  
  if (totalPages > 1) {
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-sm btn-secondary';
    prevBtn.textContent = '← Previous';
    prevBtn.disabled = validCurrentPage <= 1;
    prevBtn.onclick = () => handlePageChange(validCurrentPage - 1);
    paginationControls.appendChild(prevBtn);
    
    // Page numbers
    const pageNumbers = document.createElement('div');
    pageNumbers.style.cssText = 'display:flex;align-items:center;gap:4px;margin:0 8px;';
    
    const startPage = Math.max(1, validCurrentPage - 2);
    const endPage = Math.min(totalPages, validCurrentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = i === validCurrentPage ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline';
      pageBtn.textContent = i;
      pageBtn.onclick = () => handlePageChange(i);
      pageNumbers.appendChild(pageBtn);
    }
    
    paginationControls.appendChild(pageNumbers);
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-sm btn-secondary';
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = validCurrentPage >= totalPages;
    nextBtn.onclick = () => handlePageChange(validCurrentPage + 1);
    paginationControls.appendChild(nextBtn);
  }
  
  paginationEl.appendChild(paginationInfo);
  paginationEl.appendChild(paginationControls);
  
  return {
    items: pageItems,
    pagination: paginationEl,
    totalItems: totalItems,
    currentPage: validCurrentPage,
    totalPages: totalPages
  };
};

// API helper with loading
window.callApiWithLoading = function(path, options = {}, container = null, message = 'Loading...') {
  let overlay = null;
  if (container) {
    overlay = window.showLoading(container, message);
  }
  
  return window.callApi(path, options).finally(() => {
    if (overlay && container) {
      window.hideLoading(container);
    }
  });
};

// Pagination loading helper
window.setPaginationLoading = function(paginationContainer, loading) {
  if (!paginationContainer) return;
  
  if (loading) {
    paginationContainer.classList.add('pagination-loading');
  } else {
    paginationContainer.classList.remove('pagination-loading');
  }
};
