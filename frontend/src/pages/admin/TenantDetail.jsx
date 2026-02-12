import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HexColorPicker } from 'react-colorful';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Building2,
  Phone,
  Clock,
  Settings,
  Save,
  Trash2,
  RefreshCw,
  PhoneCall,
  CheckCircle,
  XCircle,
  Loader2,
  Users,
  Edit3,
  Palette,
  Image,
  Globe,
  Wrench,
  Upload,
  Check,
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
import { TemplateSelector } from '../../components/admin/TemplateSelector';

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
  { id: 'assistant', label: 'Asistan', icon: Settings },
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

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [tenantTemplate, setTenantTemplate] = useState(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // File upload state
  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [dragOverLogo, setDragOverLogo] = useState(false);
  const [dragOverFavicon, setDragOverFavicon] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef(null);

  // Close color picker on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowColorPicker(false);
      }
    };
    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

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

      // Tenant yüklendikten sonra use case'leri ve şablonları paralel çek
      if (tenantData?.industry) {
        await Promise.all([
          fetchUseCases(tenantData.industry),
          fetchTemplates(tenantData.industry),
          fetchTenantTemplate(),
        ]);
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

  const fetchTemplates = async (industry) => {
    try {
      setTemplatesLoading(true);
      const response = await adminAPI.getTemplates({ industry });
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const fetchTenantTemplate = async () => {
    try {
      const response = await adminAPI.getTenantTemplate(id);
      setTenantTemplate(response.data);
    } catch (error) {
      console.error('Failed to fetch tenant template:', error);
      setTenantTemplate(null);
    }
  };

  const handleTemplateAssigned = async (templateId) => {
    try {
      await adminAPI.assignTenantTemplate(id, templateId, true);
      alert('Şablon atandı ve VAPI\'ye sync edildi!');
      // Refresh data
      await fetchTenantTemplate();
      await fetchUseCases(tenant.industry);
    } catch (error) {
      console.error('Failed to assign template:', error);
      throw error;
    }
  };

  const handleInputChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { name, email, phone, assistant_name, logo_url, favicon_url,
              primary_color, login_message, welcome_message, default_language } = editData;
      const payload = {
        name, email, phone, assistant_name, logo_url, favicon_url,
        primary_color, login_message, welcome_message, default_language
      };
      const response = await adminAPI.updateTenant(id, payload);
      const updated = response.data.data || response.data;
      setTenant(prev => ({ ...prev, ...updated }));
      setEditData(prev => ({ ...prev, ...updated }));
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

  const handleFileUpload = useCallback(async (file, type) => {
    if (!file) return;
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Dosya boyutu 2MB\'den küçük olmalı');
      return;
    }
    const setUploading = type === 'logo' ? setUploadingLogo : setUploadingFavicon;
    try {
      setUploading(true);
      const response = await adminAPI.uploadTenantAsset(id, file, type);
      const url = response.data.url;
      const field = type === 'logo' ? 'logo_url' : 'favicon_url';
      handleInputChange(field, url);
    } catch (error) {
      console.error(`Upload ${type} failed:`, error);
      alert(`Yükleme hatası: ${error.response?.data?.error || error.message}`);
    } finally {
      setUploading(false);
    }
  }, [id]);

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

  const PRESET_COLORS = [
    // Row 1 - Vibrant
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    // Row 2 - Deep
    '#dc2626', '#ea580c', '#d97706', '#ca8a04',
    '#65a30d', '#16a34a', '#059669', '#0d9488',
    '#0891b2', '#0284c7', '#2563eb', '#4f46e5',
    '#7c3aed', '#9333ea', '#c026d3', '#db2777',
    // Row 3 - Dark
    '#991b1b', '#9a3412', '#92400e', '#854d0e',
    '#3f6212', '#166534', '#065f46', '#115e59',
    '#155e75', '#075985', '#1e40af', '#4338ca',
    '#5b21b6', '#6b21a8', '#86198f', '#9d174d',
  ];

  const renderBrandingTab = () => {
    const primaryColor = editData.primary_color || '#4f46e5';

    const handleDrop = (e, type) => {
      e.preventDefault();
      const setDragOver = type === 'logo' ? setDragOverLogo : setDragOverFavicon;
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file, type);
    };

    const handleDragOver = (e, type) => {
      e.preventDefault();
      const setDragOver = type === 'logo' ? setDragOverLogo : setDragOverFavicon;
      setDragOver(true);
    };

    const handleDragLeave = (e, type) => {
      e.preventDefault();
      const setDragOver = type === 'logo' ? setDragOverLogo : setDragOverFavicon;
      setDragOver(false);
    };

    return (
      <div className="space-y-6">
        {/* Logo */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Logo</h3>
          <div className="flex items-start gap-6">
            <div
              className={`w-32 h-32 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-all cursor-pointer group relative ${
                dragOverLogo
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50'
              }`}
              onClick={() => isEditing && logoInputRef.current?.click()}
              onDrop={(e) => isEditing && handleDrop(e, 'logo')}
              onDragOver={(e) => isEditing && handleDragOver(e, 'logo')}
              onDragLeave={(e) => isEditing && handleDragLeave(e, 'logo')}
            >
              {uploadingLogo ? (
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              ) : editData.logo_url ? (
                <>
                  <img src={editData.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  {isEditing && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center p-2">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                  <span className="text-xs text-slate-400">Yükle</span>
                </div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files[0]) handleFileUpload(e.target.files[0], 'logo');
                  e.target.value = '';
                }}
              />
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
                Dosya yükleyin veya URL girin. Önerilen: 200x200px, PNG/SVG
              </p>
            </div>
          </div>
        </div>

        {/* Favicon */}
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Favicon</h3>
          <div className="flex items-start gap-6">
            <div
              className={`w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden transition-all cursor-pointer group relative ${
                dragOverFavicon
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50'
              }`}
              onClick={() => isEditing && faviconInputRef.current?.click()}
              onDrop={(e) => isEditing && handleDrop(e, 'favicon')}
              onDragOver={(e) => isEditing && handleDragOver(e, 'favicon')}
              onDragLeave={(e) => isEditing && handleDragLeave(e, 'favicon')}
            >
              {uploadingFavicon ? (
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              ) : editData.favicon_url ? (
                <>
                  <img src={editData.favicon_url} alt="Favicon" className="w-full h-full object-contain" />
                  {isEditing && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="w-4 h-4 text-white" />
                    </div>
                  )}
                </>
              ) : (
                <Upload className="w-5 h-5 text-slate-400" />
              )}
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files[0]) handleFileUpload(e.target.files[0], 'favicon');
                  e.target.value = '';
                }}
              />
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
                Dosya yükleyin veya URL girin. Önerilen: 32x32px, ICO/PNG
              </p>
            </div>
          </div>
        </div>

        {/* Primary Color */}
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Renk Şeması</h3>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-3">Ana Renk</label>

            {/* Color swatch + hex input + preview row */}
            <div className="flex items-center gap-4 mb-4">
              {/* Clickable color swatch that opens popup */}
              <div className="relative" ref={colorPickerRef}>
                <button
                  type="button"
                  disabled={!isEditing}
                  onClick={() => isEditing && setShowColorPicker(!showColorPicker)}
                  className={`w-12 h-12 rounded-xl border-2 border-slate-200 shadow-sm transition-all ${
                    isEditing ? 'cursor-pointer hover:scale-105 hover:shadow-md' : 'cursor-not-allowed opacity-60'
                  }`}
                  style={{ backgroundColor: primaryColor }}
                  title="Renk seçici aç"
                />

                {/* Color Picker Popup */}
                {showColorPicker && isEditing && (
                  <div className="absolute top-14 left-0 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-[280px]">
                    {/* Arrow */}
                    <div className="absolute -top-2 left-4 w-4 h-4 bg-white border-l border-t border-slate-200 rotate-45" />

                    {/* Spectrum Picker */}
                    <div className="relative rounded-xl overflow-hidden mb-4" style={{ height: '160px' }}>
                      <HexColorPicker
                        color={primaryColor}
                        onChange={(color) => handleInputChange('primary_color', color)}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>

                    {/* Preset Swatches */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-slate-400 mb-2">Hazır Renkler</label>
                      <div className="grid grid-cols-16 gap-1" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
                        {PRESET_COLORS.map((color, idx) => (
                          <button
                            key={`${color}-${idx}`}
                            type="button"
                            onClick={() => handleInputChange('primary_color', color)}
                            className={`w-full aspect-square rounded-sm transition-all ${
                              primaryColor.toLowerCase() === color.toLowerCase()
                                ? 'ring-2 ring-slate-900 ring-offset-1 scale-125 z-10'
                                : 'hover:scale-125 hover:z-10'
                            }`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Hex Input inside popup */}
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg border border-slate-200 flex-shrink-0"
                        style={{ backgroundColor: primaryColor }}
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.match(/^#[0-9a-fA-F]{0,6}$/)) {
                            handleInputChange('primary_color', val);
                          }
                        }}
                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="#4f46e5"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Hex Input */}
              <Input
                value={primaryColor}
                onChange={(e) => handleInputChange('primary_color', e.target.value)}
                disabled={!isEditing}
                placeholder="#4f46e5"
                className="flex-1 max-w-[160px]"
              />

              {/* Inline preview */}
              <div className="flex items-center gap-3 ml-auto">
                <button
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: primaryColor }}
                >
                  Örnek Buton
                </button>
                <a
                  href="#"
                  className="text-sm hover:underline"
                  style={{ color: primaryColor }}
                  onClick={(e) => e.preventDefault()}
                >
                  Örnek Link
                </a>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Butonlar, linkler ve vurgulanan elementler için kullanılır. Renk kutusuna tıklayarak seçici açabilirsiniz.
            </p>
          </div>
        </div>

        {/* Dashboard Welcome Message */}
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Dashboard Karşılama Mesajı</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Karşılama Mesajı</label>
              <textarea
                value={editData.welcome_message || ''}
                onChange={(e) => handleInputChange('welcome_message', e.target.value)}
                disabled={!isEditing}
                placeholder="Örn: Prestige Auto Yönetim Paneline Hoş Geldiniz!"
                className="input w-full h-20 resize-none"
              />
              <p className="text-sm text-slate-500 mt-2">
                Tenant panelinde header'da gösterilir. Boş bırakılırsa varsayılan "Hoş Geldiniz, Kullanıcı Adı" gösterilir.
              </p>
            </div>

            {/* Dashboard Önizleme */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Önizleme</label>
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                {/* Mini browser chrome */}
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-200 border-b border-slate-300">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-0.5 bg-white rounded text-xs text-slate-400 max-w-xs truncate">
                      {editData.slug ? `${editData.slug}.canliasistan.com/dashboard` : 'tenant.canliasistan.com/dashboard'}
                    </div>
                  </div>
                </div>

                <div className="flex" style={{ minHeight: '220px' }}>
                  {/* Sidebar mockup */}
                  <div className="w-48 bg-slate-900 flex-shrink-0 p-4">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-6">
                      {editData.logo_url ? (
                        <img src={editData.logo_url} alt="Logo" className="h-8 w-8 rounded-lg object-contain bg-white p-0.5" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                          <Phone className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <span className="text-white text-sm font-semibold truncate">{editData.name || 'Firma'}</span>
                    </div>
                    {/* Nav items */}
                    <div className="space-y-1">
                      {['Dashboard', 'Aramalar', 'Randevular', 'Müşteriler', 'Ayarlar'].map((item, i) => (
                        <div
                          key={item}
                          className={`px-3 py-2 rounded-lg text-xs ${
                            i === 0 ? 'text-white' : 'text-slate-400'
                          }`}
                          style={i === 0 ? { backgroundColor: primaryColor } : {}}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Main content */}
                  <div className="flex-1">
                    {/* Header */}
                    <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                      <h2 className="text-base font-semibold text-slate-900 truncate">
                        {editData.welcome_message || `Hoş Geldiniz, ${tenant?.users?.[0]?.name || 'Kullanıcı Adı'}`}
                      </h2>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-4 h-4 rounded bg-slate-200" />
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                          style={{ backgroundColor: primaryColor }}>
                          {(tenant?.users?.[0]?.name || 'K')[0]}
                        </div>
                      </div>
                    </div>

                    {/* Dashboard body */}
                    <div className="p-4 bg-slate-50">
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Toplam Arama', value: '128' },
                          { label: 'Randevular', value: '24' },
                          { label: 'Müşteriler', value: '86' },
                        ].map((stat) => (
                          <div key={stat.label} className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="text-[10px] text-slate-500">{stat.label}</div>
                            <div className="text-lg font-bold text-slate-900 mt-0.5">{stat.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  };

  // Asistan modu: 'template' veya 'custom'
  const [assistantMode, setAssistantMode] = useState(
    tenantTemplate?.template_id ? 'template' : 'custom'
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(tenantTemplate?.template_id || null);

  // Update mode when template data loads
  useEffect(() => {
    if (tenantTemplate?.template_id) {
      setAssistantMode('template');
      setSelectedTemplateId(tenantTemplate.template_id);
    }
  }, [tenantTemplate]);

  // Seçili asistan detaylarını göster/gizle
  const [showCurrentDetails, setShowCurrentDetails] = useState(false);

  const renderAssistantTab = () => {
    const industryUseCases = availableUseCases.length > 0
      ? availableUseCases
      : (INDUSTRY_USE_CASES[tenant?.industry] || INDUSTRY_USE_CASES.automotive);

    const industryTemplates = templates.filter(t => t.industry === tenant?.industry);

    // Mevcut aktif şablon
    const currentTemplate = tenantTemplate?.template_id
      ? industryTemplates.find(t => t.id === tenantTemplate.template_id)
      : null;

    const tierColors = {
      basic: { bg: 'from-slate-50 to-slate-100', border: 'border-slate-200', badge: 'bg-slate-500', text: 'text-slate-700' },
      standard: { bg: 'from-blue-50 to-indigo-50', border: 'border-blue-200', badge: 'bg-blue-600', text: 'text-blue-700' },
      premium: { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', badge: 'bg-amber-600', text: 'text-amber-700' },
    };
    const tierLabels = { basic: 'Temel', standard: 'Standart', premium: 'Premium' };

    const handleUseCaseToggle = (useCaseId) => {
      const isCurrentlyEnabled = tenantUseCases.includes(useCaseId);
      const newTenantUseCases = isCurrentlyEnabled
        ? tenantUseCases.filter(id => id !== useCaseId)
        : [...tenantUseCases, useCaseId];
      setTenantUseCases(newTenantUseCases);
      setHasChanges(true);
    };

    const handleTemplateSelect = async (templateId) => {
      setSelectedTemplateId(templateId);
      setAssistantMode('template');
      setHasChanges(true);
    };

    const handleCustomSelect = () => {
      setAssistantMode('custom');
      setSelectedTemplateId(null);
      setHasChanges(true);
    };

    const handleSaveAndSync = async () => {
      try {
        setUseCasesSaving(true);

        if (assistantMode === 'template' && selectedTemplateId) {
          // Şablon modunda - şablonu ata
          await adminAPI.assignTenantTemplate(id, selectedTemplateId, true);
          await fetchTenantTemplate();
          await fetchUseCases(tenant.industry);
          alert('Şablon atandı ve VAPI\'ye sync edildi!');
        } else {
          // Özel modda - use case'leri kaydet
          await adminAPI.setTenantUseCases(id, tenantUseCases, true);
          alert('Özellikler kaydedildi ve VAPI\'ye sync edildi!');
        }

        setHasChanges(false);
      } catch (error) {
        console.error('Failed to save:', error);
        alert('Kaydetme hatası: ' + error.message);
      } finally {
        setUseCasesSaving(false);
      }
    };

    // Seçili şablonun özellikleri
    const selectedTemplate = industryTemplates.find(t => t.id === selectedTemplateId);

    if (useCasesLoading || templatesLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* SEÇİLİ ASISTAN KARTI - En üstte */}
        {(currentTemplate || tenantUseCases.length > 0) && (
          <div
            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
              currentTemplate
                ? `bg-gradient-to-r ${tierColors[currentTemplate.tier]?.bg || tierColors.standard.bg} ${tierColors[currentTemplate.tier]?.border || 'border-slate-200'}`
                : 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200'
            }`}
            onClick={() => setShowCurrentDetails(!showCurrentDetails)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  currentTemplate ? 'bg-white shadow-sm' : 'bg-purple-100'
                }`}>
                  {currentTemplate ? (
                    currentTemplate.tier === 'premium' ? (
                      <span className="text-3xl">👑</span>
                    ) : currentTemplate.tier === 'standard' ? (
                      <span className="text-3xl">⭐</span>
                    ) : (
                      <span className="text-3xl">📦</span>
                    )
                  ) : (
                    <Settings className="w-8 h-8 text-purple-600" />
                  )}
                </div>

                {/* Info */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-slate-500">Seçili Asistan:</span>
                    <span className={`px-2 py-0.5 rounded-full text-white text-xs font-bold ${
                      currentTemplate
                        ? (tierColors[currentTemplate.tier]?.badge || 'bg-blue-600')
                        : 'bg-purple-600'
                    }`}>
                      {currentTemplate ? tierLabels[currentTemplate.tier] : 'Özel'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {currentTemplate ? currentTemplate.name_tr : 'Özel Asistan'}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {currentTemplate
                      ? currentTemplate.description_tr
                      : `${tenantUseCases.length} özellik ile özelleştirilmiş asistan`
                    }
                  </p>

                  {/* Quick Stats */}
                  <div className="flex items-center gap-4 mt-3">
                    <span className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Wrench className="w-4 h-4" />
                      {currentTemplate
                        ? (currentTemplate.included_use_cases?.length || 0)
                        : tenantUseCases.length
                      } özellik
                    </span>
                    {tenantTemplate?.added_use_cases?.length > 0 && (
                      <span className="flex items-center gap-1 text-sm text-emerald-600">
                        <CheckCircle className="w-4 h-4" />
                        +{tenantTemplate.added_use_cases.length} eklendi
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expand/Collapse */}
              <div className="flex flex-col items-end gap-2">
                <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
                  AKTİF
                </span>
                <button className="p-2 hover:bg-white/50 rounded-lg transition-colors text-slate-400">
                  {showCurrentDetails ? '▲ Gizle' : '▼ Detaylar'}
                </button>
              </div>
            </div>

            {/* Expandable Details */}
            {showCurrentDetails && (
              <div className="mt-4 pt-4 border-t border-slate-200/50 space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">Aktif Özellikler:</h4>
                <div className="flex flex-wrap gap-2">
                  {(currentTemplate ? currentTemplate.included_use_cases : tenantUseCases)?.map((ucId) => {
                    const uc = industryUseCases.find(u => u.id === ucId);
                    return (
                      <span
                        key={ucId}
                        className="px-3 py-1.5 bg-white/80 text-slate-700 text-sm rounded-lg border border-slate-200 flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        {uc?.name_tr || ucId}
                      </span>
                    );
                  })}
                  {tenantTemplate?.added_use_cases?.map((ucId) => {
                    const uc = industryUseCases.find(u => u.id === ucId);
                    return (
                      <span
                        key={`added-${ucId}`}
                        className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm rounded-lg border border-emerald-200 flex items-center gap-1.5"
                      >
                        <span className="text-xs">+</span>
                        {uc?.name_tr || ucId}
                      </span>
                    );
                  })}
                </div>
                {tenantTemplate?.selected_at && (
                  <p className="text-xs text-slate-400 mt-2">
                    Seçilme tarihi: {new Date(tenantTemplate.selected_at).toLocaleDateString('tr-TR')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Asistan Bilgileri */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Asistan Bilgileri</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Asistan Adı"
              value={editData.assistant_name || ''}
              onChange={(e) => handleInputChange('assistant_name', e.target.value)}
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
          </div>
        </div>

        {/* Asistan Seçimi Başlık */}
        <div className="pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Asistan Değiştir</h3>
              <p className="text-sm text-slate-500 mt-1">
                {currentTemplate
                  ? `Mevcut: ${currentTemplate.name_tr} • Değiştirmek için yeni bir şablon seçin`
                  : tenantUseCases.length > 0
                  ? `Mevcut: Özel Asistan (${tenantUseCases.length} özellik) • Değiştirmek için seçin`
                  : 'Hazır bir şablon seçin veya özel asistan oluşturun'
                }
              </p>
            </div>
            {(currentTemplate || tenantUseCases.length > 0) && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                Yeşil kenarlı = Mevcut aktif
              </span>
            )}
          </div>
        </div>

        {/* Şablon Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Hazır Şablonlar */}
          {industryTemplates.map((template) => {
            const isSelected = assistantMode === 'template' && selectedTemplateId === template.id;
            const isCurrent = tenantTemplate?.template_id === template.id;
            const cardTierColors = {
              basic: 'from-slate-400 to-slate-500',
              standard: 'from-blue-500 to-indigo-600',
              premium: 'from-amber-500 to-orange-600',
            };
            const cardTierLabels = { basic: 'Basic', standard: 'Standard', premium: 'Premium' };

            return (
              <div
                key={template.id}
                onClick={() => handleTemplateSelect(template.id)}
                className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  isCurrent
                    ? 'border-emerald-500 bg-emerald-50 shadow-lg ring-2 ring-emerald-200'
                    : isSelected
                    ? 'border-indigo-500 bg-indigo-50 shadow-lg scale-[1.02]'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                }`}
              >
                {/* Tier Badge */}
                <div className={`absolute -top-3 left-4 px-3 py-1 rounded-full text-white text-xs font-bold bg-gradient-to-r ${cardTierColors[template.tier] || cardTierColors.standard}`}>
                  {cardTierLabels[template.tier] || 'Standard'}
                </div>

                {/* Mevcut Badge - daha belirgin */}
                {isCurrent && (
                  <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm">
                    <CheckCircle className="w-3 h-3" />
                    AKTİF
                  </div>
                )}

                {/* Seçim İndikatörü */}
                <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                }`}>
                  {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                </div>

                <div className="pt-4">
                  <h4 className="font-bold text-slate-900 text-lg mb-2">{template.name_tr}</h4>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">{template.description_tr}</p>

                  {/* Özellik Sayısı */}
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Wrench className="w-4 h-4" />
                    <span>{template.included_use_cases?.length || 0} özellik</span>
                  </div>

                  {/* Özellik Listesi */}
                  {template.included_use_cases && template.included_use_cases.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {template.included_use_cases.slice(0, 3).map((ucId, idx) => {
                        const uc = industryUseCases.find(u => u.id === ucId);
                        return (
                          <span key={idx} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {uc?.name_tr || ucId}
                          </span>
                        );
                      })}
                      {template.included_use_cases.length > 3 && (
                        <span className="text-xs text-slate-400">+{template.included_use_cases.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Özel Asistan Kartı */}
          {(() => {
            const isCustomCurrent = !tenantTemplate?.template_id && tenantUseCases.length > 0;
            return (
              <div
                onClick={handleCustomSelect}
                className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  isCustomCurrent
                    ? 'border-emerald-500 bg-emerald-50 shadow-lg ring-2 ring-emerald-200'
                    : assistantMode === 'custom'
                    ? 'border-purple-500 bg-purple-50 shadow-lg scale-[1.02]'
                    : 'border-dashed border-slate-300 bg-white hover:border-slate-400 hover:shadow-md'
                }`}
              >
                {/* Badge */}
                <div className="absolute -top-3 left-4 px-3 py-1 rounded-full text-white text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-600">
                  Özel
                </div>

                {/* Aktif Badge */}
                {isCustomCurrent && (
                  <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm">
                    <CheckCircle className="w-3 h-3" />
                    AKTİF
                  </div>
                )}

                {/* Seçim İndikatörü */}
                {!isCustomCurrent && (
                  <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    assistantMode === 'custom' ? 'border-purple-500 bg-purple-500' : 'border-slate-300'
                  }`}>
                    {assistantMode === 'custom' && <CheckCircle className="w-4 h-4 text-white" />}
                  </div>
                )}

                <div className="pt-4">
                  <h4 className="font-bold text-slate-900 text-lg mb-2">Özel Asistan</h4>
                  <p className="text-sm text-slate-500 mb-4">İstediğiniz özellikleri tek tek seçin</p>

                  <div className="flex items-center gap-2 text-sm text-purple-600">
                    <Settings className="w-4 h-4" />
                    <span>Tam kontrol</span>
                  </div>

                  {isCustomCurrent && (
                    <div className="mt-2 text-xs text-emerald-600">
                      {tenantUseCases.length} özellik aktif
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Seçili Şablonun Detayları veya Özel Seçim */}
        {assistantMode === 'template' && selectedTemplate && (
          <div className="p-6 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-semibold text-slate-900 text-lg">{selectedTemplate.name_tr}</h4>
                <p className="text-sm text-slate-600">{selectedTemplate.description_tr}</p>
              </div>
              <Badge variant="info">{selectedTemplate.included_use_cases?.length || 0} özellik</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {selectedTemplate.included_use_cases?.map((ucId) => {
                const uc = industryUseCases.find(u => u.id === ucId);
                return (
                  <div key={ucId} className="flex items-center gap-2 p-3 bg-white rounded-lg">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-sm text-slate-700">{uc?.name_tr || ucId}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {assistantMode === 'custom' && (
          <div className="p-6 bg-purple-50 border border-purple-200 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-slate-900 text-lg">Özellik Seçimi</h4>
                <p className="text-sm text-slate-600">Asistanınızın kullanacağı özellikleri seçin</p>
              </div>
              <Badge variant="info">{tenantUseCases.length} seçili</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {industryUseCases.map((useCase) => {
                const isEnabled = tenantUseCases.includes(useCase.id);
                return (
                  <div
                    key={useCase.id}
                    onClick={() => handleUseCaseToggle(useCase.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      isEnabled
                        ? 'bg-purple-100 border border-purple-300'
                        : 'bg-white border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isEnabled ? 'bg-purple-600 text-white' : 'bg-white border border-slate-300'
                    }`}>
                      {isEnabled && <CheckCircle className="w-3 h-3" />}
                    </div>
                    <div>
                      <p className={`font-medium text-sm ${isEnabled ? 'text-slate-900' : 'text-slate-600'}`}>
                        {useCase.name_tr || useCase.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {useCase.description_tr || useCase.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Kaydet Butonu */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <p className="font-medium text-slate-900">
              {assistantMode === 'template' ? `Seçili: ${selectedTemplate?.name_tr || 'Şablon seçin'}` : `${tenantUseCases.length} özellik seçili`}
            </p>
            <p className="text-sm text-slate-500">Değişiklikleri kaydetmek için butona tıklayın</p>
          </div>
          <Button
            variant="primary"
            onClick={handleSaveAndSync}
            disabled={useCasesSaving || !hasChanges}
          >
            {useCasesSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Kaydet & VAPI Sync
          </Button>
        </div>

        {/* Yönetim Panelleri */}
        <div className="pt-6 border-t border-slate-200">
          <h4 className="text-md font-semibold text-slate-900 mb-4">Yönetim Panelleri</h4>
          <div className="space-y-4">
            <AppointmentsViewer tenantId={id} />
            <CustomersViewer tenantId={id} />
            <FeedbackViewer tenantId={id} />
          </div>
        </div>

        {/* Gerekli Veriler */}
        {(assistantMode === 'custom' ? tenantUseCases.length > 0 : selectedTemplate?.included_use_cases?.length > 0) && (
          <div className="pt-6 border-t border-slate-200">
            <h4 className="text-md font-semibold text-slate-900 mb-4">Gerekli Veriler</h4>
            <div className="space-y-4">
              <SlotManagerEditor
                tenantId={id}
                tenant={tenant}
                onTenantUpdate={(updatedTenant) => setTenant(updatedTenant)}
              />

              {(assistantMode === 'custom' ? tenantUseCases.includes('test_drive') : selectedTemplate?.included_use_cases?.includes('test_drive')) && (
                <VehicleCatalogEditor tenantId={id} />
              )}

              {(assistantMode === 'custom'
                ? (tenantUseCases.includes('beauty_services') || tenantUseCases.includes('hairdresser_services'))
                : (selectedTemplate?.included_use_cases?.includes('beauty_services') || selectedTemplate?.included_use_cases?.includes('hairdresser_services'))
              ) && (
                <BeautyServicesEditor tenantId={id} />
              )}

              {(assistantMode === 'custom' ? tenantUseCases.includes('staff_selection') : selectedTemplate?.included_use_cases?.includes('staff_selection')) && (
                <StaffEditor tenantId={id} />
              )}

              {(assistantMode === 'custom' ? tenantUseCases.includes('promotions') : selectedTemplate?.included_use_cases?.includes('promotions')) && (
                <PromotionsEditor tenantId={id} />
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

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
          {activeTab === 'assistant' && renderAssistantTab()}
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
