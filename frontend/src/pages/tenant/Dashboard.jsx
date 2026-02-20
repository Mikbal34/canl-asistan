import { useTranslation } from 'react-i18next';
import { Calendar, Users, Phone, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useTenant } from '../../hooks/useTenant';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { SkeletonStatCard, SkeletonTableRows } from '../../components/common/Skeleton';
import { testDriveAPI, beautyAPI, serviceAppointmentAPI } from '../../services/api';
import { cn } from '@/lib/utils';

// Mock weekly activity data (real API returns totals only)
const weeklyData = [
  { day: 'Pzt', appointments: 4, calls: 8 },
  { day: 'Sal', appointments: 7, calls: 12 },
  { day: 'Çrş', appointments: 5, calls: 9 },
  { day: 'Prş', appointments: 9, calls: 15 },
  { day: 'Cum', appointments: 6, calls: 11 },
  { day: 'Cmt', appointments: 3, calls: 5 },
  { day: 'Paz', appointments: 2, calls: 3 },
];

const statConfig = [
  { key: 'totalAppointments', icon: Calendar, borderColor: 'border-l-green-500', iconBg: 'bg-green-100 dark:bg-green-950/60', iconColor: 'text-green-600 dark:text-green-400', trend: '+12%', trendColor: 'text-green-600 dark:text-green-400' },
  { key: 'totalCustomers',    icon: Users,    borderColor: 'border-l-red-500',   iconBg: 'bg-red-100 dark:bg-red-950/60',   iconColor: 'text-red-600 dark:text-red-400',   trend: '+8%',  trendColor: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'totalCalls',        icon: Phone,    borderColor: 'border-l-blue-500',  iconBg: 'bg-blue-100 dark:bg-blue-950/60', iconColor: 'text-blue-600 dark:text-blue-400', trend: '+24%', trendColor: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'successRate',       icon: TrendingUp, borderColor: 'border-l-purple-500', iconBg: 'bg-purple-100 dark:bg-purple-950/60', iconColor: 'text-purple-600 dark:text-purple-400', trend: '+5%', trendColor: 'text-emerald-600 dark:text-emerald-400' },
];

export const Dashboard = () => {
  const { t } = useTranslation();
  const { stats, tenantSettings, loading: tenantLoading } = useTenant();

  const fetchRecentAppointments = async () => {
    let allAppointments = [];
    if (tenantSettings?.industry === 'automotive') {
      const [testDriveRes, serviceRes] = await Promise.allSettled([
        testDriveAPI.getAll({ limit: 5 }),
        serviceAppointmentAPI.getAll({ limit: 5 }),
      ]);
      const testDrives = (testDriveRes.status === 'fulfilled' ? testDriveRes.value.data?.data || testDriveRes.value.data || [] : [])
        .map(a => ({ ...a, _type: 'test_drive' }));
      const services = (serviceRes.status === 'fulfilled' ? serviceRes.value.data?.data || serviceRes.value.data || [] : [])
        .map(a => ({ ...a, _type: 'service' }));
      allAppointments = [...testDrives, ...services]
        .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
        .slice(0, 5);
    } else {
      const response = await beautyAPI.getAppointments({ limit: 5 });
      allAppointments = (response.data?.data || response.data || [])
        .map(a => ({ ...a, _type: 'beauty' }));
    }
    return allAppointments;
  };

  const { data: recentAppointments, loading, error } = useCachedFetch(
    'dashboard-appointments',
    fetchRecentAppointments,
    { enabled: !tenantLoading && !!tenantSettings }
  );

  const getStatValue = (key) => {
    if (key === 'successRate') return `${stats?.successRate || 0}%`;
    if (key === 'totalAppointments') return stats?.totalAppointments || 0;
    if (key === 'totalCustomers') return stats?.totalCustomers || 0;
    if (key === 'totalCalls') return stats?.totalCalls || 0;
    return 0;
  };

  const getStatTitle = (key) => {
    const map = {
      totalAppointments: t('dashboard.totalAppointments'),
      totalCustomers: t('dashboard.activeCustomers'),
      totalCalls: t('dashboard.totalCalls'),
      successRate: t('dashboard.successRate'),
    };
    return map[key] || key;
  };

  const getStatusVariant = (status) => {
    const variants = { confirmed: 'success', pending: 'warning', scheduled: 'info', cancelled: 'error', completed: 'success' };
    return variants[status] || 'info';
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });

  if (tenantLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="animate-pulse bg-muted rounded h-8 w-48 mb-2" />
          <div className="animate-pulse bg-muted rounded h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <Card>
          <CardHeader><div className="animate-pulse bg-muted rounded h-6 w-48" /></CardHeader>
          <CardContent><SkeletonTableRows rows={5} columns={4} /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Hata: {error}
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('dashboard.stats')}</p>
      </div>

      {/* Stat Cards with colored left borders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statConfig.map(({ key, icon: Icon, borderColor, iconBg, iconColor, trend, trendColor }) => (
          <div
            key={key}
            className={cn(
              'rounded-xl border border-border bg-card p-5 shadow-sm border-l-4',
              borderColor
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{getStatTitle(key)}</p>
                <p className="text-2xl font-bold text-foreground">{getStatValue(key)}</p>
                <p className={cn('text-xs mt-2 font-medium', trendColor)}>{trend} bu ay</p>
              </div>
              <div className={cn('p-2.5 rounded-lg', iconBg)}>
                <Icon className={cn('w-5 h-5', iconColor)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Aktivite Trendi</CardTitle>
          <p className="text-xs text-muted-foreground">Son 7 günlük randevu ve arama istatistikleri</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAppointments" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--foreground)',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--muted-foreground)' }} />
              <Area type="monotone" dataKey="appointments" name="Randevular" stroke="#22c55e" strokeWidth={2} fill="url(#colorAppointments)" />
              <Area type="monotone" dataKey="calls" name="Aramalar" stroke="#a855f7" strokeWidth={2} fill="url(#colorCalls)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Appointments */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('dashboard.recentAppointments')}</CardTitle>
            <Link to="/appointments">
              <Button variant="ghost" size="sm" className="text-xs">
                {t('dashboard.viewAll')}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <SkeletonTableRows rows={5} columns={4} showHeader={false} />
          ) : !recentAppointments || recentAppointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {t('appointments.noAppointments')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('appointments.customerName')}</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('appointments.date')}</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('appointments.service')}</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('appointments.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentAppointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-foreground font-medium">
                        {appointment.customer?.name || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDate(appointment.appointment_date)}
                        {appointment.appointment_time && (
                          <span className="text-muted-foreground/60 ml-2">
                            {appointment.appointment_time.slice(0, 5)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {appointment.service?.name ||
                          (appointment.vehicle ? `${appointment.vehicle.brand} ${appointment.vehicle.model}` : null) ||
                          appointment.vehicle_name ||
                          'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusVariant(appointment.status)}>
                          {t(`appointments.${appointment.status}`, appointment.status)}
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
