// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQlj9ntfX-nu_HJQ24_LK6U9V31dDLRkA",
  authDomain: "trip-planner-ab5a9.firebaseapp.com",
  projectId: "trip-planner-ab5a9",
  storageBucket: "trip-planner-ab5a9.firebasestorage.app",
  messagingSenderId: "715210543670",
  appId: "1:715210543670:web:81d29d198d64bcf32cbe97"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// For local testing, enable the debug token
if (typeof window !== "undefined" && window.location.hostname === "localhost") {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// Initialize App Check with reCAPTCHA Enterprise
export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider('6LdYelosAAAAAA2nTqOSHM4vmgA-4nS8Zfsc_CYz'),
  isTokenAutoRefreshEnabled: true // Set to true to allow auto-refresh.
});

export const db = getFirestore(app);