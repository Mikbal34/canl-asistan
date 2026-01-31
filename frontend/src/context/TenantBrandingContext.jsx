import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useAuth } from './AuthContext';

export const TenantBrandingContext = createContext(null);

/**
 * Default branding values when no tenant is resolved
 */
const DEFAULT_BRANDING = {
  name: 'Canli Asistan',
  logo_url: null,
  primary_color: '#c9a227',
  favicon_url: null,
  login_message: null,
  slug: null,
  industry: null,
};

/**
 * TenantBrandingProvider component that manages tenant branding state
 * Branding is now based on authenticated user's tenant, not domain
 */
export const TenantBrandingProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(false);
  const [tenantResolved, setTenantResolved] = useState(false);

  // Update branding from authenticated user's tenant
  const updateBrandingFromUser = useCallback(() => {
    if (isAuthenticated && user?.tenant) {
      const tenant = user.tenant;
      setBranding({
        ...DEFAULT_BRANDING,
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        industry: tenant.industry,
        logo_url: tenant.logo_url,
        primary_color: tenant.primary_color || DEFAULT_BRANDING.primary_color,
        favicon_url: tenant.favicon_url,
        login_message: tenant.login_message,
        assistant_name: tenant.assistant_name,
      });
      setTenantResolved(true);
    } else {
      setBranding(DEFAULT_BRANDING);
      setTenantResolved(false);
    }
    setLoading(false);
  }, [isAuthenticated, user]);

  // Update branding when user changes
  useEffect(() => {
    updateBrandingFromUser();
  }, [updateBrandingFromUser]);

  // Update document title based on branding
  useEffect(() => {
    if (tenantResolved && branding.name) {
      document.title = branding.name;
    } else {
      document.title = 'Canli Asistan';
    }
  }, [tenantResolved, branding.name]);

  // Update favicon based on branding
  useEffect(() => {
    const updateFavicon = (url) => {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = url || '/favicon.ico';
    };

    if (tenantResolved && branding.favicon_url) {
      updateFavicon(branding.favicon_url);
    } else {
      updateFavicon('/favicon.ico');
    }
  }, [tenantResolved, branding.favicon_url]);

  // Apply primary color as CSS variable
  useEffect(() => {
    if (branding.primary_color) {
      document.documentElement.style.setProperty('--tenant-primary-color', branding.primary_color);
      // Also create RGB version for transparency
      const hex = branding.primary_color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      document.documentElement.style.setProperty('--tenant-primary-rgb', `${r}, ${g}, ${b}`);
    }
  }, [branding.primary_color]);

  const value = {
    // Branding data
    branding,

    // State
    loading,
    error: null,
    tenantResolved,

    // Actions
    refreshBranding: updateBrandingFromUser,

    // Convenience getters
    tenantName: branding.name,
    tenantLogo: branding.logo_url,
    primaryColor: branding.primary_color,
    faviconUrl: branding.favicon_url,
    loginMessage: branding.login_message,
    tenantSlug: branding.slug,
    tenantIndustry: branding.industry,
  };

  return (
    <TenantBrandingContext.Provider value={value}>
      {children}
    </TenantBrandingContext.Provider>
  );
};

/**
 * Custom hook to access tenant branding context
 * @returns {Object} Tenant branding context value
 */
export const useTenantBranding = () => {
  const context = useContext(TenantBrandingContext);
  if (!context) {
    throw new Error('useTenantBranding must be used within a TenantBrandingProvider');
  }
  return context;
};

export default TenantBrandingContext;
