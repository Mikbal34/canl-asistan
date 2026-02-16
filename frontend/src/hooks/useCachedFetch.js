import { useState, useEffect, useCallback, useRef } from 'react';

// Module-level cache (survives component unmount, resets on page refresh)
const cache = new Map();
const DEFAULT_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * Lightweight stale-while-revalidate cache hook
 *
 * @param {string} key - Unique cache key
 * @param {Function} fetchFn - Async function that returns data
 * @param {Object} options
 * @param {number} options.ttl - Cache TTL in ms (default 2min)
 * @param {boolean} options.enabled - Whether to fetch (default true)
 */
export function useCachedFetch(key, fetchFn, options = {}) {
  const { ttl = DEFAULT_TTL, enabled = true } = options;
  const [data, setData] = useState(() => {
    const cached = cache.get(key);
    return cached ? cached.data : null;
  });
  const [loading, setLoading] = useState(() => {
    const cached = cache.get(key);
    return !cached;
  });
  const [error, setError] = useState(null);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const fetchData = useCallback(async (showLoading = true) => {
    if (!enabled) return;

    const cached = cache.get(key);
    const now = Date.now();

    // If cache is fresh, use it directly
    if (cached && (now - cached.timestamp) < ttl) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    // If cache exists but stale, show stale data immediately, revalidate in background
    if (cached) {
      setData(cached.data);
      setLoading(false);
    } else if (showLoading) {
      setLoading(true);
    }

    try {
      setError(null);
      const result = await fetchFnRef.current();
      cache.set(key, { data: result, timestamp: Date.now() });
      setData(result);
    } catch (err) {
      console.error(`useCachedFetch[${key}]:`, err);
      setError(err.message || 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [key, ttl, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Manual refetch (silent - no loading state)
  const refetch = useCallback(() => {
    return fetchData(false);
  }, [fetchData]);

  // Invalidate cache and refetch
  const invalidate = useCallback(() => {
    cache.delete(key);
    setLoading(true);
    return fetchData(true);
  }, [key, fetchData]);

  return { data, loading, error, refetch, invalidate };
}

// Static: invalidate a specific key from outside
useCachedFetch.invalidateKey = (key) => {
  cache.delete(key);
};

// Static: clear all cache (e.g. on logout)
useCachedFetch.invalidateAll = () => {
  cache.clear();
};
