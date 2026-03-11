import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'trip-planner-state';

export function useLocalStorage(initialValue) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [state]);

  const resetState = useCallback((newState) => {
    localStorage.removeItem(STORAGE_KEY);
    setState(newState);
  }, []);

  return [state, setState, resetState];
}
