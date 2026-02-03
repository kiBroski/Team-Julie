
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

// --------------------------------------------------------
// CONFIGURATION
// --------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyAzT9hZben67udjeH_DMuc3ybTwDvcfDlg",
  authDomain: "teamjulie-15d92.firebaseapp.com",
  projectId: "teamjulie-15d92",
  storageBucket: "teamjulie-15d92.firebasestorage.app",
  messagingSenderId: "207650210547",
  appId: "1:207650210547:web:d0fad341d141022d666d86",
  measurementId: "G-VSSQG0NSRX"
};

// --------------------------------------------------------
// INITIALIZATION
// --------------------------------------------------------

export const isFirebaseSetup = firebaseConfig.apiKey !== "YOUR_API_KEY_HERE";

if (!isFirebaseSetup) {
  console.warn("Firebase API keys are missing. Application will render Setup Guide.");
}

// Initialize Firebase (Prevent multiple initializations)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  
  // Enable Offline Persistence safely
  if (typeof firebase.firestore === 'function') {
    // We suppress the warning about enableIndexedDbPersistence deprecation 
    // because migrating to modular SDK is a larger refactor.
    // This allows offline support to work without console spam.
    const db = firebase.firestore();
    
    // Check if we are in a browser environment that supports persistence
    if (typeof window !== 'undefined') {
       db.enablePersistence({ synchronizeTabs: true })
        .catch((err) => {
          if (err.code === 'failed-precondition') {
             // Multiple tabs open, persistence can only be enabled in one tab at a time.
             // This is fine.
             console.log('Persistence limited to one tab');
          } else if (err.code === 'unimplemented') {
             console.log('Persistence not supported by browser');
          }
        });
    }
  } else {
    console.error("CRITICAL: Firebase Firestore module not loaded. Check imports.");
  }
}

export const auth = firebase.auth();
export const db = firebase.firestore();
