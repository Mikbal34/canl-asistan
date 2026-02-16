import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { notificationAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export const NotificationContext = createContext(null);

const POLL_INTERVAL = 10000; // 10 saniye (aktif tab)

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);
  const fetchingRef = useRef(false);

  const isSuperAdmin = user?.role === 'super_admin';
  const tenantId = user?.tenant_id || user?.tenant?.id;

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated || isSuperAdmin) return;
    try {
      const res = await notificationAPI.getUnreadCount();
      setUnreadCount(res.data?.count || 0);
    } catch (err) {
      // silent
    }
  }, [isAuthenticated, isSuperAdmin]);

  const fetchRecentNotifications = useCallback(async () => {
    if (!isAuthenticated || isSuperAdmin) return;
    try {
      const res = await notificationAPI.getAll({ page: 1, limit: 10 });
      setRecentNotifications(res.data?.data || []);
    } catch (err) {
      // silent
    }
  }, [isAuthenticated, isSuperAdmin]);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      await Promise.all([fetchUnreadCount(), fetchRecentNotifications()]);
    } finally {
      fetchingRef.current = false;
    }
  }, [fetchUnreadCount, fetchRecentNotifications]);

  const markAsRead = useCallback(async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setRecentNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationAPI.markAllAsRead();
      setRecentNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(refresh, POLL_INTERVAL);
  }, [refresh]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    if (!isAuthenticated || isSuperAdmin) return;

    refresh();
    startPolling();

    return stopPolling;
  }, [isAuthenticated, isSuperAdmin, refresh, startPolling, stopPolling]);

  // Visibility-aware polling: stop when hidden, instant refresh + restart when visible
  useEffect(() => {
    if (!isAuthenticated || isSuperAdmin) return;

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        refresh();
        startPolling();
      }
    };

    const handleFocus = () => {
      if (!document.hidden) refresh();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, isSuperAdmin, refresh, startPolling, stopPolling]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        recentNotifications,
        loading,
        fetchUnreadCount,
        fetchRecentNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
