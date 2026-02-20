import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Users, Activity } from 'lucide-react';
import { SkeletonTableRows } from '../../components/common/Skeleton';
import { adminAPI } from '../../services/api';

/**
 * Admin Dashboard page component
 */
export const AdminDashboard = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    tenantStats: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await adminAPI.getDashboardStats();
      const data = response.data;
      setStats({
        totalTenants: data.totalTenants || 0,
        activeTenants: data.activeTenants || 0,
        totalUsers: data.totalUsers || 0,
        tenantStats: data.tenantStats || [],
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: t('admin.totalTenants'),
      value: stats.totalTenants,
      icon: Building2,
      bgColor: 'bg-blue-100 dark:bg-blue-950/50',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: t('admin.activeTenants'),
      value: stats.activeTenants,
      icon: Activity,
      bgColor: 'bg-emerald-100 dark:bg-emerald-950/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: t('admin.totalUsers'),
      value: stats.totalUsers,
      icon: Users,
      bgColor: 'bg-purple-100 dark:bg-purple-950/50',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('admin.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('admin.subtitle')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="border border-border rounded-xl p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${stat.bgColor}`}>
                <Icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
              <div>
                {loading
                  ? <div className="animate-pulse bg-muted rounded h-8 w-12 mb-1" />
                  : <p className="text-3xl font-bold text-foreground leading-none">{stat.value}</p>
                }
                <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tenant Statistics Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        {/* Section header bar */}
        <div className="px-6 py-4 border-b border-border bg-muted/20">
          <h2 className="text-sm font-semibold text-foreground">{t('admin.tenantStats')}</h2>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-6"><SkeletonTableRows rows={5} columns={5} /></div>
        ) : stats.tenantStats.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">{t('admin.tenants')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('admin.companyName')}</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('admin.tenantIndustry')}</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('admin.tenantStatus')}</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('admin.callCount')}</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('admin.appointmentCount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.tenantStats.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{tenant.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground capitalize">
                        {tenant.industry}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tenant.is_active
                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                          : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                      }`}>
                        {tenant.is_active ? t('admin.active') : t('admin.inactive')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-muted-foreground">{tenant.callCount}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">{tenant.appointmentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
