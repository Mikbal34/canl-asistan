import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Calendar,
  XCircle,
  RefreshCw,
  UserPlus,
  Phone,
  CheckCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { notificationAPI } from '../../services/api';

const NOTIFICATION_TYPES = [
  'appointment_created',
  'appointment_cancelled',
  'appointment_updated',
  'customer_created',
  'call_completed'
];

const TYPE_CONFIG = {
  appointment_created: {
    icon: Calendar,
    color: 'text-green-600',
    bg: 'bg-green-50'
  },
  appointment_cancelled: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50'
  },
  appointment_updated: {
    icon: RefreshCw,
    color: 'text-blue-600',
    bg: 'bg-blue-50'
  },
  customer_created: {
    icon: UserPlus,
    color: 'text-purple-600',
    bg: 'bg-purple-50'
  },
  call_completed: {
    icon: Phone,
    color: 'text-slate-600',
    bg: 'bg-slate-50'
  }
};

export const Notifications = () => {
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    type: '',
    is_read: ''
  });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        ...(filters.type && { type: filters.type }),
        ...(filters.is_read !== '' && { is_read: filters.is_read })
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

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderTypeIcon = (type) => {
    const config = TYPE_CONFIG[type] || TYPE_CONFIG.call_completed;
    const IconComponent = config.icon;
    return (
      <div className={`p-2 rounded-lg ${config.bg}`}>
        <IconComponent className={`h-5 w-5 ${config.color}`} />
      </div>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('common.previous')}
        </button>

        <div className="flex items-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
            <button
              key={pageNum}
              onClick={() => setPage(pageNum)}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                page === pageNum
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {pageNum}
            </button>
          ))}
        </div>

        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common.next')}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('notifications.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('notifications.subtitle')}
          </p>
        </div>
        <button
          onClick={handleMarkAllAsRead}
          disabled={loading || notifications.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle className="h-4 w-4" />
          {t('notifications.markAllRead')}
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('notifications.filterByType')}
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t('notifications.allTypes')}</option>
                {NOTIFICATION_TYPES.map(type => (
                  <option key={type} value={type}>
                    {t(`notifications.types.${type}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('notifications.filterByStatus')}
              </label>
              <select
                value={filters.is_read}
                onChange={(e) => handleFilterChange('is_read', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t('notifications.allStatuses')}</option>
                <option value="true">{t('notifications.read')}</option>
                <option value="false">{t('notifications.unread')}</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card>
        {loading ? (
          <CardContent className="p-12">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </CardContent>
        ) : notifications.length === 0 ? (
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Bell className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600">{t('notifications.empty')}</p>
            </div>
          </CardContent>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('notifications.type')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('notifications.details')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('notifications.date')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('notifications.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('notifications.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <tr
                      key={notification.id}
                      className={!notification.is_read ? 'bg-blue-50/50' : ''}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderTypeIcon(notification.type)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p
                            className={`text-sm ${
                              !notification.is_read
                                ? 'font-bold text-gray-900'
                                : 'font-medium text-gray-700'
                            }`}
                          >
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600">
                            {notification.description}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(notification.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant={notification.is_read ? 'success' : 'warning'}
                        >
                          {notification.is_read
                            ? t('notifications.read')
                            : t('notifications.unread')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!notification.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700"
                          >
                            {t('notifications.markAsRead')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </>
        )}
      </Card>
    </div>
  );
};
