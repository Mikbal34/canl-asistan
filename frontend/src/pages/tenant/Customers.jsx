import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import { Table } from '../../components/common/Table';
import { customerAPI } from '../../services/api';

/**
 * Customers page component
 */
export const Customers = () => {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await customerAPI.getAll();
      setCustomers(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredCustomers = customers.filter((customer) =>
    customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm)
  );

  const columns = [
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
  ];

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
              className="input pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-slate-500">
              {t('common.loading')}
            </div>
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
