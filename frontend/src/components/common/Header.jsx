import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, User, Globe, Calendar, UserPlus, XCircle, RefreshCw, Phone, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTenantBranding } from '../../context/TenantBrandingContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '@/lib/utils';

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
  appointment_created: 'text-green-600 bg-green-100 dark:bg-green-950 dark:text-green-400',
  appointment_cancelled: 'text-red-600 bg-red-100 dark:bg-red-950 dark:text-red-400',
  appointment_updated: 'text-blue-600 bg-blue-100 dark:bg-blue-950 dark:text-blue-400',
  customer_created: 'text-purple-600 bg-purple-100 dark:bg-purple-950 dark:text-purple-400',
  call_completed: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
};

export const Header = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { welcomeMessage } = useTenantBranding();
  const { unreadCount, recentNotifications, markAsRead, markAllAsRead } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  const languages = [
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
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

  const btnClass = 'p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground';
  const dropdownClass = 'absolute right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50';

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-card border-b border-border z-40">
      <div className="h-full px-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {welcomeMessage || `${t('common.welcome')}, ${user?.name || user?.email}`}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={btnClass}
            title={theme === 'dark' ? 'Açık tema' : 'Koyu tema'}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={cn(btnClass, 'relative')}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className={cn(dropdownClass, 'w-96')}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">{t('notifications.title')}</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      {t('notifications.markAllRead')}
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {recentNotifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {t('notifications.empty')}
                    </div>
                  ) : (
                    recentNotifications.map((notification) => {
                      const Icon = typeIcons[notification.type] || Bell;
                      const colorClass = typeColors[notification.type] || 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400';
                      return (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                            !notification.is_read && 'bg-primary/5'
                          )}
                        >
                          <div className={cn('mt-0.5 p-1.5 rounded-lg flex-shrink-0', colorClass)}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={cn('text-sm truncate', !notification.is_read ? 'font-semibold text-foreground' : 'text-foreground/80')}>
                                {notification.title}
                              </p>
                              {!notification.is_read && (
                                <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                              )}
                            </div>
                            {notification.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{notification.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              {formatRelativeTime(notification.created_at, t)}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-border">
                  <button
                    onClick={handleViewAll}
                    className="w-full px-4 py-3 text-sm text-center text-primary hover:bg-muted/50 font-medium transition-colors rounded-b-lg"
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
              className={cn(btnClass, 'flex items-center gap-1.5 px-3')}
            >
              <Globe className="w-4 h-4" />
              <span className="text-sm">{currentLanguage?.flag}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showLangMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                <div className={cn(dropdownClass, 'w-44')}>
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                        i18n.language === lang.code
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-muted/50'
                      )}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span>{lang.name}</span>
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
              className={cn(btnClass, 'flex items-center gap-2 pl-2 pr-3')}
            >
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground hidden sm:block">
                {user?.name?.split(' ')[0] || 'User'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className={cn(dropdownClass, 'w-56')}>
                  <div className="p-3 border-b border-border">
                    <p className="text-sm font-medium text-foreground">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted/50 transition-colors rounded-b-lg"
                  >
                    <LogOut className="w-4 h-4 text-muted-foreground" />
                    <span>{t('common.logout')}</span>
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
