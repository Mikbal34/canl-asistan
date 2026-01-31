import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Phone,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Check,
  X,
  Filter,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Input } from '../common/Input';
import { appointmentsAPI } from '../../services/api';

// Status configuration
const STATUS_CONFIG = {
  pending: { label: 'Beklemede', color: 'bg-yellow-100 text-yellow-800', badgeVariant: 'warning' },
  confirmed: { label: 'Onaylandı', color: 'bg-blue-100 text-blue-800', badgeVariant: 'info' },
  completed: { label: 'Tamamlandı', color: 'bg-green-100 text-green-800', badgeVariant: 'success' },
  cancelled: { label: 'İptal', color: 'bg-red-100 text-red-800', badgeVariant: 'error' },
  no_show: { label: 'Gelmedi', color: 'bg-gray-100 text-gray-800', badgeVariant: 'default' },
};

// Appointment type configuration
const TYPE_CONFIG = {
  beauty: { label: 'Güzellik', icon: '💅', color: 'bg-pink-50 border-pink-200' },
  test_drive: { label: 'Test Sürüşü', icon: '🚗', color: 'bg-blue-50 border-blue-200' },
  service: { label: 'Servis', icon: '🔧', color: 'bg-orange-50 border-orange-200' },
};

/**
 * AppointmentsViewer - Unified appointments viewer for admin panel
 * Shows all appointment types (beauty, test_drive, service) in one place
 */
export const AppointmentsViewer = ({ tenantId, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchAppointments();
    }
  }, [tenantId, filters]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await appointmentsAPI.getAll(tenantId, params);
      setAppointments(response.data || []);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
      if (err.response?.status === 404) {
        setAppointments([]);
      } else {
        setError('Randevular yüklenirken hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appointment, newStatus) => {
    try {
      setUpdating(appointment.id);
      await appointmentsAPI.updateStatus(
        tenantId,
        appointment.id,
        newStatus,
        appointment.appointment_type
      );
      await fetchAppointments();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Durum güncellenirken hata oluştu');
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
    return timeString.slice(0, 5);
  };

  const getCustomerInfo = (appointment) => {
    const customer = appointment.customer;
    if (!customer) return { name: 'Bilinmiyor', phone: '-' };
    return {
      name: customer.name || customer.full_name || 'İsimsiz',
      phone: customer.phone || '-',
    };
  };

  const getAppointmentDetails = (appointment) => {
    const type = appointment.appointment_type;
    if (type === 'beauty' && appointment.service) {
      return appointment.service.name || 'Güzellik Hizmeti';
    }
    if (type === 'test_drive' && appointment.vehicle) {
      return `${appointment.vehicle.brand} ${appointment.vehicle.model}`;
    }
    if (type === 'service') {
      return appointment.service_type || 'Servis Randevusu';
    }
    return '-';
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      status: '',
      startDate: '',
      endDate: '',
    });
  };

  // Group appointments by date
  const groupedAppointments = appointments.reduce((groups, appointment) => {
    const date = appointment.appointment_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(appointment);
    return groups;
  }, {});

  // Count by status
  const statusCounts = appointments.reduce((counts, a) => {
    counts[a.status] = (counts[a.status] || 0) + 1;
    return counts;
  }, {});

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <div className="text-left">
            <h4 className="font-medium text-slate-900">Randevu Yönetimi</h4>
            <p className="text-sm text-slate-500">Tüm randevuları görüntüle ve yönet</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">{appointments.length} randevu</Badge>
          {statusCounts.pending > 0 && (
            <Badge variant="warning">{statusCounts.pending} beklemede</Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtrele
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchAppointments}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            {Object.values(filters).some(v => v) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Filtreleri Temizle
              </Button>
            )}
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Tür</label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Tümü</option>
                    <option value="beauty">Güzellik</option>
                    <option value="test_drive">Test Sürüşü</option>
                    <option value="service">Servis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Durum</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Tümü</option>
                    <option value="pending">Beklemede</option>
                    <option value="confirmed">Onaylandı</option>
                    <option value="completed">Tamamlandı</option>
                    <option value="cancelled">İptal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Başlangıç</label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Bitiş</label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && appointments.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Henüz randevu bulunmuyor</p>
            </div>
          )}

          {/* Appointments List */}
          {!loading && !error && appointments.length > 0 && (
            <div className="space-y-4">
              {Object.entries(groupedAppointments).map(([date, dateAppointments]) => (
                <div key={date}>
                  <h5 className="text-sm font-medium text-slate-500 mb-2">
                    {formatDate(date)}
                  </h5>
                  <div className="space-y-2">
                    {dateAppointments.map((appointment) => {
                      const typeConfig = TYPE_CONFIG[appointment.appointment_type] || TYPE_CONFIG.beauty;
                      const statusConfig = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.pending;
                      const customer = getCustomerInfo(appointment);

                      return (
                        <div
                          key={`${appointment.appointment_type}-${appointment.id}`}
                          className={`flex items-center justify-between p-4 rounded-lg border ${typeConfig.color}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-2xl">{typeConfig.icon}</div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-900">{customer.name}</p>
                                <Badge variant={statusConfig.badgeVariant} className="text-xs">
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTime(appointment.appointment_time)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {customer.phone}
                                </span>
                                <span>{getAppointmentDetails(appointment)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {updating === appointment.id ? (
                              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                            ) : (
                              <>
                                {appointment.status === 'pending' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleStatusChange(appointment, 'confirmed')}
                                      className="!text-blue-600 hover:!bg-blue-50"
                                    >
                                      <Check className="w-4 h-4 mr-1" />
                                      Onayla
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleStatusChange(appointment, 'cancelled')}
                                      className="!text-red-600 hover:!bg-red-50"
                                    >
                                      <X className="w-4 h-4 mr-1" />
                                      İptal
                                    </Button>
                                  </>
                                )}
                                {appointment.status === 'confirmed' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleStatusChange(appointment, 'completed')}
                                      className="!text-green-600 hover:!bg-green-50"
                                    >
                                      <Check className="w-4 h-4 mr-1" />
                                      Tamamla
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleStatusChange(appointment, 'no_show')}
                                      className="!text-gray-600 hover:!bg-gray-50"
                                    >
                                      Gelmedi
                                    </Button>
                                  </>
                                )}
                                {(appointment.status === 'completed' || appointment.status === 'cancelled') && (
                                  <select
                                    value={appointment.status}
                                    onChange={(e) => handleStatusChange(appointment, e.target.value)}
                                    className="text-sm border border-slate-200 rounded px-2 py-1"
                                  >
                                    <option value="pending">Beklemede</option>
                                    <option value="confirmed">Onaylandı</option>
                                    <option value="completed">Tamamlandı</option>
                                    <option value="cancelled">İptal</option>
                                    <option value="no_show">Gelmedi</option>
                                  </select>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AppointmentsViewer;
