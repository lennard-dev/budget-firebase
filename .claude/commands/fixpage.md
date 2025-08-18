---
name: fixpage
description: Automates the fix-deploy-test cycle for the budget app until all console errors are resolved
arguments: "<fix_description>"
---

# Fix Page Command

This command automates the complete fix-deploy-test cycle for the budget app, continuously fixing and testing until all console errors are resolved.

## Usage

```
/fixpage "Fix authentication issues and ledger display problems"
```

## Workflow

The command executes the following automated workflow:

1. **Parse Fix Requirements**
   - Analyze the provided fix description
   - Identify affected pages and components
   - Create a structured fix plan

2. **Initial Local Testing**
   - Run local build to catch compilation errors
   - Check for TypeScript/linting issues
   - Verify basic functionality

3. **Implement Fixes**
   - Apply targeted fixes based on the description
   - Follow QuickBooks-style architecture principles
   - Ensure atomic Firestore transactions
   - Maintain separation between frontend display and backend calculations

4. **Build & Deploy Cycle**
   - Build production bundle: `npm run build`
   - Deploy to Firebase: `firebase deploy --only hosting`
   - Wait for deployment completion

5. **Browser Testing**
   - Open https://budget-v01.web.app/ in browser
   - Navigate to affected pages (expenses, cash-banking, dashboard)
   - Check browser console for errors
   - Capture and analyze any error messages

6. **Error Analysis & Fix Loop**
   - If console errors exist:
     - Analyze root cause of each error
     - Implement targeted fixes
     - Rebuild and redeploy
     - Test again
   - Continue until zero console errors

7. **Final Verification**
   - Test all main pages for errors
   - Verify data display and calculations
   - Check ledger balances
   - Confirm transaction flows

8. **Report Generation**
   - Summary of all fixes implemented
   - Number of deployment cycles
   - Final status of each page
   - Any remaining warnings (non-critical)

## Implementation Steps

```javascript
// Step 1: Parse arguments and create fix plan
const fixDescription = $ARGUMENTS;
console.log(`Starting fix cycle for: ${fixDescription}`);

// Step 2: Initial local test
await runCommand('npm run build');
const buildErrors = checkBuildErrors();
if (buildErrors) {
  await fixBuildErrors(buildErrors);
}

// Step 3: Main fix-deploy-test loop
let iterationCount = 0;
let hasErrors = true;
const maxIterations = 10;
const fixHistory = [];

while (hasErrors && iterationCount < maxIterations) {
  iterationCount++;
  console.log(`\n=== Iteration ${iterationCount} ===`);
  
  // Apply fixes based on current errors
  if (iterationCount === 1) {
    await implementInitialFixes(fixDescription);
  } else {
    await implementErrorFixes(lastErrors);
  }
  
  // Build and deploy
  console.log('Building for production...');
  await runCommand('npm run build');
  
  console.log('Deploying to Firebase...');
  await runCommand('firebase deploy --only hosting');
  
  // Wait for deployment propagation
  await sleep(5000);
  
  // Test in browser
  console.log('Testing in browser...');
  const testResults = await testInBrowser([
    'https://budget-v01.web.app/',
    'https://budget-v01.web.app/pages/expenses.html',
    'https://budget-v01.web.app/pages/cash-banking.html'
  ]);
  
  // Analyze results
  const errors = extractConsoleErrors(testResults);
  hasErrors = errors.length > 0;
  
  if (hasErrors) {
    console.log(`Found ${errors.length} errors. Analyzing...`);
    lastErrors = errors;
    fixHistory.push({
      iteration: iterationCount,
      errors: errors,
      fixes: await planFixes(errors)
    });
  } else {
    console.log('No console errors found!');
  }
}

// Step 4: Generate final report
generateFinalReport({
  success: !hasErrors,
  iterations: iterationCount,
  fixHistory: fixHistory,
  finalStatus: await getFinalStatus()
});
```

## Error Handling

### Common Error Patterns & Fixes

1. **Firestore Transaction Errors**
   - Error: "FAILED_PRECONDITION: Firestore transactions require all reads before writes"
   - Fix: Restructure transaction to perform all reads first, then all writes

2. **Missing Ledger Entries**
   - Error: "Cannot read property 'balance_after' of undefined"
   - Fix: Ensure ledger entries are created for all transactions

3. **Authentication Issues**
   - Error: "Missing or insufficient permissions"
   - Fix: Check mock auth implementation or Firebase rules

4. **Build Errors**
   - Error: TypeScript compilation failures
   - Fix: Resolve type issues, missing imports, or syntax errors

### Rollback Procedure

If critical errors occur during deployment:

1. **Immediate Rollback**
   ```bash
   firebase hosting:rollback
   ```

2. **Restore Previous Version**
   - Identify last working deployment
   - Restore from Git history if needed
   - Redeploy stable version

3. **Error Documentation**
   - Log all error details
   - Create issue report
   - Document attempted fixes

## Configuration

### Environment Requirements

- Node.js and npm installed
- Firebase CLI configured
- Authentication to Firebase project
- Browser with DevTools access

### Project Structure

```
budget-firebase/
├── public/
│   ├── pages/
│   │   ├── expenses.html
│   │   ├── cash-banking.html
│   │   └── dashboard.html
│   └── js/
│       ├── services/
│       └── pages/
├── functions/
│   └── index.js
└── firebase.json
```

## Examples

### Example 1: Fix Authentication Issues
```
/fixpage "Fix mock authentication not initializing properly on page load"
```

### Example 2: Fix Ledger Display
```
/fixpage "Cash movements table showing no data despite transactions existing"
```

### Example 3: Fix Balance Calculations
```
/fixpage "Bank balance not updating after new transactions"
```

### Example 4: Fix Multiple Issues
```
/fixpage "Fix authentication, ledger display, and balance calculation errors on all pages"
```

## Success Criteria

The command succeeds when:
- Zero console errors on all pages
- All data displays correctly
- Balances calculate properly
- Transaction flows work end-to-end
- No TypeScript/build errors

## Monitoring

During execution, the command will:
- Log each step's progress
- Display error messages found
- Show fixes being applied
- Report deployment status
- Provide iteration summaries

## Notes

- Maximum 10 iterations to prevent infinite loops
- Each iteration includes full build and deploy
- Browser testing uses actual production URL
- All fixes follow QuickBooks-style architecture
- Maintains separation of concerns between transactions, ledger, and balances