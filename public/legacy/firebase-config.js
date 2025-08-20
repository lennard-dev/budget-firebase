// Firebase configuration fallback for local development
// This provides a fallback when the auto-initialization fails

window.firebaseConfigFallback = {
  // Demo/local development configuration
  apiKey: "demo-api-key",
  authDomain: "localhost",
  projectId: "demo-budget-app",
  storageBucket: "demo-budget-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Function to initialize Firebase with fallback config
window.initializeFirebaseWithFallback = async function() {
  // First, try to wait for auto-initialization
  let retries = 0;
  while (!window.firebase && retries < 30) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }

  // If Firebase loaded but no app initialized, use fallback
  if (window.firebase && !window.firebase.apps.length) {
    console.log('Using fallback Firebase configuration for local development');
    try {
      const app = firebase.initializeApp(window.firebaseConfigFallback);

      // Connect to emulators if in development and they're available
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const auth = firebase.auth();
        const db = firebase.firestore();
        const functions = firebase.functions();

        try {
          // Try to connect to emulators - if they fail, continue without them
          await checkEmulatorAvailability('localhost', 9099);
          auth.useEmulator('http://localhost:9099');
          console.log('Connected to Auth emulator');
        } catch (e) {
          console.warn('Auth emulator not available, using production auth');
        }

        try {
          await checkEmulatorAvailability('localhost', 8080);
          db.useEmulator('localhost', 8080);
          console.log('Connected to Firestore emulator');
        } catch (e) {
          console.warn('Firestore emulator not available, using production firestore');
        }

        try {
          await checkEmulatorAvailability('localhost', 5001);
          functions.useEmulator('localhost', 5001);
          console.log('Connected to Functions emulator');
        } catch (e) {
          console.warn('Functions emulator not available, using production functions');
        }
      }

      return app;
    } catch (e) {
      console.error('Failed to initialize Firebase with fallback config:', e);
      throw e;
    }
  }

  return window.firebase.app();
};

// Helper function to check if emulator is available
async function checkEmulatorAvailability(host, port) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 1000);

    fetch(`http://${host}:${port}/`)
      .then(() => {
        clearTimeout(timeout);
        resolve();
      })
      .catch(() => {
        clearTimeout(timeout);
        reject(new Error('Not available'));
      });
  });
}
