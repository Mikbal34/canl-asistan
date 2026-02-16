import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, User, Globe, Calendar, UserPlus, XCircle, RefreshCw, Phone } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTenantBranding } from '../../context/TenantBrandingContext';
import { useNotifications } from '../../hooks/useNotifications';

function formatRelativeTime(dateString, t) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return t('notifications.justNow');
  if (diffMinutes < 60) return t('notifications.minutesAgo', { count: diffMinutes });
  if (diffHours < 24) return t('notifications.hoursAgo', { count: diffHours });
  return t('notifications.daysAgo', { count: diffDays });
}

const typeIcons = {
  appointment_created: Calendar,
  appointment_cancelled: XCircle,
  appointment_updated: RefreshCw,
  customer_created: UserPlus,
  call_completed: Phone,
};

const typeColors = {
  appointment_created: 'text-green-600 bg-green-50',
  appointment_cancelled: 'text-red-600 bg-red-50',
  appointment_updated: 'text-blue-600 bg-blue-50',
  customer_created: 'text-purple-600 bg-purple-50',
  call_completed: 'text-slate-600 bg-slate-50',
};

/**
 * Header component with user menu, language switcher, and notification dropdown
 */
export const Header = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { welcomeMessage } = useTenantBranding();
  const { unreadCount, recentNotifications, markAsRead, markAllAsRead } = useNotifications();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  const languages = [
    { code: 'tr', name: 'Turkce', flag: '\u{1F1F9}\u{1F1F7}' },
    { code: 'en', name: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
    { code: 'de', name: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language);

  const changeLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('language', langCode);
    setShowLangMenu(false);
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
  };

  const handleViewAll = () => {
    setShowNotifications(false);
    navigate('/notifications');
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-slate-200 z-40">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Page title - can be customized per page */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {welcomeMessage || `${t('common.welcome')}, ${user?.name || user?.email}`}
          </h2>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Bell className="w-5 h-5 text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg border border-slate-200 shadow-lg z-50">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">{t('notifications.title')}</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      {t('notifications.markAllRead')}
                    </button>
                  )}
                </div>

                {/* Notification list */}
                <div className="max-h-96 overflow-y-auto">
                  {recentNotifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      {t('notifications.empty')}
                    </div>
                  ) : (
                    recentNotifications.map((notification) => {
                      const Icon = typeIcons[notification.type] || Bell;
                      const colorClass = typeColors[notification.type] || 'text-slate-600 bg-slate-50';
                      return (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                            !notification.is_read ? 'bg-indigo-50/30' : ''
                          }`}
                        >
                          <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${colorClass}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm truncate ${!notification.is_read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                                {notification.title}
                              </p>
                              {!notification.is_read && (
                                <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
                              )}
                            </div>
                            {notification.description && (
                              <p className="text-xs text-slate-500 truncate mt-0.5">{notification.description}</p>
                            )}
                            <p className="text-xs text-slate-400 mt-1">
                              {formatRelativeTime(notification.created_at, t)}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100">
                  <button
                    onClick={handleViewAll}
                    className="w-full px-4 py-3 text-sm text-center text-indigo-600 hover:bg-slate-50 font-medium transition-colors rounded-b-lg"
                  >
                    {t('notifications.viewAll')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Globe className="w-5 h-5 text-slate-600" />
              <span className="text-sm text-slate-600">{currentLanguage?.flag}</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </button>

            {showLangMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowLangMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg border border-slate-200 shadow-lg z-50">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        i18n.language === lang.code
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xl">{lang.flag}</span>
                      <span className="text-sm">{lang.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-900">{user?.name || 'User'}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg border border-slate-200 shadow-lg z-50">
                  <div className="p-4 border-b border-slate-200">
                    <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-700 hover:bg-slate-50 transition-colors rounded-b-lg"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">{t('common.logout')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
