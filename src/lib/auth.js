import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth } from '../firebase'

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

export function signInWithGoogle() {
  return signInWithPopup(auth, provider)
}

export function logOut() {
  return signOut(auth)
}

export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, callback)
}
