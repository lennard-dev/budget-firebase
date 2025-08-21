// Script to run the chart_of_accounts migration
// Run this in the browser console when logged into the app

async function migrateToChartOfAccounts() {
  try {
    console.log('Starting migration to chart_of_accounts...');
    
    // Get the current user's token
    const token = await firebase.auth().currentUser.getIdToken();
    
    // Call the migration endpoint
    const response = await fetch('https://api-ngc2efkn7q-uc.a.run.app/api/chart-of-accounts/migrate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Migration successful!', result.message);
      
      // Now fetch the new accounts to verify
      const accountsResponse = await fetch('https://api-ngc2efkn7q-uc.a.run.app/api/chart-of-accounts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const accounts = await accountsResponse.json();
      console.log('📊 Chart of Accounts:', accounts);
      
      return accounts;
    } else {
      console.error('❌ Migration failed:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error during migration:', error);
    return null;
  }
}

// Run the migration
console.log('To run the migration, execute: migrateToChartOfAccounts()');
console.log('This will:');
console.log('1. Convert all categories to professional chart of accounts');
console.log('2. Set up account codes (5000+ for expenses)');
console.log('3. Create sub-account hierarchy');
console.log('4. Enable full QuickBooks-style accounting');