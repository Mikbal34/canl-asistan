import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Users, Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
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
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: t('admin.activeTenants'),
      value: stats.activeTenants,
      icon: Activity,
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      title: t('admin.totalUsers'),
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-purple-100 text-purple-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t('admin.title')}</h1>
        <p className="text-slate-500 mt-1">
          {t('admin.subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tenant Statistics Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.tenantStats')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">
              {t('common.loading')}
            </div>
          ) : stats.tenantStats.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {t('admin.tenants')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">{t('admin.companyName')}</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">{t('admin.tenantIndustry')}</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">{t('admin.tenantStatus')}</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">{t('admin.callCount')}</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">{t('admin.appointmentCount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.tenantStats.map((tenant) => (
                    <tr key={tenant.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">{tenant.name}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {tenant.industry}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          tenant.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {tenant.is_active ? t('admin.active') : t('admin.inactive')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700">{tenant.callCount}</td>
                      <td className="py-3 px-4 text-right text-slate-700">{tenant.appointmentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
