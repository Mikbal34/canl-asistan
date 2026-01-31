import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Modal, ModalFooter } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { adminAPI } from '../../services/api';

// Dil seçenekleri
const LANGUAGES = [
  { value: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

// Sektöre göre varsayılan asistan isimleri
const DEFAULT_ASSISTANTS = {
  automotive: ['Ayşe', 'Elif', 'Zeynep'],
  beauty_salon: ['Elif', 'Ayşe', 'Selin'],
  hairdresser: ['Selin', 'Elif', 'Ayşe'],
};

// Industry presets with icons and descriptions
const industries = [
  {
    id: 'automotive',
    name: 'Otomotiv',
    icon: '🚗',
    description: 'Oto galeri, servis, yedek parça',
    features: ['Test sürüşü randevusu', 'Servis randevusu', 'Araç kataloğu'],
  },
  {
    id: 'beauty_salon',
    name: 'Güzellik Salonu',
    icon: '💅',
    description: 'Cilt bakımı, manikür, makyaj, SPA',
    features: ['Randevu sistemi', 'Cilt & tırnak bakımı', 'SPA hizmetleri'],
  },
  {
    id: 'hairdresser',
    name: 'Kuaför',
    icon: '✂️',
    description: 'Saç kesimi, boyama, fön (kadın+erkek)',
    features: ['Randevu sistemi', 'Kuaför seçimi', 'Saç bakım hizmetleri'],
  },
];


/**
 * Tenant Create Modal - Step-by-step tenant creation
 */
export const TenantCreateModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [createdTenant, setCreatedTenant] = useState(null);

  // Form state
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [formData, setFormData] = useState({
    // Step 2 - Firma Bilgileri
    name: '',
    phone: '',
    email: '',
    // Step 3 - Kullanıcı Ayarları
    password: '',
    passwordConfirm: '',
    language: 'tr',
    assistantName: 'Ayşe',
  });

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setStep(1);
    setSelectedIndustry(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      password: '',
      passwordConfirm: '',
      language: 'tr',
      assistantName: 'Ayşe',
    });
    setError('');
    setSuccess(false);
    setCreatedTenant(null);
    setShowPassword(false);
    setShowPasswordConfirm(false);
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateStep2 = () => {
    if (!formData.name.trim()) {
      setError('Firma adı zorunludur');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Telefon numarası zorunludur');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email adresi zorunludur');
      return false;
    }
    if (!validateEmail(formData.email)) {
      setError('Geçerli bir email adresi girin');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.password || formData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return false;
    }
    if (formData.password !== formData.passwordConfirm) {
      setError('Şifreler eşleşmiyor');
      return false;
    }
    if (!formData.assistantName.trim()) {
      setError('Asistan adı zorunludur');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !selectedIndustry) {
      setError('Lütfen bir sektör seçin');
      return;
    }
    if (step === 2 && !validateStep2()) {
      return;
    }
    // Step 2'den 3'e geçerken varsayılan asistan adını sektöre göre ayarla
    if (step === 2) {
      const assistantOptions = DEFAULT_ASSISTANTS[selectedIndustry.id] || DEFAULT_ASSISTANTS.automotive;
      setFormData(prev => ({ ...prev, assistantName: assistantOptions[0] }));
    }
    setError('');
    setStep(step + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    setLoading(true);
    setError('');

    try {
      const slug = generateSlug(formData.name);

      const tenantData = {
        name: formData.name,
        slug,
        industry: selectedIndustry.id,
        phone: formData.phone,
        email: formData.email,
        // Yeni: Kullanıcı oluştur
        createUser: true,
        password: formData.password,
        language: formData.language,
        assistantName: formData.assistantName,
      };

      const response = await adminAPI.createTenant(tenantData);
      const tenant = response.data.data || response.data;

      // Giriş bilgilerini sakla
      setCreatedTenant({
        ...tenant,
        email: formData.email,
        password: formData.password,
      });
      setSuccess(true);
    } catch (err) {
      console.error('Failed to create tenant:', err);
      setError(err.response?.data?.message || err.message || 'Müşteri oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    resetForm();
    onSuccess();
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Sektör Seçimi</h3>
        <p className="text-slate-500 text-sm">Müşterinin sektörünü seçin</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {industries.map((industry) => (
          <button
            key={industry.id}
            onClick={() => {
              setSelectedIndustry(industry);
              setError('');
            }}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              selectedIndustry?.id === industry.id
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="text-3xl mb-2">{industry.icon}</div>
            <div className="font-semibold text-slate-900 mb-1">{industry.name}</div>
            <div className="text-sm text-slate-500 mb-3">{industry.description}</div>
            <div className="space-y-1">
              {industry.features.map((feature, idx) => (
                <div key={idx} className="text-xs text-slate-500 flex items-center gap-1">
                  <Check className="w-3 h-3 text-indigo-600" />
                  {feature}
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50">
        <div className="text-3xl">{selectedIndustry?.icon}</div>
        <div>
          <div className="font-semibold text-slate-900">{selectedIndustry?.name}</div>
          <div className="text-sm text-slate-500">{selectedIndustry?.description}</div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Firma Bilgileri</h3>

        <div className="space-y-4">
          <Input
            label="Firma Adı *"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Örn: Prestige Auto"
          />

          <Input
            label="Telefon *"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="+90 5XX XXX XX XX"
          />

          <Input
            label="Email *"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="info@firma.com"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => {
    const assistantOptions = DEFAULT_ASSISTANTS[selectedIndustry?.id] || DEFAULT_ASSISTANTS.automotive;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50">
          <div className="text-3xl">{selectedIndustry?.icon}</div>
          <div>
            <div className="font-semibold text-slate-900">{formData.name}</div>
            <div className="text-sm text-slate-500">{formData.email}</div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Kullanıcı Ayarları</h3>

          {/* Şifre Alanları */}
          <div className="space-y-4 mb-6">
            <div className="relative">
              <Input
                label="Şifre *"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="En az 6 karakter"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Şifre Tekrar *"
                type={showPasswordConfirm ? 'text' : 'password'}
                value={formData.passwordConfirm}
                onChange={(e) => handleInputChange('passwordConfirm', e.target.value)}
                placeholder="Şifreyi tekrar girin"
              />
              <button
                type="button"
                onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
              >
                {showPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Dil Seçimi */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Dil Seçimi
            </label>
            <div className="flex flex-wrap gap-3">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => handleInputChange('language', lang.value)}
                  className={`
                    flex items-center gap-2 px-4 py-3 rounded-lg border transition-all
                    ${formData.language === lang.value
                      ? 'bg-indigo-50 border-indigo-500 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }
                  `}
                >
                  <span className="text-xl">{lang.flag}</span>
                  <span>{lang.label}</span>
                  {formData.language === lang.value && (
                    <Check className="w-4 h-4 text-indigo-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Asistan Adı */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Asistan Adı
            </label>
            <div className="flex flex-wrap gap-3">
              {assistantOptions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleInputChange('assistantName', name)}
                  className={`
                    px-4 py-2 rounded-lg border transition-all
                    ${formData.assistantName === name
                      ? 'bg-indigo-50 border-indigo-500 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }
                  `}
                >
                  {name}
                </button>
              ))}
              <input
                type="text"
                placeholder="Özel isim..."
                value={!assistantOptions.includes(formData.assistantName) ? formData.assistantName : ''}
                onChange={(e) => handleInputChange('assistantName', e.target.value)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 w-32 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCredentials = () => {
    const text = `Firma: ${createdTenant?.name}\nEmail: ${createdTenant?.email}\nŞifre: ${createdTenant?.password}`;
    copyToClipboard(text);
  };

  const renderSuccess = () => (
    <div className="text-center py-6">
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-8 h-8 text-emerald-500" />
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">Müşteri Oluşturuldu!</h3>
      <p className="text-slate-500 mb-6">
        {createdTenant?.name} başarıyla oluşturuldu ve giriş yapabilir durumda.
      </p>

      <div className="p-4 rounded-lg bg-slate-50 text-left space-y-3 mb-6">
        <div className="flex justify-between">
          <span className="text-slate-500">Firma:</span>
          <span className="text-slate-900 font-medium">{createdTenant?.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Email:</span>
          <span className="text-slate-900">{createdTenant?.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Şifre:</span>
          <span className="text-slate-900 font-mono">••••••••</span>
        </div>

        {/* Giriş Bilgilerini Kopyala */}
        <div className="pt-3 border-t border-slate-200">
          <button
            onClick={copyCredentials}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5" />
                Kopyalandı!
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                Giriş Bilgilerini Kopyala
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
        ⚠️ Bu bilgileri müşterinize güvenli bir şekilde iletin.
      </div>
    </div>
  );

  const getTitle = () => {
    if (success) return 'Başarılı';
    switch (step) {
      case 1: return 'Yeni Müşteri - Sektör';
      case 2: return 'Yeni Müşteri - Firma Bilgileri';
      case 3: return 'Yeni Müşteri - Kullanıcı Ayarları';
      default: return 'Yeni Müşteri';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={getTitle()}
      size="lg"
    >
      {/* Step indicators */}
      {!success && (
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                s === step
                  ? 'bg-indigo-600 text-white'
                  : s < step
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {s < step ? <Check className="w-4 h-4" /> : s}
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      {success ? renderSuccess() : (
        <>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </>
      )}

      {/* Footer */}
      <ModalFooter>
        {success ? (
          <Button variant="primary" onClick={handleDone}>
            Tamam
          </Button>
        ) : (
          <>
            {step > 1 && (
              <Button variant="ghost" onClick={handleBack} disabled={loading}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Geri
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="ghost" onClick={handleClose} disabled={loading}>
              İptal
            </Button>
            {step < 3 ? (
              <Button variant="primary" onClick={handleNext}>
                Devam
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Oluşturuluyor...
                  </>
                ) : (
                  'Müşteri Oluştur'
                )}
              </Button>
            )}
          </>
        )}
      </ModalFooter>
    </Modal>
  );
};
