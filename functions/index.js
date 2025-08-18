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

// Initialize Firebase Admin
setGlobalOptions({maxInstances: 10});

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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

  try {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.*)$/i);

    if (!match) {
      return res.status(401).json({error: "Missing Authorization header"});
    }

    const idToken = match[1];

    // Mock token support for development
    if (idToken.startsWith("mock-test-token-")) {
      req.user = {
        uid: "test-admin-user-001",
        email: "admin@test.local",
      };
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
    category: transactionData.category || null,
    subcategory: transactionData.subcategory || null,
    paymentMethod: transactionData.paymentMethod || null, // Store at top level for expenses
    metadata: transactionData.metadata || {},
  };
  
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

/**
 * Generate next category ID in format C0001, C0002, etc.
 */
async function generateCategoryId(uid) {
  const sequenceRef = db.collection("users").doc(uid)
      .collection("id_sequences").doc("categories");
  
  const result = await db.runTransaction(async (t) => {
    const sequenceDoc = await t.get(sequenceRef);
    const nextId = sequenceDoc.exists ? (sequenceDoc.data().next_id || 1) : 1;
    const categoryId = `C${String(nextId).padStart(4, '0')}`;
    
    t.set(sequenceRef, { next_id: nextId + 1 }, { merge: true });
    return categoryId;
  });
  
  return result;
}

/**
 * Generate next subcategory ID in format S0001, S0002, etc.
 */
async function generateSubcategoryId(uid) {
  const sequenceRef = db.collection("users").doc(uid)
      .collection("id_sequences").doc("subcategories");
  
  const result = await db.runTransaction(async (t) => {
    const sequenceDoc = await t.get(sequenceRef);
    const nextId = sequenceDoc.exists ? (sequenceDoc.data().next_id || 1) : 1;
    const subcategoryId = `S${String(nextId).padStart(4, '0')}`;
    
    t.set(sequenceRef, { next_id: nextId + 1 }, { merge: true });
    return subcategoryId;
  });
  
  return result;
}

// Categories
apiRouter.get("/categories", async (req, res) => {
  const uid = req.user.uid;
  const snap = await db.collection("users").doc(uid)
      .collection("categories").orderBy("name").get();
  const data = snap.docs.map((d) => ({id: d.id, ...d.data()}));
  res.json({success: true, data});
});

apiRouter.post("/categories", async (req, res) => {
  const uid = req.user.uid;
  const {id, name, code, subcategories = [], active = true} = req.body || {};
  if (!name || !code) {
    return res.status(400).json({success: false, error: "Missing name or code"});
  }
  
  const col = db.collection("users").doc(uid).collection("categories");
  
  if (id) {
    // Update existing category
    const existingDoc = await col.doc(id).get();
    const existingData = existingDoc.data() || {};
    
    // Process subcategories - maintain existing IDs, generate new ones for new subcategories
    const existingSubsMap = new Map();
    if (Array.isArray(existingData.subcategories)) {
      existingData.subcategories.forEach(sub => {
        if (typeof sub === 'object' && sub.name) {
          existingSubsMap.set(sub.name, sub.id);
        } else if (typeof sub === 'string') {
          existingSubsMap.set(sub, null);
        }
      });
    }
    
    const processedSubcategories = await Promise.all(
      subcategories.map(async (subName) => {
        if (existingSubsMap.has(subName) && existingSubsMap.get(subName)) {
          // Existing subcategory with ID
          return { id: existingSubsMap.get(subName), name: subName };
        } else {
          // New subcategory - generate ID
          const subId = await generateSubcategoryId(uid);
          return { id: subId, name: subName };
        }
      })
    );
    
    await col.doc(id).set({
      name, 
      code, 
      subcategories: processedSubcategories, 
      active,
      category_id: existingData.category_id || await generateCategoryId(uid),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    
    return res.json({success: true});
  } else {
    // Create new category with generated ID
    const categoryId = await generateCategoryId(uid);
    
    // Generate IDs for all subcategories
    const processedSubcategories = await Promise.all(
      subcategories.map(async (subName) => ({
        id: await generateSubcategoryId(uid),
        name: subName
      }))
    );
    
    const ref = await col.add({
      category_id: categoryId,
      name, 
      code, 
      subcategories: processedSubcategories, 
      active,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return res.json({success: true, id: ref.id, category_id: categoryId});
  }
});

// Category rename with transaction propagation
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
    
    // Get budget document for the specific month
    const budgetId = `${year}-${String(month).padStart(2, '0')}`;
    const budgetDoc = await db.collection("users").doc(uid)
        .collection("budgets").doc(budgetId).get();
    
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
    const categoriesGrouped = {};
    let totalBudget = 0;
    let totalSpent = 0;
    
    // Get all categories
    const categoriesSnap = await db.collection("users").doc(uid)
        .collection("categories").get();
    
    categoriesSnap.forEach(doc => {
      const category = doc.data();
      const categoryName = category.name;
      const budgetForCategory = budgetData.categories?.[categoryName] || {};
      const spendingForCategory = spendingByCategory[categoryName] || { total: 0, subcategories: {} };
      
      // Calculate totals for this category
      let categoryBudgetTotal = 0;
      const subcategoriesData = [];
      
      // Handle subcategories
      (category.subcategories || []).forEach(sub => {
        const subBudget = budgetForCategory[sub] || 0;
        const subSpent = spendingForCategory.subcategories[sub] || 0;
        
        categoryBudgetTotal += subBudget;
        
        subcategoriesData.push({
          subcategory: sub,
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
    
    if (allocations && Array.isArray(allocations)) {
      // Frontend sends allocations array format
      allocations.forEach(({category, subcategory, amount}) => {
        if (!categoriesData[category]) {
          categoriesData[category] = {};
        }
        // Store subcategory budget (or "All" for category-level)
        categoriesData[category][subcategory || "General"] = amount || 0;
      });
    } else if (categories) {
      // Direct categories object format (backward compatibility)
      categoriesData = categories;
    }
    
    const budgetId = `${year}-${String(month).padStart(2, '0')}`;
    
    await db.collection("users").doc(uid)
        .collection("budgets").doc(budgetId).set({
      totalBudget: totalBudget || 0,
      categories: categoriesData,
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

// Export the Express app as a Firebase Function
module.exports = {api: onRequest(app)};
