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
  CalendarClock,
  Car,
  Tag,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { useTenantBranding } from '../../context/TenantBrandingContext';
import { cn } from '@/lib/utils';

export const Sidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const { tenantSettings, industry: tenantIndustry } = useTenant();
  const { branding, tenantResolved } = useTenantBranding();

  const isActive = (path) => location.pathname === path;

  const industry = user?.tenant?.industry || tenantIndustry || tenantSettings?.industry;
  const logoUrl = tenantResolved ? branding.logo_url : (tenantSettings?.logo_url || user?.tenant?.logo_url);
  const primaryColor = tenantResolved ? branding.primary_color : (tenantSettings?.primary_color || user?.tenant?.primary_color);
  const displayName = tenantResolved ? branding.name : (tenantSettings?.name || user?.tenant?.name || 'Dashboard');

  const getNavGroups = () => {
    if (user?.role === 'super_admin') {
      return [
        {
          label: 'ANA MENÜ',
          items: [
            { path: '/admin/dashboard', icon: LayoutDashboard, label: t('navigation.dashboard') },
            { path: '/admin/tenants', icon: Building2, label: t('navigation.tenants') },
            { path: '/admin/presets', icon: Palette, label: t('navigation.presets') },
          ],
        },
      ];
    }

    const mainItems = [
      { path: '/dashboard', icon: LayoutDashboard, label: t('navigation.dashboard') },
      { path: '/appointments', icon: Calendar, label: t('navigation.appointments') },
      { path: '/customers', icon: Users, label: t('navigation.customers') },
    ];

    const managementItems = [
      { path: '/slot-manager', icon: CalendarClock, label: t('navigation.slotManager') },
    ];
    if (industry === 'automotive') {
      managementItems.push({ path: '/vehicles', icon: Car, label: t('navigation.vehicleCatalog') });
    }
    managementItems.push({ path: '/promotions', icon: Tag, label: t('navigation.promotions') });

    const systemItems = [
      { path: '/notifications', icon: Bell, label: t('navigation.notifications') },
      { path: '/call-logs', icon: Phone, label: t('navigation.callLogs') },
      { path: '/settings', icon: Settings, label: t('navigation.settings') },
    ];

    return [
      { label: 'ANA MENÜ', items: mainItems },
      { label: 'YÖNETİM', items: managementItems },
      { label: 'SİSTEM', items: systemItems },
    ];
  };

  const navGroups = getNavGroups();

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-50">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={displayName}
              className="w-9 h-9 rounded-lg object-contain"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: primaryColor || '#4f46e5' }}
            >
              <Phone className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-foreground truncate">
              {user?.role === 'super_admin' ? 'Voice AI' : displayName}
            </h1>
            <p className="text-xs text-muted-foreground">
              {user?.role === 'super_admin' ? 'Admin Panel' : 'Dashboard'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                        active
                          ? 'text-white font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                      style={active ? { backgroundColor: primaryColor || '#4f46e5' } : {}}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-border">
        {user?.role === 'super_admin' ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800">
            <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Super Admin</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors cursor-default">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: primaryColor || '#4f46e5' }}
            >
              {getInitials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.name || 'Kullanıcı'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
