import React, { createContext, useState, useEffect, useContext } from 'react';
import { authAPI } from '../services/api';

export const AuthContext = createContext(null);

/**
 * AuthProvider component that manages authentication state
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (!token) {
      setLoading(false);
      return;
    }

    // Önce localStorage'dan user'ı yükle (hızlı başlangıç)
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setTenant(parsedUser?.tenant || null);
        setIsAuthenticated(true);
      } catch (e) {
        console.error('Failed to parse saved user:', e);
      }
    }

    try {
      const response = await authAPI.getMe();
      // Backend { user, tenant } döndürüyor
      const userData = response.data?.user || response.data;
      const tenantData = response.data?.tenant || userData?.tenant || null;

      // User objesine tenant bilgisini ekle
      const userWithTenant = {
        ...userData,
        tenant: tenantData
      };

      setUser(userWithTenant);
      setTenant(tenantData);
      setIsAuthenticated(true);

      // localStorage'ı güncelle
      localStorage.setItem('user', JSON.stringify(userWithTenant));
    } catch (error) {
      console.error('Auth check failed:', error);
      // Sadece 401 ise temizle, diğer hatalarda localStorage'daki user'ı kullan
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setTenant(null);
        setIsAuthenticated(false);
      }
      // Network hatası vs. varsa localStorage'dan devam et
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      console.log('[Auth] Login attempt:', credentials.email);
      const response = await authAPI.login(credentials);
      console.log('[Auth] Login response:', response.data);

      const { session, user: userData, tenant: tenantData } = response.data;

      // Token'ı session'dan al
      const token = session?.access_token;
      console.log('[Auth] Token:', token ? 'received' : 'missing');

      if (token) {
        localStorage.setItem('token', token);
        console.log('[Auth] Token saved to localStorage');
      }

      // Tenant bilgisi user içinde veya ayrı olabilir
      const resolvedTenant = tenantData || userData?.tenant || null;

      // User objesine tenant bilgisini ekle
      const userWithTenant = userData ? {
        ...userData,
        tenant: resolvedTenant
      } : null;

      if (userWithTenant) {
        localStorage.setItem('user', JSON.stringify(userWithTenant));
        console.log('[Auth] User saved to localStorage:', userWithTenant.role);
        setUser(userWithTenant);
        setTenant(resolvedTenant);
      }

      setIsAuthenticated(true);
      console.log('[Auth] Login successful');

      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Login failed'
      };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setTenant(null);
      setIsAuthenticated(false);
    }
  };

  // Sektör bilgisi getter
  const industry = tenant?.industry || user?.tenant?.industry || null;

  const value = {
    user,
    tenant,
    industry,
    loading,
    isAuthenticated,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to access auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
