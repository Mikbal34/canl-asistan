import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PhoneCall,
  CheckCircle,
  Circle,
  Copy,
  Check,
  ChevronLeft,
  Loader2,
  Rocket,
  Building2,
  Car,
  Clock,
  Mic,
  AlertCircle,
  ExternalLink,
  Scissors,
  Stethoscope,
  Briefcase,
} from 'lucide-react';
import { onboardingAPI } from '../../../services/api';
import { Button } from '../../../components/common/Button';

// Sektore gore test senaryolari
const INDUSTRY_SCENARIOS = {
  automotive: [
    { id: 1, text: 'Test surusu randevusu almak istiyorum', category: 'test_drive' },
    { id: 2, text: 'Hangi araclariniz var?', category: 'vehicles' },
    { id: 3, text: 'Yarin saat 14:00 musait misiniz?', category: 'availability' },
    { id: 4, text: 'Servis randevusu almak istiyorum', category: 'service' },
  ],
  beauty: [
    { id: 1, text: 'Cilt bakimi randevusu almak istiyorum', category: 'appointment' },
    { id: 2, text: 'Hangi hizmetleriniz var?', category: 'services' },
    { id: 3, text: 'Yarin saat 15:00 musait misiniz?', category: 'availability' },
    { id: 4, text: 'Manikur ve pedikur fiyatlari ne kadar?', category: 'pricing' },
  ],
  beauty_salon: [
    { id: 1, text: 'Cilt bakimi randevusu almak istiyorum', category: 'appointment' },
    { id: 2, text: 'Hangi guzellik hizmetleriniz var?', category: 'services' },
    { id: 3, text: 'Yarin saat 15:00 musait misiniz?', category: 'availability' },
    { id: 4, text: 'Manikur ve SPA fiyatlari ne kadar?', category: 'pricing' },
  ],
  hairdresser: [
    { id: 1, text: 'Sac kesimi randevusu almak istiyorum', category: 'appointment' },
    { id: 2, text: 'Hangi kuaforleriniz var?', category: 'staff' },
    { id: 3, text: 'Yarin saat 14:00 musait misiniz?', category: 'availability' },
    { id: 4, text: 'Sac boyama fiyati ne kadar?', category: 'pricing' },
  ],
};

// Sektore gore ikon
const INDUSTRY_ICONS = {
  automotive: Car,
  beauty: Scissors,
  beauty_salon: Scissors,
  hairdresser: Scissors,
};

// Sektore gore katalog etiketi
const CATALOG_LABELS = {
  automotive: { singular: 'Arac', plural: 'Araclar', icon: Car },
  beauty: { singular: 'Hizmet', plural: 'Hizmetler', icon: Scissors },
  beauty_salon: { singular: 'Hizmet', plural: 'Hizmetler', icon: Scissors },
  hairdresser: { singular: 'Hizmet', plural: 'Hizmetler', icon: Scissors },
};

/**
 * Step 4: Test & Aktivasyon
 */
export const Step4TestActivation = ({ data, industry = 'automotive', onUpdate, onBack, onComplete }) => {
  const { t } = useTranslation();

  // Sektore gore ayarlar
  const testScenarios = INDUSTRY_SCENARIOS[industry] || INDUSTRY_SCENARIOS.automotive;
  const CatalogIcon = CATALOG_LABELS[industry]?.icon || Briefcase;
  const catalogLabel = CATALOG_LABELS[industry] || CATALOG_LABELS.automotive;

  // Test state
  const [testPhoneNumber, setTestPhoneNumber] = useState(data.testPhoneNumber || null);
  const [loadingTest, setLoadingTest] = useState(false);
  const [testReady, setTestReady] = useState(false);
  const [checkedScenarios, setCheckedScenarios] = useState([]);

  // Activation state
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState('');

  // Copy state
  const [copied, setCopied] = useState(false);

  // Checklist state
  const [checklist, setChecklist] = useState(null);
  const [loadingChecklist, setLoadingChecklist] = useState(true);

  // Checklist ve test numarasini yukle
  useEffect(() => {
    const initialize = async () => {
      try {
        // Checklist'i al
        const { data: checklistData } = await onboardingAPI.getChecklist();
        setChecklist(checklistData);

        // Test cagrisi baslat (VAPI assistant'larini olusturur)
        setLoadingTest(true);
        const { data: testData } = await onboardingAPI.initiateTestCall();
        setTestPhoneNumber(testData.testPhoneNumber);
        setTestReady(true);

        onUpdate({
          testPhoneNumber: testData.testPhoneNumber,
        });
      } catch (err) {
        console.error('Initialize error:', err);
        setError('Test hazirlanirken bir hata olustu');
      } finally {
        setLoadingTest(false);
        setLoadingChecklist(false);
      }
    };

    initialize();
  }, []);

  // Telefon numarasini kopyala
  const handleCopyNumber = async () => {
    if (testPhoneNumber) {
      await navigator.clipboard.writeText(testPhoneNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Test senaryosunu isle
  const toggleScenario = (scenarioId) => {
    setCheckedScenarios((prev) =>
      prev.includes(scenarioId)
        ? prev.filter((id) => id !== scenarioId)
        : [...prev, scenarioId]
    );
  };

  // Aktivasyon
  const handleActivate = async () => {
    setActivating(true);
    setError('');

    try {
      const { data: result } = await onboardingAPI.activate();

      setActivated(true);
      onUpdate({ testCompleted: true });

      // 2 saniye sonra dashboard'a yonlendir
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      console.error('Activation error:', err);
      setError(err.response?.data?.message || 'Aktivasyon sirasinda bir hata olustu');
    } finally {
      setActivating(false);
    }
  };

  // Checklist item component
  const ChecklistItem = ({ label, checked, icon: Icon }) => (
    <div className="flex items-center gap-3 py-2">
      {checked ? (
        <CheckCircle className="w-5 h-5 text-emerald-500" />
      ) : (
        <Circle className="w-5 h-5 text-slate-400" />
      )}
      <Icon className="w-4 h-4 text-slate-400" />
      <span className={checked ? 'text-slate-900' : 'text-slate-500'}>{label}</span>
    </div>
  );

  // Aktivasyon basarili
  if (activated) {
    return (
      <div className="p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Tebrikler!</h2>
        <p className="text-xl text-slate-600 mb-2">
          {data.tenant?.name} icin sesli asistan aktif
        </p>
        <p className="text-slate-500 mb-8">
          Dashboard'a yonlendiriliyorsunuz...
        </p>
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Step Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-indigo-100">
            <PhoneCall className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Test & Aktivasyon</h2>
        </div>
        <p className="text-slate-500">
          Sesli asistani test edin ve aktiflestivin
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left: Setup Summary */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">Kurulum Ozeti</h3>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            {loadingChecklist ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 py-2 border-b border-slate-200">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <span className="text-slate-900 font-medium">{data.tenant?.name}</span>
                </div>

                <ChecklistItem
                  label="Firma bilgileri"
                  checked={checklist?.hasCompanyInfo}
                  icon={Building2}
                />
                <ChecklistItem
                  label={`${catalogLabel.plural} (${checklist?.catalogCount || 0} adet)`}
                  checked={checklist?.hasCatalog || data.vehiclesSkipped || data.servicesSkipped}
                  icon={CatalogIcon}
                />
                <ChecklistItem
                  label="Calisma saatleri"
                  checked={checklist?.hasWorkingHours}
                  icon={Clock}
                />
                <ChecklistItem
                  label={`Asistan: ${data.voiceSettings?.assistantName || 'Ayse'}`}
                  checked={checklist?.hasVoiceSettings || checklist?.hasAssistantName}
                  icon={Mic}
                />
                <ChecklistItem
                  label="VAPI asistan olusturuldu"
                  checked={checklist?.hasVapiAssistant || testReady}
                  icon={PhoneCall}
                />
              </>
            )}
          </div>
        </div>

        {/* Right: Test Call */}
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">Test Cagrisi</h3>

          {loadingTest ? (
            <div className="p-8 rounded-lg bg-slate-50 border border-slate-200 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-4" />
              <p className="text-slate-500">Sesli asistan hazirlaniyor...</p>
              <p className="text-sm text-slate-400 mt-2">Bu islem 1-2 dakika surebilir</p>
            </div>
          ) : testReady ? (
            <>
              {/* Phone Number Box */}
              <div className="p-6 rounded-lg bg-gradient-to-r from-indigo-50 to-transparent border border-indigo-200 text-center mb-4">
                <p className="text-sm text-slate-500 mb-2">Test Numarasi</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl font-mono text-slate-900">
                    {testPhoneNumber || '+90 850 XXX XX XX'}
                  </span>
                  <button
                    onClick={handleCopyNumber}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Copy className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                </div>
                <p className="text-sm text-slate-500 mt-3">
                  Bu numarayi arayarak asistani test edin
                </p>
              </div>

              {/* Test Scenarios */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-sm text-slate-500 mb-3">Deneyebileceginiz senaryolar:</p>
                <div className="space-y-2">
                  {testScenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      onClick={() => toggleScenario(scenario.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                        checkedScenarios.includes(scenario.id)
                          ? 'bg-emerald-50 border border-emerald-200'
                          : 'bg-white border border-slate-100 hover:bg-slate-100'
                      }`}
                    >
                      {checkedScenarios.includes(scenario.id) ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      )}
                      <span className={checkedScenarios.includes(scenario.id) ? 'text-slate-900' : 'text-slate-500'}>
                        "{scenario.text}"
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 rounded-lg bg-slate-50 border border-slate-200 text-center">
              <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-4" />
              <p className="text-slate-500">Test numarasi alinamadi</p>
              <p className="text-sm text-slate-400 mt-2">
                Aktivasyondan sonra dashboard'dan test edebilirsiniz
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Activation Notice */}
      <div className="mt-8 p-4 rounded-lg bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-slate-900 font-medium">Test cagrisi opsiyoneldir</p>
            <p className="text-sm text-slate-500 mt-1">
              Test cagrisi yapmadan da aktiflestirebilirsiniz. Aktivasyondan sonra
              dashboard'dan tum ozelliklere erisebilirsiniz.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 mt-8 border-t border-slate-200">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="w-5 h-5 mr-2" />
          Geri
        </Button>

        <Button
          variant="primary"
          size="lg"
          onClick={handleActivate}
          disabled={activating || loadingChecklist}
          className="bg-green-500 hover:bg-green-600"
        >
          {activating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Aktiflesitiriliyor...
            </>
          ) : (
            <>
              <Rocket className="w-5 h-5 mr-2" />
              Aktifleştir ve Basla
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
