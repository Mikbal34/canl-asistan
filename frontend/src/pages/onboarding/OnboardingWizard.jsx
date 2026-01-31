import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as LucideIcons from 'lucide-react';
import {
  Building2,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { onboardingAPI, adminAPI } from '../../services/api';
import { DynamicStep } from '../../components/common/DynamicStep';

// Map of custom components for special steps (simplified - no longer needed but kept for compatibility)
const CUSTOM_COMPONENTS = {};

// Simplified fallback config - only company registration step
// Technical settings (use cases, hours, voice) are now managed by admin
const FALLBACK_CONFIG = {
  version: '2.0',
  steps: [
    {
      id: 'company',
      title: 'Firma Bilgileri',
      description: 'Isletmeniz hakkinda temel bilgiler',
      icon: 'Building2',
      required: true,
      fields: [
        { name: 'name', label: 'Firma Adi', type: 'text', required: true },
        { name: 'phone', label: 'Telefon', type: 'tel', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'password', label: 'Sifre', type: 'password', required: true, validation: { minLength: 6 } },
      ],
    },
  ],
};

// Industry display config
const INDUSTRY_DISPLAY = {
  automotive: {
    title: 'Otomotiv Sesli Asistan Kurulumu',
    subtitle: 'Arac satis ve servis bayileri icin',
    primaryColor: '#3B82F6',
    icon: 'Car',
  },
  beauty: {
    title: 'Guzellik Salonu Asistani Kurulumu',
    subtitle: 'Cilt bakimi, manikur ve SPA icin',
    primaryColor: '#EC4899',
    icon: 'Scissors',
  },
  beauty_salon: {
    title: 'Guzellik Salonu Asistani Kurulumu',
    subtitle: 'Cilt bakimi, manikur, makyaj ve SPA icin',
    primaryColor: '#EC4899',
    icon: 'Scissors',
  },
  hairdresser: {
    title: 'Kuafor Asistani Kurulumu',
    subtitle: 'Sac kesimi, boyama ve fon icin',
    primaryColor: '#8B5CF6',
    icon: 'Scissors',
  },
  default: {
    title: 'Sesli Asistan Kurulumu',
    subtitle: 'Isletmeniz icin yapay zeka asistani',
    primaryColor: '#8B5CF6',
    icon: 'Building2',
  },
};

/**
 * Config-Driven Onboarding Wizard
 * Fetches step configuration from API and renders dynamically
 */
export const OnboardingWizard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { industry = 'automotive' } = useParams();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant');

  // Config state
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState(null);
  const [existingTenant, setExistingTenant] = useState(null);

  // Wizard state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stepLoading, setStepLoading] = useState(false);
  const [stepError, setStepError] = useState(null);

  // Wizard data (shared between steps)
  const [wizardData, setWizardData] = useState({
    industry,
    tenant: null,
    user: null,
    token: null,
    catalogItems: [],
    workingHours: {},
    voiceSettings: {},
    testPhoneNumber: null,
    testCompleted: false,
  });

  // Fetch existing tenant data if tenantId is provided
  useEffect(() => {
    const fetchExistingTenant = async () => {
      if (!tenantId) return;

      try {
        // Fetch tenant data from public onboarding endpoint
        const response = await fetch(`http://localhost:3000/api/public/onboarding/tenant/${tenantId}`);
        if (response.ok) {
          const tenant = await response.json();
          setExistingTenant(tenant);
          // Pre-fill wizard data with existing tenant info
          setWizardData(prev => ({
            ...prev,
            tenantId: tenant.id,
            tenant,
            name: tenant.name || '',
            email: tenant.email || '',
            phone: tenant.phone || '',
            address: tenant.address || '',
            assistantName: tenant.assistant_name || '',
            language: tenant.default_language || 'tr',
          }));
          console.log('[Onboarding] Loaded existing tenant:', tenant.name);
        }
      } catch (err) {
        console.log('Could not fetch existing tenant:', err);
      }
    };

    fetchExistingTenant();
  }, [tenantId]);

  // Fetch onboarding config from API
  useEffect(() => {
    const fetchConfig = async () => {
      setConfigLoading(true);
      setConfigError(null);

      try {
        const { data } = await onboardingAPI.getOnboardingConfig(industry);
        if (data && data.steps && data.steps.length > 0) {
          setConfig(data);
        } else {
          // Use fallback if no config
          console.warn('No config found for industry, using fallback:', industry);
          setConfig(FALLBACK_CONFIG);
        }
      } catch (err) {
        console.error('Failed to load onboarding config:', err);
        setConfigError('Konfigürasyon yüklenemedi');
        setConfig(FALLBACK_CONFIG);
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, [industry]);

  // Save token when Step 1 completes
  useEffect(() => {
    if (wizardData.token) {
      localStorage.setItem('token', wizardData.token);
      setIsAuthenticated(true);
    }
  }, [wizardData.token]);

  // Get display config for industry
  const displayConfig = INDUSTRY_DISPLAY[industry] || INDUSTRY_DISPLAY.default;
  const HeaderIcon = LucideIcons[displayConfig.icon] || Building2;

  // Update wizard data
  const updateWizardData = (updates) => {
    setWizardData((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  // Handle step submission
  const handleStepSubmit = async (stepConfig, stepValues) => {
    setStepLoading(true);
    setStepError(null);

    try {
      // Step-specific API calls
      if (stepConfig.id === 'company') {
        // Register tenant - this now handles everything automatically
        // (default use cases, working hours, VAPI assistant creation)
        const { data } = await onboardingAPI.register({
          ...stepValues,
          industry,
          language: stepValues.language || 'tr',
        });
        updateWizardData({
          tenant: data.tenant,
          user: data.user,
          token: data.token,
        });

        // After successful registration, redirect directly to dashboard
        // No more multi-step onboarding - admin handles technical settings
        navigate('/dashboard');
        return;
      }

      // Move to next step (for any legacy multi-step configs)
      goToNextStep();
    } catch (err) {
      console.error('Step submit error:', err);
      setStepError(err.response?.data?.message || 'Bir hata oluştu');
    } finally {
      setStepLoading(false);
    }
  };

  // Navigation
  const goToNextStep = () => {
    if (config && currentStepIndex < config.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setStepError(null);
    }
  };

  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      setStepError(null);
    }
  };

  const goToStep = (index) => {
    if (index === 0) {
      setCurrentStepIndex(0);
      return;
    }
    if (!isAuthenticated && index > 0) return;
    if (index <= currentStepIndex + 1) {
      setCurrentStepIndex(index);
      setStepError(null);
    }
  };

  // Handle skip
  const handleSkip = () => {
    goToNextStep();
  };

  // Handle completion
  const handleComplete = () => {
    navigate('/dashboard');
  };

  // Handle file upload for catalog
  const handleFileUpload = async (file, tableName) => {
    if (!file) return;
    setStepLoading(true);
    setStepError(null);

    try {
      const { data } = await onboardingAPI.uploadCatalogCSV(file, tableName);
      if (data.items) {
        const newItems = data.items.map((item, i) => ({ ...item, id: Date.now() + i }));
        updateWizardData({
          catalogItems: [...(wizardData.catalogItems || []), ...newItems],
        });
      }
    } catch (err) {
      console.error('CSV upload error:', err);
      setStepError(err.response?.data?.message || 'CSV yükleme hatası');
    } finally {
      setStepLoading(false);
    }
  };

  // Render loading state
  if (configLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-500">Kurulum yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (configError && !config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-slate-900 mb-2">Kurulum yüklenemedi</p>
          <p className="text-slate-500 text-sm">{configError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  const currentStepConfig = config?.steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === (config?.steps.length || 1) - 1;

  // Render current step content
  const renderCurrentStep = () => {
    if (!currentStepConfig) return null;

    // For special component steps (voice_settings, activation), use dedicated components
    if (currentStepConfig.component && CUSTOM_COMPONENTS[currentStepConfig.component]) {
      const CustomComponent = CUSTOM_COMPONENTS[currentStepConfig.component];
      return (
        <CustomComponent
          data={wizardData}
          industry={industry}
          config={currentStepConfig}
          onUpdate={updateWizardData}
          onNext={goToNextStep}
          onBack={goToPrevStep}
          onComplete={handleComplete}
        />
      );
    }

    // For regular steps, use DynamicStep
    return (
      <DynamicStep
        stepConfig={currentStepConfig}
        values={wizardData}
        onChange={updateWizardData}
        onNext={() => handleStepSubmit(currentStepConfig, wizardData)}
        onBack={goToPrevStep}
        onSkip={currentStepConfig.skippable ? handleSkip : undefined}
        loading={stepLoading}
        error={stepError}
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        customComponents={CUSTOM_COMPONENTS}
        onFileUpload={handleFileUpload}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 -left-32 w-96 h-96 rounded-full blur-3xl opacity-50"
          style={{ backgroundColor: `${displayConfig.primaryColor}20` }}
        />
        <div
          className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full blur-3xl opacity-50"
          style={{ backgroundColor: `${displayConfig.primaryColor}20` }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: displayConfig.primaryColor }}
          >
            <HeaderIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {displayConfig.title}
          </h1>
          <p className="text-slate-500">
            {displayConfig.subtitle} - {config?.steps.length || 4} adımda hayata geçir
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {config?.steps.map((step, index) => {
              const isCompleted = currentStepIndex > index;
              const isCurrent = currentStepIndex === index;
              const isClickable = index === 0 || (isAuthenticated && index <= currentStepIndex + 1);
              const StepIcon = LucideIcons[step.icon] || Building2;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  {/* Step circle */}
                  <button
                    onClick={() => isClickable && goToStep(index)}
                    disabled={!isClickable}
                    className={`
                      relative flex items-center justify-center w-12 h-12 rounded-full
                      transition-all duration-300
                      ${isCompleted
                        ? 'bg-indigo-600 text-white'
                        : isCurrent
                          ? 'bg-indigo-100 text-indigo-600 border-2 border-indigo-500'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }
                      ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <StepIcon className="w-6 h-6" />
                    )}
                  </button>

                  {/* Step label */}
                  <div className="hidden sm:block ml-3 mr-4">
                    <p className={`text-sm font-medium ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>
                      Adım {index + 1}
                    </p>
                    <p className={`text-xs ${isCurrent ? 'text-slate-600' : 'text-slate-400'}`}>
                      {step.title}
                    </p>
                  </div>

                  {/* Connector line */}
                  {index < config.steps.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isCompleted ? 'bg-indigo-600' : 'bg-slate-200'
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {renderCurrentStep()}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-sm text-slate-400">
          <p>
            Yardıma mı ihtiyacınız var?{' '}
            <a href="mailto:support@example.com" className="text-indigo-600 hover:underline">
              Destek Ekibi
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
