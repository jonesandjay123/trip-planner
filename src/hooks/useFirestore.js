import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const FIRESTORE_DOC = 'trips/main';
const LOCAL_CACHE_KEY = 'trip-planner-state';

export function useFirestore(initialValue) {
  const [state, setState] = useState(() => {
    // Try local cache first for instant render
    try {
      const cached = localStorage.getItem(LOCAL_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed._version === initialValue._version) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }
    return initialValue;
  });

  const [loading, setLoading] = useState(true);
  const isLocalChange = useRef(false);
  const initialized = useRef(false);

  // --- Real-time listener (onSnapshot) ---
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, FIRESTORE_DOC),
      (snap) => {
        if (snap.exists()) {
          const remote = snap.data();
          if (remote._version === initialValue._version) {
            // Skip if this snapshot was triggered by our own write
            if (isLocalChange.current) {
              isLocalChange.current = false;
              return;
            }
            setState(remote);
            localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(remote));
            console.log('📡 Real-time update from Firestore');
          } else {
            console.log('⚠️ Firestore version mismatch, ignoring remote data');
          }
        } else {
          console.log('📝 No Firestore data yet');
        }
        if (!initialized.current) {
          initialized.current = true;
          setLoading(false);
        }
      },
      (err) => {
        console.error('❌ Firestore listener error:', err);
        if (!initialized.current) {
          initialized.current = true;
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Sync local state changes to Firestore ---
  useEffect(() => {
    // Don't write until initialized
    if (!initialized.current) return;

    // Save to localStorage (instant)
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }

    // Save to Firestore (mark as local change so onSnapshot skips it)
    isLocalChange.current = true;
    setDoc(doc(db, FIRESTORE_DOC), state)
      .then(() => console.log('☁️ Synced to Firestore'))
      .catch((err) => {
        isLocalChange.current = false;
        console.error('❌ Failed to sync to Firestore:', err);
      });
  }, [state]);

  const resetState = useCallback((newState) => {
    localStorage.removeItem(LOCAL_CACHE_KEY);
    setState(newState);
  }, []);

  return [state, setState, resetState, loading];
}
