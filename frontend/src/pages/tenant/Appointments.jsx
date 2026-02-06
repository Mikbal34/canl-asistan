import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter } from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Table } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { testDriveAPI, beautyAPI, serviceAppointmentAPI } from '../../services/api';

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
      let allAppointments = [];
      if (tenantSettings?.industry === 'automotive') {
        const [testDriveRes, serviceRes] = await Promise.allSettled([
          testDriveAPI.getAll(),
          serviceAppointmentAPI.getAll(),
        ]);
        const testDrives = (testDriveRes.status === 'fulfilled' ? testDriveRes.value.data?.data || testDriveRes.value.data || [] : [])
          .map(a => ({ ...a, _type: 'test_drive' }));
        const services = (serviceRes.status === 'fulfilled' ? serviceRes.value.data?.data || serviceRes.value.data || [] : [])
          .map(a => ({ ...a, _type: 'service' }));
        allAppointments = [...testDrives, ...services];
      } else {
        const response = await beautyAPI.getAppointments();
        allAppointments = (response.data?.data || response.data || [])
          .map(a => ({ ...a, _type: 'beauty' }));
      }
      setAppointments(allAppointments);
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

  const formatTime = (timeString) => {
    if (!timeString) return '';
    // Handle TIME format "14:00:00" → "14:00"
    if (typeof timeString === 'string' && timeString.match(/^\d{2}:\d{2}/)) {
      return timeString.slice(0, 5);
    }
    return new Date(timeString).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper to get service/vehicle display name
  const getDisplayName = (appointment) => {
    if (appointment.service && typeof appointment.service === 'object') {
      return appointment.service.name || '';
    }
    if (appointment.vehicle && typeof appointment.vehicle === 'object') {
      return `${appointment.vehicle.brand || ''} ${appointment.vehicle.model || ''}`.trim();
    }
    return appointment.vehicle_name || '';
  };

  // Helper to get appointment type label
  const getTypeLabel = (appointment) => {
    const types = {
      test_drive: 'Test Sürüşü',
      service: 'Servis',
      beauty: 'Güzellik Hizmeti',
    };
    return types[appointment._type] || '';
  };

  const filteredAppointments = appointments.filter((appointment) => {
    const displayName = getDisplayName(appointment);
    const customerName = appointment.customer?.name || '';
    const matchesSearch =
      customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      displayName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      header: t('appointments.customerName'),
      accessor: 'customer',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.customer?.name || 'N/A'}
          </p>
          <p className="text-sm text-slate-500">{row.customer?.phone || ''}</p>
        </div>
      ),
    },
    {
      header: t('appointments.date'),
      accessor: 'appointment_date',
      render: (row) => (
        <div>
          <p className="text-slate-900">
            {formatDate(row.appointment_date)}
          </p>
          <p className="text-sm text-slate-500">
            {formatTime(row.appointment_time)}
          </p>
        </div>
      ),
    },
    {
      header: 'Tür',
      accessor: '_type',
      render: (row) => (
        <span className="text-slate-600">
          {getTypeLabel(row)}
        </span>
      ),
    },
    {
      header: t('appointments.service'),
      accessor: 'service',
      render: (row) => (
        <span className="text-slate-600">
          {getDisplayName(row) || 'N/A'}
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
