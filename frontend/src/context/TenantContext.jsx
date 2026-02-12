import { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { tenantAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export const TenantContext = createContext(null);

/**
 * TenantProvider component that manages tenant-specific state
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export const TenantProvider = ({ children }) => {
  const { isAuthenticated, user, tenant: authTenant } = useAuth();
  const [tenantSettings, setTenantSettings] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTenantData();
    }
  }, [isAuthenticated, user?.id]);

  const fetchTenantData = useCallback(async () => {
    // Super admin için tenant API çağırma (tenant_id null)
    if (user?.role === 'super_admin') {
      setTenantSettings(null);
      setStats(null);
      setLoading(false);
      return;
    }

    // Önce user.tenant'tan bilgi al (hızlı yükleme için)
    const userTenant = authTenant || user?.tenant;
    if (userTenant) {
      setTenantSettings(userTenant);
    }

    try {
      const [settingsRes, statsRes] = await Promise.all([
        tenantAPI.getSettings(),
        tenantAPI.getStats(),
      ]);

      setTenantSettings(settingsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch tenant data:', error);
      // API başarısız olursa user.tenant'ı kullan
      if (userTenant) {
        setTenantSettings(prev => prev || userTenant);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.role, user?.tenant, authTenant]);

  const updateSettings = useCallback(async (data) => {
    try {
      const response = await tenantAPI.updateSettings(data);
      setTenantSettings(response.data);
      return { success: true };
    } catch (error) {
      console.error('Failed to update settings:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Update failed'
      };
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const response = await tenantAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to refresh stats:', error);
    }
  }, []);

  // Sektör bilgisi getter - user.tenant'tan veya API'dan
  const industry = tenantSettings?.industry || authTenant?.industry || user?.tenant?.industry || null;

  const value = useMemo(() => ({
    tenantSettings,
    stats,
    loading,
    industry,
    updateSettings,
    refreshStats,
    fetchTenantData,
  }), [tenantSettings, stats, loading, industry, updateSettings, refreshStats, fetchTenantData]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
