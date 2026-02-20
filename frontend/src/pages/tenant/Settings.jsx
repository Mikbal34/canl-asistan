import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Bot, Package, Zap, Crown, Star, ChevronDown, ChevronUp, Check, Wrench, FileText, Sparkles, Shield, Lock, Mail } from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { templateAPI, authAPI } from '../../services/api';
import { cn } from '@/lib/utils';

const tierConfig = {
  basic:    { label: 'Temel',    icon: Package, colorClass: 'bg-muted text-foreground border-border',                                                                     gradientClass: 'from-muted/50 to-muted' },
  standard: { label: 'Standart', icon: Zap,     colorClass: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',     gradientClass: 'from-blue-50 dark:from-blue-950/20 to-indigo-50 dark:to-indigo-950/20' },
  premium:  { label: 'Premium',  icon: Crown,   colorClass: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800', gradientClass: 'from-amber-50 dark:from-amber-950/20 to-orange-50 dark:to-orange-950/20' },
};

export const Settings = () => {
  const { t } = useTranslation();
  const { tenantSettings, updateSettings } = useTenant();
  const [formData, setFormData] = useState({ name: '', industry: '', phone: '', email: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
  const [emailForm, setEmailForm] = useState({ password: '', newEmail: '' });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState({ type: '', text: '' });
  const [emailConfirmModal, setEmailConfirmModal] = useState(false);
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

  useEffect(() => {
    const fetchAssistantInfo = async () => {
      try {
        setAssistantLoading(true);
        const response = await templateAPI.getMyTemplate();
        setAssistantInfo(response.data);
      } catch (err) {
        setAssistantInfo(null);
      } finally {
        setAssistantLoading(false);
      }
    };
    fetchAssistantInfo();
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      const result = await updateSettings({ name: formData.name, phone: formData.phone, address: formData.address });
      if (result.success) { setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });
    if (passwordForm.newPassword.length < 6) { setPasswordMsg({ type: 'error', text: t('settings.passwordRequired') }); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setPasswordMsg({ type: 'error', text: t('settings.passwordMismatch') }); return; }
    setPasswordLoading(true);
    try {
      await authAPI.changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordMsg({ type: 'success', text: t('settings.passwordChanged') });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordMsg({ type: '', text: '' }), 5000);
    } catch (error) {
      const msg = error.response?.status === 401 ? t('settings.wrongPassword') : (error.response?.data?.message || t('common.error'));
      setPasswordMsg({ type: 'error', text: msg });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleEmailChange = (e) => {
    e.preventDefault();
    setEmailMsg({ type: '', text: '' });
    if (!emailForm.newEmail || !emailForm.password) return;
    setEmailConfirmModal(true);
  };

  const handleEmailConfirm = async () => {
    setEmailConfirmModal(false);
    setEmailLoading(true);
    try {
      await authAPI.changeEmail({ password: emailForm.password, newEmail: emailForm.newEmail });
      setEmailMsg({ type: 'success', text: t('settings.emailChanged') });
      setEmailForm({ password: '', newEmail: '' });
      setTimeout(() => setEmailMsg({ type: '', text: '' }), 5000);
    } catch (error) {
      const msg = error.response?.status === 401 ? t('settings.wrongPassword') : (error.response?.data?.message || t('common.error'));
      setEmailMsg({ type: 'error', text: msg });
    } finally {
      setEmailLoading(false);
    }
  };

  const msgClass = (type) => type === 'success'
    ? 'p-3 rounded-lg text-sm bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
    : 'p-3 rounded-lg text-sm bg-destructive/10 border border-destructive/20 text-destructive';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('settings.subtitle')}</p>
      </div>

      {/* Seçili Asistan */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border bg-muted/20">
          <Bot className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Seçili Asistan</h2>
        </div>
        <div className="p-6">
          {assistantLoading ? (
            <div className="flex items-start gap-4 animate-pulse">
              <div className="w-14 h-14 rounded-xl bg-muted flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="bg-muted rounded h-5 w-48" />
                <div className="bg-muted rounded h-4 w-72" />
                <div className="bg-muted rounded h-3 w-32" />
              </div>
            </div>
          ) : assistantInfo?.template ? (
            <div>
              <div
                className={cn(`p-4 rounded-xl bg-gradient-to-r ${tierConfig[assistantInfo.template.tier]?.gradientClass || 'from-muted/50 to-muted'} border border-border cursor-pointer hover:shadow-md transition-all`)}
                onClick={() => setShowDetails(!showDetails)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center flex-shrink-0">
                      {(() => { const TierIcon = tierConfig[assistantInfo.template.tier]?.icon || Package; return <TierIcon className="w-7 h-7 text-primary" />; })()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-foreground">{assistantInfo.template.name_tr || assistantInfo.template.name}</h3>
                        <span className={cn('px-2 py-0.5 rounded-lg border text-xs font-medium', tierConfig[assistantInfo.template.tier]?.colorClass)}>
                          {tierConfig[assistantInfo.template.tier]?.label || assistantInfo.template.tier}
                        </span>
                        {assistantInfo.template.is_featured && (
                          <span className="bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" /> Önerilen
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{assistantInfo.template.description_tr || assistantInfo.template.description}</p>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-muted/50 rounded-lg transition-colors shrink-0">
                    {showDetails ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                  </button>
                </div>
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Wrench className="w-4 h-4" />
                    {assistantInfo.effectiveUseCases?.length || assistantInfo.template.included_use_cases?.length || 0} özellik
                  </span>
                  {assistantInfo.added_use_cases?.length > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="w-4 h-4" /> +{assistantInfo.added_use_cases.length} eklenmiş
                    </span>
                  )}
                </div>
              </div>

              {showDetails && (
                <div className="mt-4 space-y-4">
                  {assistantInfo.effectiveUseCases?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <Wrench className="w-4 h-4" /> Aktif Özellikler
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {assistantInfo.effectiveUseCases.map((uc) => (
                          <div key={uc} className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                            <span className="text-sm font-medium text-primary">{t(`useCases.${uc}`, uc)}</span>
                            {t(`useCaseDescriptions.${uc}`, '') && (
                              <p className="text-xs text-muted-foreground mt-1">{t(`useCaseDescriptions.${uc}`, '')}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {tenantSettings?.voice_config_override?.system_prompt_suffix && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Özel Kurallar
                      </h4>
                      <div className="p-3 bg-muted/50 rounded-lg text-sm text-foreground whitespace-pre-wrap">
                        {tenantSettings.voice_config_override.system_prompt_suffix.replace('## Özel Kurallar', '').trim()}
                      </div>
                    </div>
                  )}
                  <div className="pt-3 border-t border-border text-xs text-muted-foreground">
                    Şablon ID: {assistantInfo.template_id} • Seçilme: {new Date(assistantInfo.selected_at).toLocaleDateString('tr-TR')}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 dark:from-purple-950/20 to-pink-50 dark:to-pink-950/20 border border-border">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-foreground">Özel Kurulum</h3>
                    <span className="px-2 py-0.5 rounded-lg border text-xs font-medium bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">Dinamik</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Asistanınız ihtiyaç analizine göre özel olarak yapılandırıldı.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Firma Bilgileri */}
      <form onSubmit={handleSubmit}>
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
            <h2 className="text-sm font-semibold text-foreground">{t('settings.companyInfo')}</h2>
            <Button type="submit" variant="primary" size="sm" disabled={loading}>
              {loading ? t('common.loading') : <><Save className="w-4 h-4 mr-2" />{t('settings.saveChanges')}</>}
            </Button>
          </div>
          <div className="p-6 space-y-5">
            {success && (
              <div className="p-3 rounded-lg text-sm bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
                {t('settings.settingsUpdated')}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input label={t('settings.companyName')} name="name" value={formData.name} onChange={handleChange} required />
              <Input label={t('settings.industry')} name="industry" value={formData.industry} disabled />
              <Input label={t('settings.phone')} name="phone" type="tel" value={formData.phone} onChange={handleChange} />
              <div className="md:col-span-2">
                <Input label={t('settings.address')} name="address" value={formData.address} onChange={handleChange} />
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Hesap Güvenliği */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border bg-muted/20">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{t('settings.accountSecurity')}</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Change Password */}
            <form onSubmit={handlePasswordChange} className="border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                {t('settings.changePassword')}
              </h3>
              {passwordMsg.text && <div className={msgClass(passwordMsg.type)}>{passwordMsg.text}</div>}
              <Input label={t('settings.currentPassword')} type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required />
              <Input label={t('settings.newPassword')} type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required />
              <Input label={t('settings.confirmPassword')} type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required />
              <Button type="submit" variant="primary" disabled={passwordLoading} className="w-full">
                {passwordLoading ? t('common.loading') : t('settings.changePassword')}
              </Button>
            </form>

            {/* Change Email */}
            <form onSubmit={handleEmailChange} className="border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                {t('settings.changeEmail')}
              </h3>
              <p className="text-xs text-muted-foreground">Giriş e-posta adresinizi değiştirmek için önce yeni e-postanızı girin, ardından mevcut şifrenizle onaylayın.</p>
              {emailMsg.text && <div className={msgClass(emailMsg.type)}>{emailMsg.text}</div>}
              <Input label={t('settings.newEmail')} type="email" placeholder="yeni@email.com" value={emailForm.newEmail} onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })} required />
              <Input label="Onay için mevcut şifreniz" type="password" placeholder="Mevcut şifrenizi girin" value={emailForm.password} onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })} required />
              <Button type="submit" variant="primary" disabled={emailLoading} className="w-full">
                {emailLoading ? t('common.loading') : t('settings.changeEmail')}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Email Confirm Modal */}
      {emailConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEmailConfirmModal(false)}>
          <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">E-posta Değişikliği Onayı</h3>
              <p className="text-sm text-muted-foreground mb-1">Giriş e-posta adresiniz aşağıdaki ile değiştirilecek:</p>
              <p className="text-base font-semibold text-primary mb-4">{emailForm.newEmail}</p>
              <p className="text-xs text-muted-foreground mb-6">Değişiklik sonrası yeni e-posta adresinizle giriş yapmanız gerekecektir.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setEmailConfirmModal(false)}>Vazgeç</Button>
              <Button variant="primary" className="flex-1" onClick={handleEmailConfirm}>Onayla</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
