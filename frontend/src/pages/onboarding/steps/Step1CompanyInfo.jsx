import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Globe,
  ChevronRight,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { onboardingAPI } from '../../../services/api';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';

const LANGUAGES = [
  { value: 'tr', label: 'Turkce', flag: '🇹🇷' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

const REGIONS = [
  { value: 'tr', label: 'Turkiye' },
  { value: 'de', label: 'Almanya' },
  { value: 'global', label: 'Global' },
];

// Sektore gore varsayilan asistan isimleri
const DEFAULT_ASSISTANTS = {
  automotive: ['Ayse', 'Elif', 'Zeynep'],
  beauty: ['Elif', 'Ayse', 'Selin'],
  beauty_salon: ['Elif', 'Ayse', 'Selin'],
  hairdresser: ['Selin', 'Elif', 'Ayse'],
};

/**
 * Step 1: Firma Bilgileri
 */
export const Step1CompanyInfo = ({ data, industry = 'automotive', onUpdate, onNext }) => {
  const { t } = useTranslation();
  const assistantOptions = DEFAULT_ASSISTANTS[industry] || DEFAULT_ASSISTANTS.automotive;

  // Form state
  const [formData, setFormData] = useState({
    name: data.tenant?.name || '',
    phone: data.tenant?.phone || '',
    email: data.user?.email || '',
    password: '',
    passwordConfirm: '',
    language: 'tr',
    region: 'tr',
    assistantName: assistantOptions[0] || 'Ayse',
  });

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Slug state
  const [suggestedSlug, setSuggestedSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Firma adi degistiginde slug onerisi al
  useEffect(() => {
    const checkSlug = async () => {
      if (formData.name.length < 2) {
        setSuggestedSlug('');
        setSlugAvailable(null);
        return;
      }

      setCheckingSlug(true);
      try {
        const { data: result } = await onboardingAPI.suggestSlug(formData.name);
        setSuggestedSlug(result.suggested);
        setSlugAvailable(true);
      } catch (err) {
        console.error('Slug check error:', err);
      } finally {
        setCheckingSlug(false);
      }
    };

    const debounce = setTimeout(checkSlug, 500);
    return () => clearTimeout(debounce);
  }, [formData.name]);

  // Form degisiklikleri
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  // Dil secimi
  const handleLanguageChange = (lang) => {
    setFormData((prev) => ({
      ...prev,
      language: lang,
    }));
  };

  // Form validasyonu
  const validateForm = () => {
    if (!formData.name || formData.name.length < 2) {
      setError('Firma adi en az 2 karakter olmali');
      return false;
    }

    if (!formData.email || !formData.email.includes('@')) {
      setError('Gecerli bir email adresi girin');
      return false;
    }

    if (!formData.password || formData.password.length < 6) {
      setError('Sifre en az 6 karakter olmali');
      return false;
    }

    if (formData.password !== formData.passwordConfirm) {
      setError('Sifreler eslesmeli');
      return false;
    }

    return true;
  };

  // Form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: result } = await onboardingAPI.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        language: formData.language,
        region: formData.region,
        assistantName: formData.assistantName,
        industry, // Sektor bilgisi eklendi
      });

      // Wizard data'yi guncelle
      onUpdate({
        tenant: result.tenant,
        user: result.user,
        token: result.token,
      });

      // Sonraki adima gec
      onNext();
    } catch (err) {
      console.error('Registration error:', err);
      const message = err.response?.data?.message || 'Kayit sirasinda bir hata olustu';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* Step Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-indigo-100">
            <Building2 className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Firma Bilgileri</h2>
        </div>
        <p className="text-slate-500">
          Sesli asistan kurulumu icin firma bilgilerinizi girin
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Firma Adi */}
        <div>
          <Input
            label="Firma Adi *"
            name="name"
            placeholder="Ornek: Prestige Auto"
            value={formData.name}
            onChange={handleChange}
            required
          />
          {/* Slug preview */}
          {suggestedSlug && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-slate-500">URL:</span>
              <span className="text-slate-600">app.example.com/</span>
              <span className="text-indigo-600 font-medium">{suggestedSlug}</span>
              {checkingSlug ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : slugAvailable ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <X className="w-4 h-4 text-red-500" />
              )}
            </div>
          )}
        </div>

        {/* Telefon & Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative">
            <Input
              label="Telefon"
              name="phone"
              type="tel"
              placeholder="+90 5XX XXX XX XX"
              value={formData.phone}
              onChange={handleChange}
            />
            <Phone className="absolute right-3 top-10 w-5 h-5 text-gray-500" />
          </div>
          <div className="relative">
            <Input
              label="Email *"
              name="email"
              type="email"
              placeholder="info@firma.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <Mail className="absolute right-3 top-10 w-5 h-5 text-gray-500" />
          </div>
        </div>

        {/* Sifre */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative">
            <Input
              label="Sifre *"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="En az 6 karakter"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-10 text-gray-500 hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="relative">
            <Input
              label="Sifre Tekrar *"
              name="passwordConfirm"
              type={showPasswordConfirm ? 'text' : 'password'}
              placeholder="Sifreyi tekrar girin"
              value={formData.passwordConfirm}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
              className="absolute right-3 top-10 text-gray-500 hover:text-gray-300"
            >
              {showPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Dil Secimi */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Dil Secimi
          </label>
          <div className="flex flex-wrap gap-3">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                type="button"
                onClick={() => handleLanguageChange(lang.value)}
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

        {/* Bolge Secimi */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Bolge
          </label>
          <select
            name="region"
            value={formData.region}
            onChange={handleChange}
            className="input"
          >
            {REGIONS.map((region) => (
              <option key={region.value} value={region.value}>
                {region.label}
              </option>
            ))}
          </select>
        </div>

        {/* Asistan Adi */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Asistan Adi (Onerilen)
          </label>
          <div className="flex flex-wrap gap-3">
            {assistantOptions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, assistantName: name }))}
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
              placeholder="Ozel isim..."
              value={!assistantOptions.includes(formData.assistantName) ? formData.assistantName : ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, assistantName: e.target.value }))}
              className="input w-32"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-6 border-t border-slate-200">
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                Devam Et
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
