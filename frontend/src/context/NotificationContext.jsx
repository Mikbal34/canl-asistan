import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { notificationAPI } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../hooks/useAuth';

export const NotificationContext = createContext(null);

const POLL_INTERVAL = 15000; // 15 saniye

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef(null);
  const pollRef = useRef(null);
  const realtimeConnected = useRef(false);

  const tenantId = user?.tenant?.id || user?.tenant_id;
  const isSuperAdmin = user?.role === 'super_admin';

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

  const refresh = useCallback(() => {
    fetchUnreadCount();
    fetchRecentNotifications();
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

  // Initial fetch + polling
  useEffect(() => {
    if (!isAuthenticated || isSuperAdmin) return;

    refresh();

    pollRef.current = setInterval(() => {
      // Realtime baglanirsa polling'i durdur
      if (!realtimeConnected.current) {
        refresh();
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isAuthenticated, isSuperAdmin, refresh]);

  // Supabase Realtime (basarisiz olursa polling devam eder)
  useEffect(() => {
    if (!isAuthenticated || isSuperAdmin || !tenantId || !supabase) return;

    const channel = supabase
      .channel(`notifications:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const newNotification = payload.new;
          setRecentNotifications(prev => [newNotification, ...prev].slice(0, 10));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Notifications] Realtime connected');
          realtimeConnected.current = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Realtime calismadi, polling devam edecek - sessizce gec
          realtimeConnected.current = false;
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        realtimeConnected.current = false;
      }
    };
  }, [isAuthenticated, isSuperAdmin, tenantId]);

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
