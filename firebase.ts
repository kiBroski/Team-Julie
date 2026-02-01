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

// Check if keys have been updated (Used to show the setup guide if needed)
export const isFirebaseSetup = firebaseConfig.apiKey !== "YOUR_API_KEY_HERE";

if (!isFirebaseSetup) {
  console.warn("Firebase API keys are missing. Application will render Setup Guide.");
}

// Initialize Firebase (Prevent multiple initializations)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();