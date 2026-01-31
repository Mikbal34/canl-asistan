import { useState, useEffect } from 'react';
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Star,
  Filter,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  ThumbsUp,
  MessageCircle,
  X,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { feedbackAPI } from '../../services/api';

// Feedback type configuration
const TYPE_CONFIG = {
  complaint: { label: 'Şikayet', icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50' },
  suggestion: { label: 'Öneri', icon: MessageCircle, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  praise: { label: 'Teşekkür', icon: ThumbsUp, color: 'text-green-600', bgColor: 'bg-green-50' },
  general: { label: 'Genel', icon: MessageSquare, color: 'text-slate-600', bgColor: 'bg-slate-50' },
};

// Status configuration
const STATUS_CONFIG = {
  pending: { label: 'Beklemede', variant: 'warning', icon: Clock },
  in_review: { label: 'İnceleniyor', variant: 'info', icon: AlertCircle },
  resolved: { label: 'Çözüldü', variant: 'success', icon: CheckCircle },
};

/**
 * FeedbackViewer - Feedback/complaint viewer for admin panel
 * Shows complaints, suggestions, and praises from customers
 */
export const FeedbackViewer = ({ tenantId, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    type: '',
    status: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchFeedbacks();
    }
  }, [tenantId, filters]);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;

      const response = await feedbackAPI.getAll(tenantId, params);
      setFeedbacks(response.data || []);
    } catch (err) {
      console.error('Failed to fetch feedbacks:', err);
      if (err.response?.status === 404) {
        setFeedbacks([]);
      } else {
        setError('Geri bildirimler yüklenirken hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (feedback, newStatus) => {
    try {
      setUpdating(feedback.id);
      await feedbackAPI.updateStatus(tenantId, feedback.id, newStatus);
      await fetchFeedbacks();
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
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStars = (rating) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      status: '',
    });
  };

  // Count by status
  const statusCounts = feedbacks.reduce((counts, f) => {
    counts[f.status] = (counts[f.status] || 0) + 1;
    return counts;
  }, {});

  // Count by type
  const typeCounts = feedbacks.reduce((counts, f) => {
    counts[f.type] = (counts[f.type] || 0) + 1;
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
          <MessageSquare className="w-5 h-5 text-purple-600" />
          <div className="text-left">
            <h4 className="font-medium text-slate-900">Geri Bildirimler</h4>
            <p className="text-sm text-slate-500">Şikayet, öneri ve teşekkürler</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">{feedbacks.length} geri bildirim</Badge>
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
                onClick={fetchFeedbacks}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Tür</label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Tümü</option>
                    <option value="complaint">Şikayet</option>
                    <option value="suggestion">Öneri</option>
                    <option value="praise">Teşekkür</option>
                    <option value="general">Genel</option>
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
                    <option value="in_review">İnceleniyor</option>
                    <option value="resolved">Çözüldü</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          {!loading && feedbacks.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-4">
              {Object.entries(TYPE_CONFIG).map(([type, config]) => {
                const TypeIcon = config.icon;
                return (
                  <div
                    key={type}
                    className={`p-3 rounded-lg ${config.bgColor} text-center cursor-pointer ${
                      filters.type === type ? 'ring-2 ring-offset-1 ring-slate-400' : ''
                    }`}
                    onClick={() => setFilters({ ...filters, type: filters.type === type ? '' : type })}
                  >
                    <TypeIcon className={`w-5 h-5 mx-auto ${config.color}`} />
                    <p className="text-lg font-bold text-slate-900 mt-1">{typeCounts[type] || 0}</p>
                    <p className="text-xs text-slate-500">{config.label}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
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
          {!loading && !error && feedbacks.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Henüz geri bildirim bulunmuyor</p>
            </div>
          )}

          {/* Feedbacks List */}
          {!loading && !error && feedbacks.length > 0 && (
            <div className="space-y-3">
              {feedbacks.map((feedback) => {
                const typeConfig = TYPE_CONFIG[feedback.type] || TYPE_CONFIG.general;
                const statusConfig = STATUS_CONFIG[feedback.status] || STATUS_CONFIG.pending;
                const TypeIcon = typeConfig.icon;

                return (
                  <div
                    key={feedback.id}
                    className={`p-4 rounded-lg border ${typeConfig.bgColor} border-slate-200`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-white ${typeConfig.color}`}>
                          <TypeIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-slate-900">
                              {feedback.customer?.name || 'Anonim'}
                            </span>
                            <Badge variant={statusConfig.variant} className="text-xs">
                              {statusConfig.label}
                            </Badge>
                            {feedback.rating && renderStars(feedback.rating)}
                          </div>
                          <p className="text-slate-700">{feedback.message || feedback.content}</p>
                          {feedback.customer?.phone && (
                            <p className="text-sm text-slate-500 mt-2">
                              Tel: {feedback.customer.phone}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 mt-2">
                            {formatDate(feedback.created_at)}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {updating === feedback.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        ) : (
                          <select
                            value={feedback.status}
                            onChange={(e) => handleStatusChange(feedback, e.target.value)}
                            className="text-sm border border-slate-200 rounded px-2 py-1 bg-white"
                          >
                            <option value="pending">Beklemede</option>
                            <option value="in_review">İnceleniyor</option>
                            <option value="resolved">Çözüldü</option>
                          </select>
                        )}
                      </div>
                    </div>

                    {/* Admin Notes */}
                    {feedback.admin_notes && (
                      <div className="mt-3 p-3 bg-white rounded border border-slate-200">
                        <p className="text-xs font-medium text-slate-500 mb-1">Admin Notu:</p>
                        <p className="text-sm text-slate-700">{feedback.admin_notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeedbackViewer;
