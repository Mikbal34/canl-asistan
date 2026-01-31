/**
 * @deprecated Domain-based tenant routing is no longer used.
 * All users access the system through the same URL.
 * This hook is kept for backward compatibility but returns a simple default.
 */

import { useMemo } from 'react';

/**
 * Domain types for tenant routing (deprecated)
 * @typedef {'main'} DomainType
 */

/**
 * Domain detection result (deprecated)
 * @typedef {Object} DomainInfo
 * @property {DomainType} type - Always returns 'main' now
 * @property {string|null} slug - Always null
 * @property {string|null} domain - Always null
 * @property {boolean} isLocalhost - Whether running on localhost
 */

/**
 * @deprecated Returns a fixed result since domain-based routing is no longer used.
 * Tenant is now resolved from authenticated user's JWT token.
 * @returns {DomainInfo} Domain detection result (always main domain)
 */
export const useTenantDomain = () => {
  const domainInfo = useMemo(() => {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    // Always return main domain type since we no longer use domain-based routing
    return {
      type: 'main',
      slug: null,
      domain: null,
      isLocalhost
    };
  }, []);

  return domainInfo;
};

export default useTenantDomain;
