import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Phone,
  Settings,
  Shield,
  Building2,
  Palette,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { useTenantBranding } from '../../context/TenantBrandingContext';

/**
 * Sidebar navigation component
 */
export const Sidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const { tenantSettings, industry: tenantIndustry } = useTenant();
  const { branding, tenantResolved } = useTenantBranding();

  const isActive = (path) => location.pathname === path;

  // Sektör bilgisini user.tenant'tan veya tenantSettings'ten al
  const industry = user?.tenant?.industry || tenantIndustry || tenantSettings?.industry;

  // Get branding info - prefer branding context when tenant is resolved
  const logoUrl = tenantResolved ? branding.logo_url : (tenantSettings?.logo_url || user?.tenant?.logo_url);
  const primaryColor = tenantResolved ? branding.primary_color : (tenantSettings?.primary_color || user?.tenant?.primary_color);
  const displayName = tenantResolved ? branding.name : (tenantSettings?.name || user?.tenant?.name || 'Dashboard');

  // Sektore gore navigation items olustur
  const getNavItems = () => {
    const baseItems = [
      { path: '/dashboard', icon: LayoutDashboard, label: t('navigation.dashboard') },
      { path: '/appointments', icon: Calendar, label: t('navigation.appointments') },
      { path: '/customers', icon: Users, label: t('navigation.customers') },
    ];

    // Sektore gore ozel menuler
    // Voice settings ve Services artik admin panelinden yonetiliyor
    if (industry === 'automotive') {
      return [
        ...baseItems,
        { path: '/call-logs', icon: Phone, label: t('navigation.callLogs') },
        { path: '/settings', icon: Settings, label: t('navigation.settings') },
      ];
    }

    // Default ve Beauty: Services kaldırıldı
    return [
      ...baseItems,
      { path: '/call-logs', icon: Phone, label: t('navigation.callLogs') },
      { path: '/settings', icon: Settings, label: t('navigation.settings') },
    ];
  };

  const tenantNavItems = getNavItems();

  const adminNavItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: t('navigation.dashboard') },
    { path: '/admin/tenants', icon: Building2, label: t('navigation.tenants') },
    { path: '/admin/presets', icon: Palette, label: t('navigation.presets') },
  ];

  const navItems = user?.role === 'super_admin' ? adminNavItems : tenantNavItems;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={displayName}
              className="w-10 h-10 rounded-lg object-contain"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: primaryColor || '#4f46e5' }}
            >
              <Phone className="w-6 h-6 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900 truncate max-w-[140px]">
              {user?.role === 'super_admin' ? 'Voice AI' : displayName}
            </h1>
            <p className="text-xs text-slate-500">
              {user?.role === 'super_admin' ? 'Admin Panel' : 'Dashboard'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    active
                      ? 'text-white font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  style={active ? { backgroundColor: primaryColor || '#4f46e5' } : {}}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User role badge */}
      {user?.role === 'super_admin' && (
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-50 border border-indigo-200">
            <Shield className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-600">Super Admin</span>
          </div>
        </div>
      )}
    </aside>
  );
};
