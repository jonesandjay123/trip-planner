import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
  const isFirstLoad = useRef(true);
  const skipNextSync = useRef(false);

  // --- Load from Firestore on mount ---
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, FIRESTORE_DOC));
        if (snap.exists()) {
          const remote = snap.data();
          // Version check — if remote is outdated, overwrite it
          if (remote._version === initialValue._version) {
            skipNextSync.current = true; // Don't write back what we just read
            setState(remote);
            localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(remote));
            console.log('✅ Loaded from Firestore');
          } else {
            console.log('⚠️ Firestore version mismatch, using local/defaults');
          }
        } else {
          console.log('📝 No Firestore data yet, will create on first change');
        }
      } catch (err) {
        console.error('❌ Failed to load from Firestore:', err);
      } finally {
        setLoading(false);
        isFirstLoad.current = false;
      }
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Sync state to Firestore + localStorage on every change ---
  useEffect(() => {
    // Skip the write triggered by loading Firestore data
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    // Don't write during initial load
    if (isFirstLoad.current) return;

    // Save to localStorage (instant, offline-capable)
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }

    // Save to Firestore (async, cloud sync)
    setDoc(doc(db, FIRESTORE_DOC), state)
      .then(() => console.log('☁️ Synced to Firestore'))
      .catch((err) => console.error('❌ Failed to sync to Firestore:', err));
  }, [state]);

  const resetState = useCallback((newState) => {
    localStorage.removeItem(LOCAL_CACHE_KEY);
    setState(newState);
  }, []);

  return [state, setState, resetState, loading];
}
