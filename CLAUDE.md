- "In the budget app project:  To re-enable authentication later, just:
  1. Delete lines 71-113 (the mock user auto-login code)
  2. Uncomment lines 117-359 (the original Firebase auth code)
  3. Remove the */ on line 359
"
- The system MUST use QuickBooks-style double-entry bookkeeping architecture with complete separation of
   concerns between transactions, ledger entries, and account balances. The all-transactions collection 
  stores ONLY raw transaction data: id, date, timestamp, type (expense/income/transfer), subtype,       
  account (cash/bank), amount (negative for expenses, positive for income), description, category, and  
  metadata, with NO balance information embedded. A separate account_ledger collection maintains the    
  complete audit trail where each document represents one account's balance change from one transaction:
   transaction_id referencing the transaction, account name, balance_before showing the account balance 
  before this transaction, balance_after showing the balance after applying this transaction, date and       
  timestamp matching the transaction, and a sequence number for ordering same-timestamp entries. A third     
   account_balances collection stores the current balance snapshot for each account with fields: account     
   name as document ID, current_balance as the latest balance, last_transaction_id referencing the last      
  transaction that affected this account, last_updated timestamp, and transaction_count for audit
  purposes. When a transaction is created, the backend MUST first insert the raw transaction into
  all-transactions, then calculate the balance change based on transaction type and amount, fetch the        
  current balance from account_balances collection, create a new ledger entry in account_ledger with
  balance_before as current and balance_after as current plus/minus the transaction amount, and finally      
  update the account_balances document with the new current balance and transaction reference. The
  frontend MUST NEVER calculate balances and only displays what is stored in the ledger, where each
  transaction row shows the balance_after from its corresponding ledger entry, and summary cards show        
  current_balance from account_balances collection. Balance recalculation for corrections rebuilds the       
  entire account_ledger collection by processing all transactions chronologically without modifying the      
  original transactions. This architecture ensures data integrity through separation of raw data from        
  calculated balances, provides a complete audit trail of every balance change, enables O(1) balance
  lookups from account_balances, allows balance corrections without transaction modifications, and
  matches exactly how QuickBooks, Xero, and enterprise accounting systems operate.
- The following is how the workflow is supposed to work in the app:\
\
It is supposed to be used by the project manager. In the expenses page, she can view the recent expenses in the project and add new ones via the modal, opened by the button in the top right.\
\
On the cash & banking page, she can see summary cards in the top - showing 1) the cash balance, 2)Expected income, 3. Received this month and 4.  bank balance.\
Below that is a tab bar with "Cash movements", "Bank movements" and "expected income" tabs.\
\
The cash movements tab shows all movements in the "cash ledger", ie. the cash on hand. This can be cash expenses (also seen in expenses page), but also deposists or withdrawls, or cash donations. The bank movements are similar - showing expenses that went off the bank account (payment type: Bank Transfer or Card), donations, and bank fees - but also the withdrawls and deposits of cash.\
A key part is that the balances calculate correctly and are visible in every line in the bank and cash movements table as "Rem. Balance" after each transaction (its a column, every movement entry shows the balance on the account (either cash or bank) that is left after the transaction in a column of that table.\
\
The cash movements tab and bank movements tab tables have  Date, Type, Description, Amount, Remaining Balance, and Actions columns. The actions column has two possible buttons for each entry: An eye icon (same as in expenses table) for cash or bank expneses that can be clicked to show the receipt. The eye icon is only visible for expenses. And a gear icon, a menu that opens to edit or delete the entry. It is there for each entry. \
\
The expected income tab is a workflow support for the user - she can enter expected donations from partners and donors that can be checked off and will be entered into the record of transactions and appear at the respective places. \
\
Remember this is my vision for the pages.
- 1. Architecture Principle: No Compatibility Layers

  - When rebuilding systems, do NOT create compatibility layers or migration paths
  - All data is dummy data - be radical in approach
  - Delete legacy code completely rather than maintaining dual systems

  2. QuickBooks-Style Implementation Requirements

  - Exactly 3 collections: all-transactions, account_ledger, account_balances
  - Atomic operations: All transaction operations must use db.runTransaction()
  - No frontend calculations: Balances only calculated in backend
  - Ledger entries: Must have balance_before and balance_after for complete audit trail

  3. Firestore Transaction Rules

  - Critical: All reads MUST happen before any writes in a transaction
  - Violating this causes: "FAILED_PRECONDITION: Firestore transactions require all reads to be executed     
   before all writes"
  - Solution structure:
  // FIRST: Do all reads
  const balanceReads = {};
  for (...) { await t.get(...) }
  // THEN: Do all writes
  t.set(...); t.update(...);

  4. Firestore Index Avoidance

  - Complex composite queries require indexes which slow development
  - Solution: Use simple queries and filter in memory
  - Instead of: .where('type', '==', 'expense').orderBy('date')
  - Do: .orderBy('date') then filter in JavaScript

  5. Deployment Workflow

  - User works directly on live version, not local
  - Always deploy immediately: firebase deploy --only functions or --only hosting
  - No local emulators or development environment

  6. Frontend Service Pattern

  - Create unified services like TransactionService for all operations
  - Pages should never directly call Firebase SDK
  - All API calls go through /api endpoints

  7. Current System State

  - Backend: Clean QuickBooks implementation deployed
  - Frontend: Expenses and dashboard updated to use new endpoints
  - Known issue: Cash movements display (ledger may be empty despite transactions existing)

  8. Testing Approach

  - Use /seed-clean-data.html page for dummy data
  - No migration from old data - always start fresh
  - Verify with console logging when debugging display issues

  These learnings should prevent repeating the same architectural decisions and help maintain the clean,     
   single-approach system going forward.
- When debugging or investigating errors, ALWAYS first identify the root cause, identify potential solutions and then suggest the fixes. DO NOT implement them without my approval. Suggest the fixes first. If I approve, implement them.
- ## Database Query Strategy - Professional Approach

  ### Index Requirements
  - **USE PROPER FIRESTORE COMPOSITE INDEXES** - This is how QuickBooks, Xero, and professional accounting systems operate
  - Indexes enable efficient, direct queries without over-fetching or memory filtering
  - Accept the upfront setup time for indexes to achieve production-quality performance

  ### Index Management Process
  1. **ALWAYS CHECK EXISTING INDEXES FIRST** before creating new ones:
     - Run `firebase firestore:indexes` to list current indexes
     - Or check Firebase Console > Firestore > Indexes tab
     - Reuse existing indexes when possible by structuring queries to match

  2. **When Creating New Indexes**:
     - Use the Firebase Console link from error messages for quick creation
     - Or define in `firestore.indexes.json` for version control
     - Deploy with `firebase deploy --only firestore:indexes`

  3. **Required Core Indexes for Accounting**:
     - `account_ledger`: [account ASC, timestamp ASC, __name__ ASC]
     - `all-transactions`: [type ASC, timestamp ASC, __name__ ASC]
     - `all-transactions`: [account ASC, timestamp ASC, __name__ ASC]
     - Additional indexes as needed for specific query patterns

  ### Query Implementation Standards
  - **ORDER BY TIMESTAMP ASCENDING** for ledger queries - chronological order is essential for balance calculations
  - Use compound queries with proper WHERE clauses - don't over-fetch and filter in memory
  - Example correct query:
    ```javascript
    .where('account', '==', account)
    .where('timestamp', '>=', startTimestamp)
    .where('timestamp', '<=', endTimestamp)
    .orderBy('timestamp', 'asc')
    .limit(limit)
  - Include sequence number ordering for same-timestamp transactions when needed

  Migration from Current Approach

  - Replace memory filtering with proper indexed queries
  - Change all ledger queries from DESC to ASC ordering
  - Remove over-fetching (no more limit * 10)
  - This matches professional accounting software practices

## Critical Firestore Ordering Issue & Solution

  ### Problem Discovered
  - **Firestore DESC ordering may not work reliably** - Even with proper indexes, `.orderBy('timestamp', 'desc')` queries may still return results in ascending order
  - This causes cash/bank movements to display oldest-first instead of newest-first
  - The issue persists even after index rebuilds and deployments

  ### Working Solution (Implemented in functions/index.js lines 479-502)
  ```javascript
  // CRITICAL FIX: Firestore desc ordering not working, use asc and reverse
  let query = db.collection('users').doc(uid)
    .collection('account_ledger')
    .where('account', '==', account)
    .orderBy('timestamp', 'asc')  // Use ascending (which works)
    .limit(Number(limit) * 2);  // Get extra for filtering
  
  // After fetching, reverse the array in JavaScript
  entries = entries.reverse();  // CRITICAL: Reverse to get newest first
  ```

  ### Index Building Time
  - **Indexes take time to build** - After deploying new indexes with `firebase deploy --only firestore:indexes`, wait 1-2 minutes
  - Check build status: The error message provides a Firebase Console link to monitor index building progress
  - Queries will fail with "index is currently building" until complete

  ### Complete Index Set Required
  The following indexes are ALL required for the cash/bank movements to work:
  - `account_ledger`: [account ASC, timestamp ASC]
  - `account_ledger`: [account ASC, timestamp DESC] 
  - `all-transactions`: [date ASC, timestamp ASC]
  - `all-transactions`: [type ASC, timestamp ASC]
  - `all-transactions`: [account ASC, timestamp ASC]

  ### Display Balance Calculation
  - Frontend uses `display_balance` field for showing remaining balance
  - Backend calculates this by working backwards from current balance
  - This ensures UI shows correct balance flow (newest to oldest)
- Learnings from this session: \
\
 1. Firestore DESC Ordering Bug

  - Discovered that Firestore's descending order doesn't work reliably even with proper indexes
  - Solution: Query with ascending order and reverse the results in JavaScript

  2. Index Building Time

  - Indexes take 1-2 minutes to build after deployment
  - Must wait for completion before queries will work

  3. Complete Index Requirements

  - Listed all 5 required composite indexes for the system to function
  - Both ASC and DESC versions needed for account_ledger

  4. Display Balance Calculation

  - Documented how the backend calculates display_balance by working backwards
  - Ensures correct balance flow in the UI (newest to oldest)

  5. Working Solution Code

  - Included the exact code snippet from lines 479-502 that implements the workaround
  - This ensures future developers understand why we query ascending and reverse

  These learnings will prevent future developers from falling into the same pitfalls and ensure they understand the workarounds required for the professional QuickBooks-style implementation to function correctly.
- Save the implementation plan to memory
- This implementation plan is for the account ledger balance update fix when expenses are modified, it also addresses the settings page and the category ID system that needs to be built.\
\
Remove from memory when done.\
\
📋 Implementation Plan

  Phase 1: CRITICAL - Fix Balance Recalculation 🔴

  Timeline: Immediate implementation

  1.1 Fix DELETE Endpoint

  File: functions/index.js
  Changes:
  // Line 628-692: apiRouter.delete("/transactions/:id")
  // After deleting transaction (line 672):
  1. Get all affected accounts from the deleted transaction
  2. Trigger ledger rebuild for those specific accounts
  3. OR trigger full ledger rebuild: await rebuildLedgerForUser(uid)

  Steps:
  1. Add helper function rebuildLedgerForAccount(uid, account)
  2. After transaction deletion, rebuild ledger entries for affected accounts
  3. Return updated balances in response

  1.2 Fix UPDATE Endpoint

  File: functions/index.js
  Changes:
  // Line 563-625: apiRouter.put("/transactions/:id")
  // Before update (line 608):
  1. Fetch original transaction data
  2. Compare old vs new amount and account
  3. If amount or account changed:
     - Delete old ledger entries
     - Recalculate new ledger entries
     - Update account balances

  Implementation approach:
  - Option A: Full rebuild (simpler but slower)
  - Option B: Differential update (complex but faster)
  - Recommended: Start with Option A, optimize later

  ---
  Phase 2: HIGH - Fix Settings Page 🟡

  Timeline: After Phase 1

  2.1 Remove Broken Elements

  File: public/pages/settings.html
  Changes:
  // Line 197: Remove addPayment button listener
  // Line 44: Remove "Generate Dummy Data" button
  // Lines 159-189: Remove generateDummyData function

  2.2 Enhance Category Management UI

  File: public/pages/settings.html
  Changes:
  <!-- Line 17: Update table structure -->
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Code</th>
        <th>Subcategories</th>
        <th>In Use</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
  </table>

  2.3 Fix Category Edit Modal

  File: public/modals/edit-category.html
  Enhancements:
  - Add field validation
  - Show category ID (once implemented)
  - Add subcategory management UI
  - Add "in use" indicator

  ---
  Phase 3: MEDIUM - Category ID System 🟢

  Timeline: After Phase 2

  3.1 Database Schema Changes

  New fields for categories collection:
  {
    category_id: "C0001",  // New auto-generated ID
    name: "Operations",
    code: "OPS",
    subcategories: [
      { id: "S0001", name: "Administrative" },
      { id: "S0002", name: "Office Supplies" }
    ]
  }

  3.2 Backend Updates

  File: functions/index.js

  New endpoints/functions:
  // Add ID generator function
  async function generateCategoryId(uid) {
    // Get last category ID from sequence collection
    // Format: C0001, C0002, etc.
  }

  async function generateSubcategoryId(uid) {
    // Format: S0001, S0002, etc.
  }

  // Update POST /categories to generate IDs
  // Update transactions to store category_id and subcategory_id

  3.3 Migration Strategy

  1. Create migration endpoint to add IDs to existing categories
  2. Update all existing transactions with category/subcategory IDs
  3. Maintain backward compatibility during transition

  3.4 Category Rename Propagation

  New endpoint: PUT /categories/:id/rename
  // When category is renamed:
  1. Update category document
  2. Find all transactions with old category name
  3. Update them with new name (batch update)
  4. Log the change for audit

  3.5 Delete Validation

  Update: DELETE /categories/:id
  // Before deletion:
  1. Check if any transactions use this category
  2. If in use, return error with count
  3. Optionally offer to reassign to another category

  ---
  🚀 Execution Order

  Day 1: Critical Fixes

  1. ✅ Implement ledger rebuild on DELETE
  2. ✅ Implement balance recalculation on UPDATE
  3. ✅ Test with sample data
  4. ✅ Deploy backend changes

  Day 2: Settings Page

  1. ✅ Remove broken buttons
  2. ✅ Remove dummy data generator
  3. ✅ Enhance category table UI
  4. ✅ Fix category edit modal
  5. ✅ Deploy frontend changes

  Day 3-4: Category ID System

  1. ✅ Design ID generation system
  2. ✅ Implement backend ID generators
  3. ✅ Update category creation/edit
  4. ✅ Create migration script
  5. ✅ Implement rename propagation
  6. ✅ Add delete validation
  7. ✅ Test thoroughly
  8. ✅ Deploy complete system

  ---
  🎯 Success Criteria

  Phase 1 Success:

  - ✓ Deleting expense correctly updates balances
  - ✓ Editing expense amount correctly updates balances
  - ✓ Ledger entries stay in sync with transactions
  - ✓ No data integrity issues

  Phase 2 Success:

  - ✓ Settings page has no broken buttons
  - ✓ Category management works smoothly
  - ✓ Edit modal properly updates categories
  - ✓ Clean, functional UI

  Phase 3 Success:

  - ✓ All categories have unique IDs (C0001 format)
  - ✓ All subcategories have unique IDs (S0001 format)
  - ✓ Renaming category updates all transactions
  - ✓ Cannot delete categories in use
  - ✓ Full referential integrity

  ---
  🔧 Technical Considerations

  1. Performance: Ledger rebuilds can be expensive
    - Consider background jobs for large datasets
    - Implement progress indicators
  2. Backwards Compatibility: During ID migration
    - Support both name-based and ID-based lookups
    - Gradual migration approach
  3. Data Integrity: During updates
    - Use database transactions
    - Implement rollback on failure
  4. Testing: Critical for accounting system
    - Unit tests for balance calculations
    - Integration tests for full workflows
    - Edge case testing (concurrent updates, etc.)
- the cash movements tab on the cash banking page is supposed to show cash expenses, deposits, withdrawls and cash donations. The bank movements table is supposed to show expenses that have payment method "Card" or "Bank transfer", as well as withdrawls, deposits, bank donations. It should just show the lable "Bank Expense".
- When navigating pages via playwright, always go to them via https://budget-v01.web.app/#cash-banking or https://budget-v01.web.app/#expenses or https://budget-v01.web.app/#budget... The /page/ url does not work - the data doesnt load.
- Session Review & Achievements

  What We Fixed

  1. Chronological Balance Calculation Issue
    - Problem: When transactions were entered out of chronological order, the remaining balances were incorrect because they were calculated
   based on the current balance at creation time, not the balance at the transaction's actual date
    - Solution: Implemented automatic ledger rebuild after transaction creation using rebuildLedgerForAccounts() function
  2. Same-Day Transaction Ordering
    - Problem: Multiple transactions on the same date were not ordered consistently between rebuild and display, causing confusing balance       
  displays
    - Solution: Added compound ordering (date + timestamp) to ensure consistent ordering in both rebuild and display queries

  Key Learnings for CLAUDE.md

  Here are the important learnings that should be added to memory:

  ## Ledger Balance Recalculation System

  ### Implementation Details
  - **Automatic Rebuild on Transaction Creation**: The `createTransaction()` function now triggers `rebuildLedgerForAccounts()` after each       
  transaction to maintain chronological accuracy
  - **Compound Ordering**: Ledger queries use `.orderBy("date", "desc").orderBy("timestamp", "desc")` to ensure consistent ordering for
  same-day transactions
  - **Required Indexes**: Added composite index for `account_ledger`: [account ASC, date DESC, timestamp DESC]

  ### Known Behavior
  - When transactions are added with past dates, the entire account ledger is rebuilt chronologically
  - The rebuild processes ALL transactions for the account from oldest to newest, recalculating balance_before and balance_after
  - This ensures the "Remaining Balance" column always shows accurate chronological balances

  ### Testing Insights
  - The system successfully handles out-of-order transaction entry
  - Same-day transactions are now ordered by their creation timestamp
  - Balance calculations are accurate even when transactions are added retroactively

  ### Performance Considerations
  - Each transaction creation triggers a ledger rebuild for affected accounts
  - This is currently acceptable for the scale but may need optimization for larger datasets
  - Future optimization could implement partial rebuilds from the affected date forward

  ### Critical Success Pattern
  - Always rebuild ledger after ANY transaction modification (create/update/delete)
  - Ensure ordering is consistent between rebuild logic and display logic
  - Use compound indexes for queries that need multiple sort fields
- In the category modal, there is the visible class for the subcategory field that has caused issues. If not set correctly, the fields for the subcategories do not show up.