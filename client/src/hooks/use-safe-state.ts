import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook that provides a safe setState that prevents updates on unmounted components
 */
export function useSafeState<T>(initialState: T | (() => T)) {
  const [state, setState] = useState(initialState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setSafeState = (value: T | ((prevState: T) => T)) => {
    if (mountedRef.current) {
      setState(value);
    }
  };

  return [state, setSafeState] as const;
}