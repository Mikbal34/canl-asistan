/**
 * Global TTL-based In-Memory Cache Service
 * Singleton — used by promptCompiler, vapiService, etc.
 */

class CacheService {
  constructor() {
    this._store = new Map();
  }

  /**
   * Get cached value (returns null if expired or missing)
   * @param {string} key
   * @returns {*} cached data or null
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this._store.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set a value with TTL
   * @param {string} key
   * @param {*} data
   * @param {number} ttlMs - Time-to-live in milliseconds
   */
  set(key, data, ttlMs) {
    this._store.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs,
    });
  }

  /**
   * Invalidate all keys matching a prefix
   * @param {string} prefix
   * @returns {number} number of entries invalidated
   */
  invalidate(prefix) {
    let count = 0;
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) {
        this._store.delete(key);
        count++;
      }
    }
    if (count > 0) {
      console.log(`[Cache] Invalidated ${count} entries with prefix "${prefix}"`);
    }
    return count;
  }

  /**
   * Clear entire cache
   */
  clear() {
    const size = this._store.size;
    this._store.clear();
    if (size > 0) {
      console.log(`[Cache] Cleared all ${size} entries`);
    }
  }

  /**
   * Get cache stats
   */
  stats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const [, entry] of this._store) {
      if (now - entry.timestamp <= entry.ttlMs) {
        valid++;
      } else {
        expired++;
      }
    }

    return { total: this._store.size, valid, expired };
  }
}

module.exports = new CacheService();
