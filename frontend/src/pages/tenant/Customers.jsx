import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Users, Phone, Calendar, Activity } from 'lucide-react';
import { Table } from '../../components/common/Table';
import { SkeletonTableRows } from '../../components/common/Skeleton';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { customerAPI } from '../../services/api';
import { cn } from '@/lib/utils';

const getInitials = (name) =>
  name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';

const avatarColors = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
];
const getAvatarColor = (name) =>
  avatarColors[(name?.charCodeAt(0) ?? 0) % avatarColors.length];

export const Customers = () => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: customers, loading } = useCachedFetch('customers-list', async () => {
    const response = await customerAPI.getAll();
    return response.data.data || response.data;
  }, { ttl: 5 * 60 * 1000 });

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const safeCustomers = customers || [];

  const activeCount = useMemo(
    () => safeCustomers.filter(c => (c.appointmentCount || 0) > 0).length,
    [safeCustomers]
  );

  const recentCount = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return safeCustomers.filter(c => c.lastVisit && new Date(c.lastVisit) >= cutoff).length;
  }, [safeCustomers]);

  const stats = [
    { label: 'Toplam Müşteri', value: safeCustomers.length, icon: Users,     color: 'blue'   },
    { label: 'Aktif Müşteri',  value: activeCount,           icon: Activity,  color: 'green'  },
    { label: 'Son 30 Gün',     value: recentCount,           icon: Calendar,  color: 'purple' },
  ];

  const statColorMap = {
    blue:   { icon: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-100 dark:bg-blue-950/60'     },
    green:  { icon: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-950/60' },
    purple: { icon: 'text-purple-600 dark:text-purple-400',   bg: 'bg-purple-100 dark:bg-purple-950/60' },
  };

  const filteredCustomers = useMemo(() => safeCustomers.filter((customer) => {
    const term = searchTerm.toLocaleLowerCase('tr');
    return (
      customer.name?.toLocaleLowerCase('tr').includes(term) ||
      customer.email?.toLocaleLowerCase('tr').includes(term) ||
      customer.phone?.includes(searchTerm)
    );
  }), [safeCustomers, searchTerm]);

  const columns = useMemo(() => [
    {
      header: t('customers.name'),
      accessor: 'name',
      render: (row) => {
        const name = row.name || 'N/A';
        return (
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
              getAvatarColor(name)
            )}>
              {getInitials(name)}
            </div>
            <div>
              <p className="font-medium text-foreground">{name}</p>
              <p className="text-xs text-muted-foreground">{row.email || '—'}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: t('customers.phone'),
      accessor: 'phone',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground">{row.phone || '—'}</span>
        </div>
      ),
    },
    {
      header: t('customers.totalAppointments'),
      accessor: 'appointmentCount',
      render: (row) => {
        const count = row.appointmentCount || 0;
        return (
          <span className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
            count > 0
              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground'
          )}>
            {count} randevu
          </span>
        );
      },
    },
    {
      header: t('customers.lastVisit'),
      accessor: 'lastVisit',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground">{formatDate(row.lastVisit)}</span>
        </div>
      ),
    },
  ], [t]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('customers.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Müşteri veritabanınızı görüntüleyin ve yönetin</p>
      </div>

      {/* Stat Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((stat) => {
          const colors = statColorMap[stat.color];
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', colors.bg)}>
                <Icon className={cn('w-5 h-5', colors.icon)} />
              </div>
              <div>
                {loading
                  ? <div className="animate-pulse bg-muted rounded h-7 w-8 mb-0.5" />
                  : <p className="text-2xl font-bold text-foreground leading-none">{stat.value}</p>
                }
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Müşteri adı, e-posta veya telefon ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input w-full pl-9"
        />
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/20">
          <h2 className="text-sm font-semibold text-foreground">{t('customers.title')}</h2>
        </div>
        {loading ? (
          <div className="p-6"><SkeletonTableRows rows={8} columns={4} /></div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              {searchTerm ? 'Aramanızla eşleşen müşteri bulunamadı.' : 'Henüz müşteri kaydı yok.'}
            </p>
          </div>
        ) : (
          <Table columns={columns} data={filteredCustomers} />
        )}
      </div>
    </div>
  );
};
