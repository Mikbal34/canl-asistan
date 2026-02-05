import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Protected route component that requires authentication
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @param {string} props.requiredRole - Required user role (optional)
 */
export const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  // localStorage'dan da kontrol et (state async güncellenebilir)
  const hasToken = !!localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  let localUser = null;
  try {
    localUser = savedUser ? JSON.parse(savedUser) : null;
  } catch (e) {
    // ignore parse error
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Context veya localStorage'dan biri authenticated olmalı
  const effectivelyAuthenticated = isAuthenticated || hasToken;
  const effectiveUser = user || localUser;

  if (!effectivelyAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Super admin tenant sayfalarına erişmeye çalışırsa admin dashboard'a yönlendir
  const isSuperAdmin = effectiveUser?.role === 'super_admin';
  const isOnTenantPage = !location.pathname.startsWith('/admin');

  if (isSuperAdmin && isOnTenantPage && !requiredRole) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (requiredRole && effectiveUser?.role !== requiredRole) {
    // Tenant admin, admin sayfasına erişmeye çalışırsa kendi dashboard'a yönlendir
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
