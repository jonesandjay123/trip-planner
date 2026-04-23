import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY

if (!firebaseApiKey) {
  throw new Error('Missing VITE_FIREBASE_API_KEY. Add it to your .env.local before starting the app.')
}

const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: 'trip-planner-ab5a9.firebaseapp.com',
  projectId: 'trip-planner-ab5a9',
  storageBucket: 'trip-planner-ab5a9.firebasestorage.app',
  messagingSenderId: '715210543670',
  appId: '1:715210543670:web:81d29d198d64bcf32cbe97',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, 'us-central1')
export const ownerEmail = import.meta.env.VITE_OWNER_EMAIL || 'jonesandjay123@gmail.com'
