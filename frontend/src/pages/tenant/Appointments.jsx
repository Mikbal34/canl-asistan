import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, Calendar, X, Check, XCircle } from 'lucide-react';
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
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Edit modal state
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ appointment_date: '', appointment_time: '', status: '' });
  const [editLoading, setEditLoading] = useState(false);

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
    if (typeof timeString === 'string' && timeString.match(/^\d{2}:\d{2}/)) {
      return timeString.slice(0, 5);
    }
    return new Date(timeString).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDisplayName = (appointment) => {
    if (appointment.service && typeof appointment.service === 'object') {
      return appointment.service.name || '';
    }
    if (appointment.vehicle && typeof appointment.vehicle === 'object') {
      return `${appointment.vehicle.brand || ''} ${appointment.vehicle.model || ''}`.trim();
    }
    return appointment.vehicle_name || '';
  };

  const getTypeLabel = (appointment) => {
    return t(`appointments.typeLabels.${appointment._type}`) || '';
  };

  // Status update (approve/reject)
  const handleStatusUpdate = async (appointment, newStatus) => {
    try {
      if (appointment._type === 'test_drive') {
        await testDriveAPI.update(appointment.id, { status: newStatus });
      } else if (appointment._type === 'service') {
        await serviceAppointmentAPI.updateStatus(appointment.id, newStatus);
      } else if (appointment._type === 'beauty') {
        await beautyAPI.updateAppointment(appointment.id, { status: newStatus });
      }
      fetchAppointments();
    } catch (error) {
      console.error('Status update failed:', error);
    }
  };

  // Edit modal
  const openEditModal = (appointment) => {
    setEditModal(appointment);
    setEditForm({
      appointment_date: appointment.appointment_date || '',
      appointment_time: appointment.appointment_time ? appointment.appointment_time.slice(0, 5) : '',
      status: appointment.status || '',
    });
  };

  const handleEditSubmit = async () => {
    if (!editModal) return;
    setEditLoading(true);
    try {
      const data = {
        appointment_date: editForm.appointment_date,
        appointment_time: editForm.appointment_time,
        status: editForm.status,
      };
      if (editModal._type === 'test_drive') {
        await testDriveAPI.update(editModal.id, data);
      } else if (editModal._type === 'service') {
        await serviceAppointmentAPI.update(editModal.id, data);
      } else if (editModal._type === 'beauty') {
        await beautyAPI.updateAppointment(editModal.id, data);
      }
      setEditModal(null);
      fetchAppointments();
    } catch (error) {
      console.error('Edit failed:', error);
    } finally {
      setEditLoading(false);
    }
  };

  const filteredAppointments = useMemo(() => appointments.filter((appointment) => {
    const displayName = getDisplayName(appointment);
    const customerName = appointment.customer?.name || '';
    const term = searchTerm.toLocaleLowerCase('tr');
    const matchesSearch =
      customerName.toLocaleLowerCase('tr').includes(term) ||
      (appointment.customer?.phone || '').includes(searchTerm) ||
      displayName.toLocaleLowerCase('tr').includes(term);

    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;
    const matchesType = typeFilter === 'all' || appointment._type === typeFilter;

    // Date range filter
    let matchesDate = true;
    if (dateFrom && appointment.appointment_date) {
      matchesDate = matchesDate && appointment.appointment_date >= dateFrom;
    }
    if (dateTo && appointment.appointment_date) {
      matchesDate = matchesDate && appointment.appointment_date <= dateTo;
    }

    return matchesSearch && matchesStatus && matchesType && matchesDate;
  }), [appointments, searchTerm, statusFilter, typeFilter, dateFrom, dateTo]);

  const columns = useMemo(() => [
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
      header: t('appointments.type'),
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
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant(row.status)}>
            {t(`appointments.${row.status}`)}
          </Badge>
          {row.status === 'pending' && (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); handleStatusUpdate(row, 'confirmed'); }}
                className="p-1 rounded hover:bg-emerald-50 text-emerald-600"
                title={t('appointments.approve')}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleStatusUpdate(row, 'cancelled'); }}
                className="p-1 rounded hover:bg-red-50 text-red-500"
                title={t('appointments.reject')}
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ),
    },
    {
      header: t('appointments.actions'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditModal(row); }}>
            {t('common.edit')}
          </Button>
        </div>
      ),
    },
  ], [t]);

  const statusOptions = [
    { value: 'all', label: t('appointments.all') },
    { value: 'pending', label: t('appointments.pending') },
    { value: 'confirmed', label: t('appointments.confirmed') },
    { value: 'completed', label: t('appointments.completed') },
    { value: 'cancelled', label: t('appointments.cancelled') },
  ];

  const typeOptions = (() => {
    const all = { value: 'all', label: t('appointments.allTypes') };
    const industry = tenantSettings?.industry;
    if (industry === 'automotive') {
      return [
        all,
        { value: 'test_drive', label: t('appointments.typeLabels.test_drive') },
        { value: 'service', label: t('appointments.typeLabels.service') },
      ];
    }
    if (industry === 'beauty' || industry === 'beauty_salon' || industry === 'hairdresser') {
      return [
        all,
        { value: 'beauty', label: t('appointments.typeLabels.beauty') },
      ];
    }
    return [
      all,
      { value: 'test_drive', label: t('appointments.typeLabels.test_drive') },
      { value: 'service', label: t('appointments.typeLabels.service') },
      { value: 'beauty', label: t('appointments.typeLabels.beauty') },
    ];
  })();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t('appointments.title')}</h1>
        <p className="text-slate-500 mt-1">
          {t('appointments.subtitle')}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
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
              <div className="flex items-center gap-2">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="input"
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Date range filter */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <Calendar className="w-5 h-5 text-slate-400 hidden md:block" />
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500 whitespace-nowrap">{t('appointments.startDate')}:</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500 whitespace-nowrap">{t('appointments.endDate')}:</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-sm text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
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

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {t('appointments.editAppointment')}
              </h3>
              <button onClick={() => setEditModal(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('appointments.customerName')}
                </label>
                <p className="text-slate-600">{editModal.customer?.name || 'N/A'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('appointments.date')}
                </label>
                <input
                  type="date"
                  value={editForm.appointment_date}
                  onChange={(e) => setEditForm({ ...editForm, appointment_date: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('appointments.time')}
                </label>
                <input
                  type="time"
                  value={editForm.appointment_time}
                  onChange={(e) => setEditForm({ ...editForm, appointment_time: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('appointments.status')}
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="input"
                >
                  <option value="pending">{t('appointments.pending')}</option>
                  <option value="confirmed">{t('appointments.confirmed')}</option>
                  <option value="completed">{t('appointments.completed')}</option>
                  <option value="cancelled">{t('appointments.cancelled')}</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setEditModal(null)}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" onClick={handleEditSubmit} disabled={editLoading}>
                {editLoading ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
