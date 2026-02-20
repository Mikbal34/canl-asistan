import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Calendar, XCircle, RefreshCw, UserPlus, Phone, CheckCircle, ChevronLeft, ChevronRight, Trash2, Filter, X } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import { notificationAPI } from '../../services/api';
import { cn } from '@/lib/utils';

const NOTIFICATION_TYPES = ['appointment_created', 'appointment_cancelled', 'appointment_updated', 'customer_created', 'call_completed'];

const TYPE_CONFIG = {
  appointment_created:  { icon: Calendar,   color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-100 dark:bg-green-950/50' },
  appointment_cancelled:{ icon: XCircle,    color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-100 dark:bg-red-950/50' },
  appointment_updated:  { icon: RefreshCw,  color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-100 dark:bg-blue-950/50' },
  customer_created:     { icon: UserPlus,   color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-950/50' },
  call_completed:       { icon: Phone,      color: 'text-muted-foreground',               bg: 'bg-muted/60' },
};

export const Notifications = () => {
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ type: '', is_read: '' });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        ...(filters.type && { type: filters.type }),
        ...(filters.is_read !== '' && { is_read: filters.is_read }),
      };
      const response = await notificationAPI.getAll(params);
      setNotifications(response.data.data || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    try { await notificationAPI.markAsRead(id); fetchNotifications(); } catch (e) { console.error(e); }
  };
  const handleMarkAllAsRead = async () => {
    try { await notificationAPI.markAllAsRead(); fetchNotifications(); } catch (e) { console.error(e); }
  };
  const handleDelete = async (id) => {
    try { await notificationAPI.delete(id); fetchNotifications(); } catch (e) { console.error(e); }
  };
  const handleFilterChange = (key, value) => { setFilters(prev => ({ ...prev, [key]: value })); setPage(1); };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('notifications.title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('notifications.subtitle')}</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleMarkAllAsRead}
          disabled={loading || notifications.length === 0}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {t('notifications.markAllRead')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-4 border border-border rounded-xl bg-muted/20 flex-wrap">
        <div className="flex items-center gap-2 text-muted-foreground shrink-0">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filtrele</span>
        </div>

        <div className="flex items-end gap-3 flex-1 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t('notifications.filterByType')}</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="input text-sm !w-auto min-w-[180px]"
            >
              <option value="">{t('notifications.allTypes')}</option>
              {NOTIFICATION_TYPES.map(type => (
                <option key={type} value={type}>{t(`notifications.types.${type}`)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t('notifications.filterByStatus')}</label>
            <select
              value={filters.is_read}
              onChange={(e) => handleFilterChange('is_read', e.target.value)}
              className="input text-sm !w-auto min-w-[140px]"
            >
              <option value="">{t('notifications.allStatuses')}</option>
              <option value="true">{t('notifications.read')}</option>
              <option value="false">{t('notifications.unread')}</option>
            </select>
          </div>

          {(filters.type || filters.is_read !== '') && (
            <button
              onClick={() => { setFilters({ type: '', is_read: '' }); setPage(1); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors self-end"
            >
              <X className="w-3.5 h-3.5" />
              Temizle
            </button>
          )}
        </div>

        {!loading && notifications.length > 0 && (
          <span className="text-sm text-muted-foreground ml-auto shrink-0">
            <span className="font-medium text-foreground">{notifications.length}</span> bildirim
            {unreadCount > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                • <span className="font-medium">{unreadCount}</span> okunmamış
              </span>
            )}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-border rounded-xl p-4">
              <div className="flex items-start gap-4">
                <Skeleton width="2.5rem" height="2.5rem" rounded="rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton width="60%" height="1rem" />
                  <Skeleton width="40%" height="0.75rem" />
                  <Skeleton width="5rem" height="0.75rem" />
                </div>
                <Skeleton width="3.5rem" height="1.5rem" rounded="rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && notifications.length === 0 && (
        <div className="border border-border rounded-xl py-16 flex flex-col items-center justify-center text-center">
          <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">{t('notifications.empty')}</p>
        </div>
      )}

      {/* Notification cards */}
      {!loading && notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.call_completed;
            const Icon = config.icon;
            return (
              <div
                key={notification.id}
                className={cn(
                  'border rounded-xl p-4 transition-colors',
                  !notification.is_read
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border'
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Type icon */}
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', config.bg)}>
                    <Icon className={cn('w-5 h-5', config.color)} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className={cn('text-sm', !notification.is_read ? 'font-semibold text-foreground' : 'text-foreground/80')}>
                          {notification.title}
                        </p>
                        {notification.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{notification.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(notification.created_at)}</p>
                      </div>
                      {/* Badge + actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={notification.is_read ? 'success' : 'warning'}>
                          {notification.is_read ? t('notifications.read') : t('notifications.unread')}
                        </Badge>
                        {!notification.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                            title={t('notifications.markAsRead')}
                          >
                            <CheckCircle className="w-4 h-4 text-primary" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                          title={t('notifications.delete')}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground border border-border rounded-lg hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" /> {t('common.previous')}
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  page === pageNum ? 'bg-primary text-primary-foreground' : 'text-foreground border border-border hover:bg-muted/50'
                )}
              >
                {pageNum}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground border border-border rounded-lg hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('common.next')} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
