import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Settings,
  Mic,
  Brain,
  MessageSquare,
  Volume2,
  RefreshCw,
  Save,
  Loader2,
  Check,
  Play,
  Info,
  ChevronDown,
  ChevronUp,
  Clock,
  Phone,
  Shield,
  Zap,
  X,
  Plus,
  AudioLines,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { adminAPI } from '../../services/api';

const LANGUAGES = [
  { code: 'tr', name: 'Turkce', flag: 'TR' },
  { code: 'en', name: 'English', flag: 'EN' },
  { code: 'de', name: 'Deutsch', flag: 'DE' },
];

const VOICE_PROVIDERS = [
  { id: '11labs', name: 'ElevenLabs' },
  { id: 'deepgram', name: 'Deepgram' },
  { id: 'playht', name: 'PlayHT' },
  { id: 'openai', name: 'OpenAI' },
];

const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2 (Best)' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5 (Fast)' },
  { id: 'eleven_turbo_v2', name: 'Turbo v2' },
  { id: 'eleven_monolingual_v1', name: 'Monolingual v1 (English)' },
];

const AI_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast)' },
  { id: 'gpt-4o', name: 'GPT-4o (Advanced)' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
];

const TRANSCRIBER_PROVIDERS = [
  { id: 'deepgram', name: 'Deepgram' },
  { id: 'talkscriber', name: 'Talkscriber' },
  { id: 'gladia', name: 'Gladia' },
];

const TRANSCRIBER_MODELS = {
  deepgram: [
    { id: 'nova-2', name: 'Nova 2 (Best)' },
    { id: 'nova', name: 'Nova' },
    { id: 'enhanced', name: 'Enhanced' },
    { id: 'base', name: 'Base' },
  ],
  talkscriber: [
    { id: 'whisper', name: 'Whisper' },
  ],
  gladia: [
    { id: 'default', name: 'Default' },
  ],
};

const TRANSCRIBER_LANGUAGES = [
  { id: '', name: 'Auto (Dil bazlı)' },
  { id: 'tr', name: 'Türkçe' },
  { id: 'en-US', name: 'English (US)' },
  { id: 'en-GB', name: 'English (UK)' },
  { id: 'de', name: 'Deutsch' },
  { id: 'fr', name: 'Français' },
  { id: 'es', name: 'Español' },
  { id: 'it', name: 'Italiano' },
  { id: 'pt', name: 'Português' },
  { id: 'ar', name: 'العربية' },
  { id: 'ru', name: 'Русский' },
];

// Tool açıklamaları
const TOOL_DESCRIPTIONS = {
  // ==========================================
  // ORTAK TOOLS (Automotive & Beauty)
  // ==========================================
  get_business_info: {
    name: 'İşletme Bilgileri',
    description: 'İşletme adres, telefon ve email bilgilerini getirir',
    details: 'Müşteri işletme hakkında bilgi sorduğunda çağrılır. Tenant tablosundan adres, telefon, email ve website bilgilerini döner.',
    example: '"Adresiniz ne?", "Neredesiniz?", "Telefon numaranız?"',
  },
  get_working_hours: {
    name: 'Çalışma Saatleri',
    description: 'İşletmenin çalışma saatlerini getirir',
    details: 'Belirli bir gün veya tüm hafta için çalışma saatlerini döner. Bugün, yarın veya gün adı ile sorgulanabilir.',
    example: '"Saat kaça kadar açıksınız?", "Cumartesi açık mısınız?"',
  },
  get_customer_history: {
    name: 'Müşteri Geçmişi',
    description: 'Müşterinin geçmiş randevularını listeler',
    details: 'Arayan müşterinin tamamlanmış randevularını getirir. "Son seferkiyle aynı olsun" gibi istekler için kullanılır.',
    example: '"Daha önce ne yaptırmıştım?", "Geçmiş randevularım?"',
  },
  get_active_promotions: {
    name: 'Aktif Kampanyalar',
    description: 'Güncel kampanya ve indirimleri listeler',
    details: 'Bugün geçerli olan tüm kampanyaları, indirim oranları ve bitiş tarihleriyle birlikte döner.',
    example: '"Kampanyanız var mı?", "İndirimleriniz neler?"',
  },
  get_loyalty_points: {
    name: 'Sadakat Puanı',
    description: 'Müşterinin sadakat puanını sorgular',
    details: 'Müşterinin mevcut puanını, üyelik seviyesini (bronz/gümüş/altın) ve bir sonraki seviyeye kalan puanı döner.',
    example: '"Puanlarım ne kadar?", "Üyelik seviyem ne?"',
  },
  apply_promo_code: {
    name: 'Promosyon Kodu',
    description: 'İndirim kodunu kontrol eder ve uygular',
    details: 'Müşterinin verdiği kodu doğrular, geçerliyse indirim oranını döner. Kullanım limiti ve tarih kontrolü yapar.',
    example: '"İndirim kodum var: YENI50", "Promosyon kodum var"',
  },
  submit_complaint: {
    name: 'Geri Bildirim',
    description: 'Şikayet, öneri veya teşekkür kaydeder',
    details: 'Müşteri geri bildirimini kaydeder. 1-5 arası puan ve mesaj alır. Şikayet, öneri veya övgü olarak kategorize eder.',
    example: '"Şikayet etmek istiyorum", "Bir önerim var", "Teşekkür etmek istiyorum"',
  },
  get_available_time_slots: {
    name: 'Müsait Saatler',
    description: 'Belirli bir tarih için boş randevu saatlerini getirir',
    details: 'Randevu almak isteyen müşteriye müsait saatleri gösterir. Tarih ve randevu türüne göre filtrelenir.',
    example: '"Yarın için müsait saatleriniz neler?"',
  },
  get_my_appointments: {
    name: 'Randevularım',
    description: 'Müşterinin aktif randevularını listeler',
    details: 'Arayan müşterinin telefon numarasına göre bekleyen veya onaylanmış randevuları getirir. İptal veya değiştirme öncesi çağrılır.',
    example: '"Randevularımı görmek istiyorum"',
  },
  cancel_appointment: {
    name: 'Randevu İptal',
    description: 'Mevcut bir randevuyu iptal eder',
    details: 'Randevu ID\'si ve türü (test_drive/service/beauty) ile randevuyu iptal durumuna getirir.',
    example: '"Randevumu iptal etmek istiyorum"',
  },
  reschedule_appointment: {
    name: 'Randevu Değiştir',
    description: 'Randevu tarih/saatini değiştirir',
    details: 'Mevcut randevunun tarih ve saatini günceller. Yeni slot müsaitliğini kontrol eder.',
    example: '"Randevumu perşembeye alabilir miyiz?"',
  },

  // ==========================================
  // AUTOMOTIVE TOOLS
  // ==========================================
  get_available_vehicles: {
    name: 'Araçları Listele',
    description: 'Test sürüşü için müsait araçları listeler',
    details: 'Müşteri araç sormak istediğinde bu fonksiyon çağrılır. Marka, model ve fiyat filtresi uygulanabilir. Veritabanından tenant\'a ait müsait araçları getirir.',
    example: '"Hangi araçlarınız var?" veya "BMW\'lerinizi görebilir miyim?"',
  },
  get_service_price: {
    name: 'Fiyat Sorgula',
    description: 'Araç veya servis fiyatını getirir',
    details: 'Araç fiyatı veya servis işlem ücretlerini döner. Araç adı veya servis türü ile sorgulanır.',
    example: '"BMW 320i ne kadar?", "Yağ değişimi kaç para?"',
  },
  create_test_drive_appointment: {
    name: 'Test Sürüşü Randevusu',
    description: 'Yeni bir test sürüşü randevusu oluşturur',
    details: 'Müşteri adı, telefon, araç, tarih ve saat bilgileriyle test sürüşü randevusu kaydeder. Slot müsaitliğini kontrol eder ve çakışma varsa uyarır.',
    example: '"BMW 320i için yarın saat 14:00\'te test sürüşü ayarla"',
  },
  create_service_appointment: {
    name: 'Servis Randevusu',
    description: 'Yeni bir servis randevusu oluşturur',
    details: 'Araç plakası, servis türü (bakım, yağ değişimi, lastik, tamir), tarih ve saat bilgileriyle servis randevusu kaydeder.',
    example: '"Aracım için yağ değişimi randevusu almak istiyorum"',
  },

  // ==========================================
  // BEAUTY TOOLS
  // ==========================================
  get_beauty_services: {
    name: 'Hizmetleri Listele',
    description: 'Salondaki güzellik hizmetlerini listeler',
    details: 'Saç, tırnak, cilt bakımı, makyaj kategorilerindeki hizmetleri fiyat ve süre bilgisiyle getirir.',
    example: '"Ne tür hizmetleriniz var?" veya "Saç hizmetlerinizi söyler misiniz?"',
  },
  create_beauty_appointment: {
    name: 'Güzellik Randevusu',
    description: 'Yeni bir güzellik randevusu oluşturur',
    details: 'Müşteri adı, hizmet, tarih ve saat bilgileriyle randevu kaydeder. Hizmet adı veya ID ile eşleştirir.',
    example: '"Saç kesimi için yarın saat 15:00\'te randevu almak istiyorum"',
  },
  get_available_staff: {
    name: 'Müsait Personel',
    description: 'Belirli bir tarihte müsait personeli listeler',
    details: 'İstenen tarih ve hizmet kategorisine göre çalışabilecek personelleri ve müsait saatlerini döner.',
    example: '"Yarın hangi kuaförünüz müsait?", "Kimler çalışıyor?"',
  },
  book_with_staff: {
    name: 'Personelle Randevu',
    description: 'Belirli bir personelle randevu oluşturur',
    details: 'Müşterinin istediği personel adı, hizmet, tarih ve saat ile randevu kaydeder. Personel müsaitliğini kontrol eder.',
    example: '"Ayşe hanım ile saç kesimi randevusu almak istiyorum"',
  },
};

/**
 * Admin Preset Configuration page
 * Detailed configuration for each industry preset with language tabs
 */
export const PresetConfig = () => {
  const { industry } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [creatingMaster, setCreatingMaster] = useState(false);
  const [preset, setPreset] = useState(null);
  const [activeTab, setActiveTab] = useState('tr');
  const [formData, setFormData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedTool, setExpandedTool] = useState(null);
  const [enabledTools, setEnabledTools] = useState({});
  const [masterAssistants, setMasterAssistants] = useState({ tr: null, en: null, de: null });

  useEffect(() => {
    if (industry) {
      fetchPreset();
      fetchMasterAssistants();
    }
  }, [industry]);

  const fetchMasterAssistants = async () => {
    try {
      const response = await adminAPI.getMasterAssistants(industry);
      setMasterAssistants(response.data || { tr: null, en: null, de: null });
    } catch (error) {
      console.error('Failed to fetch master assistants:', error);
    }
  };

  const fetchPreset = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getPreset(industry);
      const data = response.data;
      setPreset(data);

      // Language-specific optimized defaults
      // Based on: Dil Bazlı Doğal Konuşma Optimizasyonu
      const LANG_DEFAULTS = {
        tr: {
          voice_speed: 0.95,
          voice_stability: 0.45,
          voice_style: 0.2,
          silence_timeout_seconds: 12,
          response_delay_seconds: 0.5,
          num_words_to_interrupt: 3,
          transcriber_endpointing: 280,
          temperature: 0.75,
        },
        en: {
          voice_speed: 1.0,
          voice_stability: 0.5,
          voice_style: 0.15,
          silence_timeout_seconds: 10,
          response_delay_seconds: 0.4,
          num_words_to_interrupt: 2,
          transcriber_endpointing: 220,
          temperature: 0.7,
        },
        de: {
          voice_speed: 0.9,
          voice_stability: 0.55,
          voice_style: 0.1,
          silence_timeout_seconds: 12,
          response_delay_seconds: 0.45,
          num_words_to_interrupt: 3,
          transcriber_endpointing: 300,
          temperature: 0.65,
        },
      };

      // Initialize form data for each language with advanced settings
      const initialFormData = {};
      LANGUAGES.forEach((lang) => {
        const configKey = `config_${lang.code}`;
        const cfg = data[configKey] || {};
        const langDefaults = LANG_DEFAULTS[lang.code] || LANG_DEFAULTS.en;

        initialFormData[lang.code] = {
          // Basic voice settings
          voice_provider: cfg.voice_provider || 'elevenlabs',
          voice_id: cfg.voice_id || '',
          voice_model: cfg.voice_model || 'eleven_multilingual_v2',
          voice_speed: cfg.voice_speed ?? langDefaults.voice_speed,
          // Advanced voice settings (ElevenLabs)
          voice_stability: cfg.voice_stability ?? langDefaults.voice_stability,
          voice_similarity_boost: cfg.voice_similarity_boost ?? 0.75,
          voice_style: cfg.voice_style ?? langDefaults.voice_style,
          voice_use_speaker_boost: cfg.voice_use_speaker_boost ?? true,
          // AI model settings
          model: cfg.model || 'gpt-4o-mini',
          temperature: cfg.temperature ?? langDefaults.temperature,
          max_tokens: cfg.max_tokens || 500,
          // Advanced model settings
          top_p: cfg.top_p ?? 0.95,
          presence_penalty: cfg.presence_penalty ?? 0,
          frequency_penalty: cfg.frequency_penalty ?? 0,
          emotion_recognition_enabled: cfg.emotion_recognition_enabled ?? true,
          // Conversation settings
          silence_timeout_seconds: cfg.silence_timeout_seconds ?? langDefaults.silence_timeout_seconds,
          max_duration_seconds: cfg.max_duration_seconds ?? 1800,
          response_delay_seconds: cfg.response_delay_seconds ?? langDefaults.response_delay_seconds,
          interruptions_enabled: cfg.interruptions_enabled ?? true,
          num_words_to_interrupt: cfg.num_words_to_interrupt ?? langDefaults.num_words_to_interrupt,
          // Backchannel settings
          backchannel_enabled: cfg.backchannel_enabled ?? true,
          backchannel_words: cfg.backchannel_words || [],
          // Recording settings
          recording_enabled: cfg.recording_enabled ?? false,
          hipaa_enabled: cfg.hipaa_enabled ?? false,
          // End call settings
          end_call_message: cfg.end_call_message || '',
          end_call_phrases: cfg.end_call_phrases || [],
          // Transcriber settings
          transcriber_provider: cfg.transcriber_provider || 'deepgram',
          transcriber_model: cfg.transcriber_model || 'nova-2',
          transcriber_language: cfg.transcriber_language || '',
          transcriber_keywords: cfg.transcriber_keywords || [],
          transcriber_endpointing: cfg.transcriber_endpointing ?? langDefaults.transcriber_endpointing,
          // Prompt settings
          system_prompt: cfg.system_prompt || '',
          first_message: cfg.first_message || '',
        };
      });
      setFormData(initialFormData);
    } catch (error) {
      console.error('Failed to fetch preset:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Build update payload
      const updates = {};
      LANGUAGES.forEach((lang) => {
        updates[`config_${lang.code}`] = formData[lang.code];
      });

      await adminAPI.updatePreset(industry, updates);
      setHasChanges(false);
      alert('Preset saved successfully!');
    } catch (error) {
      console.error('Failed to save preset:', error);
      alert('Failed to save preset: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    const langNames = { tr: 'Turkish', en: 'English', de: 'German' };
    if (!confirm(`This will create/update ${langNames[activeTab]} assistant for all tenants using this preset. Continue?`)) {
      return;
    }

    try {
      setSyncing(true);

      // Önce değişiklikleri kaydet (varsa)
      if (hasChanges) {
        const updates = {};
        LANGUAGES.forEach((lang) => {
          updates[`config_${lang.code}`] = formData[lang.code];
        });
        await adminAPI.updatePreset(industry, updates);
        setHasChanges(false);
      }

      // Sonra tenant'ları sync et
      const response = await adminAPI.syncPreset(industry, activeTab);
      alert(`Synced ${response.data.results?.length || 0} tenants for ${langNames[activeTab]} successfully!`);
    } catch (error) {
      console.error('Failed to sync preset:', error);
      alert('Failed to sync: ' + (error.response?.data?.message || error.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateMasterAssistant = async () => {
    const langNames = { tr: 'Turkce', en: 'English', de: 'Deutsch' };

    try {
      setCreatingMaster(true);

      // Önce değişiklikleri kaydet (varsa)
      if (hasChanges) {
        const updates = {};
        LANGUAGES.forEach((lang) => {
          updates[`config_${lang.code}`] = formData[lang.code];
        });
        await adminAPI.updatePreset(industry, updates);
        setHasChanges(false);
      }

      // Sonra master asistanı oluştur/güncelle
      const response = await adminAPI.createMasterAssistant(industry, activeTab);
      alert(`Master assistant created for ${langNames[activeTab]}!`);
      fetchMasterAssistants();
    } catch (error) {
      console.error('Failed to create master assistant:', error);
      alert('Failed to create master assistant: ' + (error.response?.data?.error || error.message));
    } finally {
      setCreatingMaster(false);
    }
  };

  const handleCreateAllMasterAssistants = async () => {
    if (!confirm('This will create master assistants for all languages (TR, EN, DE). Continue?')) {
      return;
    }

    try {
      setCreatingMaster(true);
      const response = await adminAPI.createAllMasterAssistants(industry);
      const successCount = response.data.results?.filter(r => r.success).length || 0;
      alert(`Created ${successCount}/3 master assistants!`);
      fetchMasterAssistants();
    } catch (error) {
      console.error('Failed to create master assistants:', error);
      alert('Failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setCreatingMaster(false);
    }
  };

  const currentConfig = formData[activeTab] || {};

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!preset) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Preset not found: {industry}</p>
        <Button variant="ghost" onClick={() => navigate('/admin/presets')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Presets
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/presets')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{preset.icon}</span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {preset[`name_${activeTab}`] || preset.industry} Configuration
              </h1>
              <p className="text-slate-500 text-sm">
                {preset[`description_${activeTab}`] || `Configure VAPI settings for ${preset.industry}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Master Assistant Status */}
          <div className="flex items-center gap-1 text-xs text-slate-500 mr-2">
            <span>Master:</span>
            {['tr', 'en', 'de'].map((lang) => (
              <span
                key={lang}
                className={`px-1.5 py-0.5 rounded ${
                  masterAssistants[lang]
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {lang.toUpperCase()}
              </span>
            ))}
          </div>

          <Button
            variant="secondary"
            onClick={handleCreateMasterAssistant}
            disabled={creatingMaster}
            title={`Create master assistant for ${activeTab.toUpperCase()}`}
          >
            {creatingMaster ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Create Master ({activeTab.toUpperCase()})
          </Button>
          <Button
            variant="secondary"
            onClick={handleSync}
            disabled={syncing}
            title="Sync changes to all tenants using this preset"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync Tenants
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Language Tabs */}
      <div className="flex border-b border-slate-200">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setActiveTab(lang.code)}
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === lang.code
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voice Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-indigo-600" />
              Voice Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Voice Provider
              </label>
              <select
                value={currentConfig.voice_provider || 'elevenlabs'}
                onChange={(e) => handleInputChange('voice_provider', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {VOICE_PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Voice ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentConfig.voice_id || ''}
                  onChange={(e) => handleInputChange('voice_id', e.target.value)}
                  placeholder="e.g., EXAVITQu4vr4xnSDxMaL"
                  className="flex-1 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
                <Button variant="secondary" size="sm">
                  <Play className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {(currentConfig.voice_provider === '11labs' || currentConfig.voice_provider === 'elevenlabs') && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  ElevenLabs Model
                </label>
                <select
                  value={currentConfig.voice_model || 'eleven_multilingual_v2'}
                  onChange={(e) => handleInputChange('voice_model', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
                >
                  {ELEVENLABS_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Voice Speed: {currentConfig.voice_speed || 1.0}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={currentConfig.voice_speed || 1.0}
                onChange={(e) => handleInputChange('voice_speed', parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>0.5x</span>
                <span>1.0x</span>
                <span>2.0x</span>
              </div>
            </div>

            {/* ElevenLabs Advanced Settings */}
            {(currentConfig.voice_provider === '11labs' || currentConfig.voice_provider === 'elevenlabs') && (
              <>
                <div className="border-t border-slate-200 pt-4">
                  <p className="text-xs text-slate-400 mb-3">ElevenLabs Advanced</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Stability: {currentConfig.voice_stability ?? 0.5}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={currentConfig.voice_stability ?? 0.5}
                    onChange={(e) => handleInputChange('voice_stability', parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>Variable</span>
                    <span>Stable</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Similarity Boost: {currentConfig.voice_similarity_boost ?? 0.75}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={currentConfig.voice_similarity_boost ?? 0.75}
                    onChange={(e) => handleInputChange('voice_similarity_boost', parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Style: {currentConfig.voice_style ?? 0.0}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={currentConfig.voice_style ?? 0.0}
                    onChange={(e) => handleInputChange('voice_style', parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>None</span>
                    <span>Expressive</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-600">
                    Speaker Boost
                  </label>
                  <button
                    onClick={() => handleInputChange('voice_use_speaker_boost', !currentConfig.voice_use_speaker_boost)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      currentConfig.voice_use_speaker_boost ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        currentConfig.voice_use_speaker_boost ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* AI Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-600" />
              AI Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Model
              </label>
              <select
                value={currentConfig.model || 'gpt-4o-mini'}
                onChange={(e) => handleInputChange('model', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {AI_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Temperature: {currentConfig.temperature || 0.7}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={currentConfig.temperature || 0.7}
                onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Precise</span>
                <span>Balanced</span>
                <span>Creative</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                value={currentConfig.max_tokens || 500}
                onChange={(e) => handleInputChange('max_tokens', parseInt(e.target.value))}
                min="100"
                max="2000"
                className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Advanced Model Settings */}
            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-400 mb-3">Advanced</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Top P: {currentConfig.top_p ?? 0.95}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentConfig.top_p ?? 0.95}
                onChange={(e) => handleInputChange('top_p', parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Focused</span>
                <span>Diverse</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Presence Penalty
                </label>
                <input
                  type="number"
                  value={currentConfig.presence_penalty ?? 0}
                  onChange={(e) => handleInputChange('presence_penalty', parseFloat(e.target.value))}
                  min="-2"
                  max="2"
                  step="0.1"
                  className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Frequency Penalty
                </label>
                <input
                  type="number"
                  value={currentConfig.frequency_penalty ?? 0}
                  onChange={(e) => handleInputChange('frequency_penalty', parseFloat(e.target.value))}
                  min="-2"
                  max="2"
                  step="0.1"
                  className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-600">
                Emotion Recognition
              </label>
              <button
                onClick={() => handleInputChange('emotion_recognition_enabled', !currentConfig.emotion_recognition_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  currentConfig.emotion_recognition_enabled ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    currentConfig.emotion_recognition_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Transcriber Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AudioLines className="w-5 h-5 text-indigo-600" />
              Transcriber (Speech-to-Text)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Provider
              </label>
              <select
                value={currentConfig.transcriber_provider || 'deepgram'}
                onChange={(e) => handleInputChange('transcriber_provider', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {TRANSCRIBER_PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Model
              </label>
              <select
                value={currentConfig.transcriber_model || 'nova-2'}
                onChange={(e) => handleInputChange('transcriber_model', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {(TRANSCRIBER_MODELS[currentConfig.transcriber_provider] || TRANSCRIBER_MODELS.deepgram).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Language
              </label>
              <select
                value={currentConfig.transcriber_language || ''}
                onChange={(e) => handleInputChange('transcriber_language', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {TRANSCRIBER_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Auto uses TR/EN/DE based on selected tab</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Endpointing (ms): {currentConfig.transcriber_endpointing ?? 255}
              </label>
              <input
                type="range"
                min="100"
                max="1000"
                step="50"
                value={currentConfig.transcriber_endpointing ?? 255}
                onChange={(e) => handleInputChange('transcriber_endpointing', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Fast (100ms)</span>
                <span>Slow (1000ms)</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">How long to wait before considering speech ended</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Keywords (Boost Recognition)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(currentConfig.transcriber_keywords || []).map((keyword, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-100 text-blue-600 text-sm"
                  >
                    {keyword}
                    <button
                      onClick={() => {
                        const newKeywords = [...currentConfig.transcriber_keywords];
                        newKeywords.splice(index, 1);
                        handleInputChange('transcriber_keywords', newKeywords);
                      }}
                      className="hover:text-slate-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="new-keyword"
                  placeholder="e.g., BMW, Mercedes, randevu..."
                  className="flex-1 px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-900 text-sm focus:border-indigo-500 focus:outline-none"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      handleInputChange('transcriber_keywords', [
                        ...(currentConfig.transcriber_keywords || []),
                        e.target.value.trim()
                      ]);
                      e.target.value = '';
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const input = document.getElementById('new-keyword');
                    if (input.value.trim()) {
                      handleInputChange('transcriber_keywords', [
                        ...(currentConfig.transcriber_keywords || []),
                        input.value.trim()
                      ]);
                      input.value = '';
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Words that should be recognized more accurately</p>
            </div>
          </CardContent>
        </Card>

        {/* Conversation Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Conversation Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Silence Timeout (seconds)
              </label>
              <input
                type="number"
                value={currentConfig.silence_timeout_seconds ?? 10}
                onChange={(e) => handleInputChange('silence_timeout_seconds', Math.max(10, parseInt(e.target.value) || 10))}
                min="10"
                max="60"
                className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-xs text-slate-400 mt-1">How long to wait for user response (min: 10s)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Max Call Duration (seconds)
              </label>
              <input
                type="number"
                value={currentConfig.max_duration_seconds ?? 1800}
                onChange={(e) => handleInputChange('max_duration_seconds', parseInt(e.target.value))}
                min="60"
                max="7200"
                step="60"
                className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-xs text-slate-400 mt-1">{Math.floor((currentConfig.max_duration_seconds ?? 1800) / 60)} minutes</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Response Delay: {currentConfig.response_delay_seconds ?? 0.4}s
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={currentConfig.response_delay_seconds ?? 0.4}
                onChange={(e) => handleInputChange('response_delay_seconds', parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Instant</span>
                <span>Natural</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Allow Interruptions
                </label>
                <p className="text-xs text-slate-400">User can interrupt assistant</p>
              </div>
              <button
                onClick={() => handleInputChange('interruptions_enabled', !currentConfig.interruptions_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  currentConfig.interruptions_enabled ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    currentConfig.interruptions_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {currentConfig.interruptions_enabled && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Words to Interrupt
                </label>
                <input
                  type="number"
                  value={currentConfig.num_words_to_interrupt ?? 2}
                  onChange={(e) => handleInputChange('num_words_to_interrupt', parseInt(e.target.value))}
                  min="1"
                  max="10"
                  className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Number of words needed to interrupt</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Backchannel & Recording Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-600" />
              Natural Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Backchannel */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Backchannel Sounds
                </label>
                <p className="text-xs text-slate-400">"hmm", "evet", "anlıyorum" etc.</p>
              </div>
              <button
                onClick={() => handleInputChange('backchannel_enabled', !currentConfig.backchannel_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  currentConfig.backchannel_enabled ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    currentConfig.backchannel_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {currentConfig.backchannel_enabled && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Backchannel Words
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(currentConfig.backchannel_words || []).map((word, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-600/20 text-indigo-600 text-sm"
                    >
                      {word}
                      <button
                        onClick={() => {
                          const newWords = [...currentConfig.backchannel_words];
                          newWords.splice(index, 1);
                          handleInputChange('backchannel_words', newWords);
                        }}
                        className="hover:text-slate-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="new-backchannel-word"
                    placeholder="Add word..."
                    className="flex-1 px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-900 text-sm focus:border-indigo-500 focus:outline-none"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        handleInputChange('backchannel_words', [
                          ...(currentConfig.backchannel_words || []),
                          e.target.value.trim()
                        ]);
                        e.target.value = '';
                      }
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const input = document.getElementById('new-backchannel-word');
                      if (input.value.trim()) {
                        handleInputChange('backchannel_words', [
                          ...(currentConfig.backchannel_words || []),
                          input.value.trim()
                        ]);
                        input.value = '';
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Recording Settings */}
            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-400 mb-3 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Recording & Compliance
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Record Calls
                </label>
                <p className="text-xs text-slate-400">Save call recordings</p>
              </div>
              <button
                onClick={() => handleInputChange('recording_enabled', !currentConfig.recording_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  currentConfig.recording_enabled ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    currentConfig.recording_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-600">
                  HIPAA Compliant
                </label>
                <p className="text-xs text-slate-400">Healthcare data protection</p>
              </div>
              <button
                onClick={() => handleInputChange('hipaa_enabled', !currentConfig.hipaa_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  currentConfig.hipaa_enabled ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    currentConfig.hipaa_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* System Prompt */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              System Prompt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <p className="text-xs text-slate-400">
                Available placeholders: {'{FIRMA_ADI}'}, {'{ASISTAN_ADI}'}, {'{TELEFON}'}, {'{EMAIL}'}, {'{TARIH}'}, {'{SAAT}'}
              </p>
            </div>
            <textarea
              value={currentConfig.system_prompt || ''}
              onChange={(e) => handleInputChange('system_prompt', e.target.value)}
              rows={12}
              className="w-full px-4 py-3 rounded-lg bg-white border border-slate-200 text-slate-900 font-mono text-sm focus:border-indigo-500 focus:outline-none resize-none"
              placeholder="Enter the system prompt for the AI assistant..."
            />
          </CardContent>
        </Card>

        {/* First Message */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-indigo-600" />
              First Message (Greeting)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={currentConfig.first_message || ''}
              onChange={(e) => handleInputChange('first_message', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none resize-none"
              placeholder="Enter the greeting message when the call starts..."
            />
          </CardContent>
        </Card>

        {/* End Call Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-indigo-600" />
              End Call Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Goodbye Message
              </label>
              <input
                type="text"
                value={currentConfig.end_call_message || ''}
                onChange={(e) => handleInputChange('end_call_message', e.target.value)}
                placeholder="e.g., Goodbye, have a nice day!"
                className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                End Call Trigger Phrases
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(currentConfig.end_call_phrases || []).map((phrase, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-600 text-sm"
                  >
                    {phrase}
                    <button
                      onClick={() => {
                        const newPhrases = [...currentConfig.end_call_phrases];
                        newPhrases.splice(index, 1);
                        handleInputChange('end_call_phrases', newPhrases);
                      }}
                      className="hover:text-slate-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="new-end-phrase"
                  placeholder="Add phrase..."
                  className="flex-1 px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-900 text-sm focus:border-indigo-500 focus:outline-none"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      handleInputChange('end_call_phrases', [
                        ...(currentConfig.end_call_phrases || []),
                        e.target.value.trim()
                      ]);
                      e.target.value = '';
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const input = document.getElementById('new-end-phrase');
                    if (input.value.trim()) {
                      handleInputChange('end_call_phrases', [
                        ...(currentConfig.end_call_phrases || []),
                        input.value.trim()
                      ]);
                      input.value = '';
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                When user says these phrases, the call will end
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tools */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-600" />
              Available Tools
              <span className="text-xs text-slate-400 font-normal ml-2">
                (Tıklayarak detayları görüntüleyin)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(preset.default_tools || []).map((tool, index) => {
                const toolInfo = TOOL_DESCRIPTIONS[tool.name] || {};
                const isExpanded = expandedTool === tool.name;
                const isEnabled = enabledTools[tool.name] !== false;

                return (
                  <div
                    key={index}
                    className={`rounded-lg border transition-all ${
                      isEnabled
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-50 border-slate-100 opacity-60'
                    }`}
                  >
                    {/* Tool Header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white"
                      onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          setEnabledTools({ ...enabledTools, [tool.name]: e.target.checked });
                          setHasChanges(true);
                        }}
                        className="w-4 h-4 rounded border-gray-600 text-indigo-600 focus:ring-primary cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            {toolInfo.name || tool.name}
                          </span>
                          <code className="text-xs px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-600">
                            {tool.name}
                          </code>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {toolInfo.description || tool.description}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && toolInfo.details && (
                      <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                        <div className="ml-7 space-y-3">
                          <div>
                            <h4 className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              Ne İşe Yarar?
                            </h4>
                            <p className="text-sm text-slate-500">{toolInfo.details}</p>
                          </div>
                          {toolInfo.example && (
                            <div>
                              <h4 className="text-xs font-semibold text-slate-600 mb-1">
                                💬 Örnek Kullanım
                              </h4>
                              <p className="text-sm text-indigo-600/80 italic">
                                {toolInfo.example}
                              </p>
                            </div>
                          )}
                          {tool.parameters?.properties && (
                            <div>
                              <h4 className="text-xs font-semibold text-slate-600 mb-1">
                                📋 Parametreler
                              </h4>
                              <div className="flex flex-wrap gap-1">
                                {Object.keys(tool.parameters.properties).map((param) => (
                                  <span
                                    key={param}
                                    className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600"
                                  >
                                    {param}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 bg-indigo-600/90 text-slate-900 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span className="text-sm">You have unsaved changes</span>
          <Button size="sm" variant="ghost" onClick={handleSave}>
            Save Now
          </Button>
        </div>
      )}
    </div>
  );
};
