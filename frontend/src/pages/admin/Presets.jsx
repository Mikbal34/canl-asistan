import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Palette, Settings, MessageSquare, Mic, Globe, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal, ModalFooter } from '../../components/common/Modal';
import { adminAPI } from '../../services/api';

/**
 * Admin Presets page component
 */
export const Presets = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncingPreset, setSyncingPreset] = useState(null); // 'automotive_tr', 'automotive_en' gibi
  const [formData, setFormData] = useState({
    name_tr: '',
    name_en: '',
    default_prompt_tr: '',
    default_prompt_en: '',
    default_prompt_de: '',
    default_functions: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const response = await adminAPI.getPresets();
      setPresets(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigure = (preset) => {
    // Navigate to the detailed configuration page
    navigate(`/admin/presets/${preset.id}`);
  };

  const handleQuickConfigure = (preset) => {
    setSelectedPreset(preset);
    // Mevcut preset verilerini forma yukle
    const existingPreset = presets.find(p => p.industry === preset.id);
    setFormData({
      name_tr: existingPreset?.name_tr || preset.name,
      name_en: existingPreset?.name_en || preset.name,
      default_prompt_tr: existingPreset?.default_prompt_tr || preset.defaultPrompt?.tr || '',
      default_prompt_en: existingPreset?.default_prompt_en || preset.defaultPrompt?.en || '',
      default_prompt_de: existingPreset?.default_prompt_de || preset.defaultPrompt?.de || '',
      default_functions: existingPreset?.default_functions || preset.functions || [],
    });
    setIsModalOpen(true);
  };

  const handleSync = async (presetId, language, e) => {
    e.stopPropagation();
    const langNames = { tr: 'Turkish', en: 'English', de: 'German' };
    if (!confirm(`This will create/update ${langNames[language]} assistant for all tenants using this preset. Continue?`)) {
      return;
    }

    const syncKey = `${presetId}_${language}`;
    try {
      setSyncingPreset(syncKey);
      const response = await adminAPI.syncPreset(presetId, language);
      alert(`Synced ${response.data.results?.length || 0} tenants for ${langNames[language]} successfully!`);
    } catch (error) {
      console.error('Failed to sync:', error);
      alert('Failed to sync: ' + (error.response?.data?.message || error.message));
    } finally {
      setSyncingPreset(null);
    }
  };

  const handleSave = async () => {
    if (!selectedPreset) return;

    setSaving(true);
    try {
      const existingPreset = presets.find(p => p.industry === selectedPreset.id);
      if (existingPreset?.id) {
        await adminAPI.updatePreset(existingPreset.id, {
          ...formData,
          industry: selectedPreset.id,
        });
      }
      await fetchPresets();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save preset:', error);
    } finally {
      setSaving(false);
    }
  };

  const industryPresets = [
    {
      id: 'automotive',
      name: 'Automotive',
      description: 'Car dealerships and automotive services',
      icon: '🚗',
      features: ['Test drive booking', 'Vehicle inquiry', 'Service appointments'],
      functions: ['get_available_vehicles', 'create_test_drive_appointment', 'create_service_appointment'],
      defaultPrompt: {
        tr: 'Sen bir otomotiv bayisinin sesli asistanısın. Test sürüşü ve servis randevuları oluşturabilirsin.',
        en: 'You are a voice assistant for an automotive dealership. You can create test drives and service appointments.',
        de: 'Sie sind ein Sprachassistent für ein Autohaus. Sie können Probefahrten und Servicetermine erstellen.',
      },
    },
    {
      id: 'beauty_salon',
      name: 'Beauty Salon',
      description: 'Skin care, nails, makeup and SPA services',
      icon: '💅',
      features: ['Beauty appointments', 'Skin & nail care', 'SPA services'],
      functions: ['get_beauty_services', 'create_beauty_appointment', 'get_available_slots', 'get_active_promotions', 'get_loyalty_points'],
      defaultPrompt: {
        tr: 'Sen bir güzellik salonunun sesli asistanısın. Cilt bakımı, manikür, makyaj ve SPA randevuları oluşturabilirsin.',
        en: 'You are a voice assistant for a beauty salon. You can create appointments for skin care, nails, makeup and SPA.',
        de: 'Sie sind ein Sprachassistent für einen Schönheitssalon. Sie können Termine für Hautpflege, Nägel, Make-up und SPA erstellen.',
      },
    },
    {
      id: 'hairdresser',
      name: 'Hairdresser',
      description: 'Hair cutting, coloring and styling services',
      icon: '✂️',
      features: ['Hair appointments', 'Stylist selection', 'Hair care services'],
      functions: ['get_hairdresser_services', 'create_beauty_appointment', 'get_available_slots', 'get_available_staff', 'book_with_staff', 'get_customer_history'],
      defaultPrompt: {
        tr: 'Sen bir kuaförün sesli asistanısın. Saç kesimi, boyama ve fön randevuları oluşturabilir, kuaför seçimi yapabilirsin.',
        en: 'You are a voice assistant for a hairdresser. You can create appointments for hair cutting, coloring and styling, and select stylists.',
        de: 'Sie sind ein Sprachassistent für einen Friseur. Sie können Termine für Haarschnitt, Färben und Styling erstellen und Stylisten auswählen.',
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-indigo-100">
          <Palette className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('admin.presets')}</h1>
          <p className="text-slate-500 mt-1">
            Industry-specific configurations and templates
          </p>
        </div>
      </div>

      {/* Presets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {industryPresets.map((preset) => (
          <Card key={preset.id}>
            <CardContent>
              <div className="flex items-start gap-4">
                <div className="text-4xl">{preset.icon}</div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    {preset.name}
                  </h3>
                  <p className="text-slate-500 text-sm mb-4">
                    {preset.description}
                  </p>
                  <div className="space-y-2 mb-4">
                    {preset.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="text-indigo-600">✓</span>
                        {feature}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleConfigure(preset)}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Button>
                    {/* Language-specific sync buttons */}
                    {['tr', 'en', 'de'].map((lang) => (
                      <Button
                        key={lang}
                        variant="secondary"
                        size="sm"
                        onClick={(e) => handleSync(preset.id, lang, e)}
                        disabled={syncingPreset === `${preset.id}_${lang}`}
                        title={`Sync ${lang.toUpperCase()} assistant`}
                      >
                        {syncingPreset === `${preset.id}_${lang}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3 mr-1" />
                            {lang.toUpperCase()}
                          </>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Configure Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Configure ${selectedPreset?.name || ''}`}
        size="lg"
      >
        {selectedPreset && (
          <div className="space-y-6">
            {/* Preset Info */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50">
              <div className="text-4xl">{selectedPreset.icon}</div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedPreset.name}</h3>
                <p className="text-sm text-slate-500">{selectedPreset.description}</p>
              </div>
            </div>

            {/* Name Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  <Globe className="w-4 h-4 inline mr-1" />
                  Name (Turkish)
                </label>
                <input
                  type="text"
                  value={formData.name_tr}
                  onChange={(e) => setFormData({ ...formData, name_tr: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  <Globe className="w-4 h-4 inline mr-1" />
                  Name (English)
                </label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* System Prompts */}
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                Default System Prompts
              </h4>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Turkish Prompt</label>
                <textarea
                  value={formData.default_prompt_tr}
                  onChange={(e) => setFormData({ ...formData, default_prompt_tr: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">English Prompt</label>
                <textarea
                  value={formData.default_prompt_en}
                  onChange={(e) => setFormData({ ...formData, default_prompt_en: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">German Prompt</label>
                <textarea
                  value={formData.default_prompt_de}
                  onChange={(e) => setFormData({ ...formData, default_prompt_de: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Available Functions */}
            <div>
              <h4 className="text-md font-semibold text-slate-900 flex items-center gap-2 mb-3">
                <Mic className="w-5 h-5 text-indigo-600" />
                Available Functions
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedPreset.functions?.map((func, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-700 border border-indigo-200"
                  >
                    {func}
                  </span>
                ))}
              </div>
            </div>

            <ModalFooter>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </div>
  );
};
