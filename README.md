# NGO Budget Management System

A professional budget management system for NGOs built with Firebase and vanilla JavaScript, implementing QuickBooks-style double-entry bookkeeping.

## Features

### Core Accounting System
- **Double-Entry Bookkeeping**: Professional accounting with automatic ledger balance calculations
- **Multi-Account Management**: Separate tracking for Cash and Bank accounts
- **Automatic Balance Reconciliation**: Chronological balance recalculation when transactions are added

### Transaction Management
- **Expense Tracking**: Record and categorize expenses with receipt attachments
- **Income Recording**: Track donations and other income sources
- **Cash & Banking**: Manage deposits, withdrawals, and transfers between accounts
- **Transaction History**: Full audit trail with remaining balance calculations

### Budget & Reporting
- **Budget Planning**: Set and track budgets by category
- **Real-time Dashboards**: Visual overview of financial status
- **Expected Income Tracking**: Monitor pending donations and payments

## Technical Architecture

### Backend
- **Firebase Functions**: Serverless backend with Express.js API
- **Firestore Database**: NoSQL database with three main collections:
  - `all-transactions`: Raw transaction data
  - `account_ledger`: Complete audit trail with balance history
  - `account_balances`: Current balance snapshots

### Frontend
- **Vanilla JavaScript**: No framework dependencies
- **Modular Design**: Reusable components and services
- **Responsive UI**: Mobile-friendly interface

### Key Implementation Details
- Transactions trigger automatic ledger rebuilds for chronological accuracy
- Compound ordering (date + timestamp) ensures consistent same-day transaction handling
- Firestore composite indexes optimize query performance

## Setup

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Install dependencies: `cd functions && npm install`
3. Configure Firebase: `firebase init`
4. Deploy: `firebase deploy`

## Recent Updates

### Ledger Balance Recalculation System (August 2025)
- Implemented automatic ledger rebuild on transaction creation
- Fixed chronological balance calculation for out-of-order entries
- Added compound ordering for consistent same-day transaction display
- Ensures "Remaining Balance" column always shows accurate chronological balances

## Security

- Firebase Authentication for user management
- Firestore security rules for data protection
- No sensitive data in frontend code

## License

Private project - All rights reserved

## Author

Developed for Paréa Lesvos NGO