import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const FIRESTORE_DOC = 'trips/main';
const LOCAL_CACHE_KEY = 'trip-planner-state';
const DEBOUNCE_MS = 600;

export function useFirestore(initialValue) {
  const [state, setState] = useState(() => {
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
  const initialized = useRef(false);
  const debounceTimer = useRef(null);
  const lastWriteTime = useRef(0);
  const dragging = useRef(false);
  const pendingWrite = useRef(false);
  const WRITE_COOLDOWN = 1500;

  // --- Real-time listener (onSnapshot) ---
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, FIRESTORE_DOC),
      (snap) => {
        if (snap.exists()) {
          const remote = snap.data();
          if (remote._version === initialValue._version) {
            // Skip echoes from our own writes (within cooldown window)
            const timeSinceWrite = Date.now() - lastWriteTime.current;
            if (timeSinceWrite < WRITE_COOLDOWN) {
              return;
            }
            setState(remote);
            localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(remote));
            console.log('📡 Real-time update from Firestore');
          }
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

  // --- Debounced sync to Firestore ---
  useEffect(() => {
    if (!initialized.current) return;

    // Always save to localStorage immediately
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }

    // If dragging, mark pending and don't write yet
    if (dragging.current) {
      pendingWrite.current = true;
      return;
    }

    // Debounce Firestore writes
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      lastWriteTime.current = Date.now();
      setDoc(doc(db, FIRESTORE_DOC), state)
        .then(() => console.log('☁️ Synced to Firestore'))
        .catch((err) => console.error('❌ Failed to sync:', err));
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [state]);

  const resetState = useCallback((newState) => {
    localStorage.removeItem(LOCAL_CACHE_KEY);
    setState(newState);
  }, []);

  const setDragging = useCallback((isDragging) => {
    dragging.current = isDragging;
    // When drag ends, flush pending write
    if (!isDragging && pendingWrite.current) {
      pendingWrite.current = false;
      lastWriteTime.current = Date.now();
      // Read latest state from localStorage (most up-to-date)
      try {
        const latest = JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY));
        if (latest) {
          setDoc(doc(db, FIRESTORE_DOC), latest)
            .then(() => console.log('☁️ Synced after drag end'))
            .catch((err) => console.error('❌ Failed to sync:', err));
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  return [state, setState, resetState, loading, setDragging];
}
