import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter } from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Table } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { testDriveAPI, beautyAPI } from '../../services/api';

/**
 * Appointments page component
 */
export const Appointments = () => {
  const { t } = useTranslation();
  const { tenantSettings } = useTenant();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchAppointments();
  }, [tenantSettings]);

  const fetchAppointments = async () => {
    try {
      let response;
      if (tenantSettings?.industry === 'automotive') {
        response = await testDriveAPI.getAll();
      } else {
        response = await beautyAPI.getAppointments();
      }
      setAppointments(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
    } finally {
      setLoading(false);
    }
  };

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
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper to get vehicle display name
  const getVehicleName = (appointment) => {
    if (appointment.service) return appointment.service;
    if (appointment.vehicle && typeof appointment.vehicle === 'object') {
      return `${appointment.vehicle.brand || ''} ${appointment.vehicle.model || ''}`.trim();
    }
    return appointment.vehicle_name || appointment.vehicle || '';
  };

  const filteredAppointments = appointments.filter((appointment) => {
    const vehicleName = getVehicleName(appointment);
    const matchesSearch =
      (appointment.customerName || appointment.customer_name || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      vehicleName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      header: t('appointments.customerName'),
      accessor: 'customerName',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.customerName || row.customer_name}
          </p>
          <p className="text-sm text-slate-500">{row.phone}</p>
        </div>
      ),
    },
    {
      header: t('appointments.date'),
      accessor: 'scheduledDate',
      render: (row) => (
        <div>
          <p className="text-slate-900">
            {formatDate(row.scheduledDate || row.scheduled_date)}
          </p>
          <p className="text-sm text-slate-500">
            {formatTime(row.scheduledDate || row.scheduled_date)}
          </p>
        </div>
      ),
    },
    {
      header: t('appointments.service'),
      accessor: 'service',
      render: (row) => (
        <span className="text-slate-600">
          {getVehicleName(row) || 'N/A'}
        </span>
      ),
    },
    {
      header: t('appointments.status'),
      accessor: 'status',
      render: (row) => (
        <Badge variant={getStatusVariant(row.status)}>
          {t(`appointments.${row.status}`)}
        </Badge>
      ),
    },
    {
      header: t('appointments.actions'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            {t('common.edit')}
          </Button>
        </div>
      ),
    },
  ];

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: t('appointments.pending') },
    { value: 'confirmed', label: t('appointments.confirmed') },
    { value: 'completed', label: t('appointments.completed') },
    { value: 'cancelled', label: t('appointments.cancelled') },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t('appointments.title')}</h1>
        <p className="text-slate-500 mt-1">
          Manage and track all your appointments
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
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
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-slate-500">
              {t('common.loading')}
            </div>
          ) : (
            <Table
              columns={columns}
              data={filteredAppointments}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
