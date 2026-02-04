import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Save,
  Bot,
  Package,
  Zap,
  Crown,
  Star,
  ChevronDown,
  ChevronUp,
  Check,
  Wrench,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { templateAPI } from '../../services/api';

// Tier configuration
const tierConfig = {
  basic: {
    label: 'Temel',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Package,
    gradient: 'from-slate-50 to-slate-100',
  },
  standard: {
    label: 'Standart',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Zap,
    gradient: 'from-blue-50 to-indigo-50',
  },
  premium: {
    label: 'Premium',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Crown,
    gradient: 'from-amber-50 to-orange-50',
  },
};

/**
 * Settings page component
 * Simplified - only basic company info
 * Voice settings and notifications are managed by admin
 */
export const Settings = () => {
  const { t } = useTranslation();
  const { tenantSettings, updateSettings } = useTenant();
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    phone: '',
    email: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Assistant/Template state
  const [assistantInfo, setAssistantInfo] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (tenantSettings) {
      setFormData({
        name: tenantSettings.name || '',
        industry: tenantSettings.industry || '',
        phone: tenantSettings.phone || '',
        email: tenantSettings.email || '',
        address: tenantSettings.address || '',
      });
    }
  }, [tenantSettings]);

  // Fetch assistant/template info
  useEffect(() => {
    const fetchAssistantInfo = async () => {
      try {
        setAssistantLoading(true);
        const response = await templateAPI.getMyTemplate();
        setAssistantInfo(response.data);
      } catch (err) {
        console.log('No template assigned or API not available');
        setAssistantInfo(null);
      } finally {
        setAssistantLoading(false);
      }
    };

    fetchAssistantInfo();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const updateData = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
      };

      const result = await updateSettings(updateData);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t('settings.title')}</h1>
        <p className="text-slate-500 mt-1">
          Configure your company and voice assistant settings
        </p>
      </div>

      {/* Selected Assistant Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            Seçili Asistan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assistantLoading ? (
            <div className="flex items-center gap-3 text-slate-500">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
              <span>Yükleniyor...</span>
            </div>
          ) : assistantInfo?.template ? (
            <div>
              {/* Main Info */}
              <div
                className={`p-4 rounded-xl bg-gradient-to-r ${tierConfig[assistantInfo.template.tier]?.gradient || 'from-slate-50 to-slate-100'} border border-slate-200 cursor-pointer transition-all hover:shadow-md`}
                onClick={() => setShowDetails(!showDetails)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="w-14 h-14 rounded-xl bg-white shadow-sm flex items-center justify-center">
                      {(() => {
                        const TierIcon = tierConfig[assistantInfo.template.tier]?.icon || Package;
                        return <TierIcon className="w-7 h-7 text-indigo-600" />;
                      })()}
                    </div>

                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {assistantInfo.template.name_tr || assistantInfo.template.name}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-lg border text-xs font-medium ${tierConfig[assistantInfo.template.tier]?.color}`}>
                          {tierConfig[assistantInfo.template.tier]?.label || assistantInfo.template.tier}
                        </span>
                        {assistantInfo.template.is_featured && (
                          <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            Önerilen
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        {assistantInfo.template.description_tr || assistantInfo.template.description}
                      </p>
                    </div>
                  </div>

                  {/* Expand Button */}
                  <button className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                    {showDetails ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Wrench className="w-4 h-4" />
                    {assistantInfo.effectiveUseCases?.length || assistantInfo.template.included_use_cases?.length || 0} özellik
                  </span>
                  {assistantInfo.added_use_cases?.length > 0 && (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      +{assistantInfo.added_use_cases.length} eklenmiş
                    </span>
                  )}
                </div>
              </div>

              {/* Expandable Details */}
              {showDetails && (
                <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  {/* Effective Use Cases */}
                  {assistantInfo.effectiveUseCases && assistantInfo.effectiveUseCases.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Wrench className="w-4 h-4" />
                        Aktif Özellikler
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {assistantInfo.effectiveUseCases.map((uc) => (
                          <span
                            key={uc}
                            className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-full border border-indigo-100"
                          >
                            {uc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Rules */}
                  {tenantSettings?.voice_config_override?.system_prompt_suffix && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Özel Kurallar
                      </h4>
                      <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 whitespace-pre-wrap">
                        {tenantSettings.voice_config_override.system_prompt_suffix.replace('## Özel Kurallar', '').trim()}
                      </div>
                    </div>
                  )}

                  {/* Template Meta */}
                  <div className="pt-3 border-t border-slate-200 text-xs text-slate-400">
                    Şablon ID: {assistantInfo.template_id} • Seçilme: {new Date(assistantInfo.selected_at).toLocaleDateString('tr-TR')}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Dynamic Mode / No Template */
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-white shadow-sm flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-purple-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-slate-900">Özel Kurulum</h3>
                    <span className="px-2 py-0.5 rounded-lg border text-xs font-medium bg-purple-100 text-purple-700 border-purple-200">
                      Dinamik
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Asistanınız ihtiyaç analizine göre özel olarak yapılandırıldı.
                  </p>
                  {tenantSettings?.metadata?.onboarding_mode === 'dynamic' && (
                    <p className="text-xs text-slate-500 mt-2">
                      Şablon kullanılmadan, ihtiyaçlarınıza göre özel özellik seti oluşturuldu.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Success Message */}
        {success && (
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
            {t('common.success')}! Settings updated successfully.
          </div>
        )}

        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.companyInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label={t('settings.companyName')}
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
              <Input
                label={t('settings.industry')}
                name="industry"
                value={formData.industry}
                disabled
              />
              <Input
                label={t('settings.phone')}
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
              />
              <Input
                label={t('settings.email')}
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
              />
              <div className="md:col-span-2">
                <Input
                  label={t('settings.address')}
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? (
              t('common.loading')
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {t('settings.saveChanges')}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
