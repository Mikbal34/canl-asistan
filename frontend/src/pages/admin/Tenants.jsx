import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Filter,
  Building2,
  Send,
  RefreshCw,
  Eye,
  Loader2,
  Sparkles,
  Plus,
  Activity,
  Clock,
  XCircle,
} from 'lucide-react';
import { Table } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { SkeletonTableRows } from '../../components/common/Skeleton';
import { Button } from '../../components/common/Button';
import { adminAPI } from '../../services/api';
import { OnboardingChat } from '../../components/admin/OnboardingChat';
import { TenantCreateModal } from './TenantCreateModal';

const industryIcons = {
  automotive: '🚗',
  beauty: '💅',
  beauty_salon: '💅',
  hairdresser: '✂️',
};

const industryLabels = {
  automotive: 'Otomotiv',
  beauty: 'Güzellik Salonu',
  beauty_salon: 'Güzellik Salonu',
  hairdresser: 'Kuaför',
};

const getStatusInfo = (tenant) => {
  if (tenant.is_active) {
    return { variant: 'success', label: 'Aktif', icon: '●' };
  }
  if (tenant.onboarding_step) {
    return {
      variant: 'warning',
      label: `Onboarding (${tenant.onboarding_step}/4)`,
      icon: '○',
    };
  }
  return { variant: 'error', label: 'Pasif', icon: '○' };
};

export const Tenants = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isOnboardingChatOpen, setIsOnboardingChatOpen] = useState(false);
  const [isManualCreateOpen, setIsManualCreateOpen] = useState(false);
  const [syncingTenant, setSyncingTenant] = useState(null);
  const [sendingLink, setSendingLink] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  useEffect(() => {
    fetchTenants();
  }, [industryFilter, statusFilter]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const params = {};
      if (industryFilter) params.industry = industryFilter;
      if (statusFilter === 'active') params.isActive = true;
      if (statusFilter === 'inactive') params.isActive = false;

      const response = await adminAPI.getTenants(params);
      setTenants(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingSuccess = () => {
    setIsOnboardingChatOpen(false);
    fetchTenants();
  };

  const handleManualCreateSuccess = () => {
    setIsManualCreateOpen(false);
    fetchTenants();
  };

  const handleViewTenant = (tenant) => {
    navigate(`/admin/tenants/${tenant.id}`);
  };

  const handleSyncTenant = async (tenant, e) => {
    e.stopPropagation();
    try {
      setSyncingTenant(tenant.id);
      await adminAPI.syncTenant(tenant.id);
      alert('VAPI sync başarılı!');
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync hatası: ' + error.message);
    } finally {
      setSyncingTenant(null);
    }
  };

  const handleSendOnboardingLink = async (tenant, e) => {
    e.stopPropagation();
    if (!tenant.email) {
      alert('Tenant email adresi bulunamadı');
      return;
    }
    try {
      setSendingLink(tenant.id);
      await adminAPI.sendOnboardingLink(tenant.id);
      alert(`Onboarding linki ${tenant.email} adresine gönderildi!`);
    } catch (error) {
      console.error('Send link failed:', error);
      alert('Link gönderme hatası: ' + error.message);
    } finally {
      setSendingLink(null);
    }
  };

  const filteredTenants = useMemo(() => tenants.filter((tenant) => {
    const term = debouncedSearch.toLocaleLowerCase('tr');
    return !term ||
      tenant.name?.toLocaleLowerCase('tr').includes(term) ||
      tenant.email?.toLocaleLowerCase('tr').includes(term) ||
      tenant.phone?.includes(debouncedSearch);
  }), [tenants, debouncedSearch]);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const formatLastActivity = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const diffMs = Date.now() - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffHours < 1) return 'Az önce';
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;
    return formatDate(dateString);
  };

  const statCards = [
    {
      label: 'Toplam Tenant',
      value: tenants.length,
      icon: Building2,
      bgColor: 'bg-blue-100 dark:bg-blue-950/50',
      iconColor: 'text-blue-600 dark:text-blue-400',
      valueColor: 'text-foreground',
    },
    {
      label: 'Aktif',
      value: tenants.filter(t => t.is_active).length,
      icon: Activity,
      bgColor: 'bg-emerald-100 dark:bg-emerald-950/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      valueColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Onboarding',
      value: tenants.filter(t => !t.is_active && t.onboarding_step).length,
      icon: Clock,
      bgColor: 'bg-amber-100 dark:bg-amber-950/50',
      iconColor: 'text-amber-600 dark:text-amber-400',
      valueColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Pasif',
      value: tenants.filter(t => !t.is_active && !t.onboarding_step).length,
      icon: XCircle,
      bgColor: 'bg-muted',
      iconColor: 'text-muted-foreground',
      valueColor: 'text-muted-foreground',
    },
  ];

  const columns = useMemo(() => [
    {
      header: t('admin.tenantName'),
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl flex-shrink-0">
            {industryIcons[row.industry] || '🏢'}
          </div>
          <div>
            <p className="font-medium text-foreground">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: t('admin.tenantIndustry'),
      accessor: 'industry',
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground capitalize">
          {industryLabels[row.industry] || row.industry}
        </span>
      ),
    },
    {
      header: t('admin.tenantPhone'),
      accessor: 'phone',
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.phone || '-'}</span>
      ),
    },
    {
      header: t('admin.tenantStatus'),
      accessor: 'status',
      render: (row) => {
        const statusInfo = getStatusInfo(row);
        return (
          <Badge variant={statusInfo.variant}>
            {statusInfo.icon} {statusInfo.label}
          </Badge>
        );
      },
    },
    {
      header: 'Son Aktivite',
      accessor: 'updated_at',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatLastActivity(row.updated_at || row.created_at)}
        </span>
      ),
    },
    {
      header: t('appointments.actions'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleViewTenant(row); }}
            className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/50 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
            title="Detay görüntüle"
          >
            <Eye className="w-4 h-4" />
          </button>
          {!row.is_active && (
            <button
              onClick={(e) => handleSendOnboardingLink(row, e)}
              disabled={sendingLink === row.id}
              className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 transition-colors disabled:opacity-50"
              title="Onboarding linki gönder"
            >
              {sendingLink === row.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </button>
          )}
          <button
            onClick={(e) => handleSyncTenant(row, e)}
            disabled={syncingTenant === row.id}
            className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/50 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-400 transition-colors disabled:opacity-50"
            title="VAPI Sync"
          >
            {syncingTenant === row.id
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />
            }
          </button>
        </div>
      ),
    },
  ], [t, syncingTenant, sendingLink]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('admin.tenants')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">Tüm tenant hesaplarını yönetin</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => setIsManualCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Manuel Ekle
          </Button>
          <button
            onClick={() => setIsOnboardingChatOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:opacity-90 text-white font-medium transition-opacity"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI ile Ekle
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Ara... (isim, email, telefon)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9 w-full"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="input pl-9 pr-8 min-w-[160px] appearance-none cursor-pointer"
            >
              <option value="">Tüm Sektörler</option>
              <option value="automotive">🚗 Otomotiv</option>
              <option value="beauty_salon">💅 Güzellik Salonu</option>
              <option value="hairdresser">✂️ Kuaför</option>
            </select>
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input pr-8 min-w-[150px] appearance-none cursor-pointer"
            >
              <option value="">Tüm Durumlar</option>
              <option value="active">● Aktif</option>
              <option value="inactive">○ Pasif/Onboarding</option>
            </select>
          </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${stat.bgColor}`}>
                <Icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <div>
                {loading
                  ? <div className="animate-pulse bg-muted rounded h-7 w-8 mb-0.5" />
                  : <p className={`text-2xl font-bold leading-none ${stat.valueColor}`}>{stat.value}</p>
                }
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tenants Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/20">
          <h2 className="text-sm font-semibold text-foreground">{t('admin.tenants')}</h2>
        </div>

        {loading ? (
          <div className="p-6"><SkeletonTableRows rows={5} columns={6} /></div>
        ) : filteredTenants.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              {searchTerm || industryFilter || statusFilter
                ? 'Filtrelere uygun tenant bulunamadı'
                : 'Henüz tenant bulunmuyor'}
            </p>
            {!searchTerm && !industryFilter && !statusFilter && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button variant="secondary" size="sm" onClick={() => setIsManualCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Manuel Ekle
                </Button>
                <button
                  onClick={() => setIsOnboardingChatOpen(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:opacity-90 text-white font-medium transition-opacity"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI ile Ekle
                </button>
              </div>
            )}
          </div>
        ) : (
          <Table
            columns={columns}
            data={filteredTenants}
            onRowClick={handleViewTenant}
          />
        )}
      </div>

      <OnboardingChat
        isOpen={isOnboardingChatOpen}
        onClose={() => setIsOnboardingChatOpen(false)}
        onSuccess={handleOnboardingSuccess}
      />

      <TenantCreateModal
        isOpen={isManualCreateOpen}
        onClose={() => setIsManualCreateOpen(false)}
        onSuccess={handleManualCreateSuccess}
      />
    </div>
  );
};
