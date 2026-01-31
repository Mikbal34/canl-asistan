import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Car,
  Scissors,
  Stethoscope,
  Building2,
  ChevronRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { onboardingAPI } from '../../services/api';

// Industry icon mapping
const INDUSTRY_ICONS = {
  automotive: Car,
  beauty_salon: Scissors,
  hairdresser: Scissors,
  default: Building2,
};

// Industry display data (fallback if API doesn't provide)
const INDUSTRY_DEFAULTS = {
  automotive: {
    display_name: 'Otomotiv',
    description: 'Arac satis ve servis bayileri icin sesli asistan',
    primary_color: '#3B82F6',
    features: ['Test surusu randevusu', 'Arac sorgulama', 'Servis randevusu'],
  },
  beauty_salon: {
    display_name: 'Guzellik Salonu',
    description: 'Cilt bakimi, manikur, makyaj ve SPA icin sesli asistan',
    primary_color: '#EC4899',
    features: ['Randevu alma', 'Cilt & tirnak bakimi', 'SPA hizmetleri'],
  },
  hairdresser: {
    display_name: 'Kuafor',
    description: 'Sac kesimi, boyama ve fon icin sesli asistan',
    primary_color: '#8B5CF6',
    features: ['Randevu alma', 'Kuafor secimi', 'Sac bakim hizmetleri'],
  },
};

/**
 * Industry Selector - Sektor Secim Sayfasi
 */
export const IndustrySelector = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState(null);

  // Industry listesini yukle
  useEffect(() => {
    const loadIndustries = async () => {
      try {
        const { data } = await onboardingAPI.getIndustryPresets();

        // API verisi ile defaults'u birlestir
        const enrichedIndustries = data.map(preset => ({
          ...INDUSTRY_DEFAULTS[preset.industry],
          ...preset,
        }));

        setIndustries(enrichedIndustries);
      } catch (err) {
        console.error('Failed to load industries:', err);
        // Fallback: defaults kullan
        setIndustries(Object.entries(INDUSTRY_DEFAULTS).map(([key, value]) => ({
          industry: key,
          ...value,
          is_active: true,
        })));
      } finally {
        setLoading(false);
      }
    };

    loadIndustries();
  }, []);

  // Sektor secildiginde
  const handleSelectIndustry = (industry) => {
    setSelectedIndustry(industry);
    // Kisa bir animasyon sonrasi yonlendir
    setTimeout(() => {
      navigate(`/onboarding/${industry}`);
    }, 200);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-500">Sektorler yukleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-100 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-100 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-100 mb-6">
            <Sparkles className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Sesli Asistan Kurulumu
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">
            Isletmeniz icin yapay zeka destekli sesli asistan olusturun.
            Sektorunuzu secin ve 30 dakikada hayata gecirin.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-center">
            {error}
          </div>
        )}

        {/* Industry Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {industries.map((industry) => {
            const Icon = INDUSTRY_ICONS[industry.industry] || INDUSTRY_ICONS.default;
            const isSelected = selectedIndustry === industry.industry;
            const features = industry.features || INDUSTRY_DEFAULTS[industry.industry]?.features || [];

            return (
              <button
                key={industry.industry}
                onClick={() => handleSelectIndustry(industry.industry)}
                disabled={!industry.is_active}
                className={`
                  relative p-6 rounded-2xl border text-left transition-all duration-300
                  ${isSelected
                    ? 'bg-indigo-100 border-indigo-500 scale-[1.02]'
                    : industry.is_active
                      ? 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:scale-[1.01]'
                      : 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed'
                  }
                `}
              >
                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${industry.primary_color}20` }}
                >
                  <Icon
                    className="w-7 h-7"
                    style={{ color: industry.primary_color }}
                  />
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  {industry.display_name}
                </h2>

                {/* Description */}
                <p className="text-slate-500 text-sm mb-4">
                  {industry.description}
                </p>

                {/* Features */}
                <ul className="space-y-2 mb-4">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-slate-600">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: industry.primary_color }}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {industry.is_active ? (
                  <div className="flex items-center gap-2 text-indigo-600 font-medium">
                    <span>Kuruluma Basla</span>
                    <ChevronRight className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="text-slate-400 text-sm">
                    Yakinda...
                  </div>
                )}

                {/* Coming soon badge */}
                {!industry.is_active && (
                  <div className="absolute top-4 right-4 px-2 py-1 rounded-full bg-slate-100 text-slate-500 text-xs">
                    Yakinda
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Info */}
        <div className="mt-12 text-center text-slate-400">
          <p className="mb-2">
            Her sektor icin ozellestirilmis yapay zeka asistani
          </p>
          <p className="text-sm">
            Sorulariniz mi var?{' '}
            <a href="mailto:support@example.com" className="text-indigo-600 hover:underline">
              Destek Ekibi
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
