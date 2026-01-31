import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
  Calendar,
  RefreshCw,
  User,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Input } from '../common/Input';
import { customersAdminAPI } from '../../services/api';

/**
 * CustomersViewer - Customer list viewer for admin panel
 * Shows all customers with their appointment history
 */
export const CustomersViewer = ({ tenantId, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (tenantId) {
      fetchCustomers();
    }
  }, [tenantId, debouncedSearch]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;

      const response = await customersAdminAPI.getAll(tenantId, params);
      setCustomers(response.data || []);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      if (err.response?.status === 404) {
        setCustomers([]);
      } else {
        setError('Müşteriler yüklenirken hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-blue-600" />
          <div className="text-left">
            <h4 className="font-medium text-slate-900">Müşteri Listesi</h4>
            <p className="text-sm text-slate-500">Tüm müşterileri görüntüle</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">{customers.length} müşteri</Badge>
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
          {/* Search */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="İsim, telefon veya e-posta ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchCustomers}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
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
          {!loading && !error && customers.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>{searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz müşteri bulunmuyor'}</p>
            </div>
          )}

          {/* Customers List */}
          {!loading && !error && customers.length > 0 && (
            <div className="space-y-2">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-medium">
                        {getInitials(customer.name || customer.full_name)}
                      </span>
                    </div>

                    {/* Info */}
                    <div>
                      <p className="font-medium text-slate-900">
                        {customer.name || customer.full_name || 'İsimsiz Müşteri'}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </span>
                        )}
                        {customer.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {customer.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-slate-900">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{customer.total_appointments || 0}</span>
                        <span className="text-sm text-slate-500">randevu</span>
                      </div>
                      {customer.last_appointment_date && (
                        <p className="text-xs text-slate-500 mt-1">
                          Son: {formatDate(customer.last_appointment_date)}
                        </p>
                      )}
                    </div>
                    <Badge variant={customer.total_appointments > 5 ? 'success' : 'default'}>
                      {customer.total_appointments > 5 ? 'Sadık' : 'Yeni'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {!loading && !error && customers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-slate-900">{customers.length}</p>
                  <p className="text-sm text-slate-500">Toplam Müşteri</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {customers.filter(c => (c.total_appointments || 0) > 5).length}
                  </p>
                  <p className="text-sm text-slate-500">Sadık Müşteri</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {customers.reduce((sum, c) => sum + (c.total_appointments || 0), 0)}
                  </p>
                  <p className="text-sm text-slate-500">Toplam Randevu</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomersViewer;
