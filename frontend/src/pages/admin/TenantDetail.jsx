import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Building2,
  Phone,
  Clock,
  Mic,
  Settings,
  Save,
  Trash2,
  RefreshCw,
  PhoneCall,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  Users,
  Edit3,
  Palette,
  Image,
  Globe,
  Wrench,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { Modal, ModalFooter } from '../../components/common/Modal';
import { adminAPI, useCaseAPI } from '../../services/api';

// Use Case Editor Components
import { WorkingHoursEditor } from '../../components/admin/WorkingHoursEditor';
import { VehicleCatalogEditor } from '../../components/admin/VehicleCatalogEditor';
import { BeautyServicesEditor } from '../../components/admin/BeautyServicesEditor';
import { StaffEditor } from '../../components/admin/StaffEditor';
import { PromotionsEditor } from '../../components/admin/PromotionsEditor';
import { SlotManagerEditor } from '../../components/admin/SlotManagerEditor';
import { AppointmentsViewer } from '../../components/admin/AppointmentsViewer';
import { CustomersViewer } from '../../components/admin/CustomersViewer';
import { FeedbackViewer } from '../../components/admin/FeedbackViewer';

// Industry config
const industryConfig = {
  automotive: {
    icon: '🚗',
    name: 'Otomotiv',
  },
  beauty: {
    icon: '💅',
    name: 'Güzellik Salonu',
  },
  beauty_salon: {
    icon: '💅',
    name: 'Güzellik Salonu',
  },
  hairdresser: {
    icon: '✂️',
    name: 'Kuaför',
  },
};

// Tab configuration
const tabs = [
  { id: 'general', label: 'Genel', icon: Building2 },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'voice', label: 'Ses Ayarları', icon: Mic },
  { id: 'usecases', label: 'Use Cases', icon: Settings },
  { id: 'features', label: 'Özellikler', icon: Settings },
];

// Default use cases per industry
const INDUSTRY_USE_CASES = {
  automotive: [
    { id: 'test_drive', name: 'Test Sürüşü Randevusu', description: 'Araç test sürüşü randevusu alma' },
    { id: 'service', name: 'Servis Randevusu', description: 'Araç servis ve bakım randevusu' },
    { id: 'vehicle_inquiry', name: 'Araç Bilgi Sorgulama', description: 'Stok ve araç detayları hakkında bilgi' },
    { id: 'price_inquiry', name: 'Fiyat Bilgisi', description: 'Araç fiyatları ve kampanyalar' },
    { id: 'callback', name: 'Geri Arama Talebi', description: 'Müşteri geri arama kaydı' },
  ],
  beauty: [
    { id: 'appointment', name: 'Randevu Alma', description: 'Güzellik hizmeti randevusu' },
    { id: 'service_inquiry', name: 'Hizmet Bilgisi', description: 'Sunulan hizmetler hakkında bilgi' },
    { id: 'price_inquiry', name: 'Fiyat Bilgisi', description: 'Hizmet fiyatları' },
    { id: 'availability', name: 'Müsaitlik Sorgulama', description: 'Randevu müsaitliği kontrolü' },
    { id: 'callback', name: 'Geri Arama Talebi', description: 'Müşteri geri arama kaydı' },
  ],
  beauty_salon: [
    { id: 'beauty_services', name: 'Güzellik Hizmetleri', description: 'Cilt, tırnak, makyaj ve SPA hizmetleri' },
    { id: 'appointment', name: 'Randevu Alma', description: 'Güzellik hizmeti randevusu' },
    { id: 'staff_selection', name: 'Personel Seçimi', description: 'Personel tercihi (opsiyonel)' },
    { id: 'price_inquiry', name: 'Fiyat Bilgisi', description: 'Hizmet fiyatları' },
    { id: 'promotions', name: 'Kampanyalar', description: 'Aktif kampanyalar ve indirimler' },
    { id: 'loyalty', name: 'Sadakat Programı', description: 'Puan sorgulama ve üyelik' },
  ],
  hairdresser: [
    { id: 'hairdresser_services', name: 'Kuaför Hizmetleri', description: 'Saç kesimi, boyama ve fön hizmetleri' },
    { id: 'appointment', name: 'Randevu Alma', description: 'Kuaför randevusu' },
    { id: 'staff_selection', name: 'Kuaför Seçimi', description: 'Kuaför tercihi (önemli!)' },
    { id: 'price_inquiry', name: 'Fiyat Bilgisi', description: 'Hizmet fiyatları' },
    { id: 'customer_history', name: 'Müşteri Geçmişi', description: 'Önceki stili hatırlama' },
    { id: 'callback', name: 'Geri Arama Talebi', description: 'Müşteri geri arama kaydı' },
  ],
};

// Use Case to Required Data mapping
const USE_CASE_DATA_REQUIREMENTS = {
  business_info: { component: 'WorkingHoursEditor', label: 'Çalışma Saatleri' },
  test_drive: { component: 'VehicleCatalogEditor', label: 'Araç Kataloğu' },
  beauty_services: { component: 'BeautyServicesEditor', label: 'Hizmet Kataloğu' },
  hairdresser_services: { component: 'BeautyServicesEditor', label: 'Hizmet Kataloğu' },
  staff_selection: { component: 'StaffEditor', label: 'Personel Listesi' },
  promotions: { component: 'PromotionsEditor', label: 'Kampanya Yönetimi' },
};

/**
 * Tenant Detail Page - View and edit tenant information
 */
export const TenantDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // Action states
  const [syncing, setSyncing] = useState(false);
  const [testingCall, setTestingCall] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Use Cases state
  const [availableUseCases, setAvailableUseCases] = useState([]);
  const [tenantUseCases, setTenantUseCases] = useState([]);
  const [useCasesLoading, setUseCasesLoading] = useState(false);
  const [useCasesSaving, setUseCasesSaving] = useState(false);

  useEffect(() => {
    fetchTenant();
  }, [id]);

  const fetchTenant = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getTenant(id);
      const tenantData = response.data.data || response.data;
      setTenant(tenantData);
      setEditData(tenantData);

      // Tenant yüklendikten sonra use case'leri çek
      if (tenantData?.industry) {
        fetchUseCases(tenantData.industry);
      }
    } catch (error) {
      console.error('Failed to fetch tenant:', error);
      alert('Tenant bulunamadı');
      navigate('/admin/tenants');
    } finally {
      setLoading(false);
    }
  };

  const fetchUseCases = async (industry) => {
    try {
      setUseCasesLoading(true);

      // Admin endpoint'inden tenant'ın use case'lerini çek
      const response = await adminAPI.getTenantUseCases(id);
      const data = response.data;

      // Mevcut use case'leri set et
      setAvailableUseCases(data.available || []);
      // Aktif use case ID'lerini set et
      setTenantUseCases(data.enabled || []);
    } catch (error) {
      console.error('Failed to fetch use cases:', error);
      // Hata durumunda statik listeye düş
      const industryUseCases = INDUSTRY_USE_CASES[industry] || INDUSTRY_USE_CASES.automotive;
      setAvailableUseCases(industryUseCases);
      setTenantUseCases([]);
    } finally {
      setUseCasesLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await adminAPI.updateTenant(id, editData);
      setTenant(editData);
      setHasChanges(false);
      setIsEditing(false);
      alert('Değişiklikler kaydedildi');
    } catch (error) {
      console.error('Failed to save tenant:', error);
      alert('Kaydetme hatası: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData(tenant);
    setHasChanges(false);
    setIsEditing(false);
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await adminAPI.syncTenant(id);
      alert('VAPI sync başarılı!');
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync hatası: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleTestCall = async () => {
    if (!tenant.phone) {
      alert('Tenant telefon numarası bulunamadı');
      return;
    }
    try {
      setTestingCall(true);
      // This would initiate a test call through VAPI
      await adminAPI.initiateTestCall(id);
      alert('Test araması başlatıldı!');
    } catch (error) {
      console.error('Test call failed:', error);
      alert('Test araması hatası: ' + error.message);
    } finally {
      setTestingCall(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await adminAPI.deleteTenant(id);
      alert('Tenant silindi');
      navigate('/admin/tenants');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Silme hatası: ' + error.message);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusInfo = () => {
    if (tenant?.is_active) {
      return { variant: 'success', label: 'Aktif', icon: CheckCircle };
    }
    if (tenant?.onboarding_step) {
      return { variant: 'warning', label: `Onboarding (${tenant.onboarding_step}/4)`, icon: Clock };
    }
    return { variant: 'error', label: 'Pasif', icon: XCircle };
  };

  const industry = tenant ? industryConfig[tenant.industry] || {} : {};

  // Tab content renderers
  const renderGeneralTab = () => (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Input
            label="Firma Adı"
            value={editData.name || ''}
            onChange={(e) => handleInputChange('name', e.target.value)}
            disabled={!isEditing}
          />
          <Input
            label="Email"
            type="email"
            value={editData.email || ''}
            onChange={(e) => handleInputChange('email', e.target.value)}
            disabled={!isEditing}
          />
          <Input
            label="Telefon"
            type="tel"
            value={editData.phone || ''}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            disabled={!isEditing}
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Sektör</label>
            <div className="input bg-slate-50 flex items-center gap-2">
              <span className="text-xl">{industry.icon}</span>
              <span>{industry.name || tenant?.industry}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Durum</label>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusInfo().variant}>
                {getStatusInfo().label}
              </Badge>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Oluşturulma Tarihi</label>
            <div className="input bg-slate-50">
              {formatDate(tenant?.created_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="pt-6 border-t border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Ek Ayarlar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Slug"
            value={editData.slug || ''}
            onChange={(e) => handleInputChange('slug', e.target.value)}
            disabled={!isEditing}
          />
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Varsayılan Dil</label>
            <select
              value={editData.default_language || 'tr'}
              onChange={(e) => handleInputChange('default_language', e.target.value)}
              disabled={!isEditing}
              className="input w-full"
            >
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
          <Input
            label="Asistan Adı"
            value={editData.assistant_name || ''}
            onChange={(e) => handleInputChange('assistant_name', e.target.value)}
            disabled={!isEditing}
          />
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Plan</label>
            <select
              value={editData.plan || 'starter'}
              onChange={(e) => handleInputChange('plan', e.target.value)}
              disabled={!isEditing}
              className="input w-full"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users */}
      {tenant?.users && tenant.users.length > 0 && (
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Kullanıcılar</h3>
          <div className="space-y-2">
            {tenant.users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-slate-900 font-medium">{user.name || user.email}</div>
                    <div className="text-sm text-slate-500">{user.email}</div>
                  </div>
                </div>
                <Badge variant={user.is_active ? 'success' : 'error'}>
                  {user.role}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderBrandingTab = () => {
    return (
      <div className="space-y-6">
        {/* Logo */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Logo</h3>
          <div className="flex items-start gap-6">
            <div className="w-32 h-32 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
              {editData.logo_url ? (
                <img
                  src={editData.logo_url}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Image className="w-12 h-12 text-slate-400" />
              )}
            </div>
            <div className="flex-1 space-y-3">
              <Input
                label="Logo URL"
                placeholder="https://example.com/logo.png"
                value={editData.logo_url || ''}
                onChange={(e) => handleInputChange('logo_url', e.target.value)}
                disabled={!isEditing}
              />
              <p className="text-sm text-slate-500">
                Önerilen boyut: 200x200 piksel, PNG veya SVG formatı
              </p>
            </div>
          </div>
        </div>

        {/* Favicon */}
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Favicon</h3>
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
              {editData.favicon_url ? (
                <img
                  src={editData.favicon_url}
                  alt="Favicon"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Globe className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <Input
                label="Favicon URL"
                placeholder="https://example.com/favicon.ico"
                value={editData.favicon_url || ''}
                onChange={(e) => handleInputChange('favicon_url', e.target.value)}
                disabled={!isEditing}
              />
              <p className="text-sm text-slate-500 mt-2">
                Önerilen boyut: 32x32 veya 64x64 piksel, ICO veya PNG formatı
              </p>
            </div>
          </div>
        </div>

        {/* Primary Color */}
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Renk Şeması</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Ana Renk</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={editData.primary_color || '#4f46e5'}
                  onChange={(e) => handleInputChange('primary_color', e.target.value)}
                  disabled={!isEditing}
                  className="w-12 h-12 rounded-lg cursor-pointer border-2 border-slate-200"
                />
                <Input
                  value={editData.primary_color || '#4f46e5'}
                  onChange={(e) => handleInputChange('primary_color', e.target.value)}
                  disabled={!isEditing}
                  placeholder="#4f46e5"
                  className="flex-1"
                />
              </div>
              <p className="text-sm text-slate-500 mt-2">
                Butonlar, linkler ve vurgulanan elementler için kullanılır
              </p>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Önizleme</label>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                <button
                  className="px-4 py-2 rounded-lg text-white font-medium"
                  style={{ backgroundColor: editData.primary_color || '#4f46e5' }}
                >
                  Örnek Buton
                </button>
                <p>
                  <a
                    href="#"
                    className="hover:underline"
                    style={{ color: editData.primary_color || '#4f46e5' }}
                    onClick={(e) => e.preventDefault()}
                  >
                    Örnek Link
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Login Message */}
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Login Sayfası</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Hoş Geldin Mesajı</label>
              <textarea
                value={editData.login_message || ''}
                onChange={(e) => handleInputChange('login_message', e.target.value)}
                disabled={!isEditing}
                placeholder="Örn: Prestige Auto'ya Hoş Geldiniz"
                className="input w-full h-20 resize-none"
              />
              <p className="text-sm text-slate-500 mt-2">
                Login sayfasında başlığın altında gösterilir (opsiyonel)
              </p>
            </div>
          </div>
        </div>

        {/* Branding Preview */}
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Branding Önizlemesi</h3>
          <div className="p-6 rounded-xl bg-gradient-to-br from-slate-100 via-white to-slate-50 border border-slate-200">
            <div className="text-center">
              {editData.logo_url ? (
                <img
                  src={editData.logo_url}
                  alt="Logo Preview"
                  className="h-16 w-auto mx-auto mb-4 object-contain"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: editData.primary_color || '#4f46e5' }}
                >
                  <Phone className="w-8 h-8 text-white" />
                </div>
              )}
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{editData.name || 'Tenant Name'}</h2>
              <p className="text-slate-500">{editData.login_message || 'Hoş geldiniz'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderVoiceTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-slate-900">Ses Ayarları</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">TTS Sağlayıcı</label>
          <select
            value={editData.tts_provider || 'deepgram'}
            onChange={(e) => handleInputChange('tts_provider', e.target.value)}
            disabled={!isEditing}
            className="input w-full"
          >
            <option value="deepgram">Deepgram</option>
            <option value="elevenlabs">ElevenLabs</option>
            <option value="playht">PlayHT</option>
          </select>
        </div>

        <Input
          label="Voice ID"
          value={editData.elevenlabs_voice_id || ''}
          onChange={(e) => handleInputChange('elevenlabs_voice_id', e.target.value)}
          disabled={!isEditing}
          placeholder="Örn: EXAVITQu4vr4xnSDxMaL"
        />
      </div>

      {/* Voice Config Override */}
      {tenant?.voice_config_override && (
        <div className="pt-6 border-t border-slate-200">
          <h4 className="text-md font-semibold text-slate-900 mb-4">Özel Ayarlar</h4>
          <div className="p-4 rounded-lg bg-slate-50">
            <pre className="text-sm text-slate-700 overflow-auto">
              {JSON.stringify(tenant.voice_config_override, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* VAPI Assistant IDs */}
      <div className="pt-6 border-t border-slate-200">
        <h4 className="text-md font-semibold text-slate-900 mb-4">VAPI Asistanları</h4>
        <div className="space-y-2">
          {['tr', 'en', 'de'].map((lang) => {
            const assistantId = tenant?.[`vapi_assistant_id_${lang}`];
            return (
              <div key={lang} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <span className="text-slate-600 uppercase">{lang}</span>
                {assistantId ? (
                  <code className="text-sm text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                    {assistantId}
                  </code>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderUseCasesTab = () => {
    // API'den çekilen use case'leri kullan, yoksa statik listeye düş
    const industryUseCases = availableUseCases.length > 0
      ? availableUseCases
      : (INDUSTRY_USE_CASES[tenant?.industry] || INDUSTRY_USE_CASES.automotive);

    const handleUseCaseToggle = async (useCaseId) => {
      const isCurrentlyEnabled = tenantUseCases.includes(useCaseId);
      const newTenantUseCases = isCurrentlyEnabled
        ? tenantUseCases.filter(id => id !== useCaseId)
        : [...tenantUseCases, useCaseId];

      setTenantUseCases(newTenantUseCases);
      setHasChanges(true);
    };

    const handleSelectAll = () => {
      const allIds = industryUseCases.map(uc => uc.id);
      setTenantUseCases(allIds);
      setHasChanges(true);
    };

    const handleDeselectAll = () => {
      setTenantUseCases([]);
      setHasChanges(true);
    };

    const handleSaveUseCases = async () => {
      try {
        setUseCasesSaving(true);
        // Admin olarak tenant'ın use case'lerini kaydet ve sync et
        await adminAPI.setTenantUseCases(id, tenantUseCases, true);
        alert('Use case\'ler kaydedildi ve VAPI\'ye sync edildi!');
        setHasChanges(false);
      } catch (error) {
        console.error('Failed to save use cases:', error);
        alert('Use case kaydetme hatası: ' + error.message);
      } finally {
        setUseCasesSaving(false);
      }
    };

    if (useCasesLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Use Cases (Özellikler)</h3>
            <p className="text-sm text-slate-500 mt-1">
              Asistanın kullanacağı özellikleri seçin. Seçilen özellikler VAPI asistanına sync edilir.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
            >
              Tümünü Seç
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeselectAll}
            >
              Tümünü Kaldır
            </Button>
          </div>
        </div>

        {industryUseCases.length === 0 ? (
          <div className="p-8 rounded-xl border-2 border-dashed border-slate-300 text-center">
            <Wrench className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <p className="text-slate-600">Bu sektör için henüz use case tanımlanmamış.</p>
            <p className="text-sm text-slate-500 mt-2">
              Admin panelden use case ekleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {industryUseCases.map((useCase) => {
              const isEnabled = tenantUseCases.includes(useCase.id);
              return (
                <div
                  key={useCase.id}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    isEnabled
                      ? 'bg-indigo-50 border-indigo-300 hover:bg-indigo-100'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                  onClick={() => handleUseCaseToggle(useCase.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isEnabled ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300'
                    }`}>
                      {isEnabled && <CheckCircle className="w-3 h-3" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`font-medium ${isEnabled ? 'text-slate-900' : 'text-slate-600'}`}>
                          {useCase.name}
                        </p>
                        {useCase.category && (
                          <Badge variant="info" className="text-xs">
                            {useCase.category}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        {useCase.description}
                      </p>
                      {useCase.tools && useCase.tools.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {useCase.tools.slice(0, 3).map((tool, idx) => (
                            <span key={idx} className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                              {typeof tool === 'string' ? tool : tool.name}
                            </span>
                          ))}
                          {useCase.tools.length > 3 && (
                            <span className="text-xs text-slate-400">+{useCase.tools.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Save & Sync */}
        <div className="pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-blue-800 font-medium">Kaydet & VAPI Sync</p>
                <p className="text-sm text-blue-600">
                  Use case değişikliklerini kaydedin ve VAPI asistanına sync edin.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sadece Sync
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveUseCases}
                disabled={useCasesSaving}
              >
                {useCasesSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Kaydet & Sync
              </Button>
            </div>
          </div>
        </div>

        {/* Current Status */}
        <div className="pt-6 border-t border-slate-200">
          <h4 className="text-md font-semibold text-slate-900 mb-4">
            Aktif Özellikler ({tenantUseCases.length})
          </h4>
          {tenantUseCases.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tenantUseCases.map((ucId) => {
                const uc = industryUseCases.find(u => u.id === ucId);
                return uc ? (
                  <Badge key={ucId} variant="success">
                    {uc.name}
                  </Badge>
                ) : null;
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Henüz hiçbir özellik seçilmedi.</p>
          )}
        </div>

        {/* Management Panels - Always show */}
        <div className="pt-6 border-t border-slate-200">
          <h4 className="text-md font-semibold text-slate-900 mb-4">
            Yönetim Panelleri
          </h4>
          <p className="text-sm text-slate-500 mb-4">
            Randevuları, müşterileri ve geri bildirimleri buradan yönetebilirsiniz.
          </p>
          <div className="space-y-4">
            {/* Randevu Yönetimi - her zaman göster */}
            <AppointmentsViewer tenantId={id} />

            {/* Müşteri Listesi - her zaman göster */}
            <CustomersViewer tenantId={id} />

            {/* Geri Bildirimler - her zaman göster */}
            <FeedbackViewer tenantId={id} />
          </div>
        </div>

        {/* Required Data Editors based on selected use cases */}
        {tenantUseCases.length > 0 && (
          <div className="pt-6 border-t border-slate-200">
            <h4 className="text-md font-semibold text-slate-900 mb-4">
              Gerekli Veriler
            </h4>
            <p className="text-sm text-slate-500 mb-4">
              Seçili use case'lerin çalışması için gereken verileri aşağıdan yönetebilirsiniz.
            </p>
            <div className="space-y-4">
              {/* Takvim & Slot Yönetimi - her zaman göster (çalışma saatleri dahil) */}
              <SlotManagerEditor
                tenantId={id}
                tenant={tenant}
                onTenantUpdate={(updatedTenant) => setTenant(updatedTenant)}
              />

              {/* test_drive seçiliyse */}
              {tenantUseCases.includes('test_drive') && (
                <VehicleCatalogEditor tenantId={id} />
              )}

              {/* beauty_services veya hairdresser_services seçiliyse */}
              {(tenantUseCases.includes('beauty_services') || tenantUseCases.includes('hairdresser_services')) && (
                <BeautyServicesEditor tenantId={id} />
              )}

              {/* staff_selection seçiliyse */}
              {tenantUseCases.includes('staff_selection') && (
                <StaffEditor tenantId={id} />
              )}

              {/* promotions seçiliyse */}
              {tenantUseCases.includes('promotions') && (
                <PromotionsEditor tenantId={id} />
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFeaturesTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-slate-900">Özellikler & İstatistikler</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="w-8 h-8 mx-auto text-indigo-600 mb-2" />
            <div className="text-2xl font-bold text-slate-900">
              {tenant?.stats?.totalAppointments || 0}
            </div>
            <div className="text-sm text-slate-500">Toplam Randevu</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
            <div className="text-2xl font-bold text-slate-900">
              {tenant?.stats?.totalCustomers || 0}
            </div>
            <div className="text-sm text-slate-500">Müşteri</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <PhoneCall className="w-8 h-8 mx-auto text-blue-500 mb-2" />
            <div className="text-2xl font-bold text-slate-900">
              {tenant?.stats?.totalCalls || 0}
            </div>
            <div className="text-sm text-slate-500">Arama</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
            <div className="text-2xl font-bold text-slate-900">
              {tenant?.onboarding_step ? `${tenant.onboarding_step}/4` : 'Tamamlandı'}
            </div>
            <div className="text-sm text-slate-500">Onboarding</div>
          </CardContent>
        </Card>
      </div>

      {/* Supported Languages */}
      <div className="pt-6 border-t border-slate-200">
        <h4 className="text-md font-semibold text-slate-900 mb-4">Desteklenen Diller</h4>
        <div className="flex gap-2">
          {(tenant?.supported_languages || ['tr']).map((lang) => (
            <Badge key={lang} variant="info">
              {lang.toUpperCase()}
            </Badge>
          ))}
        </div>
      </div>

      {/* Functions */}
      {tenant?.enabled_functions && (
        <div className="pt-6 border-t border-slate-200">
          <h4 className="text-md font-semibold text-slate-900 mb-4">Etkin Fonksiyonlar</h4>
          <div className="flex flex-wrap gap-2">
            {tenant.enabled_functions.map((func, idx) => (
              <Badge key={idx} variant="success">
                {func}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900">Tenant bulunamadı</h2>
        <Button
          variant="primary"
          className="mt-4"
          onClick={() => navigate('/admin/tenants')}
        >
          Tenant Listesine Dön
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/tenants')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">
              {industry.icon || '🏢'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{tenant.name}</h1>
              <p className="text-slate-500">{tenant.email}</p>
            </div>
          </div>
          <Badge variant={getStatusInfo().variant}>
            {getStatusInfo().label}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges ? (
            <>
              <Button variant="ghost" onClick={handleCancel} disabled={saving}>
                İptal
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Kaydet
              </Button>
            </>
          ) : (
            <>
              <Button
                variant={isEditing ? 'primary' : 'secondary'}
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit3 className="w-4 h-4 mr-2" />
                {isEditing ? 'Düzenlemeyi Bitir' : 'Düzenle'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="text-slate-500">Hızlı İşlemler:</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestCall}
              disabled={testingCall}
            >
              {testingCall ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PhoneCall className="w-4 h-4 mr-2" />
              )}
              Test Araması
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              VAPI Sync
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-slate-500 border-transparent hover:text-slate-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <Card>
        <CardContent>
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'branding' && renderBrandingTab()}
          {activeTab === 'voice' && renderVoiceTab()}
          {activeTab === 'usecases' && renderUseCasesTab()}
          {activeTab === 'features' && renderFeaturesTab()}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Tenant'ı Sil"
        size="sm"
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-slate-600">
            <span className="font-semibold text-slate-900">{tenant?.name}</span> tenant'ını silmek istediğinize emin misiniz?
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Bu işlem geri alınamaz.
          </p>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
            İptal
          </Button>
          <Button
            variant="primary"
            className="!bg-red-500 hover:!bg-red-600"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Sil
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
