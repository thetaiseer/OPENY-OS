// ============================================================
// OPENY — Firebase Configuration
// ============================================================
// Replace the placeholder values below with your actual
// Firebase project credentials.
//
// Where to find them:
//   Firebase Console → Your Project → Project Settings → General
//   → "Your apps" section → Web app → firebaseConfig object
//
//   apiKey           : Firebase API key
//   authDomain       : "your-project-id.firebaseapp.com"
//   projectId        : Your Firebase project ID
//   storageBucket    : "your-project-id.appspot.com"
//   messagingSenderId: Your sender ID (numeric)
//   appId            : Your Firebase app ID (starts with "1:")
//
// These are PUBLIC credentials. Secure your data using
// Firestore Security Rules in the Firebase Console:
//   Firestore Database → Rules
//
// For exported files (PDF / Excel / Word), create a
// Firebase Storage bucket and set rules to allow reads:
//   Storage → Rules
// ============================================================

window.FIREBASE_CONFIG = {
    apiKey:            'YOUR_API_KEY_HERE',
    authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
    projectId:         'YOUR_PROJECT_ID_HERE',
    storageBucket:     'YOUR_PROJECT_ID.appspot.com',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID_HERE',
    appId:             'YOUR_APP_ID_HERE'
};
