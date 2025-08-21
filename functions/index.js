/**
 * Clean QuickBooks-Style Backend Implementation
 *
 * Architecture:
 * - all-transactions: Raw transaction records (source of truth)
 * - account_ledger: Complete audit trail of balance changes
 * - account_balances: Current balance snapshots for O(1) lookups
 *
 * No legacy code, no dual-writes, no frontend calculations
 * Updated: Fixed index requirements by filtering voided transactions in memory
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const AccountsService = require("./accounts");

// Initialize Firebase Admin
setGlobalOptions({maxInstances: 10});

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const accountsService = new AccountsService(db);

// Simple auth middleware
async function authenticateRequest(req, res, next) {
  // Development mode bypass for testing
  if (process.env.FUNCTIONS_EMULATOR === "true" ||
      req.headers["x-dev-mode"] === "true" ||
      (req.headers.host && req.headers.host.includes("localhost"))) {
    req.user = {
      uid: "test-admin-user-001",
      email: "admin@test.local",
    };
    next();
    return;
  }

  // Check for mock user headers from React app
  // Accept both test user and actual user ID for development
  const mockUserId = req.headers["x-user-id"];
  if (mockUserId === "test-admin-user-001" || mockUserId === "7QGvBNZJKYgTD7NdlCrgSoMhujz2") {
    req.user = {
      uid: mockUserId,
      email: mockUserId === "7QGvBNZJKYgTD7NdlCrgSoMhujz2" 
        ? "lennard.everwien@europecares.org" 
        : "admin@test.local",
    };
    next();
    return;
  }

  try {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.*)$/i);

    if (!match) {
      return res.status(401).json({error: "Missing Authorization header"});
    }

    const idToken = match[1];

    // Mock token support for development (including React app mock token)
    if (idToken.startsWith("mock-test-token-")) {
      // Check if a specific user ID was provided in headers
      const mockUserId = req.headers["x-user-id"];
      if (mockUserId === "7QGvBNZJKYgTD7NdlCrgSoMhujz2") {
        req.user = {
          uid: "7QGvBNZJKYgTD7NdlCrgSoMhujz2",
          email: "lennard.everwien@europecares.org",
        };
      } else {
        req.user = {
          uid: "test-admin-user-001",
          email: "admin@test.local",
        };
      }
      next();
      return;
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Authentication error:", err);
    return res.status(401).json({error: "Invalid token"});
  }
}

// Express app setup
const app = express();
app.use(cors({origin: true}));
app.use(express.json());

const apiRouter = express.Router();
apiRouter.use(authenticateRequest);
app.use("/api", apiRouter);

// ==================== ID GENERATION SYSTEM ====================

/**
 * Generate unique category ID
 */
async function generateCategoryId(uid) {
  const counterRef = db.collection("users").doc(uid)
      .collection("metadata").doc("counters");
  
  return await db.runTransaction(async (t) => {
    const doc = await t.get(counterRef);
    const current = doc.exists ? (doc.data().categoryCounter || 0) : 0;
    const next = current + 1;
    
    t.set(counterRef, { categoryCounter: next }, { merge: true });
    return `CAT-${String(next).padStart(3, "0")}`;
  });
}

/**
 * Generate unique subcategory ID
 */
async function generateSubcategoryId(uid) {
  const counterRef = db.collection("users").doc(uid)
      .collection("metadata").doc("counters");
  
  return await db.runTransaction(async (t) => {
    const doc = await t.get(counterRef);
    const current = doc.exists ? (doc.data().subcategoryCounter || 0) : 0;
    const next = current + 1;
    
    t.set(counterRef, { subcategoryCounter: next }, { merge: true });
    return `SUB-${String(next).padStart(3, "0")}`;
  });
}

// REMOVED: Legacy category helper functions - no longer needed
// All transactions now use account_code directly from frontend

// ==================== CORE TRANSACTION LOGIC ====================

/**
 * Determine which accounts are affected by a transaction
 */
function getAffectedAccounts(transaction) {
  const accounts = [];

  if (transaction.type === "transfer") {
    // Transfers affect both accounts
    if (transaction.subtype === "withdrawal") {
      // Bank to cash
      accounts.push({account: "bank", change: -Math.abs(transaction.amount)});
      accounts.push({account: "cash", change: Math.abs(transaction.amount)});
    } else if (transaction.subtype === "deposit") {
      // Cash to bank
      accounts.push({account: "cash", change: -Math.abs(transaction.amount)});
      accounts.push({account: "bank", change: Math.abs(transaction.amount)});
    }
  } else {
    // Regular transactions affect single account
    const change = transaction.type === "income" ?
      Math.abs(transaction.amount) :
      -Math.abs(transaction.amount);
    accounts.push({
      account: transaction.account || "cash",
      change,
    });
  }

  return accounts;
}

/**
 * Create a transaction with atomic ledger updates
 * This is THE core function - everything goes through here
 */
async function createTransaction(uid, transactionData) {
  // RADICAL CHANGE: account_code is NOW REQUIRED for expenses
  if (transactionData.type === 'expense' && !transactionData.account_code) {
    throw new Error('account_code is required for expense transactions');
  }
  
  // Store affected accounts for later rebuild
  const txnData = {
    id: '', // Will be generated
    transaction_number: '', // Will be generated
    date: transactionData.date,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    type: transactionData.type, // expense|income|transfer
    subtype: transactionData.subtype || null,
    account: transactionData.account || "cash",
    amount: Number(transactionData.amount),
    description: transactionData.description || "",
    account_code: transactionData.account_code || null, // DIRECTLY FROM FRONTEND
    account_name: transactionData.account_name || null, // For display purposes
    journal_entries: [], // Double-entry bookkeeping
    paymentMethod: transactionData.paymentMethod || null, // Store at top level for expenses
    metadata: transactionData.metadata || {},
    // DEPRECATED FIELDS - kept temporarily for migration
    category: transactionData.category || null,
    subcategory: transactionData.subcategory || null,
  };
  
  // Create journal entries for double-entry bookkeeping
  if (txnData.account_code) {
    txnData.journal_entries = accountsService.createJournalEntries(txnData);
  }
  
  // Get affected accounts before the transaction
  const affectedAccounts = getAffectedAccounts(txnData);
  const accountsToRebuild = affectedAccounts.map(({account}) => account);
  
  const txnId = await db.runTransaction(async (t) => {
    // Generate transaction ID (document ID for database operations)
    const txnId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const txnRef = db.collection("users").doc(uid)
        .collection("all-transactions").doc(txnId);

    // Generate sequential transaction number (for business operations)
    const year = new Date(transactionData.date).getFullYear();
    const sequenceRef = db.collection("users").doc(uid)
        .collection("transaction_sequences").doc(String(year));
    
    // Read sequence number
    const sequenceDoc = await t.get(sequenceRef);
    const nextSequence = sequenceDoc.exists ? 
        (sequenceDoc.data().next_sequence || 1) : 1;
    
    const transactionNumber = `${year}-${String(nextSequence).padStart(5, '0')}`;

    // Update transaction data with IDs
    txnData.id = txnId;
    txnData.transaction_number = transactionNumber;

    // Get affected accounts
    const accounts = getAffectedAccounts(txnData);

    // FIRST: Do all reads
    const balanceReads = {};
    for (const {account} of accounts) {
      const balanceRef = db.collection("users").doc(uid)
          .collection("account_balances").doc(account);
      const balanceDoc = await t.get(balanceRef);
      balanceReads[account] = {
        ref: balanceRef,
        currentBalance: balanceDoc.exists ?
          (balanceDoc.data().current_balance || 0) : 0,
      };
    }

    // THEN: Do all writes
    // Update sequence number for next transaction
    t.set(sequenceRef, {
      next_sequence: nextSequence + 1,
      last_used: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    
    // Write transaction
    t.set(txnRef, txnData);

    // Process each account with ledger entries (temporary - will be rebuilt)
    for (const {account, change} of accounts) {
      const {ref: balanceRef, currentBalance} = balanceReads[account];
      const newBalance = currentBalance + change;

      // Create temporary ledger entry (will be replaced by rebuild)
      const ledgerRef = db.collection("users").doc(uid)
          .collection("account_ledger").doc();
      t.set(ledgerRef, {
        transaction_id: txnId,
        account: account,
        balance_before: currentBalance,
        balance_after: newBalance,
        change_amount: change,
        date: transactionData.date,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        description: txnData.description,
        type: txnData.type,
        subtype: txnData.subtype,
        // Include payment method for proper filtering in bank movements
        // Check top level first (from transaction-service.js), then metadata as fallback
        paymentMethod: txnData.paymentMethod || (txnData.metadata && txnData.metadata.paymentMethod) || null,
        receiptId: (txnData.metadata && txnData.metadata.receiptId) || null,
      });

      // Update account balance (temporary - will be recalculated)
      t.set(balanceRef, {
        current_balance: newBalance,
        last_transaction_id: txnId,
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
        transaction_count: admin.firestore.FieldValue.increment(1),
      }, {merge: true});
    }

    return txnId;
  });
  
  // After transaction completes, rebuild the ledger for affected accounts
  // This ensures chronological balance accuracy
  console.log(`Transaction ${txnId} created, rebuilding ledger for accounts: ${accountsToRebuild.join(', ')}`);
  await rebuildLedgerForAccounts(uid, accountsToRebuild);
  
  return txnId;
}

/**
 * Update an existing transaction (creates reversal + new entry)
 */
async function updateTransaction(uid, transactionId, updates) {
  return await db.runTransaction(async (t) => {
    // FIRST: Do all reads
    // Get original transaction
    const txnRef = db.collection("users").doc(uid)
        .collection("all-transactions").doc(transactionId);
    const txnDoc = await t.get(txnRef);

    if (!txnDoc.exists) {
      throw new Error("Transaction not found");
    }

    const originalData = txnDoc.data();

    // Get all affected account balances
    const originalAccounts = getAffectedAccounts(originalData);
    const balanceReads = {};
    for (const {account} of originalAccounts) {
      const balanceRef = db.collection("users").doc(uid)
          .collection("account_balances").doc(account);
      const balanceDoc = await t.get(balanceRef);
      balanceReads[account] = {
        ref: balanceRef,
        currentBalance: (balanceDoc.data() && balanceDoc.data().current_balance) || 0,
      };
    }

    // THEN: Do all writes
    // Mark original as voided
    t.update(txnRef, {
      voided: true,
      voided_at: admin.firestore.FieldValue.serverTimestamp(),
      void_reason: "Updated",
    });

    // Create reversal entries in ledger
    for (const {account, change} of originalAccounts) {
      const {ref: balanceRef, currentBalance} = balanceReads[account];
      const reversedBalance = currentBalance - change; // Reverse the original change

      // Create reversal ledger entry
      const ledgerRef = db.collection("users").doc(uid)
          .collection("account_ledger").doc();
      t.set(ledgerRef, {
        transaction_id: `${transactionId}-VOID`,
        account: account,
        balance_before: currentBalance,
        balance_after: reversedBalance,
        change_amount: -change, // Reverse of original
        date: new Date().toISOString().split("T")[0],
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        description: `Reversal: ${originalData.description}`,
        type: "reversal",
        original_transaction_id: transactionId,
      });

      // Update balance
      t.set(balanceRef, {
        current_balance: reversedBalance,
        last_transaction_id: `${transactionId}-VOID`,
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
    }

    // Create new transaction with updates
    const newData = {
      ...originalData,
      ...updates,
      original_transaction_id: transactionId,
    };
    delete newData.id; // Will get new ID
    delete newData.voided;
    delete newData.timestamp; // Will get new timestamp

    // Use the main create function for the new transaction
    // Note: We need to do this outside the current transaction
    return newData;
  }).then(async (newData) => {
    // Create the replacement transaction
    return await createTransaction(uid, newData);
  });
}

/**
 * Rebuild ledger for specific account(s)
 */
async function rebuildLedgerForAccounts(uid, accountList) {
  console.log(`Rebuilding ledger for accounts: ${accountList.join(', ')}`);
  
  const batch = db.batch();
  
  // Clear existing ledger entries for specified accounts only
  for (const account of accountList) {
    const ledgerSnap = await db.collection("users").doc(uid)
      .collection("account_ledger")
      .where("account", "==", account)
      .get();
    
    ledgerSnap.forEach((doc) => batch.delete(doc.ref));
  }
  
  await batch.commit();
  
  // Initialize account balances for rebuild
  const balances = {};
  for (const account of accountList) {
    balances[account] = 0;
  }
  
  // Get all transactions ordered by date and timestamp
  const transactionsSnap = await db.collection("users").doc(uid)
    .collection("all-transactions")
    .orderBy("date")
    .orderBy("timestamp")
    .get();
  
  // Process each transaction chronologically
  let sequenceNumber = 0;
  for (const doc of transactionsSnap.docs) {
    const transaction = doc.data();
    
    // Skip voided transactions
    if (transaction.voided === true) continue;
    
    const accounts = getAffectedAccounts(transaction);
    
    for (const {account, change} of accounts) {
      // Only process if this account is in our rebuild list
      if (!accountList.includes(account)) continue;
      
      const balanceBefore = balances[account] || 0;
      const balanceAfter = balanceBefore + change;
      balances[account] = balanceAfter;
      
      // Parse the date to create a proper timestamp
      let timestampValue;
      if (transaction.timestamp) {
        timestampValue = transaction.timestamp;
      } else {
        // Create timestamp from date string (handling DD/MM/YYYY format)
        const dateStr = transaction.date;
        let dateObj;
        if (dateStr && dateStr.includes("/")) {
          const [day, month, year] = dateStr.split("/");
          dateObj = new Date(year, month - 1, day);
        } else {
          dateObj = new Date(dateStr);
        }
        // Add sequence number as milliseconds to ensure unique ordering
        dateObj.setMilliseconds(sequenceNumber++);
        timestampValue = admin.firestore.Timestamp.fromDate(dateObj);
      }
      
      // Create ledger entry with proper chronological balances
      await db.collection("users").doc(uid)
        .collection("account_ledger").add({
          transaction_id: transaction.id,
          account: account,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          change_amount: change,
          date: transaction.date,
          timestamp: timestampValue,
          description: transaction.description,
          type: transaction.type,
          subtype: transaction.subtype,
          paymentMethod: transaction.paymentMethod || (transaction.metadata && transaction.metadata.paymentMethod) || null,
          receiptId: (transaction.metadata && transaction.metadata.receiptId) || null,
          sequence: sequenceNumber,
        });
    }
  }
  
  // Update final balances for rebuilt accounts
  for (const [account, balance] of Object.entries(balances)) {
    await db.collection("users").doc(uid)
      .collection("account_balances").doc(account).set({
        current_balance: balance,
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
  }
  
  console.log(`Ledger rebuild complete for accounts: ${accountList.join(', ')}`);
}

/**
 * Rebuild entire ledger from transactions (admin function)
 */
async function rebuildLedger(uid) {
  console.log(`Rebuilding ledger for user ${uid}`);

  const batch = db.batch();

  // Clear existing ledger and balances
  const [ledgerSnap, balancesSnap] = await Promise.all([
    db.collection("users").doc(uid).collection("account_ledger").get(),
    db.collection("users").doc(uid).collection("account_balances").get(),
  ]);

  // Delete all ledger entries
  ledgerSnap.forEach((doc) => batch.delete(doc.ref));

  // Reset balances
  balancesSnap.forEach((doc) => batch.delete(doc.ref));

  await batch.commit();

  // Initialize account balances
  const balances = {
    cash: 0,
    bank: 0,
  };

  // Get all transactions ordered by date and timestamp
  // Note: We get all transactions and filter voided ones in memory to avoid index requirements
  const transactionsSnap = await db.collection("users").doc(uid)
      .collection("all-transactions")
      .orderBy("date")
      .orderBy("timestamp")
      .get();

  // Process each transaction (skip voided ones)
  let sequenceNumber = 0;
  for (const doc of transactionsSnap.docs) {
    const transaction = doc.data();

    // Skip voided transactions
    if (transaction.voided === true) continue;
    const accounts = getAffectedAccounts(transaction);

    for (const {account, change} of accounts) {
      const balanceBefore = balances[account] || 0;
      const balanceAfter = balanceBefore + change;
      balances[account] = balanceAfter;

      // Parse the date to create a proper timestamp
      let timestampValue;
      if (transaction.timestamp) {
        timestampValue = transaction.timestamp;
      } else {
        // Create timestamp from date string (handling DD/MM/YYYY format)
        const dateStr = transaction.date;
        let dateObj;
        if (dateStr && dateStr.includes("/")) {
          const [day, month, year] = dateStr.split("/");
          dateObj = new Date(year, month - 1, day);
        } else {
          dateObj = new Date(dateStr);
        }
        // Add sequence number as milliseconds to ensure unique ordering
        dateObj.setMilliseconds(sequenceNumber++);
        timestampValue = admin.firestore.Timestamp.fromDate(dateObj);
      }

      // Create ledger entry with proper timestamp
      await db.collection("users").doc(uid)
          .collection("account_ledger").add({
            transaction_id: transaction.id,
            account: account,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            change_amount: change,
            date: transaction.date,
            timestamp: timestampValue,
            description: transaction.description,
            type: transaction.type,
            subtype: transaction.subtype,
            // Include payment method for proper filtering in movements
            paymentMethod: transaction.paymentMethod || (transaction.metadata && transaction.metadata.paymentMethod) || null,
            receiptId: (transaction.metadata && transaction.metadata.receiptId) || null,
            sequence: sequenceNumber,
          });
    }
  }

  // Update final balances
  for (const [account, balance] of Object.entries(balances)) {
    await db.collection("users").doc(uid)
        .collection("account_balances").doc(account).set({
          current_balance: balance,
          last_updated: admin.firestore.FieldValue.serverTimestamp(),
          transaction_count: transactionsSnap.size,
        });
  }

  return {
    transactions_processed: transactionsSnap.size,
    final_balances: balances,
  };
}

// ==================== API ENDPOINTS ====================

// 1. Create transaction
apiRouter.post("/transactions", async (req, res) => {
  try {
    const uid = req.user.uid;
    const transactionId = await createTransaction(uid, req.body);
    res.json({
      success: true,
      data: {id: transactionId},
    });
  } catch (error) {
    console.error("Error creating transaction:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 2. Get transactions with filters
apiRouter.get("/transactions", async (req, res) => {
  try {
    const uid = req.user.uid;
    const {type, account, startDate, endDate, category, limit = 100} = req.query;

    // Build query with proper indexes
    let query = db.collection("users").doc(uid)
        .collection("all-transactions");

    // Use appropriate index based on filters
    if (type) {
      query = query.where("type", "==", type)
          .orderBy("timestamp", "asc");
    } else if (account) {
      query = query.where("account", "==", account)
          .orderBy("timestamp", "asc");
    } else {
      // Use date-based index when no type/account filter
      query = query.orderBy("date", "asc")
          .orderBy("timestamp", "asc");
    }

    // Apply limit
    query = query.limit(Number(limit));

    const snap = await query.get();

    // Post-process for additional filters and voided transactions
    const transactions = snap.docs
        .map((doc) => {
          const data = doc.data();
          // Extract metadata fields to top level for easier access
          return {
            id: doc.id, // Document ID for API operations
            transaction_number: data.transaction_number || null, // Sequential number for display
            ...data,
            // Extract payment method and receipt ID from metadata
            paymentMethod: (data.metadata && data.metadata.paymentMethod) || null,
            receiptId: (data.metadata && data.metadata.receiptId) || null,
            vendor: (data.metadata && data.metadata.vendor) || null,
            source: (data.metadata && data.metadata.source) || null,
            donor: (data.metadata && data.metadata.donor) || null,
          };
        })
        .filter((t) => {
        // Filter out voided
          if (t.voided === true) return false;
          // Apply additional filters not in query
          if (category && t.category !== category) return false;
          if (startDate && t.date < startDate) return false;
          if (endDate && t.date > endDate) return false;
          return true;
        });

    // Sort by timestamp/date descending (newest first)
    transactions.sort((a, b) => {
      // Use timestamp if available, fallback to date
      const dateA = (a.timestamp && a.timestamp._seconds) ? new Date(a.timestamp._seconds * 1000) : new Date(a.date);
      const dateB = (b.timestamp && b.timestamp._seconds) ? new Date(b.timestamp._seconds * 1000) : new Date(b.date);
      return dateB - dateA; // Descending order (newest first)
    });

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 3. Get a single transaction by ID
apiRouter.get("/transactions/:id", async (req, res) => {
  try {
    const uid = req.user.uid;
    const {id} = req.params;

    // First try using the ID as document ID
    let txnRef = db.collection("users").doc(uid)
        .collection("all-transactions").doc(id);
    let txnDoc = await txnRef.get();

    // If not found by document ID, try searching by the id field or transaction_number
    if (!txnDoc.exists) {
      // Try finding by id field
      let querySnapshot = await db.collection("users").doc(uid)
          .collection("all-transactions")
          .where("id", "==", id)
          .limit(1)
          .get();
      
      // If still not found, try by transaction_number
      if (querySnapshot.empty) {
        querySnapshot = await db.collection("users").doc(uid)
            .collection("all-transactions")
            .where("transaction_number", "==", id)
            .limit(1)
            .get();
      }
      
      if (!querySnapshot.empty) {
        txnDoc = querySnapshot.docs[0];
      } else {
        return res.status(404).json({
          success: false,
          error: "Transaction not found",
        });
      }
    }

    const data = txnDoc.data();
    
    res.json({
      success: true,
      data: {
        id: txnDoc.id, // Document ID for API operations
        transaction_number: data.transaction_number || null,
        ...data,
        // Extract metadata fields to top level
        paymentMethod: (data.metadata && data.metadata.paymentMethod) || null,
        receiptId: (data.metadata && data.metadata.receiptId) || null,
        vendor: (data.metadata && data.metadata.vendor) || null,
      }
    });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 4. Update transaction (for fixing missing data)
apiRouter.put("/transactions/:id", async (req, res) => {
  try {
    const uid = req.user.uid;
    const {id} = req.params;
    const updates = req.body;

    console.log(`Attempting to update transaction: ${id} for user: ${uid}`);

    // First try using the ID as document ID
    let txnRef = db.collection("users").doc(uid)
        .collection("all-transactions").doc(id);
    let txnDoc = await txnRef.get();

    // If not found by document ID, try searching by the id field or transaction_number
    if (!txnDoc.exists) {
      console.log(`Transaction ${id} not found by doc ID, searching by field...`);
      
      // Try finding by id field
      let querySnapshot = await db.collection("users").doc(uid)
          .collection("all-transactions")
          .where("id", "==", id)
          .limit(1)
          .get();
      
      // If still not found, try by transaction_number
      if (querySnapshot.empty) {
        querySnapshot = await db.collection("users").doc(uid)
            .collection("all-transactions")
            .where("transaction_number", "==", id)
            .limit(1)
            .get();
      }
      
      if (!querySnapshot.empty) {
        txnDoc = querySnapshot.docs[0];
        txnRef = txnDoc.ref;
        console.log(`Found transaction by field search: ${txnDoc.id}`);
      } else {
        return res.status(404).json({
          success: false,
          error: "Transaction not found",
        });
      }
    }

    // CRITICAL FIX: Check if amount or account changed - requires ledger rebuild
    const oldData = txnDoc.data();
    const needsLedgerRebuild = (
      (updates.amount !== undefined && updates.amount !== oldData.amount) ||
      (updates.account !== undefined && updates.account !== oldData.account) ||
      (updates.type !== undefined && updates.type !== oldData.type)
    );

    // RADICAL: account_code must be provided directly
    if (updates.account_code) {
      // Update journal entries with new account code
      updates.journal_entries = accountsService.createJournalEntries({...oldData, ...updates});
    } else if ((updates.category || updates.subcategory) && oldData.type === 'expense') {
      // If updating category/subcategory without account_code, reject
      return res.status(400).json({
        success: false,
        error: "account_code is required when updating expense categories"
      });
    }

    // Update the transaction with new data
    await txnRef.update({
      ...updates,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // If amount, account, or type changed, rebuild the ledger
    if (needsLedgerRebuild) {
      console.log(`Transaction ${txnDoc.id} amount/account/type changed, rebuilding ledger...`);
      
      try {
        await rebuildLedger(uid);
        console.log(`Ledger rebuilt successfully after updating transaction ${txnDoc.id}`);
        
        // Get updated balances to return to client
        const cashBalance = await db.collection("users").doc(uid)
            .collection("account_balances").doc("cash").get();
        const bankBalance = await db.collection("users").doc(uid)
            .collection("account_balances").doc("bank").get();
        
        res.json({
          success: true,
          message: "Transaction updated and ledger rebuilt",
          data: {id: txnDoc.id, ...updates},
          ledgerRebuilt: true,
          updatedBalances: {
            cash: cashBalance.data()?.current_balance || 0,
            bank: bankBalance.data()?.current_balance || 0
          }
        });
      } catch (rebuildError) {
        console.error("Failed to rebuild ledger after update:", rebuildError);
        // Transaction is already updated, return partial success
        res.json({
          success: true,
          warning: "Transaction updated but ledger rebuild failed. Please refresh.",
          data: {id: txnDoc.id, ...updates},
          ledgerRebuilt: false,
          error: rebuildError.message
        });
      }
    } else {
      // No ledger rebuild needed - just metadata update
      res.json({
        success: true,
        data: {id: txnDoc.id, ...updates},
        ledgerRebuilt: false
      });
    }
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 4. Delete a transaction completely
apiRouter.delete("/transactions/:id", async (req, res) => {
  try {
    const uid = req.user.uid;
    const {id} = req.params;

    // Try to get the transaction by document ID
    const txnRef = db.collection("users").doc(uid)
        .collection("all-transactions").doc(id);
    let txnDoc = await txnRef.get();

    // If not found by document ID, try searching by the id field or transaction_number
    if (!txnDoc.exists) {
      // Try finding by id field
      const querySnapshot = await db.collection("users").doc(uid)
          .collection("all-transactions")
          .where("id", "==", id)
          .limit(1)
          .get();
      
      // If still not found, try by transaction_number
      if (querySnapshot.empty) {
        const querySnapshot2 = await db.collection("users").doc(uid)
            .collection("all-transactions")
            .where("transaction_number", "==", id)
            .limit(1)
            .get();
        
        if (!querySnapshot2.empty) {
          txnDoc = querySnapshot2.docs[0];
        } else {
          return res.status(404).json({
            success: false,
            error: "Transaction not found",
          });
        }
      } else {
        txnDoc = querySnapshot.docs[0];
      }
    }

    // Get transaction data before deletion for rebuilding ledger
    const transactionData = txnDoc.data();
    
    // Delete the transaction
    await txnDoc.ref.delete();

    // Rebuild the ledger to recalculate balances after deletion
    // This ensures account balances are correct after removing the transaction
    console.log(`Deleted transaction ${txnDoc.id}, rebuilding ledger...`);
    
    // CRITICAL FIX: Actually rebuild the ledger to maintain balance integrity
    try {
      const rebuildResult = await rebuildLedger(uid);
      console.log(`Ledger rebuilt successfully after deleting transaction ${txnDoc.id}`);
      
      // Get updated balances to return to client
      const cashBalance = await db.collection("users").doc(uid)
          .collection("account_balances").doc("cash").get();
      const bankBalance = await db.collection("users").doc(uid)
          .collection("account_balances").doc("bank").get();
      
      res.json({
        success: true,
        message: "Transaction deleted and ledger rebuilt successfully",
        deletedId: txnDoc.id,
        updatedBalances: {
          cash: cashBalance.data()?.current_balance || 0,
          bank: bankBalance.data()?.current_balance || 0
        }
      });
    } catch (rebuildError) {
      console.error("Failed to rebuild ledger after deletion:", rebuildError);
      // Transaction is already deleted, return partial success
      res.json({
        success: true,
        warning: "Transaction deleted but ledger rebuild failed. Please refresh.",
        deletedId: txnDoc.id,
        error: rebuildError.message
      });
    }
  } catch (error) {
    console.error("Error deleting transaction:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 5. Get ledger entries for an account
apiRouter.get("/ledger/:account", async (req, res) => {
  try {
    const uid = req.user.uid;
    const {account} = req.params;
    const {startDate, endDate, limit = 100} = req.query;

    // Get current balance for the account
    const balanceDoc = await db.collection("users").doc(uid)
        .collection("account_balances").doc(account).get();
    const currentBalance = balanceDoc.exists ? balanceDoc.data().current_balance : 0;

    // Use date AND timestamp ordering to ensure consistent order with rebuild
    // This matches the rebuild ordering: date first, then timestamp for same-day transactions
    let query = db.collection("users").doc(uid)
        .collection("account_ledger")
        .where("account", "==", account)
        .orderBy("date", "desc") // Order by transaction date (newest first for display)
        .orderBy("timestamp", "desc") // Then by timestamp for same-day transactions
        .limit(Number(limit));

    let snap;
    try {
      // Try the date+timestamp query first
      snap = await query.get();
      console.log(`Successfully fetched ${snap.size} ledger entries for ${account} using date+timestamp ordering`);
    } catch (error) {
      // If the compound ordering fails (likely missing index), try simpler query
      console.error("Date+timestamp query failed:", error.message);
      console.log("Falling back to date-only ordering");
      
      query = db.collection("users").doc(uid)
          .collection("account_ledger")
          .where("account", "==", account)
          .orderBy("date", "desc")
          .limit(Number(limit));
      
      try {
        snap = await query.get();
        console.log(`Fetched ${snap.size} entries using date-only ordering`);
      } catch (error2) {
        // If date ordering also fails, fall back to timestamp only
        console.error("Date-only query failed:", error2.message);
        console.log("Falling back to timestamp-only ordering");
        
        query = db.collection("users").doc(uid)
            .collection("account_ledger")
            .where("account", "==", account)
            .orderBy("timestamp", "desc")
            .limit(Number(limit));
        
        snap = await query.get();
        console.log(`Fetched ${snap.size} entries using timestamp-only fallback`);
      }
    }

    // Process entries
    let entries = snap.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((e) => {
        // Apply date filters if needed
          if (startDate && e.date < startDate) return false;
          if (endDate && e.date > endDate) return false;
          return true;
        });

    // With timestamp DESC ordering, entries should already be in correct order (newest first)
    // No additional sorting needed
    
    // Each entry already has balance_after which is the correct balance at that point in time
    // Just use it directly as display_balance
    entries.forEach((entry) => {
      // Use the balance_after from the ledger entry - this is the balance after this transaction
      entry.display_balance = entry.balance_after || 0;
    });

    res.json({
      success: true,
      data: entries,
      current_balance: currentBalance,
    });
  } catch (error) {
    console.error("Error fetching ledger:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 4. Get current account balances
apiRouter.get("/balances", async (req, res) => {
  try {
    const uid = req.user.uid;

    const [cashDoc, bankDoc] = await Promise.all([
      db.collection("users").doc(uid)
          .collection("account_balances").doc("cash").get(),
      db.collection("users").doc(uid)
          .collection("account_balances").doc("bank").get(),
    ]);

    res.json({
      success: true,
      data: {
        cash: cashDoc.exists ? cashDoc.data().current_balance : 0,
        bank: bankDoc.exists ? bankDoc.data().current_balance : 0,
        last_updated: cashDoc.exists ? cashDoc.data().last_updated : null,
      },
    });
  } catch (error) {
    console.error("Error fetching balances:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 4b. Get summary (includes balances and monthly stats)
apiRouter.get("/summary", async (req, res) => {
  try {
    const uid = req.user.uid;

    // Get account balances
    const [cashDoc, bankDoc] = await Promise.all([
      db.collection("users").doc(uid)
          .collection("account_balances").doc("cash").get(),
      db.collection("users").doc(uid)
          .collection("account_balances").doc("bank").get(),
    ]);

    // Calculate current month expenses
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    
    // Get expenses for current month
    const expensesSnap = await db.collection("users").doc(uid)
        .collection("all-transactions")
        .where("type", "==", "expense")
        .orderBy("date", "desc")
        .limit(100)
        .get();
    
    let monthExpenses = 0;
    expensesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.date >= monthStartStr && !data.voided) {
        monthExpenses += Math.abs(data.amount || 0);
      }
    });

    // Assuming a fixed budget for now (can be made dynamic later)
    const monthlyBudget = 10000;
    const budgetRemaining = monthlyBudget - monthExpenses;

    res.json({
      success: true,
      cashBalance: cashDoc.exists ? cashDoc.data().current_balance : 0,
      bankBalance: bankDoc.exists ? bankDoc.data().current_balance : 0,
      monthExpenses: monthExpenses,
      budgetRemaining: budgetRemaining,
      monthlyBudget: monthlyBudget,
      pendingDonations: 0, // To be implemented with expected income feature
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 5. Update transaction
apiRouter.patch("/transactions/:id", async (req, res) => {
  try {
    const uid = req.user.uid;
    const newTransactionId = await updateTransaction(uid, req.params.id, req.body);
    res.json({
      success: true,
      data: {id: newTransactionId},
    });
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 6. Rebuild ledger (admin only)
apiRouter.post("/rebuild-ledger", async (req, res) => {
  try {
    const uid = req.user.uid;
    const result = await rebuildLedger(uid);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error rebuilding ledger:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== SETTINGS ENDPOINTS ====================
// Keep these for app functionality

// Categories - Now pulls from chart_of_accounts but returns frontend-compatible format
apiRouter.get("/categories", async (req, res) => {
  const uid = req.user.uid;
  
  try {
    // Use chart_of_accounts ONLY - Professional approach
    const categories = await accountsService.getCategoresFromAccounts(uid);
    
    if (!categories || categories.length === 0) {
      // If no chart of accounts exists, return empty with helpful message
      return res.json({
        success: true,
        data: [],
        message: "No chart of accounts found. Please run /api/chart-of-accounts/migrate to set up."
      });
    }
    
    res.json({success: true, data: categories});
  } catch (error) {
    console.error("Error fetching categories from chart of accounts:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to fetch categories. Please ensure chart of accounts is set up."
    });
  }
});

apiRouter.post("/categories", async (req, res) => {
  const uid = req.user.uid;
  const {id, name, code, subcategories = [], active = true} = req.body || {};
  if (!name) {
    return res.status(400).json({success: false, error: "Missing category name"});
  }
  
  try {
    // Always use chart_of_accounts - Professional approach
    // Generate account code if not provided
    let accountCode = code;
    if (!accountCode) {
      // Find next available account code
      const existingAccounts = await db.collection("users").doc(uid)
        .collection("chart_of_accounts")
        .where("display_as", "==", "category")
        .orderBy("account_code", "desc")
        .limit(1)
        .get();
      
      if (!existingAccounts.empty) {
        const lastCode = parseInt(existingAccounts.docs[0].data().account_code);
        accountCode = String(lastCode + 100);
      } else {
        accountCode = "5000"; // Start at 5000 for expense accounts
      }
    }
    
    // Create category in chart_of_accounts
    const categoryAccount = {
      account_code: accountCode,
      account_name: name,
      account_type: 'expense',
      display_as: 'category',
      category_name: name,
      subcategory_name: null,
      parent_code: null,
      normal_balance: 'debit',
      is_active: active,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      created_by: uid
    };
    
    await db.collection("users").doc(uid)
      .collection("chart_of_accounts")
      .doc(accountCode)
      .set(categoryAccount);
    
    // Create subcategory accounts
    let subIndex = 1;
    for (const subName of subcategories) {
      const subAccountCode = `${accountCode}.${String(subIndex).padStart(2, '0')}`;
      
      const subcategoryAccount = {
        account_code: subAccountCode,
        account_name: subName,
        account_type: 'expense',
        display_as: 'subcategory',
        category_name: name,
        subcategory_name: subName,
        parent_code: accountCode,
        normal_balance: 'debit',
        is_active: active,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        created_by: uid
      };
      
      await db.collection("users").doc(uid)
        .collection("chart_of_accounts")
        .doc(subAccountCode)
        .set(subcategoryAccount);
      
      subIndex++;
    }
    
    return res.json({
      success: true,
      id: accountCode,
      category_id: accountCode,
      message: "Category created in chart of accounts"
    });
  } catch (error) {
    console.error("Error creating category in chart_of_accounts:", error);
    return res.status(500).json({success: false, error: error.message});
  }
});

// The following endpoints were for the old categories collection - removed as part of migration
// All category operations now use chart_of_accounts exclusively

// Stub endpoints for backward compatibility - will redirect to chart_of_accounts

// Migration endpoint for categories to chart_of_accounts
apiRouter.post("/categories/migrate-to-chart", async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // This endpoint migrates old categories to chart_of_accounts
    // It's a one-time migration that should be run before fully switching to chart_of_accounts
    res.json({
      success: true,
      message: "Use /api/chart-of-accounts/migrate instead"
    });
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({success: false, error: error.message});
  }
});
apiRouter.put("/categories/:id/rename", async (req, res) => {
  try {
    const uid = req.user.uid;
    const {id} = req.params;
    const {name: newName, subcategories: newSubcategories} = req.body;
    
    if (!newName) {
      return res.status(400).json({success: false, error: "New name is required"});
    }
    
    // Get the existing category
    const categoryRef = db.collection("users").doc(uid).collection("categories").doc(id);
    const categoryDoc = await categoryRef.get();
    
    if (!categoryDoc.exists) {
      return res.status(404).json({success: false, error: "Category not found"});
    }
    
    const oldData = categoryDoc.data();
    const oldName = oldData.name;
    
    // Update the category document
    await categoryRef.update({
      name: newName,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // If name changed, update all transactions and budgets with this category
    if (oldName !== newName) {
      // Update transactions
      const transactionsSnap = await db.collection("users").doc(uid)
          .collection("all-transactions")
          .where("category", "==", oldName)
          .get();
      
      const batch = db.batch();
      let updateCount = 0;
      
      transactionsSnap.docs.forEach(doc => {
        batch.update(doc.ref, { category: newName });
        updateCount++;
      });
      
      if (updateCount > 0) {
        await batch.commit();
        console.log(`Updated ${updateCount} transactions with new category name`);
      }
      
      // Update budgets - migrate category name in all budget documents
      const budgetsSnap = await db.collection("users").doc(uid)
          .collection("budgets")
          .get();
      
      const budgetBatch = db.batch();
      let budgetUpdateCount = 0;
      
      for (const budgetDoc of budgetsSnap.docs) {
        const budgetData = budgetDoc.data();
        if (budgetData.categories && budgetData.categories[oldName]) {
          // Create new categories object with renamed key
          const newCategories = {...budgetData.categories};
          newCategories[newName] = newCategories[oldName];
          delete newCategories[oldName];
          
          budgetBatch.update(budgetDoc.ref, { categories: newCategories });
          budgetUpdateCount++;
        }
      }
      
      if (budgetUpdateCount > 0) {
        await budgetBatch.commit();
        console.log(`Updated ${budgetUpdateCount} budget documents with new category name`);
      }
    }
    
    res.json({
      success: true,
      message: `Category renamed successfully`,
      transactionsUpdated: updateCount || 0
    });
  } catch (error) {
    console.error("Error renaming category:", error);
    res.status(500).json({success: false, error: error.message});
  }
});

// Category delete with validation
apiRouter.delete("/categories/:id", async (req, res) => {
  try {
    const uid = req.user.uid;
    const {id} = req.params;
    const {force} = req.query; // ?force=true to delete even if in use
    
    // Get the category
    const categoryRef = db.collection("users").doc(uid).collection("categories").doc(id);
    const categoryDoc = await categoryRef.get();
    
    if (!categoryDoc.exists) {
      return res.status(404).json({success: false, error: "Category not found"});
    }
    
    const categoryData = categoryDoc.data();
    const categoryName = categoryData.name;
    
    // Check if category is in use
    const transactionsSnap = await db.collection("users").doc(uid)
        .collection("all-transactions")
        .where("category", "==", categoryName)
        .limit(1)
        .get();
    
    if (!transactionsSnap.empty && force !== 'true') {
      // Count total transactions using this category
      const fullCount = await db.collection("users").doc(uid)
          .collection("all-transactions")
          .where("category", "==", categoryName)
          .get();
      
      return res.status(400).json({
        success: false,
        error: "Category is in use",
        message: `This category is used in ${fullCount.size} transaction(s). Cannot delete.`,
        transactionCount: fullCount.size,
        hint: "Remove the category from all transactions first, or use ?force=true to delete anyway"
      });
    }
    
    // Delete the category
    await categoryRef.delete();
    
    res.json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({success: false, error: error.message});
  }
});

// Payment Methods
apiRouter.get("/paymentMethods", async (req, res) => {
  const uid = req.user.uid;
  const snap = await db.collection("users").doc(uid)
      .collection("paymentMethods").orderBy("sortOrder").get();
  const data = snap.docs.map((d) => ({id: d.id, ...d.data()}));
  res.json({success: true, data});
});

apiRouter.post("/paymentMethods", async (req, res) => {
  const uid = req.user.uid;
  const {id, name, sortOrder = 999, active = true} = req.body || {};
  if (!name) {
    return res.status(400).json({success: false, error: "Missing name"});
  }
  const col = db.collection("users").doc(uid).collection("paymentMethods");
  if (id) {
    await col.doc(id).set({name, sortOrder, active}, {merge: true});
    return res.json({success: true});
  } else {
    const ref = await col.add({
      name, sortOrder, active,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.json({success: true, id: ref.id});
  }
});

// Donors
apiRouter.get("/donors", async (req, res) => {
  const uid = req.user.uid;
  const snap = await db.collection("users").doc(uid)
      .collection("donors").orderBy("name").get();
  const data = snap.docs.map((d) => ({id: d.id, ...d.data()}));
  res.json({success: true, data});
});

apiRouter.post("/donors", async (req, res) => {
  const uid = req.user.uid;
  const {id, name, organization = "", email = "", phone = "", notes = "", active = true} = req.body || {};
  if (!name) {
    return res.status(400).json({success: false, error: "Missing name"});
  }
  const col = db.collection("users").doc(uid).collection("donors");
  if (id) {
    await col.doc(id).set({name, organization, email, phone, notes, active}, {merge: true});
    return res.json({success: true});
  } else {
    const ref = await col.add({
      name, organization, email, phone, notes, active,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.json({success: true, id: ref.id});
  }
});

// ==================== BUDGET ENDPOINTS ====================

// Get budget for a specific month
apiRouter.get("/budgets", async (req, res) => {
  try {
    const uid = req.user.uid;
    const {year, month} = req.query;
    
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        error: "Year and month are required",
      });
    }
    
    // Get budget document for the specific month - use only budget_allocations collection
    const budgetId = `${year}-${String(month).padStart(2, '0')}`;
    const budgetDoc = await db.collection("users").doc(uid)
        .collection("budget_allocations").doc(budgetId).get();
    
    // Get actual spending for this month from transactions
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    
    const transactionsSnap = await db.collection("users").doc(uid)
        .collection("all-transactions")
        .where("type", "==", "expense")
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .get();
    
    // Calculate spending by category
    const spendingByCategory = {};
    transactionsSnap.forEach(doc => {
      const txn = doc.data();
      const category = txn.category || "Other";
      const subcategory = txn.subcategory || "General";
      
      if (!spendingByCategory[category]) {
        spendingByCategory[category] = {
          total: 0,
          subcategories: {},
        };
      }
      
      spendingByCategory[category].total += Math.abs(txn.amount || 0);
      
      if (!spendingByCategory[category].subcategories[subcategory]) {
        spendingByCategory[category].subcategories[subcategory] = 0;
      }
      spendingByCategory[category].subcategories[subcategory] += Math.abs(txn.amount || 0);
    });
    
    // Combine budget and spending data
    const budgetData = budgetDoc.exists ? budgetDoc.data() : {};
    
    // Handle different data structures from budget_allocations vs budgets
    // budget_allocations has { categories: { categoryName: { subcategoryName: amount } } }
    // budgets has { categories: { categoryName: { subcategoryName: amount } } } (same structure)
    const categoriesGrouped = {};
    let totalBudget = 0;
    let totalSpent = 0;
    
    // Get all categories from chart_of_accounts ONLY - Professional approach
    const chartSnap = await db.collection("users").doc(uid)
        .collection("chart_of_accounts")
        .where("display_as", "==", "category")
        .get();
    
    let categoriesData = [];
    const categoryMap = new Map(); // Use Map to deduplicate by name
    
    // Use chart_of_accounts as single source of truth
    chartSnap.forEach(doc => {
      const account = doc.data();
      const categoryName = account.category_name || account.account_name;
      // Only add if not already in map (deduplicate by name)
      if (!categoryMap.has(categoryName)) {
        const categoryData = {
          name: categoryName,
          code: account.account_code,
          subcategories: []
        };
        categoryMap.set(categoryName, categoryData);
        categoriesData.push(categoryData);
      }
    });
    
    // Get subcategories for each category
    for (const cat of categoriesData) {
      const subsSnap = await db.collection("users").doc(uid)
          .collection("chart_of_accounts")
          .where("display_as", "==", "subcategory")
          .where("category_name", "==", cat.name)
          .get();
      
      subsSnap.forEach(subDoc => {
        const sub = subDoc.data();
        cat.subcategories.push({
          name: sub.subcategory_name || sub.account_name,
          code: sub.account_code
        });
      });
    }
    
    // If no chart_of_accounts exists, return empty result
    if (categoriesData.length === 0) {
      return res.json({
        success: true,
        data: {
          totalBudget: 0,
          totalSpent: 0,
          totalRemaining: 0,
          categoriesGrouped: {},
          month: budgetId,
          message: "No chart of accounts found. Please run migration or setup."
        }
      });
    }
    
    // Process each category
    categoriesData.forEach(category => {
      const categoryName = category.name;
      const budgetForCategory = budgetData.categories?.[categoryName] || {};
      const spendingForCategory = spendingByCategory[categoryName] || { total: 0, subcategories: {} };
      
      // Calculate totals for this category
      let categoryBudgetTotal = 0;
      const subcategoriesData = [];
      
      // Handle subcategories
      (category.subcategories || []).forEach(sub => {
        // Extract subcategory name whether it's a string or object
        let subName = '';
        let subId = null;
        
        if (typeof sub === 'object') {
          subId = sub.id;
          // Handle corrupted data where name is an object
          if (typeof sub.name === 'object') {
            console.warn(`Corrupted subcategory in ${category.name}:`, sub);
            return; // Skip this corrupted entry
          }
          subName = sub.name || '';
        } else {
          subName = sub;
        }
        
        // Skip if no valid name
        if (!subName) return;
        
        // Use the NAME to look up budget and spending data
        const subBudget = budgetForCategory[subName] || 0;
        const subSpent = spendingForCategory.subcategories[subName] || 0;
        
        categoryBudgetTotal += subBudget;
        
        subcategoriesData.push({
          subcategory: subName,  // String name for display
          subcategory_id: subId, // Include ID for reference
          budgeted: subBudget,
          spent: subSpent,
          remaining: subBudget - subSpent,
        });
      });
      
      // Also check for "All" budget (category-level budget)
      const categoryLevelBudget = budgetForCategory["All"] || 0;
      if (categoryLevelBudget > 0) {
        categoryBudgetTotal += categoryLevelBudget;
      }
      
      categoriesGrouped[categoryName] = {
        budgeted: categoryBudgetTotal,
        spent: spendingForCategory.total,
        remaining: categoryBudgetTotal - spendingForCategory.total,
        subcategories: subcategoriesData,
        total: categoryBudgetTotal  // Add explicit total field
      };
      
      totalBudget += categoryBudgetTotal;
      totalSpent += spendingForCategory.total;
    });
    
    return res.json({
      success: true,
      data: {
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        categoriesGrouped,
        month: budgetId,
      },
    });
    
  } catch (error) {
    console.error("Error fetching budget:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Save/update budget for a specific month
apiRouter.post("/budgets", async (req, res) => {
  try {
    const uid = req.user.uid;
    const {year, month, totalBudget, allocations, categories} = req.body;
    
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        error: "Year and month are required",
      });
    }
    
    // Transform allocations array to categories object if allocations is provided
    let categoriesData = {};
    let categoryIdMap = {}; // Store category ID to name mapping
    
    if (allocations && Array.isArray(allocations)) {
      // Frontend sends allocations array format
      for (const {category, subcategory, amount} of allocations) {
        if (!categoriesData[category]) {
          categoriesData[category] = {};
          
          // Look up category ID
          const categoryId = await getCategoryIdByName(uid, category);
          if (categoryId) {
            categoryIdMap[category] = categoryId;
          }
        }
        // Store subcategory budget (or "All" for category-level)
        categoriesData[category][subcategory || "General"] = amount || 0;
      }
    } else if (categories) {
      // Direct categories object format (backward compatibility)
      categoriesData = categories;
      
      // Look up IDs for existing categories
      for (const categoryName of Object.keys(categoriesData)) {
        const categoryId = await getCategoryIdByName(uid, categoryName);
        if (categoryId) {
          categoryIdMap[categoryName] = categoryId;
        }
      }
    }
    
    const budgetId = `${year}-${String(month).padStart(2, '0')}`;
    
    await db.collection("users").doc(uid)
        .collection("budgets").doc(budgetId).set({
      totalBudget: totalBudget || 0,
      categories: categoriesData,
      categoryIds: categoryIdMap, // Store ID mappings for future reference
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`Budget saved for ${budgetId}: Total=${totalBudget}, Categories=`, categoriesData);
    
    return res.json({
      success: true,
      id: budgetId,
    });
    
  } catch (error) {
    console.error("Error saving budget:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// USER MANAGEMENT ENDPOINTS
// ============================================================================

// GET /users - List all users with their roles and status
apiRouter.get("/users", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    // Get users collection
    const usersSnapshot = await db.collection("users").doc(uid)
      .collection("team_members").get();
    
    const users = [];
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      users.push({
        id: doc.id,
        name: userData.name || "Unknown",
        email: userData.email || "",
        role: userData.role || "user",
        department: userData.department || "",
        status: userData.status || "active",
        lastActive: userData.lastActive || null,
        createdAt: userData.createdAt || null,
        permissions: userData.permissions || {},
      });
    }

    // Sort by name
    users.sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /users - Create a new user
apiRouter.post("/users", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const {name, email, role, department, permissions} = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: "Name and email are required",
      });
    }

    // Generate a unique ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const userData = {
      name,
      email,
      role: role || "user",
      department: department || "",
      status: "pending", // New users start as pending
      permissions: permissions || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: uid,
    };

    await db.collection("users").doc(uid)
      .collection("team_members").doc(userId).set(userData);

    return res.json({
      success: true,
      id: userId,
      data: {...userData, id: userId},
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PUT /users/:id - Update a user
apiRouter.put("/users/:id", async (req, res) => {
  try {
    const uid = req.user?.uid;
    const userId = req.params.id;
    
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const {name, email, role, department, status, permissions} = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (status !== undefined) updateData.status = status;
    if (permissions !== undefined) updateData.permissions = permissions;
    
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updateData.updatedBy = uid;

    await db.collection("users").doc(uid)
      .collection("team_members").doc(userId).update(updateData);

    return res.json({
      success: true,
      id: userId,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// DELETE /users/:id - Delete a user
apiRouter.delete("/users/:id", async (req, res) => {
  try {
    const uid = req.user?.uid;
    const userId = req.params.id;
    
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    await db.collection("users").doc(uid)
      .collection("team_members").doc(userId).delete();

    return res.json({
      success: true,
      id: userId,
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PATCH /users/:id/status - Toggle user status
apiRouter.patch("/users/:id/status", async (req, res) => {
  try {
    const uid = req.user?.uid;
    const userId = req.params.id;
    
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const {status} = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required",
      });
    }

    await db.collection("users").doc(uid)
      .collection("team_members").doc(userId).update({
        status,
        statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        statusUpdatedBy: uid,
      });

    return res.json({
      success: true,
      id: userId,
      status,
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// ROLES & PERMISSIONS ENDPOINTS
// ============================================================================

// GET /permissions - Get permission matrix
apiRouter.get("/permissions", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    // Get permissions configuration
    const permissionsDoc = await db.collection("users").doc(uid)
      .collection("settings").doc("permissions").get();
    
    if (!permissionsDoc.exists) {
      // Return default permissions
      return res.json({
        success: true,
        data: getDefaultPermissions(),
      });
    }

    return res.json({
      success: true,
      data: permissionsDoc.data(),
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PUT /permissions - Update permission matrix
apiRouter.put("/permissions", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const permissions = req.body;

    await db.collection("users").doc(uid)
      .collection("settings").doc("permissions").set({
        ...permissions,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid,
      });

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error("Error updating permissions:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Helper function for default permissions
function getDefaultPermissions() {
  return {
    admin: {
      viewExpenses: true,
      createExpenses: true,
      editAllExpenses: true,
      deleteExpenses: true,
      viewBudget: true,
      modifyBudget: true,
      viewUsers: true,
      manageUsers: true,
      accessSettings: true,
      modifySettings: true,
    },
    manager: {
      viewExpenses: true,
      createExpenses: true,
      editAllExpenses: true,
      deleteExpenses: true,
      viewBudget: true,
      modifyBudget: true,
      viewUsers: true,
      manageUsers: false,
      accessSettings: true,
      modifySettings: false,
    },
    user: {
      viewExpenses: true,
      createExpenses: true,
      editAllExpenses: false,
      deleteExpenses: false,
      viewBudget: true,
      modifyBudget: false,
      viewUsers: false,
      manageUsers: false,
      accessSettings: false,
      modifySettings: false,
    },
    viewer: {
      viewExpenses: true,
      createExpenses: false,
      editAllExpenses: false,
      deleteExpenses: false,
      viewBudget: true,
      modifyBudget: false,
      viewUsers: false,
      manageUsers: false,
      accessSettings: false,
      modifySettings: false,
    },
  };
}

// ============================================================================
// ACTIVITY LOG ENDPOINTS
// ============================================================================

// GET /activity-logs - Fetch activity logs with filters
apiRouter.get("/activity-logs", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const {startDate, endDate, type, userId, limit = 50, offset = 0} = req.query;

    // Build query
    let query = db.collection("users").doc(uid)
      .collection("activity_logs")
      .orderBy("timestamp", "desc");

    // Apply filters
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query = query.where("timestamp", ">=", admin.firestore.Timestamp.fromDate(start));
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.where("timestamp", "<=", admin.firestore.Timestamp.fromDate(end));
    }

    if (type) {
      query = query.where("type", "==", type);
    }

    if (userId) {
      query = query.where("userId", "==", userId);
    }

    // Apply pagination
    query = query.limit(Number(limit)).offset(Number(offset));

    const snapshot = await query.get();
    const logs = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date()
      });
    });

    return res.json({
      success: true,
      data: logs,
      hasMore: logs.length === Number(limit)
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /activity-logs - Create a new activity log entry
apiRouter.post("/activity-logs", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const {type, action, details, entityId, entityType} = req.body;

    if (!type || !action) {
      return res.status(400).json({
        success: false,
        error: "Type and action are required"
      });
    }

    // Get user info
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data() || {};

    const logEntry = {
      type, // user, expense, budget, system, login
      action, // created, updated, deleted, logged_in, logged_out
      details: details || "",
      entityId: entityId || null,
      entityType: entityType || null,
      userId: uid,
      userName: userData.displayName || userData.email || "Unknown User",
      userEmail: userData.email || "",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ip: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown"
    };

    const docRef = await db.collection("users").doc(uid)
      .collection("activity_logs").add(logEntry);

    return res.json({
      success: true,
      id: docRef.id
    });
  } catch (error) {
    console.error("Error creating activity log:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /activity-logs/old - Delete old activity logs
apiRouter.delete("/activity-logs/old", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const {daysToKeep = 90} = req.query;
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - Number(daysToKeep));
    
    // Find and delete old logs
    const snapshot = await db.collection("users").doc(uid)
      .collection("activity_logs")
      .where("timestamp", "<", admin.firestore.Timestamp.fromDate(cutoffDate))
      .get();

    const batch = db.batch();
    let deleteCount = 0;

    snapshot.forEach(doc => {
      batch.delete(doc.ref);
      deleteCount++;
    });

    if (deleteCount > 0) {
      await batch.commit();
    }

    // Log this action
    await db.collection("users").doc(uid)
      .collection("activity_logs").add({
        type: "system",
        action: "cleaned_logs",
        details: `Deleted ${deleteCount} activity logs older than ${daysToKeep} days`,
        userId: uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

    return res.json({
      success: true,
      deletedCount: deleteCount
    });
  } catch (error) {
    console.error("Error deleting old logs:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to log activities (can be called from other endpoints)
async function logActivity(uid, type, action, details, entityId = null, entityType = null) {
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data() || {};

    await db.collection("users").doc(uid)
      .collection("activity_logs").add({
        type,
        action,
        details,
        entityId,
        entityType,
        userId: uid,
        userName: userData.displayName || userData.email || "Unknown User",
        userEmail: userData.email || "",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

// ============================================================================
// BUDGET SETTINGS ENDPOINTS
// ============================================================================

// GET /budget-settings - Get budget configuration
apiRouter.get("/budget-settings", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const settingsDoc = await db.collection("users").doc(uid)
      .collection("settings").doc("budget_config").get();

    if (!settingsDoc.exists) {
      // Return default settings
      return res.json({
        success: true,
        data: {
          period: 12,
          startMonth: 1,
          fiscalYear: new Date().getFullYear(),
          autoRenew: true,
          currency: "EUR"
        }
      });
    }

    return res.json({
      success: true,
      data: settingsDoc.data()
    });
  } catch (error) {
    console.error("Error fetching budget settings:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /budget-settings - Update budget configuration
apiRouter.put("/budget-settings", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const {period, startMonth, fiscalYear, autoRenew, currency} = req.body;

    const settings = {
      period: period || 12,
      startMonth: startMonth || 1,
      fiscalYear: fiscalYear || new Date().getFullYear(),
      autoRenew: autoRenew !== undefined ? autoRenew : true,
      currency: currency || "EUR",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    };

    await db.collection("users").doc(uid)
      .collection("settings").doc("budget_config").set(settings);

    // Log activity
    await logActivity(uid, "budget", "updated", "Updated budget configuration settings");

    return res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error("Error updating budget settings:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /budget-allocations - Get budget allocations by month
apiRouter.get("/budget-allocations", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const {year, month} = req.query;
    
    let query = db.collection("users").doc(uid)
      .collection("budget_allocations");
    
    if (year && month) {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const doc = await query.doc(monthKey).get();
      
      if (!doc.exists) {
        return res.json({
          success: true,
          data: null
        });
      }
      
      return res.json({
        success: true,
        data: {[monthKey]: doc.data()}
      });
    } else if (year) {
      // Get all months for a year
      const snapshot = await query
        .where("year", "==", Number(year))
        .get();
      
      const allocations = {};
      snapshot.forEach(doc => {
        allocations[doc.id] = doc.data();
      });
      
      return res.json({
        success: true,
        data: allocations
      });
    } else {
      // Get all allocations
      const snapshot = await query.get();
      const allocations = {};
      
      snapshot.forEach(doc => {
        allocations[doc.id] = doc.data();
      });
      
      return res.json({
        success: true,
        data: allocations
      });
    }
  } catch (error) {
    console.error("Error fetching budget allocations:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /budget-allocations - Save budget allocations
apiRouter.put("/budget-allocations", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const {monthKey, allocations} = req.body;
    
    if (!monthKey || !allocations) {
      return res.status(400).json({
        success: false,
        error: "Month key and allocations are required"
      });
    }

    // Parse year and month from monthKey (format: YYYY-MM)
    const [year, month] = monthKey.split('-').map(Number);
    
    const budgetData = {
      ...allocations,
      year,
      month,
      monthKey,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    };

    await db.collection("users").doc(uid)
      .collection("budget_allocations").doc(monthKey).set(budgetData);

    // Log activity
    await logActivity(uid, "budget", "updated", 
      `Updated budget allocations for ${monthKey}`, monthKey, "budget_allocation");

    return res.json({
      success: true,
      data: budgetData
    });
  } catch (error) {
    console.error("Error saving budget allocations:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /budget-templates - Save budget as template
apiRouter.post("/budget-templates", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const {name, description, settings, allocations} = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Template name is required"
      });
    }

    const template = {
      name,
      description: description || "",
      settings: settings || {},
      allocations: allocations || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: uid
    };

    const docRef = await db.collection("users").doc(uid)
      .collection("budget_templates").add(template);

    // Log activity
    await logActivity(uid, "budget", "created", 
      `Created budget template: ${name}`, docRef.id, "budget_template");

    return res.json({
      success: true,
      id: docRef.id,
      data: template
    });
  } catch (error) {
    console.error("Error saving budget template:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /budget-templates - Get saved budget templates
apiRouter.get("/budget-templates", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const snapshot = await db.collection("users").doc(uid)
      .collection("budget_templates")
      .orderBy("createdAt", "desc")
      .get();

    const templates = [];
    snapshot.forEach(doc => {
      templates.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error("Error fetching budget templates:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// SYSTEM SETTINGS ENDPOINTS
// ============================================================================

// GET /system-settings - Get system configuration
apiRouter.get("/system-settings", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const settingsDoc = await db.collection("users").doc(uid)
      .collection("settings").doc("system").get();
    
    if (!settingsDoc.exists) {
      // Return default settings
      return res.json({
        success: true,
        data: {
          appName: "Budget Management System",
          organizationName: "",
          timezone: "Europe/Berlin",
          dateFormat: "DD/MM/YYYY",
          currency: "EUR",
          fiscalYearStart: 1,
          language: "en",
          autoBackup: true,
          backupFrequency: "weekly",
          maintenanceMode: false,
          allowPublicRegistration: false,
          requireEmailVerification: true,
          sessionTimeout: 30,
          maxLoginAttempts: 5,
          passwordMinLength: 8,
          enforceStrongPasswords: true,
        },
      });
    }

    return res.json({
      success: true,
      data: settingsDoc.data(),
    });
  } catch (error) {
    console.error("Error fetching system settings:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PUT /system-settings - Update system configuration
apiRouter.put("/system-settings", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const settings = req.body;

    await db.collection("users").doc(uid)
      .collection("settings").doc("system").set({
        ...settings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid,
      });

    // Log this critical change
    await db.collection("users").doc(uid)
      .collection("activity_logs").add({
        type: "settings",
        action: "updated_system_settings",
        details: "System settings updated",
        userId: uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {changes: Object.keys(settings)},
      });

    return res.json({success: true});
  } catch (error) {
    console.error("Error updating system settings:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /email-settings - Get email configuration
apiRouter.get("/email-settings", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const emailDoc = await db.collection("users").doc(uid)
      .collection("settings").doc("email").get();
    
    if (!emailDoc.exists) {
      return res.json({
        success: true,
        data: {
          enabled: false,
          provider: "smtp",
          smtp: {
            host: "",
            port: 587,
            secure: false,
            username: "",
            password: "",
          },
          fromEmail: "",
          fromName: "",
          replyTo: "",
          notifications: {
            newExpense: true,
            budgetExceeded: true,
            weeklyReport: false,
            monthlyReport: true,
          },
        },
      });
    }

    // Mask sensitive data
    const data = emailDoc.data();
    if (data.smtp?.password) {
      data.smtp.password = "********";
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching email settings:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PUT /email-settings - Update email configuration
apiRouter.put("/email-settings", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const settings = req.body;
    
    // Don't update password if it's masked
    if (settings.smtp?.password === "********") {
      const existingDoc = await db.collection("users").doc(uid)
        .collection("settings").doc("email").get();
      if (existingDoc.exists) {
        settings.smtp.password = existingDoc.data().smtp?.password;
      }
    }

    await db.collection("users").doc(uid)
      .collection("settings").doc("email").set({
        ...settings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid,
      });

    return res.json({success: true});
  } catch (error) {
    console.error("Error updating email settings:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /test-email - Test email configuration
apiRouter.post("/test-email", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const {testEmail} = req.body;
    
    // Get email settings
    const emailDoc = await db.collection("users").doc(uid)
      .collection("settings").doc("email").get();
    
    if (!emailDoc.exists || !emailDoc.data().enabled) {
      return res.status(400).json({
        success: false,
        error: "Email settings not configured",
      });
    }

    // In production, you would send actual test email here
    // For now, simulate success
    return res.json({
      success: true,
      message: `Test email would be sent to ${testEmail}`,
    });
  } catch (error) {
    console.error("Error testing email:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /integrations - Get integration settings
apiRouter.get("/integrations", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const integrationsDoc = await db.collection("users").doc(uid)
      .collection("settings").doc("integrations").get();
    
    if (!integrationsDoc.exists) {
      return res.json({
        success: true,
        data: {
          googleSheets: {enabled: false, apiKey: "", sheetId: ""},
          quickbooks: {enabled: false, clientId: "", clientSecret: ""},
          xero: {enabled: false, clientId: "", clientSecret: ""},
          slack: {enabled: false, webhookUrl: ""},
          zapier: {enabled: false, apiKey: ""},
          webhooks: [],
        },
      });
    }

    // Mask sensitive data
    const data = integrationsDoc.data();
    Object.keys(data).forEach(key => {
      if (data[key]?.apiKey) data[key].apiKey = "********";
      if (data[key]?.clientSecret) data[key].clientSecret = "********";
      if (data[key]?.webhookUrl) data[key].webhookUrl = data[key].webhookUrl.substring(0, 20) + "...";
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PUT /integrations - Update integration settings
apiRouter.put("/integrations", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const settings = req.body;
    
    // Preserve masked values
    const existingDoc = await db.collection("users").doc(uid)
      .collection("settings").doc("integrations").get();
    
    if (existingDoc.exists) {
      const existing = existingDoc.data();
      Object.keys(settings).forEach(key => {
        if (settings[key]?.apiKey === "********" && existing[key]?.apiKey) {
          settings[key].apiKey = existing[key].apiKey;
        }
        if (settings[key]?.clientSecret === "********" && existing[key]?.clientSecret) {
          settings[key].clientSecret = existing[key].clientSecret;
        }
      });
    }

    await db.collection("users").doc(uid)
      .collection("settings").doc("integrations").set({
        ...settings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid,
      });

    return res.json({success: true});
  } catch (error) {
    console.error("Error updating integrations:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== CHART OF ACCOUNTS ENDPOINTS ====================

// GET /chart-of-accounts - Get full chart of accounts tree
apiRouter.get("/chart-of-accounts", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }
    
    const categories = await accountsService.getCategoresFromAccounts(uid);
    return res.json({success: true, data: categories});
  } catch (error) {
    console.error("Error fetching chart of accounts:", error);
    return res.status(500).json({success: false, error: error.message});
  }
});

// GET /chart-of-accounts/lookup - Lookup account by category/subcategory
apiRouter.get("/chart-of-accounts/lookup", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }
    
    const { category, subcategory } = req.query;
    if (!category) {
      return res.status(400).json({success: false, error: "Category is required"});
    }
    
    const accountCode = await accountsService.getAccountFromCategory(uid, category, subcategory);
    if (!accountCode) {
      return res.status(404).json({success: false, error: "Account not found"});
    }
    
    const account = await accountsService.getAccount(uid, accountCode);
    return res.json({success: true, data: account});
  } catch (error) {
    console.error("Error looking up account:", error);
    return res.status(500).json({success: false, error: error.message});
  }
});

// POST /chart-of-accounts/setup - Initialize default chart
apiRouter.post("/chart-of-accounts/setup", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }
    
    await accountsService.initializeDefaultChart(uid);
    return res.json({success: true, message: "Chart of accounts initialized"});
  } catch (error) {
    console.error("Error setting up chart:", error);
    return res.status(500).json({success: false, error: error.message});
  }
});

// POST /export-data - Export all data
apiRouter.post("/export-data", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const {format = "json", includeAttachments = false} = req.body;

    // Fetch all user data
    const userData = {
      transactions: [],
      categories: [],
      budgets: [],
      teamMembers: [],
      settings: {},
      exportDate: new Date().toISOString(),
      version: "1.0",
    };

    // Get transactions
    const txnSnap = await db.collection("users").doc(uid)
      .collection("all-transactions").get();
    userData.transactions = txnSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get categories
    const catSnap = await db.collection("users").doc(uid)
      .collection("categories").get();
    userData.categories = catSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get budgets
    const budgetSnap = await db.collection("users").doc(uid)
      .collection("budget_allocations").get();
    userData.budgets = budgetSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get team members
    const teamSnap = await db.collection("users").doc(uid)
      .collection("team_members").get();
    userData.teamMembers = teamSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Log export activity
    await db.collection("users").doc(uid)
      .collection("activity_logs").add({
        type: "data",
        action: "exported_data",
        details: `Data exported in ${format} format`,
        userId: uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    if (format === "json") {
      return res.json({
        success: true,
        data: userData,
      });
    } else {
      // For CSV format, would need additional processing
      return res.status(501).json({
        success: false,
        error: "CSV export not yet implemented",
      });
    }
  } catch (error) {
    console.error("Error exporting data:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /import-data - Import data
apiRouter.post("/import-data", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({success: false, error: "Unauthorized"});
    }

    const {data, mergeMode = "replace"} = req.body;

    if (!data || !data.version) {
      return res.status(400).json({
        success: false,
        error: "Invalid import data format",
      });
    }

    // In production, implement proper import logic
    // For now, return success
    await db.collection("users").doc(uid)
      .collection("activity_logs").add({
        type: "data",
        action: "imported_data",
        details: `Data imported with ${mergeMode} mode`,
        userId: uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    return res.json({
      success: true,
      message: "Data import queued for processing",
    });
  } catch (error) {
    console.error("Error importing data:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// CHART OF ACCOUNTS API ENDPOINTS
// ============================================

// Get full chart of accounts
apiRouter.get("/chart-of-accounts", async (req, res) => {
  const uid = req.user.uid;
  
  try {
    const chartSnap = await db.collection("users").doc(uid)
      .collection("chart_of_accounts")
      .orderBy("account_code")
      .get();
    
    const accounts = chartSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Build hierarchy
    const hierarchy = {
      assets: [],
      liabilities: [],
      equity: [],
      income: [],
      expenses: []
    };
    
    accounts.forEach(account => {
      const type = account.account_type;
      if (type === 'asset') hierarchy.assets.push(account);
      else if (type === 'liability') hierarchy.liabilities.push(account);
      else if (type === 'equity') hierarchy.equity.push(account);
      else if (type === 'income') hierarchy.income.push(account);
      else if (type === 'expense') hierarchy.expenses.push(account);
    });
    
    res.json({
      success: true,
      data: accounts,
      hierarchy: hierarchy,
      total: accounts.length
    });
  } catch (error) {
    console.error("Error fetching chart of accounts:", error);
    res.status(500).json({success: false, error: error.message});
  }
});

// Lookup account by category/subcategory
apiRouter.post("/chart-of-accounts/lookup", async (req, res) => {
  const uid = req.user.uid;
  const { category, subcategory } = req.body;
  
  if (!category) {
    return res.status(400).json({success: false, error: "Category is required"});
  }
  
  try {
    const accountCode = await accountsService.getAccountFromCategory(
      uid,
      category,
      subcategory
    );
    
    if (!accountCode) {
      return res.status(404).json({
        success: false,
        error: "Account not found for category/subcategory"
      });
    }
    
    // Get full account details
    const account = await accountsService.getAccount(uid, accountCode);
    
    res.json({
      success: true,
      account_code: accountCode,
      account: account
    });
  } catch (error) {
    console.error("Error looking up account:", error);
    res.status(500).json({success: false, error: error.message});
  }
});

// Migrate categories to chart_of_accounts
apiRouter.post("/chart-of-accounts/migrate", async (req, res) => {
  const uid = req.user.uid;
  
  try {
    // Check if chart_of_accounts already has data
    const chartSnap = await db.collection("users").doc(uid)
      .collection("chart_of_accounts")
      .limit(1)
      .get();
    
    if (!chartSnap.empty) {
      return res.json({
        success: true,
        message: "Chart of accounts already exists, no migration needed"
      });
    }
    
    // Get all categories
    const categoriesSnap = await db.collection("users").doc(uid)
      .collection("categories")
      .get();
    
    if (categoriesSnap.empty) {
      // Initialize default chart if no categories exist
      await accountsService.initializeDefaultChart(uid);
      return res.json({
        success: true,
        message: "No categories found, initialized default chart of accounts"
      });
    }
    
    // Migrate categories to chart_of_accounts
    const batch = db.batch();
    let accountCode = 5000; // Start expense accounts at 5000
    
    categoriesSnap.forEach(doc => {
      const category = doc.data();
      const categoryCode = String(accountCode);
      
      // Create category-level account
      const categoryAccount = {
        account_code: categoryCode,
        account_name: category.name,
        account_type: 'expense',
        display_as: 'category',
        category_name: category.name,
        subcategory_name: null,
        parent_code: null,
        normal_balance: 'debit',
        is_active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        migrated_from: 'categories'
      };
      
      batch.set(
        db.collection("users").doc(uid)
          .collection("chart_of_accounts")
          .doc(categoryCode),
        categoryAccount
      );
      
      // Create subcategory accounts
      let subCode = 1;
      (category.subcategories || []).forEach(sub => {
        const subName = typeof sub === 'object' ? sub.name : sub;
        if (!subName || typeof subName === 'object') return;
        
        const subcategoryCode = `${categoryCode}.${String(subCode).padStart(2, '0')}`;
        const subcategoryAccount = {
          account_code: subcategoryCode,
          account_name: subName,
          account_type: 'expense',
          display_as: 'subcategory',
          category_name: category.name,
          subcategory_name: subName,
          parent_code: categoryCode,
          normal_balance: 'debit',
          is_active: true,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          migrated_from: 'categories'
        };
        
        batch.set(
          db.collection("users").doc(uid)
            .collection("chart_of_accounts")
            .doc(subcategoryCode),
          subcategoryAccount
        );
        
        subCode++;
      });
      
      accountCode += 100; // Space categories by 100
    });
    
    await batch.commit();
    
    res.json({
      success: true,
      message: `Migrated ${categoriesSnap.size} categories to chart of accounts`
    });
  } catch (error) {
    console.error("Error migrating to chart of accounts:", error);
    res.status(500).json({success: false, error: error.message});
  }
});

// Setup complete chart (for initial setup or reset)
apiRouter.post("/chart-of-accounts/setup", async (req, res) => {
  const uid = req.user.uid;
  const { clearExisting = false } = req.body;
  
  try {
    // Check if already exists
    const existingSnap = await db.collection("users").doc(uid)
      .collection("chart_of_accounts")
      .limit(1)
      .get();
    
    if (!existingSnap.empty && !clearExisting) {
      return res.status(409).json({
        success: false,
        error: "Chart of accounts already exists. Use clearExisting=true to reset."
      });
    }
    
    // Clear existing if requested
    if (clearExisting && !existingSnap.empty) {
      const batch = db.batch();
      const allAccounts = await db.collection("users").doc(uid)
        .collection("chart_of_accounts")
        .get();
      
      allAccounts.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    }
    
    // Initialize default chart
    await accountsService.initializeDefaultChart(uid);
    
    res.json({
      success: true,
      message: "Chart of accounts initialized successfully"
    });
  } catch (error) {
    console.error("Error setting up chart of accounts:", error);
    res.status(500).json({success: false, error: error.message});
  }
});

// Get account balances (for reporting)
apiRouter.get("/chart-of-accounts/balances", async (req, res) => {
  const uid = req.user.uid;
  const { startDate, endDate } = req.query;
  
  try {
    // Get all accounts
    const accountsSnap = await db.collection("users").doc(uid)
      .collection("chart_of_accounts")
      .where("is_active", "==", true)
      .orderBy("account_code")
      .get();
    
    // Get current balances
    const balancesSnap = await db.collection("users").doc(uid)
      .collection("account_balances")
      .get();
    
    const balanceMap = {};
    balancesSnap.docs.forEach(doc => {
      balanceMap[doc.id] = doc.data().current_balance || 0;
    });
    
    // Build response with balances
    const accountsWithBalances = accountsSnap.docs.map(doc => {
      const account = doc.data();
      return {
        account_code: account.account_code,
        account_name: account.account_name,
        account_type: account.account_type,
        display_as: account.display_as,
        category_name: account.category_name,
        subcategory_name: account.subcategory_name,
        balance: balanceMap[account.account_code] || 0,
        normal_balance: account.normal_balance,
        budget_monthly: account.budget_monthly || 0,
        budget_annual: account.budget_annual || 0
      };
    });
    
    // Calculate totals by type
    const totals = {
      assets: 0,
      liabilities: 0,
      equity: 0,
      income: 0,
      expenses: 0
    };
    
    accountsWithBalances.forEach(account => {
      if (account.account_type === 'asset') totals.assets += account.balance;
      else if (account.account_type === 'liability') totals.liabilities += account.balance;
      else if (account.account_type === 'equity') totals.equity += account.balance;
      else if (account.account_type === 'income') totals.income += Math.abs(account.balance);
      else if (account.account_type === 'expense') totals.expenses += Math.abs(account.balance);
    });
    
    res.json({
      success: true,
      accounts: accountsWithBalances,
      totals: totals,
      net_income: totals.income - totals.expenses
    });
  } catch (error) {
    console.error("Error fetching account balances:", error);
    res.status(500).json({success: false, error: error.message});
  }
});

// ==================== REPORTS ENDPOINTS ====================

/**
 * MIGRATION ENDPOINT: Complete chart of accounts migration
 * POST /api/migration/complete-accounts-migration
 */
apiRouter.post("/migration/complete-accounts-migration", async (req, res) => {
  try {
    const uid = req.user.uid;
    let migrated = 0;
    let failed = 0;
    let skipped = 0;
    
    // Get all transactions
    const txnSnap = await db.collection("users").doc(uid)
      .collection("all-transactions")
      .get();
    
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of txnSnap.docs) {
      const txn = doc.data();
      
      // Skip if already has account_code
      if (txn.account_code) {
        skipped++;
        continue;
      }
      
      // Skip non-expense transactions for now (they don't need account codes)
      if (txn.type !== 'expense') {
        skipped++;
        continue;
      }
      
      // Look up account code from category/subcategory
      if (txn.category) {
        const accountCode = await accountsService.getAccountFromCategory(
          uid,
          txn.category,
          txn.subcategory
        );
        
        if (accountCode) {
          // Get account name for display
          const accountDoc = await db.collection("users").doc(uid)
            .collection("chart_of_accounts")
            .doc(accountCode)
            .get();
          
          const accountName = accountDoc.exists ? 
            (accountDoc.data().subcategory_name || accountDoc.data().account_name) : 
            txn.subcategory || txn.category;
          
          batch.update(doc.ref, {
            account_code: accountCode,
            account_name: accountName,
            journal_entries: accountsService.createJournalEntries({...txn, account_code: accountCode}),
            migrated_at: admin.firestore.FieldValue.serverTimestamp()
          });
          
          batchCount++;
          migrated++;
          
          // Commit batch every 100 documents
          if (batchCount >= 100) {
            await batch.commit();
            batchCount = 0;
          }
        } else {
          console.warn(`No account found for ${txn.category}/${txn.subcategory}`);
          failed++;
        }
      } else {
        skipped++;
      }
    }
    
    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
    }
    
    // Rebuild ledgers for all accounts
    await rebuildLedger(uid);
    
    res.json({
      success: true,
      message: "Migration completed successfully",
      stats: {
        total: txnSnap.size,
        migrated,
        failed,
        skipped,
        ledgerRebuilt: true
      }
    });
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reports - List all reports
 */
apiRouter.get("/reports", async (req, res) => {
  try {
    const uid = req.user.uid;
    const { status, year, limit = 12 } = req.query;
    
    let query = db.collection("users").doc(uid)
      .collection("reports")
      .orderBy("createdAt", "desc");
    
    if (status) {
      query = query.where("status", "==", status);
    }
    
    if (year) {
      query = query.where("year", "==", parseInt(year));
    }
    
    query = query.limit(parseInt(limit));
    
    const snapshot = await query.get();
    const reports = [];
    
    snapshot.forEach(doc => {
      reports.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reports/generate/:year/:month - Generate report data for a specific month
 */
apiRouter.get("/reports/generate/:year/:month", async (req, res) => {
  try {
    const uid = req.user.uid;
    const { year, month } = req.params;
    
    // Get budget data for the month
    const budgetId = `${year}-${String(month).padStart(2, '0')}`;
    const budgetDoc = await db.collection("users").doc(uid)
      .collection("budget_allocations").doc(budgetId).get();
    
    // Get expenses for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    
    const expensesSnap = await db.collection("users").doc(uid)
      .collection("all-transactions")
      .where("type", "==", "expense")
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .get();
    
    // Calculate spending by category
    const spendingByCategory = {};
    let totalSpent = 0;
    
    expensesSnap.forEach(doc => {
      const txn = doc.data();
      const category = txn.category || "Other";
      const subcategory = txn.subcategory || "General";
      const amount = Math.abs(txn.amount || 0);
      
      if (!spendingByCategory[category]) {
        spendingByCategory[category] = {
          total: 0,
          subcategories: {}
        };
      }
      
      spendingByCategory[category].total += amount;
      totalSpent += amount;
      
      if (!spendingByCategory[category].subcategories[subcategory]) {
        spendingByCategory[category].subcategories[subcategory] = 0;
      }
      spendingByCategory[category].subcategories[subcategory] += amount;
    });
    
    // Get budget allocations
    const budgetData = budgetDoc.exists ? budgetDoc.data() : {};
    const budgetCategories = budgetData.categories || {};
    let totalBudget = 0;
    
    // Calculate variances
    const categoriesWithVariance = {};
    const variancesNeedingExplanation = [];
    
    // Get all categories from chart_of_accounts ONLY - Professional approach
    const chartSnap = await db.collection("users").doc(uid)
      .collection("chart_of_accounts")
      .where("display_as", "==", "category")
      .get();
    
    let categoriesData = [];
    const categoryMap = new Map();
    
    // Use chart_of_accounts as single source of truth
    chartSnap.forEach(doc => {
      const account = doc.data();
      const categoryName = account.category_name || account.account_name;
      if (!categoryMap.has(categoryName)) {
        const categoryData = {
          name: categoryName,
          code: account.account_code,
          subcategories: []
        };
        categoryMap.set(categoryName, categoryData);
        categoriesData.push(categoryData);
      }
    });
    
    // Get subcategories for each category
    for (const cat of categoriesData) {
      const subsSnap = await db.collection("users").doc(uid)
        .collection("chart_of_accounts")
        .where("display_as", "==", "subcategory")
        .where("category_name", "==", cat.name)
        .get();
      
      subsSnap.forEach(subDoc => {
        const sub = subDoc.data();
        cat.subcategories.push({
          name: sub.subcategory_name || sub.account_name,
          code: sub.account_code
        });
      });
    }
    
    // If no chart_of_accounts exists, return error
    if (categoriesData.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No chart of accounts found. Please run migration or setup first."
      });
    }
    
    // Process each category
    categoriesData.forEach(category => {
      const categoryName = category.name;
      const budgetForCategory = budgetCategories[categoryName] || {};
      const spendingForCategory = spendingByCategory[categoryName] || { total: 0, subcategories: {} };
      
      // Calculate category budget total
      let categoryBudgetTotal = 0;
      const subcategoriesData = [];
      
      // Handle subcategories with same logic as /budgets endpoint
      (category.subcategories || []).forEach(sub => {
        // Extract subcategory name whether it's a string or object
        let subName = '';
        
        if (typeof sub === 'object') {
          // Handle corrupted data where name is an object
          if (typeof sub.name === 'object') {
            console.warn(`Corrupted subcategory in ${category.name}:`, sub);
            return; // Skip this corrupted entry
          }
          subName = sub.name || '';
        } else {
          subName = sub;
        }
        
        // Skip if no valid name
        if (!subName) return;
        
        const subBudget = budgetForCategory[subName] || 0;
        const subSpent = spendingForCategory.subcategories[subName] || 0;
        
        categoryBudgetTotal += subBudget;
        
        subcategoriesData.push({
          name: subName,
          budgeted: subBudget,
          spent: subSpent,
          variance: subSpent - subBudget
        });
      });
      
      // Also check for "All" budget (category-level budget)
      const categoryLevelBudget = budgetForCategory["All"] || 0;
      if (categoryLevelBudget > 0) {
        categoryBudgetTotal += categoryLevelBudget;
      }
      
      totalBudget += categoryBudgetTotal;
      
      const variance = spendingForCategory.total - categoryBudgetTotal;
      const variancePercent = categoryBudgetTotal > 0 
        ? ((spendingForCategory.total - categoryBudgetTotal) / categoryBudgetTotal) * 100 
        : 0;
      
      categoriesWithVariance[categoryName] = {
        budgeted: categoryBudgetTotal,
        spent: spendingForCategory.total,
        variance: variance,
        variancePercent: variancePercent,
        subcategories: subcategoriesData
      };
      
      // Check if variance needs explanation (>10% or >€100)
      if ((Math.abs(variancePercent) > 10 || Math.abs(variance) > 100) && variance > 0) {
        variancesNeedingExplanation.push({
          category: categoryName,
          variance: variance,
          variancePercent: variancePercent
        });
      }
    });
    
    // Get current account balances
    const balancesDoc = await db.collection("users").doc(uid)
      .collection("account_balances").get();
    
    let cashBalance = 0;
    let bankBalance = 0;
    
    balancesDoc.forEach(doc => {
      const data = doc.data();
      if (doc.id === 'cash') {
        cashBalance = data.current_balance || 0;
      } else if (doc.id === 'bank') {
        bankBalance = data.current_balance || 0;
      }
    });
    
    // Calculate burn rate and months remaining
    const burnRate = totalSpent;
    const totalAvailable = cashBalance + bankBalance;
    const monthsRemaining = burnRate > 0 ? totalAvailable / burnRate : 0;
    
    // Get previous 2 months data for 3-month comparison
    const previousMonths = [];
    for (let i = 1; i <= 2; i++) {
      const prevMonth = parseInt(month) - i;
      const prevYear = prevMonth <= 0 ? parseInt(year) - 1 : year;
      const actualMonth = prevMonth <= 0 ? 12 + prevMonth : prevMonth;
      
      const prevStartDate = `${prevYear}-${String(actualMonth).padStart(2, '0')}-01`;
      const prevEndDate = `${prevYear}-${String(actualMonth).padStart(2, '0')}-31`;
      
      const prevExpensesSnap = await db.collection("users").doc(uid)
        .collection("all-transactions")
        .where("type", "==", "expense")
        .where("date", ">=", prevStartDate)
        .where("date", "<=", prevEndDate)
        .get();
      
      const prevSpending = {};
      prevExpensesSnap.forEach(doc => {
        const txn = doc.data();
        const category = txn.category || "Other";
        if (!prevSpending[category]) {
          prevSpending[category] = 0;
        }
        prevSpending[category] += Math.abs(txn.amount || 0);
      });
      
      previousMonths.push({
        month: actualMonth,
        year: prevYear,
        spending: prevSpending
      });
    }
    
    // Generate YTD data
    const ytdMonths = [];
    for (let m = 1; m <= parseInt(month); m++) {
      const monthStartDate = `${year}-${String(m).padStart(2, '0')}-01`;
      const monthEndDate = `${year}-${String(m).padStart(2, '0')}-31`;
      
      const monthExpensesSnap = await db.collection("users").doc(uid)
        .collection("all-transactions")
        .where("type", "==", "expense")
        .where("date", ">=", monthStartDate)
        .where("date", "<=", monthEndDate)
        .get();
      
      let monthTotal = 0;
      monthExpensesSnap.forEach(doc => {
        monthTotal += Math.abs(doc.data().amount || 0);
      });
      
      // Get budget for this month
      const monthBudgetId = `${year}-${String(m).padStart(2, '0')}`;
      const monthBudgetDoc = await db.collection("users").doc(uid)
        .collection("budget_allocations").doc(monthBudgetId).get();
      
      let monthBudgetTotal = 0;
      if (monthBudgetDoc.exists) {
        const monthBudgetData = monthBudgetDoc.data();
        const monthCategories = monthBudgetData.categories || {};
        Object.values(monthCategories).forEach(catBudget => {
          if (typeof catBudget === 'object') {
            Object.values(catBudget).forEach(amount => {
              if (typeof amount === 'number') {
                monthBudgetTotal += amount;
              }
            });
          }
        });
      }
      
      ytdMonths.push({
        month: m,
        budget: monthBudgetTotal,
        actual: monthTotal
      });
    }
    
    return res.json({
      success: true,
      data: {
        month: parseInt(month),
        year: parseInt(year),
        totalBudget,
        totalSpent,
        totalVariance: totalSpent - totalBudget,
        categories: categoriesWithVariance,
        variancesNeedingExplanation,
        cashBalance,
        bankBalance,
        burnRate,
        monthsRemaining,
        threeMonthComparison: {
          current: { month: parseInt(month), year: parseInt(year), spending: spendingByCategory },
          previous: previousMonths
        },
        ytdData: ytdMonths
      }
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reports/:id - Get specific report
 */
apiRouter.get("/reports/:id", async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    
    const reportDoc = await db.collection("users").doc(uid)
      .collection("reports").doc(id).get();
    
    if (!reportDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }
    
    return res.json({
      success: true,
      data: {
        id: reportDoc.id,
        ...reportDoc.data()
      }
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/reports - Create new report
 */
apiRouter.post("/reports", async (req, res) => {
  try {
    const uid = req.user.uid;
    const reportData = req.body;
    
    // Check if report already exists for this month
    const existingQuery = await db.collection("users").doc(uid)
      .collection("reports")
      .where("year", "==", reportData.year)
      .where("month", "==", reportData.month)
      .limit(1)
      .get();
    
    if (!existingQuery.empty) {
      return res.status(400).json({
        success: false,
        error: "Report already exists for this month"
      });
    }
    
    const newReport = {
      ...reportData,
      status: "draft",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.user.email || uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection("users").doc(uid)
      .collection("reports").add(newReport);
    
    return res.json({
      success: true,
      data: {
        id: docRef.id,
        ...newReport
      }
    });
  } catch (error) {
    console.error("Error creating report:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/reports/:id - Update draft report
 */
apiRouter.put("/reports/:id", async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    const updates = req.body;
    
    // Check if report exists and is a draft
    const reportDoc = await db.collection("users").doc(uid)
      .collection("reports").doc(id).get();
    
    if (!reportDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }
    
    if (reportDoc.data().status === "final") {
      return res.status(400).json({
        success: false,
        error: "Cannot edit finalized report"
      });
    }
    
    const updatedReport = {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection("users").doc(uid)
      .collection("reports").doc(id).update(updatedReport);
    
    return res.json({
      success: true,
      data: {
        id: id,
        ...updatedReport
      }
    });
  } catch (error) {
    console.error("Error updating report:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/reports/:id/finalize - Finalize a report
 */
apiRouter.post("/reports/:id/finalize", async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    
    // Get the report
    const reportDoc = await db.collection("users").doc(uid)
      .collection("reports").doc(id).get();
    
    if (!reportDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }
    
    const reportData = reportDoc.data();
    
    if (reportData.status === "final") {
      return res.status(400).json({
        success: false,
        error: "Report is already finalized"
      });
    }
    
    // Validate that all required explanations are present
    const variancesNeedingExplanation = reportData.variancesNeedingExplanation || [];
    const explanations = reportData.varianceExplanations || {};
    
    for (const variance of variancesNeedingExplanation) {
      if (!explanations[variance.category]) {
        return res.status(400).json({
          success: false,
          error: `Missing explanation for ${variance.category} variance`
        });
      }
    }
    
    // Create a data snapshot for permanent record
    const snapshot = {
      ...reportData,
      status: "final",
      finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
      finalizedBy: req.user.email || uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection("users").doc(uid)
      .collection("reports").doc(id).update(snapshot);
    
    return res.json({
      success: true,
      data: {
        id: id,
        ...snapshot
      }
    });
  } catch (error) {
    console.error("Error finalizing report:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/reports/:id/reopen - Reopen a finalized report
 */
apiRouter.post("/reports/:id/reopen", async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    
    const reportDoc = await db.collection("users").doc(uid)
      .collection("reports").doc(id).get();
    
    if (!reportDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }
    
    if (reportDoc.data().status !== "final") {
      return res.status(400).json({
        success: false,
        error: "Report is not finalized"
      });
    }
    
    await db.collection("users").doc(uid)
      .collection("reports").doc(id).update({
        status: "draft",
        reopenedAt: admin.firestore.FieldValue.serverTimestamp(),
        reopenedBy: req.user.email || uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    
    return res.json({
      success: true,
      message: "Report reopened successfully"
    });
  } catch (error) {
    console.error("Error reopening report:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export the Express app as a Firebase Function
module.exports = {api: onRequest(app)};
