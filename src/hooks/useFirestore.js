import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const FIRESTORE_DOC = 'trips/main';
const LOCAL_CACHE_KEY = 'trip-planner-state';
const DEBOUNCE_MS = 200;

function getCardUpdatedTime(card) {
  const raw = card?.updatedAt || card?.location?.updatedAt || card?.createdAt;
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeRemoteProtectedFields(localState, remoteState) {
  if (!remoteState?.cards || !localState?.cards) return localState;

  let changed = false;
  const mergedCards = { ...localState.cards };

  for (const [cardId, localCard] of Object.entries(localState.cards)) {
    const remoteCard = remoteState.cards?.[cardId];
    if (!remoteCard) continue;

    const remoteIsNewer = getCardUpdatedTime(remoteCard) > getCardUpdatedTime(localCard);
    if (remoteIsNewer) {
      mergedCards[cardId] = remoteCard;
      changed = true;
      continue;
    }

    if (remoteCard.location && !localCard?.location) {
      mergedCards[cardId] = {
        ...localCard,
        location: remoteCard.location,
      };
      changed = true;
    }
  }

  return changed ? { ...localState, cards: mergedCards } : localState;
}

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
  const latestState = useRef(state);
  const dirty = useRef(false);
  const dirtyVersion = useRef(0);
  const WRITE_COOLDOWN = 1500;

  useEffect(() => {
    latestState.current = state;
  }, [state]);

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
            dirty.current = false;
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

  const writeLatestState = useCallback((reason = 'manual flush') => {
    if (!initialized.current || !dirty.current) return;
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    lastWriteTime.current = Date.now();
    const writeVersion = dirtyVersion.current;
    const ref = doc(db, FIRESTORE_DOC);

    getDoc(ref)
      .then((snap) => {
        const stateToWrite = snap.exists()
          ? mergeRemoteProtectedFields(latestState.current, snap.data())
          : latestState.current;
        latestState.current = stateToWrite;
        return setDoc(ref, stateToWrite);
      })
      .then(() => {
        if (dirtyVersion.current === writeVersion) {
          dirty.current = false;
        }
        console.log(`☁️ Synced to Firestore (${reason})`);
      })
      .catch((err) => console.error('❌ Failed to sync:', err));
  }, []);

  // Flush pending state when mobile browsers background/refresh the page.
  useEffect(() => {
    function handlePageHide() {
      writeLatestState('page hide');
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        writeLatestState('visibility hidden');
      }
    }

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [writeLatestState]);

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
      writeLatestState('debounced');
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [state, writeLatestState]);

  const updateState = useCallback((value) => {
    dirty.current = true;
    dirtyVersion.current += 1;
    setState(value);
  }, []);

  const resetState = useCallback((newState) => {
    localStorage.removeItem(LOCAL_CACHE_KEY);
    dirty.current = true;
    dirtyVersion.current += 1;
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
          latestState.current = latest;
          writeLatestState('drag end');
        }
      } catch (e) {
        // ignore
      }
    }
  }, [writeLatestState]);

  return [state, updateState, resetState, loading, setDragging];
}
