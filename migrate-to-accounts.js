// Migration script to complete chart of accounts migration
// This will update all existing transactions with account codes

const fetch = require('node-fetch');

async function runMigration() {
  console.log('Starting chart of accounts migration...');
  
  try {
    // Using the mock auth approach for admin access
    const response = await fetch('https://api-ngc2efkn7q-uc.a.run.app/api/migration/complete-accounts-migration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-test-token-migration',
        'X-User-ID': '7QGvBNZJKYgTD7NdlCrgSoMhujz2'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Migration failed: ${error}`);
    }

    const result = await response.json();
    console.log('Migration completed successfully!');
    console.log('Results:', result);
    
    if (result.stats) {
      console.log('\nMigration Statistics:');
      console.log(`- Total transactions: ${result.stats.total}`);
      console.log(`- Migrated: ${result.stats.migrated}`);
      console.log(`- Failed: ${result.stats.failed}`);
      console.log(`- Skipped: ${result.stats.skipped}`);
      console.log(`- Ledger rebuilt: ${result.stats.ledgerRebuilt}`);
    }
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration().then(() => {
  console.log('\nMigration process complete!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});