import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Filter, Calendar, X, Check, XCircle, Loader2,
  Clock, CheckCircle, CheckCheck, MoreHorizontal, ChevronDown,
} from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { Card, CardContent } from '../../components/common/Card';
import { Table } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal, ModalFooter } from '../../components/common/Modal';
import { SkeletonTableRows } from '../../components/common/Skeleton';
import { testDriveAPI, beautyAPI, serviceAppointmentAPI } from '../../services/api';
import { cn } from '@/lib/utils';

const getInitials = (name) =>
  name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';

const avatarColors = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
];
const getAvatarColor = (name) =>
  avatarColors[(name?.charCodeAt(0) ?? 0) % avatarColors.length];

export const Appointments = () => {
  const { t } = useTranslation();
  const { tenantSettings } = useTenant();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateRange, setShowDateRange] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ appointment_date: '', appointment_time: '', status: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchAppointments = async () => {
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
      allAppointments = (response.data?.data || response.data || []).map(a => ({ ...a, _type: 'beauty' }));
    }
    return allAppointments;
  };

  const { data: appointments, loading, invalidate } = useCachedFetch('appointments-list', fetchAppointments, {
    enabled: !!tenantSettings,
  });

  const invalidateAppointments = useCallback(() => {
    invalidate();
    useCachedFetch.invalidateKey('dashboard-appointments');
  }, [invalidate]);

  const getStatusVariant = (status) => {
    const variants = { confirmed: 'success', pending: 'warning', scheduled: 'info', cancelled: 'error', completed: 'success' };
    return variants[status] || 'info';
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  const formatTime = (timeString) => {
    if (!timeString) return '';
    if (typeof timeString === 'string' && timeString.match(/^\d{2}:\d{2}/)) return timeString.slice(0, 5);
    return new Date(timeString).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const getDisplayName = (appointment) => {
    if (appointment.service && typeof appointment.service === 'object') return appointment.service.name || '';
    if (appointment.vehicle && typeof appointment.vehicle === 'object')
      return `${appointment.vehicle.brand || ''} ${appointment.vehicle.model || ''}`.trim();
    return appointment.vehicle_name || '';
  };

  const requestStatusUpdate = (appointment, newStatus, e) => {
    if (e) e.stopPropagation();
    setConfirmAction({ appointment, newStatus });
  };

  const handleStatusUpdate = async () => {
    if (!confirmAction) return;
    const { appointment, newStatus } = confirmAction;
    setConfirmAction(null);
    setUpdatingStatus(appointment.id);
    try {
      if (appointment._type === 'test_drive') await testDriveAPI.update(appointment.id, { status: newStatus });
      else if (appointment._type === 'service') await serviceAppointmentAPI.updateStatus(appointment.id, newStatus);
      else if (appointment._type === 'beauty') await beautyAPI.updateAppointment(appointment.id, { status: newStatus });
      invalidateAppointments();
    } catch (error) {
      console.error('Status update failed:', error);
    } finally {
      setUpdatingStatus(null);
    }
  };

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
      const data = { appointment_date: editForm.appointment_date, appointment_time: editForm.appointment_time, status: editForm.status };
      if (editModal._type === 'test_drive') await testDriveAPI.update(editModal.id, data);
      else if (editModal._type === 'service') await serviceAppointmentAPI.update(editModal.id, data);
      else if (editModal._type === 'beauty') await beautyAPI.updateAppointment(editModal.id, data);
      setEditModal(null);
      invalidateAppointments();
    } catch (error) {
      console.error('Edit failed:', error);
    } finally {
      setEditLoading(false);
    }
  };

  const safeAppointments = appointments || [];

  const filteredAppointments = useMemo(() => safeAppointments.filter((appointment) => {
    const displayName = getDisplayName(appointment);
    const customerName = appointment.customer?.name || '';
    const term = searchTerm.toLocaleLowerCase('tr');
    const matchesSearch =
      customerName.toLocaleLowerCase('tr').includes(term) ||
      (appointment.customer?.phone || '').includes(searchTerm) ||
      displayName.toLocaleLowerCase('tr').includes(term);
    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;
    const matchesType = typeFilter === 'all' || appointment._type === typeFilter;
    let matchesDate = true;
    if (dateFrom && appointment.appointment_date) matchesDate = matchesDate && appointment.appointment_date >= dateFrom;
    if (dateTo && appointment.appointment_date) matchesDate = matchesDate && appointment.appointment_date <= dateTo;
    return matchesSearch && matchesStatus && matchesType && matchesDate;
  }), [safeAppointments, searchTerm, statusFilter, typeFilter, dateFrom, dateTo]);

  const pendingCount   = useMemo(() => safeAppointments.filter(a => a.status === 'pending').length,   [safeAppointments]);
  const confirmedCount = useMemo(() => safeAppointments.filter(a => a.status === 'confirmed').length, [safeAppointments]);
  const completedCount = useMemo(() => safeAppointments.filter(a => a.status === 'completed').length, [safeAppointments]);

  const stats = [
    { label: 'Toplam',     value: safeAppointments.length, icon: Calendar,    color: 'blue' },
    { label: 'Bekliyor',   value: pendingCount,            icon: Clock,        color: 'amber', pulse: true },
    { label: 'Onaylandı',  value: confirmedCount,          icon: CheckCircle,  color: 'green' },
    { label: 'Tamamlandı', value: completedCount,          icon: CheckCheck,   color: 'purple' },
  ];

  const statColorMap = {
    blue:   { icon: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-100 dark:bg-blue-950/60' },
    amber:  { icon: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950/60' },
    green:  { icon: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-950/60' },
    purple: { icon: 'text-purple-600 dark:text-purple-400',   bg: 'bg-purple-100 dark:bg-purple-950/60' },
  };

  const statusPills = [
    { value: 'all',       label: t('appointments.all') },
    { value: 'pending',   label: t('appointments.pending') },
    { value: 'confirmed', label: t('appointments.confirmed') },
    { value: 'completed', label: t('appointments.completed') },
    { value: 'cancelled', label: t('appointments.cancelled') },
  ];

  const typeOptions = (() => {
    const all = { value: 'all', label: t('appointments.allTypes') };
    const industry = tenantSettings?.industry;
    if (industry === 'automotive') return [all, { value: 'test_drive', label: t('appointments.typeLabels.test_drive') }, { value: 'service', label: t('appointments.typeLabels.service') }];
    if (industry === 'beauty' || industry === 'beauty_salon' || industry === 'hairdresser') return [all, { value: 'beauty', label: t('appointments.typeLabels.beauty') }];
    return [all, { value: 'test_drive', label: t('appointments.typeLabels.test_drive') }, { value: 'service', label: t('appointments.typeLabels.service') }, { value: 'beauty', label: t('appointments.typeLabels.beauty') }];
  })();

  const hasDateFilter = dateFrom || dateTo;

  const columns = useMemo(() => [
    {
      header: t('appointments.customerName'),
      accessor: 'customer',
      render: (row) => {
        const name = row.customer?.name || 'N/A';
        return (
          <div className="flex items-center gap-2.5">
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0', getAvatarColor(name))}>
              {getInitials(name)}
            </div>
            <div>
              <p className="font-medium text-foreground">{name}</p>
              <p className="text-xs text-muted-foreground">{row.customer?.phone || ''}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: t('appointments.date'),
      accessor: 'appointment_date',
      render: (row) => (
        <div className="flex items-start gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-foreground text-sm">{formatDate(row.appointment_date)}</p>
            <p className="text-xs text-muted-foreground">{formatTime(row.appointment_time)}</p>
          </div>
        </div>
      ),
    },
    {
      header: t('appointments.type'),
      accessor: '_type',
      render: (row) => (
        <Badge variant="info">{t(`appointments.typeLabels.${row._type}`) || ''}</Badge>
      ),
    },
    {
      header: t('appointments.service'),
      accessor: 'service',
      render: (row) => <span className="text-sm text-muted-foreground">{getDisplayName(row) || 'N/A'}</span>,
    },
    {
      header: t('appointments.status'),
      accessor: 'status',
      render: (row) => {
        const isUpdating = updatingStatus === row.id;
        return (
          <div className="flex items-center gap-2">
            {row.status === 'pending' ? (
              <div className="flex items-center gap-2">
                <Badge variant="warning">{t('appointments.pending')}</Badge>
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => requestStatusUpdate(row, 'confirmed', e)}
                      className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 transition-colors"
                      title={t('appointments.approve')}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => requestStatusUpdate(row, 'cancelled', e)}
                      className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/50 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-500 dark:text-red-400 transition-colors"
                      title={t('appointments.reject')}
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Badge variant={getStatusVariant(row.status)}>{t(`appointments.${row.status}`)}</Badge>
            )}
          </div>
        );
      },
    },
    {
      header: t('appointments.actions'),
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); openEditModal(row); }}
          className="px-2"
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      ),
    },
  ], [t, updatingStatus]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('appointments.title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('appointments.subtitle')}</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            </span>
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {pendingCount} randevu onay bekliyor
            </span>
          </div>
        )}
      </div>

      {/* Stat Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const colors = statColorMap[stat.color];
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', colors.bg)}>
                <Icon className={cn('w-5 h-5', colors.icon)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3">
            {/* Row 1: Full-width Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Müşteri adı veya telefon ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-full pl-9"
              />
            </div>

            {/* Row 2: Segmented Status + Right Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Segmented Status Control */}
              <div className="bg-muted rounded-lg p-1 flex items-center gap-0.5">
                {statusPills.map((pill) => (
                  <button
                    key={pill.value}
                    onClick={() => setStatusFilter(pill.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap',
                      statusFilter === pill.value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {pill.label}
                    {pill.value === 'pending' && pendingCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-amber-500 text-white font-semibold">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Right Group: Type pills + Date toggle */}
              <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                {/* Type filter pills */}
                {typeOptions.length > 1 && (
                  <div className="bg-muted rounded-lg p-1 flex items-center gap-0.5">
                    {typeOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setTypeFilter(opt.value)}
                        className={cn(
                          'px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap',
                          typeFilter === opt.value
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Date range toggle */}
                <button
                  onClick={() => setShowDateRange((v) => !v)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                    hasDateFilter
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  {hasDateFilter ? `${dateFrom || '…'} – ${dateTo || '…'}` : 'Tarih'}
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showDateRange && 'rotate-180')} />
                </button>
              </div>
            </div>

            {/* Row 3: Date inputs (collapsible) */}
            {showDateRange && (
              <div className="flex flex-wrap items-center gap-3 mt-1 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">{t('appointments.startDate')}:</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">{t('appointments.endDate')}:</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input text-sm" />
                </div>
                {hasDateFilter && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Temizle
                  </button>
                )}
              </div>
            )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-0 px-0 pb-0">
          {loading ? <div className="p-6"><SkeletonTableRows rows={8} columns={6} /></div> : (
            <Table columns={columns} data={filteredAppointments} />
          )}
        </CardContent>
      </Card>

      {/* Confirm Modal */}
      <Modal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)} size="sm">
        {confirmAction && (
          <div className="text-center">
            {confirmAction.newStatus === 'confirmed' ? (
              <>
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                  <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Randevuyu Onayla</h3>
              </>
            ) : (
              <>
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                  <XCircle className="w-7 h-7 text-red-500 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Randevuyu Reddet</h3>
              </>
            )}
            <p className="text-muted-foreground text-sm mb-1">
              <strong className="text-foreground">{confirmAction.appointment.customer?.name || 'Müşteri'}</strong>
            </p>
            <p className="text-muted-foreground text-sm mb-6">
              {formatDate(confirmAction.appointment.appointment_date)} - {formatTime(confirmAction.appointment.appointment_time)}
            </p>
            <ModalFooter className="justify-center border-0 mt-0 pt-0">
              <Button variant="ghost" onClick={() => setConfirmAction(null)}>{t('common.cancel')}</Button>
              <Button variant={confirmAction.newStatus === 'confirmed' ? 'primary' : 'danger'} onClick={handleStatusUpdate}>
                {confirmAction.newStatus === 'confirmed' ? 'Onayla' : 'Reddet'}
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editModal} onClose={() => setEditModal(null)} title={t('appointments.editAppointment')} size="md">
        {editModal && (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('appointments.customerName')}</label>
                <p className="text-muted-foreground text-sm">{editModal.customer?.name || 'N/A'}</p>
              </div>
              <div>
                <Input label={t('appointments.date')} type="date" value={editForm.appointment_date} onChange={(e) => setEditForm({ ...editForm, appointment_date: e.target.value })} />
              </div>
              <div>
                <Input label={t('appointments.time')} type="time" value={editForm.appointment_time} onChange={(e) => setEditForm({ ...editForm, appointment_time: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('appointments.status')}</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="input">
                  <option value="pending">{t('appointments.pending')}</option>
                  <option value="confirmed">{t('appointments.confirmed')}</option>
                  <option value="completed">{t('appointments.completed')}</option>
                  <option value="cancelled">{t('appointments.cancelled')}</option>
                </select>
              </div>
            </div>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setEditModal(null)}>{t('common.cancel')}</Button>
              <Button variant="primary" onClick={handleEditSubmit} disabled={editLoading}>
                {editLoading ? t('common.loading') : t('common.save')}
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
};
