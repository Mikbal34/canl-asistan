import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Users, Phone, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../hooks/useTenant';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { testDriveAPI, beautyAPI } from '../../services/api';

/**
 * Dashboard page component
 */
export const Dashboard = () => {
  const { t } = useTranslation();
  const { stats, tenantSettings, loading: tenantLoading } = useTenant();
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tenantLoading && tenantSettings) {
      fetchRecentAppointments();
    } else if (!tenantLoading) {
      setLoading(false);
    }
  }, [tenantSettings, tenantLoading]);

  const fetchRecentAppointments = async () => {
    try {
      setError(null);
      let response;
      if (tenantSettings?.industry === 'automotive') {
        response = await testDriveAPI.getAll({ limit: 5 });
      } else {
        response = await beautyAPI.getAppointments({ limit: 5 });
      }
      setRecentAppointments(response.data?.data || response.data || []);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: t('dashboard.totalAppointments'),
      value: stats?.totalAppointments || 0,
      icon: Calendar,
      color: 'bg-blue-100 text-blue-600',
      trend: '+12%',
    },
    {
      title: t('dashboard.activeCustomers'),
      value: stats?.totalCustomers || 0,
      icon: Users,
      color: 'bg-emerald-100 text-emerald-600',
      trend: '+8%',
    },
    {
      title: t('dashboard.totalCalls'),
      value: stats?.totalCalls || 0,
      icon: Phone,
      color: 'bg-purple-100 text-purple-600',
      trend: '+24%',
    },
    {
      title: t('dashboard.successRate'),
      value: `${stats?.successRate || 0}%`,
      icon: TrendingUp,
      color: 'bg-indigo-100 text-indigo-600',
      trend: '+5%',
    },
  ];

  const getStatusVariant = (status) => {
    const variants = {
      confirmed: 'success',
      pending: 'warning',
      scheduled: 'info',
      cancelled: 'error',
      completed: 'success',
    };
    return variants[status] || 'info';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Loading state
  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-500">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-600">
          Error: {error}
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t('dashboard.title')}</h1>
        <p className="text-slate-500 mt-1">{t('dashboard.stats')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                    <p className="text-sm text-emerald-600 mt-2">{stat.trend}</p>
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

      {/* Recent Appointments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('dashboard.recentAppointments')}</CardTitle>
            <Link to="/appointments">
              <Button variant="ghost" size="sm">
                {t('dashboard.viewAll')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">
              {t('common.loading')}
            </div>
          ) : recentAppointments.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {t('appointments.noAppointments')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                      {t('appointments.customerName')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                      {t('appointments.date')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                      {t('appointments.service')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                      {t('appointments.status')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {recentAppointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-900">
                        {appointment.customerName || appointment.customer_name}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {formatDate(appointment.scheduledDate || appointment.scheduled_date)}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {appointment.service ||
                         (appointment.vehicle ? `${appointment.vehicle.brand} ${appointment.vehicle.model}` : null) ||
                         appointment.vehicle_name ||
                         'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusVariant(appointment.status)}>
                          {appointment.status}
                        </Badge>
                      </td>
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
