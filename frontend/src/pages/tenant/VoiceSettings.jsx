import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mic,
  Volume2,
  Brain,
  MessageSquare,
  Save,
  RefreshCw,
  RotateCcw,
  Loader2,
  Settings,
  Check,
  Play,
  Info,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { voiceConfigAPI, tenantAPI } from '../../services/api';

const VOICE_PROVIDERS = [
  { id: 'elevenlabs', name: 'ElevenLabs' },
  { id: 'deepgram', name: 'Deepgram' },
];

/**
 * Tenant Voice Settings page
 * Override voice AI settings from industry preset
 */
export const VoiceSettings = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [tenant, setTenant] = useState(null);
  const [config, setConfig] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [enabledOverrides, setEnabledOverrides] = useState({});
  const [selectedLanguage, setSelectedLanguage] = useState('tr');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedLanguage]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tenantRes, configRes] = await Promise.all([
        tenantAPI.getSettings(),
        voiceConfigAPI.get(selectedLanguage),
      ]);

      setTenant(tenantRes.data);
      setConfig(configRes.data);

      // Set current overrides
      const currentOverride = configRes.data.override || {};
      setOverrides(currentOverride);

      // Determine which fields are overridden
      setEnabledOverrides({
        voice: !!currentOverride.voice_id,
        greeting: !!currentOverride.first_message,
        prompt: !!currentOverride.system_prompt,
      });
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideToggle = (field) => {
    setEnabledOverrides((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
    setHasChanges(true);
  };

  const handleInputChange = (field, value) => {
    setOverrides((prev) => ({
      ...prev,
      [field]: value,
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Build override config based on enabled toggles
      const overrideConfig = {};

      if (enabledOverrides.voice) {
        overrideConfig.voice_id = overrides.voice_id;
        overrideConfig.voice_provider = overrides.voice_provider;
        overrideConfig.voice_speed = overrides.voice_speed;
      }

      if (enabledOverrides.greeting) {
        overrideConfig.first_message = overrides.first_message;
      }

      if (enabledOverrides.prompt) {
        overrideConfig.system_prompt = overrides.system_prompt;
      }

      await voiceConfigAPI.update(overrideConfig);
      setHasChanges(false);
      alert('Settings saved successfully!');
      fetchData(); // Refresh
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await voiceConfigAPI.sync();
      alert('Synced to VAPI successfully!');
    } catch (error) {
      console.error('Failed to sync:', error);
      alert('Failed to sync: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('This will reset all custom voice settings to preset defaults. Continue?')) {
      return;
    }

    try {
      setResetting(true);
      await voiceConfigAPI.reset(true);
      setOverrides({});
      setEnabledOverrides({});
      setHasChanges(false);
      alert('Settings reset to preset defaults!');
      fetchData();
    } catch (error) {
      console.error('Failed to reset:', error);
      alert('Failed to reset: ' + error.message);
    } finally {
      setResetting(false);
    }
  };

  const presetConfig = config?.preset || {};
  const mergedConfig = config?.merged || {};

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-indigo-100">
            <Mic className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Voice AI Settings</h1>
            <p className="text-slate-500 text-sm">
              Customize voice assistant settings for your business
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4 mr-2" />
            )}
            Reset to Defaults
          </Button>
          <Button
            variant="secondary"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync to VAPI
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

      {/* Current Preset Info */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-slate-600">
                  Using preset: <span className="text-slate-900 font-medium capitalize">{tenant?.industry}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Model: {presetConfig.model || 'gpt-4o-mini'} | Voice: {presetConfig.voice_provider || 'elevenlabs'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {(tenant?.supported_languages || ['tr']).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedLanguage === lang
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voice Override */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-indigo-600" />
              Custom Voice
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledOverrides.voice || false}
                onChange={() => handleOverrideToggle('voice')}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-500">Override</span>
            </label>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!enabledOverrides.voice ? (
            <p className="text-slate-500 text-sm">
              Using preset voice: {presetConfig.voice_id || 'Default'}
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Voice Provider
                </label>
                <select
                  value={overrides.voice_provider || presetConfig.voice_provider || 'elevenlabs'}
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
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Voice ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={overrides.voice_id || ''}
                    onChange={(e) => handleInputChange('voice_id', e.target.value)}
                    placeholder={presetConfig.voice_id || 'Enter voice ID'}
                    className="flex-1 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                  <Button variant="secondary" size="sm">
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Voice Speed: {overrides.voice_speed || presetConfig.voice_speed || 1.0}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={overrides.voice_speed || presetConfig.voice_speed || 1.0}
                  onChange={(e) => handleInputChange('voice_speed', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Greeting Override */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Custom Greeting
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledOverrides.greeting || false}
                onChange={() => handleOverrideToggle('greeting')}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-500">Override</span>
            </label>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!enabledOverrides.greeting ? (
            <p className="text-slate-500 text-sm">
              Using preset greeting: "{mergedConfig.first_message?.substring(0, 100) || 'Default'}..."
            </p>
          ) : (
            <textarea
              value={overrides.first_message || ''}
              onChange={(e) => handleInputChange('first_message', e.target.value)}
              placeholder={mergedConfig.first_message || 'Enter custom greeting...'}
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none resize-none"
            />
          )}
        </CardContent>
      </Card>

      {/* System Prompt Override */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-600" />
              Custom System Prompt
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledOverrides.prompt || false}
                onChange={() => handleOverrideToggle('prompt')}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-500">Override</span>
            </label>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!enabledOverrides.prompt ? (
            <p className="text-slate-500 text-sm">
              Using preset system prompt for {tenant?.industry || 'your industry'}.
            </p>
          ) : (
            <>
              <div className="mb-2">
                <p className="text-xs text-slate-500">
                  Available placeholders: {'{FIRMA_ADI}'}, {'{ASISTAN_ADI}'}, {'{TELEFON}'}, {'{EMAIL}'}, {'{TARIH}'}, {'{SAAT}'}
                </p>
              </div>
              <textarea
                value={overrides.system_prompt || ''}
                onChange={(e) => handleInputChange('system_prompt', e.target.value)}
                placeholder={mergedConfig.system_prompt?.substring(0, 200) + '...' || 'Enter custom system prompt...'}
                rows={10}
                className="w-full px-4 py-3 rounded-lg bg-white border border-slate-200 text-slate-900 font-mono text-sm focus:border-indigo-500 focus:outline-none resize-none"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Active Languages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            Active Languages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {['tr', 'en', 'de'].map((lang) => {
              const isActive = (tenant?.supported_languages || ['tr']).includes(lang);
              const isDefault = tenant?.default_language === lang;
              return (
                <div
                  key={lang}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    isActive ? 'bg-indigo-50 border border-indigo-200' : 'bg-slate-50 border border-slate-200'
                  }`}
                >
                  {isActive && <Check className="w-4 h-4 text-indigo-600" />}
                  <span className={isActive ? 'text-slate-900' : 'text-slate-500'}>
                    {lang.toUpperCase()}
                  </span>
                  {isDefault && (
                    <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded">Primary</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Contact support to add or remove languages.
          </p>
        </CardContent>
      </Card>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span className="text-sm">You have unsaved changes</span>
          <Button size="sm" variant="ghost" onClick={handleSave}>
            Save Now
          </Button>
        </div>
      )}
    </div>
  );
};
