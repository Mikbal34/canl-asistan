import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mic,
  Volume2,
  Play,
  Pause,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  RefreshCw,
  User,
} from 'lucide-react';
import { onboardingAPI } from '../../../services/api';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';

// Sektore gore asistan isimleri
const INDUSTRY_ASSISTANTS = {
  automotive: [
    { name: 'Ayse', description: 'Samimi ve sicak' },
    { name: 'Elif', description: 'Profesyonel' },
    { name: 'Zeynep', description: 'Genc ve enerjik' },
  ],
  beauty: [
    { name: 'Elif', description: 'Samimi ve sicak' },
    { name: 'Selin', description: 'Profesyonel' },
    { name: 'Ayse', description: 'Enerjik ve neşeli' },
  ],
  beauty_salon: [
    { name: 'Elif', description: 'Samimi ve sicak' },
    { name: 'Selin', description: 'Profesyonel' },
    { name: 'Ayse', description: 'Enerjik ve neşeli' },
  ],
  hairdresser: [
    { name: 'Selin', description: 'Samimi ve sicak' },
    { name: 'Elif', description: 'Profesyonel' },
    { name: 'Ayse', description: 'Enerjik ve neşeli' },
  ],
};

// Sektore gore varsayilan mesaj
const getDefaultGreeting = (tenantName, assistantName, industry) => {
  const greetings = {
    automotive: `Merhaba, ${tenantName || 'firmamiza'} hosgeldiniz. Ben ${assistantName}, size nasil yardimci olabilirim? Test surusu veya servis randevusu icin buradayim.`,
    beauty: `Merhaba, ${tenantName || 'salonumuza'} hosgeldiniz. Ben ${assistantName}, size nasil yardimci olabilirim? Randevu almak veya hizmetlerimiz hakkinda bilgi icin buradayim.`,
    beauty_salon: `Merhaba, ${tenantName || 'guzellik salonumuza'} hosgeldiniz. Ben ${assistantName}, size nasil yardimci olabilirim? Cilt bakimi, manikur veya SPA randevusu icin buradayim.`,
    hairdresser: `Merhaba, ${tenantName || 'kuaforumuze'} hosgeldiniz. Ben ${assistantName}, size nasil yardimci olabilirim? Sac kesimi, boyama veya fon randevusu icin buradayim.`,
  };
  return greetings[industry] || greetings.automotive;
};

/**
 * Step 3: Ses Ayarlari
 */
export const Step3VoiceSettings = ({ data, industry = 'automotive', onUpdate, onNext, onBack }) => {
  const { t } = useTranslation();
  const ASSISTANT_NAMES = INDUSTRY_ASSISTANTS[industry] || INDUSTRY_ASSISTANTS.automotive;
  const audioRef = useRef(null);

  // Form state
  const [assistantName, setAssistantName] = useState(data.voiceSettings?.assistantName || 'Ayse');
  const [customName, setCustomName] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(data.voiceSettings?.voicePresetId || null);
  const [greetingMessage, setGreetingMessage] = useState(
    data.voiceSettings?.greetingMessage ||
    getDefaultGreeting(data.tenant?.name, assistantName, industry)
  );

  // Voice presets state
  const [voicePresets, setVoicePresets] = useState([]);
  const [loadingPresets, setLoadingPresets] = useState(true);

  // Audio playback state
  const [playingVoice, setPlayingVoice] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Voice presets yukle
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const { data: presets } = await onboardingAPI.getVoicePresets(data.tenant?.default_language || 'tr');
        setVoicePresets(presets || []);

        // Ilk preset'i sec
        if (presets?.length > 0 && !selectedVoice) {
          setSelectedVoice(presets[0].id);
        }
      } catch (err) {
        console.error('Failed to load voice presets:', err);
        // Varsayilan preset'ler kullan
        setVoicePresets([
          { id: '1', name: 'Ayse', display_name_tr: 'Ayse (Samimi)', style: 'friendly' },
          { id: '2', name: 'Elif', display_name_tr: 'Elif (Profesyonel)', style: 'professional' },
          { id: '3', name: 'Zeynep', display_name_tr: 'Zeynep (Enerjik)', style: 'energetic' },
        ]);
      } finally {
        setLoadingPresets(false);
      }
    };

    loadPresets();
  }, []);

  // Asistan adi degistiginde karsilama mesajini guncelle
  useEffect(() => {
    const name = customName || assistantName;
    setGreetingMessage(getDefaultGreeting(data.tenant?.name, name, industry));
  }, [assistantName, customName, data.tenant?.name, industry]);

  // Ses onizleme
  const handlePlayVoice = (presetId, previewUrl) => {
    if (playingVoice === presetId) {
      // Durdur
      audioRef.current?.pause();
      setPlayingVoice(null);
    } else {
      // Oynat
      if (previewUrl && audioRef.current) {
        audioRef.current.src = previewUrl;
        audioRef.current.play();
        setPlayingVoice(presetId);
      } else {
        // Onizleme yok, sadece sec
        setSelectedVoice(presetId);
      }
    }
  };

  // Ses bitti
  const handleAudioEnded = () => {
    setPlayingVoice(null);
  };

  // Varsayilana don
  const handleResetGreeting = () => {
    const name = customName || assistantName;
    setGreetingMessage(getDefaultGreeting(data.tenant?.name, name, industry));
  };

  // Kaydet ve devam et
  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const finalName = customName || assistantName;

      await onboardingAPI.updateVoiceSettings({
        assistantName: finalName,
        voicePresetId: selectedVoice,
        greetingMessage,
      });

      // Wizard data guncelle
      onUpdate({
        voiceSettings: {
          assistantName: finalName,
          voicePresetId: selectedVoice,
          greetingMessage,
        },
      });

      // Sonraki adim
      onNext();
    } catch (err) {
      console.error('Save error:', err);
      setError(err.response?.data?.message || 'Kaydetme hatasi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* Hidden audio element */}
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />

      {/* Step Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-indigo-100">
            <Mic className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Ses Asistani Ayarlari</h2>
        </div>
        <p className="text-slate-500">
          Sesli asistanin ses ve karsilama mesajini ozellestirin
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {/* Assistant Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Asistan Adi
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ASSISTANT_NAMES.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  setAssistantName(item.name);
                  setCustomName('');
                }}
                className={`p-4 rounded-lg border text-left transition-all ${
                  assistantName === item.name && !customName
                    ? 'bg-indigo-50 border-indigo-500'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    assistantName === item.name && !customName ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <User className="w-5 h-5" />
                  </div>
                  <span className="text-slate-900 font-medium">{item.name}</span>
                </div>
                <p className="text-sm text-slate-500">{item.description}</p>
              </button>
            ))}

            {/* Custom name input */}
            <div className={`p-4 rounded-lg border transition-all ${
              customName
                ? 'bg-indigo-50 border-indigo-500'
                : 'bg-white border-slate-200'
            }`}>
              <label className="block text-sm text-slate-500 mb-2">Ozel Isim</label>
              <input
                type="text"
                placeholder="Kendi isminizi girin"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* Voice Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Ses Secimi
          </label>

          {loadingPresets ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="ml-2 text-slate-500">Sesler yukleniyor...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {voicePresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedVoice(preset.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${
                    selectedVoice === preset.id
                      ? 'bg-indigo-50 border-indigo-500'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      selectedVoice === preset.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <Volume2 className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="text-slate-900 font-medium">
                        {preset.display_name_tr || preset.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {preset.style === 'friendly' && 'Samimi ve sicak bir ses'}
                        {preset.style === 'professional' && 'Profesyonel ve guvence veren'}
                        {preset.style === 'energetic' && 'Genc ve enerjik'}
                        {!preset.style && 'ElevenLabs kalitesinde ses'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {preset.preview_url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayVoice(preset.id, preset.preview_url);
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          playingVoice === preset.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {playingVoice === preset.id ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </button>
                    )}

                    {selectedVoice === preset.id && (
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Greeting Message */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-slate-700">
              Karsilama Mesaji
            </label>
            <button
              onClick={handleResetGreeting}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Varsayilana Don
            </button>
          </div>
          <textarea
            value={greetingMessage}
            onChange={(e) => setGreetingMessage(e.target.value)}
            rows={4}
            className="input resize-none"
            placeholder="Merhaba, firmamiza hosgeldiniz..."
          />
          <p className="mt-2 text-sm text-slate-500">
            Asistan arayan kisiye ilk bu mesajla cevap verecek
          </p>
        </div>

        {/* Preview Card */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-transparent border border-indigo-100">
          <p className="text-sm text-slate-500 mb-2">Onizleme:</p>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-slate-900 font-medium">{customName || assistantName}</p>
              <p className="text-slate-600 text-sm mt-1">{greetingMessage}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 mt-8 border-t border-slate-200">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="w-5 h-5 mr-2" />
          Geri
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
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
    </div>
  );
};
