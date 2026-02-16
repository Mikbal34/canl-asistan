import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import { Table } from '../../components/common/Table';
import { SkeletonTableRows } from '../../components/common/Skeleton';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { customerAPI } from '../../services/api';

/**
 * Customers page component
 */
export const Customers = () => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  const {
    data: customers,
    loading,
  } = useCachedFetch('customers-list', async () => {
    const response = await customerAPI.getAll();
    return response.data.data || response.data;
  }, { ttl: 5 * 60 * 1000 });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const safeCustomers = customers || [];

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
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.name}</p>
          <p className="text-sm text-slate-500">{row.email}</p>
        </div>
      ),
    },
    {
      header: t('customers.phone'),
      accessor: 'phone',
      render: (row) => (
        <span className="text-slate-600">{row.phone}</span>
      ),
    },
    {
      header: t('customers.totalAppointments'),
      accessor: 'appointmentCount',
      render: (row) => (
        <span className="text-slate-600">
          {row.appointmentCount || 0}
        </span>
      ),
    },
    {
      header: t('customers.lastVisit'),
      accessor: 'lastVisit',
      render: (row) => (
        <span className="text-slate-600">
          {formatDate(row.lastVisit)}
        </span>
      ),
    },
  ], [t]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t('customers.title')}</h1>
        <p className="text-slate-500 mt-1">
          Müşteri veritabanınızı görüntüleyin
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardContent>
          {loading ? (
            <SkeletonTableRows rows={8} columns={4} />
          ) : (
            <Table
              columns={columns}
              data={filteredCustomers}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
