/**
 * @deprecated Use TenantLogin (/login/:slug) instead.
 * This component redirects to the standard login page.
 */

import { Navigate } from 'react-router-dom';

export const BrandedLogin = () => {
  return <Navigate to="/login" replace />;
};

export default BrandedLogin;
