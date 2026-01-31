/**
 * @deprecated BrandedLogin is no longer used.
 * Domain-based tenant routing has been removed.
 * All users now access the system through the same URL.
 *
 * This file is kept for backward compatibility but the component
 * simply redirects to the standard login flow.
 */

import { Navigate } from 'react-router-dom';

export const BrandedLogin = () => {
  // Redirect to standard login since domain-based routing is removed
  return <Navigate to="/login" replace />;
};

export default BrandedLogin;
