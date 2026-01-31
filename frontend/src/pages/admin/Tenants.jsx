import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Filter,
  Building2,
  Send,
  RefreshCw,
  Eye,
  Loader2
} from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import { Table } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { adminAPI } from '../../services/api';
import { TenantCreateModal } from './TenantCreateModal';

// Industry icons mapping
const industryIcons = {
  automotive: '🚗',
  beauty: '💅', // Legacy - will be migrated to beauty_salon
  beauty_salon: '💅',
  hairdresser: '✂️',
};

// Industry labels mapping
const industryLabels = {
  automotive: 'Otomotiv',
  beauty: 'Güzellik Salonu', // Legacy - will be migrated to beauty_salon
  beauty_salon: 'Güzellik Salonu',
  hairdresser: 'Kuaför',
};

/**
 * Get status badge variant and label
 */
const getStatusInfo = (tenant) => {
  if (tenant.is_active) {
    return { variant: 'success', label: 'Aktif', icon: '●' };
  }
  if (tenant.onboarding_step) {
    return {
      variant: 'warning',
      label: `Onboarding (${tenant.onboarding_step}/4)`,
      icon: '○'
    };
  }
  return { variant: 'error', label: 'Pasif', icon: '○' };
};

/**
 * Admin Tenants page component
 */
export const Tenants = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [syncingTenant, setSyncingTenant] = useState(null);
  const [sendingLink, setSendingLink] = useState(null);

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

  const handleTenantCreated = () => {
    setIsCreateModalOpen(false);
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

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      tenant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.phone?.includes(searchTerm);

    return matchesSearch;
  });

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatLastActivity = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Az önce';
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;
    return formatDate(dateString);
  };

  const columns = [
    {
      header: t('admin.tenantName'),
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl">
            {industryIcons[row.industry] || '🏢'}
          </div>
          <div>
            <p className="font-medium text-slate-900">{row.name}</p>
            <p className="text-sm text-slate-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: t('admin.tenantIndustry'),
      accessor: 'industry',
      render: (row) => (
        <span className="text-slate-600">
          {industryLabels[row.industry] || row.industry}
        </span>
      ),
    },
    {
      header: t('admin.tenantPhone'),
      accessor: 'phone',
      render: (row) => (
        <span className="text-slate-600">{row.phone || '-'}</span>
      ),
    },
    {
      header: t('admin.tenantStatus'),
      accessor: 'status',
      render: (row) => {
        const statusInfo = getStatusInfo(row);
        return (
          <div className="flex items-center gap-2">
            <Badge variant={statusInfo.variant}>
              {statusInfo.icon} {statusInfo.label}
            </Badge>
          </div>
        );
      },
    },
    {
      header: 'Son Aktivite',
      accessor: 'updated_at',
      render: (row) => (
        <span className="text-slate-500 text-sm">
          {formatLastActivity(row.updated_at || row.created_at)}
        </span>
      ),
    },
    {
      header: t('appointments.actions'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewTenant(row);
            }}
            className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors"
            title="Detay görüntüle"
          >
            <Eye className="w-4 h-4" />
          </button>
          {!row.is_active && (
            <button
              onClick={(e) => handleSendOnboardingLink(row, e)}
              disabled={sendingLink === row.id}
              className="p-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-600 transition-colors disabled:opacity-50"
              title="Onboarding linki gönder"
            >
              {sendingLink === row.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={(e) => handleSyncTenant(row, e)}
            disabled={syncingTenant === row.id}
            className="p-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-600 transition-colors disabled:opacity-50"
            title="VAPI Sync"
          >
            {syncingTenant === row.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-indigo-100">
            <Building2 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('admin.tenants')}</h1>
            <p className="text-slate-500 mt-1">
              Tüm tenant hesaplarını yönetin
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Yeni Müşteri Ekle
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Ara... (isim, email, telefon)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>

            {/* Industry Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                className="input pl-10 pr-8 min-w-[160px] appearance-none cursor-pointer"
              >
                <option value="">Tüm Sektörler</option>
                <option value="automotive">🚗 Otomotiv</option>
                <option value="beauty_salon">💅 Güzellik Salonu</option>
                <option value="hairdresser">✂️ Kuaför</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input pr-8 min-w-[140px] appearance-none cursor-pointer"
              >
                <option value="">Tüm Durumlar</option>
                <option value="active">● Aktif</option>
                <option value="inactive">○ Pasif/Onboarding</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-900">{tenants.length}</div>
            <div className="text-sm text-slate-500">Toplam Tenant</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-600">
              {tenants.filter(t => t.is_active).length}
            </div>
            <div className="text-sm text-slate-500">Aktif</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">
              {tenants.filter(t => !t.is_active && t.onboarding_step).length}
            </div>
            <div className="text-sm text-slate-500">Onboarding</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-400">
              {tenants.filter(t => !t.is_active && !t.onboarding_step).length}
            </div>
            <div className="text-sm text-slate-500">Pasif</div>
          </CardContent>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">
                {searchTerm || industryFilter || statusFilter
                  ? 'Filtrelere uygun tenant bulunamadı'
                  : 'Henüz tenant bulunmuyor'}
              </p>
              {!searchTerm && !industryFilter && !statusFilter && (
                <Button
                  variant="primary"
                  className="mt-4"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  İlk Tenant'ı Oluştur
                </Button>
              )}
            </div>
          ) : (
            <Table
              columns={columns}
              data={filteredTenants}
              onRowClick={handleViewTenant}
            />
          )}
        </CardContent>
      </Card>

      {/* Create Tenant Modal */}
      <TenantCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleTenantCreated}
      />
    </div>
  );
};
