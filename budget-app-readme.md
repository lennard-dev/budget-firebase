# Budget Monitoring Application - Original Google Apps Script Version
## Complete Documentation for Migration Reference

### Table of Contents
1. [Overview](#overview)
2. [Technical Architecture](#technical-architecture)
3. [File Structure](#file-structure)
4. [Core Features](#core-features)
5. [User Workflows](#user-workflows)
6. [Data Model](#data-model)
7. [Design System](#design-system)
8. [Navigation Flow](#navigation-flow)
9. [Key Functionalities](#key-functionalities)
10. [API Structure](#api-structure)

---

## Overview

This is the original **Budget Monitoring Application** built for **Paréa Lesvos/Europe Cares**, a non-profit organization. The application is a comprehensive financial tracking system built entirely within the Google Apps Script ecosystem, designed to complement an existing volunteer management system.

### Purpose
- Track and manage organizational expenses
- Monitor budget allocations vs actual spending
- Handle cash flow and donation tracking
- Generate financial reports
- Provide real-time financial insights

### Technology Stack
- **Backend**: Google Apps Script (JavaScript)
- **Database**: Google Sheets (multiple tabs for different data types)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **File Storage**: Google Drive (for receipts)
- **Hosting**: Google Apps Script Web App
- **Charts**: Chart.js with data labels plugin
- **Authentication**: Google account-based (inherent to Apps Script)

### Key Constraints
- No external dependencies outside Google's ecosystem
- All operations must work within Apps Script execution limits
- Single-page application with client-side routing
- Must maintain exact visual consistency with existing volunteer app

---

## Technical Architecture

### Application Type
Single-Page Application (SPA) with client-side routing and server communication via `google.script.run`.

### Loading Sequence
1. **Initial Load**: Show progress indicator with Paréa heart logo
2. **Resource Loading**: 
   - SharedStyles (CSS framework)
   - Navigation header
   - All 6 pages loaded simultaneously
   - Modal components
   - Initial data preload
3. **Post-Load**: Land on Dashboard with cached data

### Data Flow Architecture
```
User Interface (HTML/JS)
    ↓↑ google.script.run (async)
Google Apps Script (Code.gs)
    ↓↑ SpreadsheetApp API
Google Sheets Database
    ↓↑ DriveApp API (for receipts)
Google Drive Storage
```

### Caching Strategy
- Local JavaScript object (`window.appDataCache`) stores:
  - Dashboard metrics
  - Expenses list
  - Categories and subcategories
  - Payment methods
  - Budget data
- Cache refreshes on page navigation
- Background refresh available via manual trigger

---

## File Structure

```
Budget-Monitoring-App/
│
├── Code.gs                          # Backend server logic
│
├── HTML Files (Frontend):
│   ├── Index.html                   # Main container & app initialization
│   ├── SharedStyles.html            # Complete CSS framework & design system
│   ├── NavHeader.html               # Navigation component (injected)
│   │
│   ├── Pages:
│   │   ├── DashboardPage.html      # Financial overview & charts
│   │   ├── ExpensesPage.html       # Expense management interface
│   │   ├── BudgetPage.html         # Budget monitoring & allocation
│   │   ├── CashBankingPage.html    # Cash flow & donations
│   │   ├── ReportsPage.html        # Report generation
│   │   └── SettingsPage.html       # Application configuration
│   │
│   └── Modals:
│       ├── AddExpenseModal.html    # New expense entry form
│       └── EditExpenseModal.html   # Expense modification form
│
└── Google Sheets Database:
    ├── Expense-Entries              # All expense records
    ├── Budget-Monthly               # Monthly budget allocations
    ├── Cash-Movements               # Cash transactions
    ├── Donations-Expected           # Pledged donations
    ├── Donations-Received           # Received donations
    ├── Balance-Monthly              # Monthly balance sheets
    ├── Static-Categories            # Category/subcategory definitions
    ├── Static-PaymentMethods        # Payment method options
    ├── Static-Donors                # Donor information
    └── Settings                     # App configuration
```

---

## Core Features

### 1. Dashboard
- **Real-time Metrics Display**:
  - Current month's total expenses
  - Remaining budget (color-coded)
  - Cash on hand balance
  - Pending donations total
- **Interactive Charts**:
  - Budget vs Actual comparison (bar chart)
  - Category breakdown (pie/doughnut chart)
  - Spending trend analysis
  - Click-to-drill-down functionality
- **Recent Transactions**: Last 5 expenses with quick view
- **Quick Actions**: One-click expense entry

### 2. Expense Management
- **Comprehensive Filtering**:
  - Date range (quick select: 7, 30, 90, 365 days)
  - Category and subcategory
  - Payment method
  - Full-text search
  - Receipt status
- **Data Display**:
  - Desktop: Sortable table with 7 columns
  - Mobile: Expandable cards with tap interaction
- **Expense Actions**:
  - Add new expense with modal form
  - Edit existing entries
  - Delete with confirmation
  - View/upload receipts
- **Pagination**: 20 expenses per page with infinite scroll option
- **Sorting**: Click column headers to sort (date, amount, category, etc.)

### 3. Budget Monitoring
- **Period Selection**: Monthly and yearly views
- **Category Allocations**: 
  - Set budget per category
  - Visual progress bars
  - Percentage utilized indicators
  - Color coding (green/yellow/red)
- **Variance Analysis**: 
  - Over/under budget calculations
  - Historical comparisons
  - Trend identification
- **Drill-down**: Click categories to see subcategory breakdown

### 4. Cash & Banking
- **Cash Management**:
  - Track withdrawals from bank
  - Monitor cash expenses
  - Petty cash reconciliation
  - Cash balance tracking
- **Donation Tracking**:
  - Expected donations list
  - Received donations recording
  - Donor management
  - Donation status updates
- **Bank Reconciliation**: Match records with bank statements

### 5. Reports Generation
- **Report Types**:
  - Monthly financial summary
  - Annual reports
  - Category-wise analysis
  - Donor reports
  - Custom date range reports
- **Export Options**:
  - PDF generation
  - Excel download
  - Email distribution
- **Visualizations**: Charts and graphs included in reports

### 6. Settings & Configuration
- **Master Data Management**:
  - Categories and subcategories
  - Payment methods
  - Donor information
  - Organizational details
- **User Preferences**:
  - Default views
  - Notification settings
  - Access permissions

---

## User Workflows

### Expense Entry Workflow
1. **Initiate**: Click "Add Expense" button (available on Dashboard/Expenses page)
2. **Form Completion**:
   - Select date (defaults to today)
   - Choose category → subcategory (2-tier dropdown)
   - Enter amount (EUR currency)
   - Select payment method (visual button selection)
   - Add description (optional but recommended)
   - Enter receipt ID (auto-generated format: YYYYMMDD-XXX)
3. **Receipt Handling**:
   - Upload receipt image/PDF
   - Or link existing receipt from Drive
4. **Validation**: Client-side validation for required fields
5. **Submission**: Save to Google Sheets with success notification
6. **Post-Save**: 
   - Update visible data
   - Refresh dashboard metrics
   - Clear form for next entry

### Budget Review Workflow
1. **Navigate** to Budget page
2. **Select Period**: Choose month/year
3. **Review Overview**: See all categories with allocations
4. **Analyze**:
   - Check color-coded status
   - Review percentage utilized
   - Compare to previous periods
5. **Drill Down**: Click category for subcategory details
6. **Adjust**: Navigate to Settings to modify allocations

### Receipt Management Workflow
1. **Receipt Generation**:
   - System generates ID: YYYYMMDD-XXX
   - Sequential numbering per day
2. **Upload Process**:
   - Select file (image/PDF)
   - File uploaded to Google Drive
   - Organized in year/month folders
3. **Retrieval**:
   - Click receipt ID in expense list
   - Opens in new tab from Google Drive
4. **Missing Receipt Handling**:
   - System shows missing indicator
   - Option to upload after the fact

### Month-End Closing Workflow
1. **Review Dashboard** for month overview
2. **Generate Reports** for stakeholders
3. **Reconcile Cash** movements
4. **Update Donations** received status
5. **Export Data** for accounting
6. **Archive** completed month

---

## Data Model

### Expense Entry Structure
```javascript
{
  id: "unique_identifier",
  date: "2024-11-15",              // ISO format
  receiptId: "20241115-001",       // YYYYMMDD-XXX format
  category: "Administration",       // Main category
  subcategory: "Office Supplies",   // Subcategory
  description: "Printer paper",     // Free text
  amount: 45.50,                   // Number (EUR)
  paymentMethod: "Cash",           // Cash/Card/Bank Transfer
  receiptUrl: "drive_url",         // Google Drive link
  createdAt: "timestamp",
  createdBy: "user_email",
  lastModified: "timestamp",
  modifiedBy: "user_email"
}
```

### Budget Structure
```javascript
{
  year: 2024,
  month: 11,
  category: "Administration",
  budgetAmount: 1000.00,
  actualAmount: 750.50,
  variance: 249.50,
  percentUsed: 75.05,
  status: "on-track"  // under/on-track/over
}
```

### Categories Structure (2-tier)
```javascript
{
  name: "Administration",
  icon: "📋",
  subcategories: [
    "Office Supplies",
    "Communications",
    "Professional Services",
    "Banking Fees"
  ]
}
```

---

## Design System

### Color Palette
```css
--color-primary: #202d54;        /* Dark blue - main brand */
--color-primary-dark: #5a67d8;   /* Medium blue - hover */
--color-primary-light: #7c8ff0;  /* Light blue - accents */
--color-secondary: #48bb78;      /* Green - success */
--color-danger: #f56565;         /* Red - errors/delete */
--color-warning: #ed8936;        /* Orange - warnings */
--color-bg: #f7fafc;            /* Light gray - background */
--color-card-bg: #ffffff;       /* White - cards */
--color-text: #2d3748;          /* Dark gray - main text */
--color-text-light: #718096;    /* Medium gray - secondary */
```

### Component Styling
- **Cards**: White background with subtle shadow, 8px border radius
- **Buttons**: 
  - Primary: Blue background, white text
  - Secondary: White background, blue text
  - Danger: Red for destructive actions
- **Forms**: Clean inputs with clear labels and validation states
- **Tables**: Alternating row colors, hover effects
- **Modals**: Centered overlay with smooth animations

### Responsive Breakpoints
- **Desktop**: > 1024px (full table views)
- **Tablet**: 768px - 1024px (compressed tables)
- **Mobile**: < 768px (card-based layouts)

### Mobile Adaptations
- **Navigation**: Hamburger menu
- **Tables → Cards**: Expense rows become expandable cards
- **Filters**: Collapsible filter section
- **FAB**: Floating action button for primary actions
- **Touch Targets**: Minimum 44px for clickable elements

---

## Navigation Flow

### Header Navigation Structure
```html
Budget Monitoring System (Logo/Brand)
├── Dashboard (default/landing)
├── Expenses
├── Budget  
├── Cash & Banking
├── Reports
└── Settings
```

### Page Switching Mechanism
1. All pages loaded at initialization (hidden)
2. Navigation uses `switchPage(pageName)` function
3. Updates URL hash for bookmarking (not implemented in original)
4. Maintains active state in nav menu
5. Triggers page-specific data refresh

### State Management
- No formal state management library
- Global variables in `window` object:
  - `window.appDataCache` - cached server data
  - `window.currentUser` - user information
  - `window.pageInitializers` - page init functions
  - Various page-specific state variables

---

## Key Functionalities

### Server Communication Pattern
```javascript
// Standard pattern for all server calls
google.script.run
  .withSuccessHandler(function(response) {
    if (response.success) {
      // Handle successful response
      processData(response.data);
    } else {
      showError(response.error);
    }
  })
  .withFailureHandler(function(error) {
    showError('Connection failed: ' + error);
  })
  .serverFunction(parameters);
```

### Error Handling
- **Client-side**: Try-catch blocks with user notifications
- **Server-side**: Consistent error object returns
- **User feedback**: Toast notifications for all actions
- **Validation**: Both client and server-side validation

### Performance Optimizations
- **Batch Operations**: Multiple sheet operations in single call
- **Data Caching**: Minimize server round trips
- **Lazy Loading**: Load pages on demand
- **Pagination**: Limit initial data display
- **Debouncing**: Search and filter inputs

### Security Considerations
- Google account authentication required
- Apps Script permissions model
- No sensitive data in client-side code
- Server-side validation for all inputs
- Audit trail for all modifications

---

## API Structure (Code.gs Functions)

### Core Functions
```javascript
// Data Retrieval
getDashboardData()          // Dashboard metrics and charts
getExpenses(filters)        // Filtered expense list
getBudgetData(year, month)  // Budget allocations
getCashMovements()          // Cash transactions
getDonations()              // Donation records

// Data Modification  
addExpense(expenseData)     // Create new expense
updateExpense(id, data)     // Modify expense
deleteExpense(id)           // Remove expense
uploadReceipt(fileData)     // Store receipt file

// Reporting
generateMonthlyReport(year, month)
generateAnnualReport(year)
exportToExcel(data)

// Configuration
getCategories()             // Category list
getPaymentMethods()         // Payment options
updateSettings(settings)    // Save configuration
```

---

## Migration Considerations

When migrating to Firebase/React, maintain:

1. **Visual Design**: Keep exact CSS styling and layout
2. **User Workflows**: Preserve all current workflows
3. **Data Structure**: Similar schema in Firestore
4. **Features**: All current functionality must be preserved
5. **Performance**: Equal or better response times
6. **Mobile Experience**: Maintain responsive design
7. **Error Handling**: Same level of user feedback

### Key Differences to Handle
- Authentication: Google Apps Script → Firebase Auth
- File Storage: Google Drive → Firebase Storage  
- Database: Google Sheets → Firestore
- Backend: Apps Script → Cloud Functions
- Frontend: Vanilla JS → React Components
- Deployment: Apps Script → Firebase Hosting

---

## Original App Advantages

1. **Zero Infrastructure Cost**: Runs entirely on Google's free tier
2. **Integrated Authentication**: Uses organizational Google accounts
3. **Familiar Tools**: Staff already knows Google Sheets
4. **Built-in Backup**: Google's infrastructure handles backups
5. **Simple Deployment**: One-click publish from Apps Script editor
6. **No Build Process**: Direct HTML/JS editing

---

## Contact & Credits

**Original Development**: Built for Paréa Lesvos/Europe Cares
**Purpose**: Non-profit budget and expense management
**Framework**: Google Apps Script Web App
**Year**: 2024

---

*This documentation represents the complete original application structure and should be used as the definitive reference for the Firebase/React migration.*