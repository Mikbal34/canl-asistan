import { useState, useEffect } from 'react';
import {
  CheckCircle,
  Circle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Info,
  Wrench,
  Save,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useCaseAPI, voiceConfigAPI } from '../../services/api';

/**
 * Tenant Use Case Settings Page
 * Allows tenant admin to manage which use cases are enabled
 */
export const UseCaseSettings = () => {
  const [useCases, setUseCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Original state for tracking changes
  const [originalState, setOriginalState] = useState({});

  // Category display config
  const categoryConfig = {
    core: {
      title: 'Temel Özellikler',
      description: 'Zorunlu temel özellikler',
      color: 'bg-blue-100 text-blue-700 border-blue-200',
    },
    automotive: {
      title: 'Otomotiv Özellikleri',
      color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    },
    beauty: {
      title: 'Güzellik Özellikleri',
      color: 'bg-pink-100 text-pink-700 border-pink-200',
    },
    addon: {
      title: 'Ek Özellikler',
      description: 'İsteğe bağlı eklentiler',
      color: 'bg-purple-100 text-purple-700 border-purple-200',
    },
  };

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data } = await useCaseAPI.getAvailableUseCases();
        setUseCases(data || []);

        // Store original state
        const original = {};
        (data || []).forEach(uc => {
          original[uc.id] = uc.enabled;
        });
        setOriginalState(original);
      } catch (err) {
        console.error('Error fetching use cases:', err);
        setError('Veriler yüklenirken bir hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Check for changes
  useEffect(() => {
    const currentState = {};
    useCases.forEach(uc => {
      currentState[uc.id] = uc.enabled;
    });

    const changed = Object.keys(currentState).some(
      id => currentState[id] !== originalState[id]
    );
    setHasChanges(changed);
  }, [useCases, originalState]);

  // Toggle use case
  const toggleUseCase = (useCaseId) => {
    setUseCases(prev => prev.map(uc => {
      if (uc.id === useCaseId && uc.category !== 'core') {
        return { ...uc, enabled: !uc.enabled };
      }
      return uc;
    }));
  };

  // Save changes
  const saveChanges = async () => {
    setSaving(true);
    setError(null);

    try {
      const enabledIds = useCases.filter(uc => uc.enabled).map(uc => uc.id);
      await useCaseAPI.setTenantUseCases(enabledIds, false);

      // Update original state
      const newOriginal = {};
      useCases.forEach(uc => {
        newOriginal[uc.id] = uc.enabled;
      });
      setOriginalState(newOriginal);

      setSuccessMessage('Ayarlar kaydedildi');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error saving:', err);
      setError('Kaydedilirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  // Save and sync to VAPI
  const saveAndSync = async () => {
    setSyncing(true);
    setError(null);

    try {
      const enabledIds = useCases.filter(uc => uc.enabled).map(uc => uc.id);
      await useCaseAPI.setTenantUseCases(enabledIds, true);

      // Update original state
      const newOriginal = {};
      useCases.forEach(uc => {
        newOriginal[uc.id] = uc.enabled;
      });
      setOriginalState(newOriginal);

      setSuccessMessage('Ayarlar kaydedildi ve asistana uygulandı');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error saving and syncing:', err);
      setError('Senkronizasyon sırasında bir hata oluştu');
    } finally {
      setSyncing(false);
    }
  };

  // Group use cases by category
  const groupedUseCases = useCases.reduce((acc, uc) => {
    const category = uc.category || 'addon';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(uc);
    return acc;
  }, {});

  // Get icon component
  const getIcon = (iconName) => {
    return LucideIcons[iconName] || LucideIcons.Box;
  };

  // Calculate stats
  const enabledCount = useCases.filter(uc => uc.enabled).length;
  const totalToolCount = useCases
    .filter(uc => uc.enabled)
    .reduce((acc, uc) => acc + (uc.tools?.length || 0), 0);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
        <p className="text-slate-500">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Asistan Özellikleri</h1>
          <p className="text-slate-500 mt-1">
            Asistanınızın hangi özellikleri kullanacağını yönetin
          </p>
        </div>

        {/* Save Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={saveChanges}
            disabled={!hasChanges || saving || syncing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              hasChanges && !saving && !syncing
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-50 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Kaydet
          </button>
          <button
            onClick={saveAndSync}
            disabled={!hasChanges || saving || syncing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              hasChanges && !saving && !syncing
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Kaydet ve Uygula
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <p className="text-emerald-700">{successMessage}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Aktif Özellikler</p>
          <p className="text-2xl font-bold text-slate-900">
            {enabledCount} / {useCases.length}
          </p>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Toplam Araç (Tool)</p>
          <p className="text-2xl font-bold text-indigo-600">{totalToolCount}</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-blue-800 font-medium mb-1">Değişiklikleri Uygulamak</p>
          <p className="text-blue-700">
            Yaptığınız değişikliklerin asistana yansıması için "Kaydet ve Uygula" butonunu kullanın.
            Sadece "Kaydet" yaparsanız değişiklikler bir sonraki senkronizasyonda uygulanır.
          </p>
        </div>
      </div>

      {/* Use Case Categories */}
      <div className="space-y-8">
        {Object.entries(groupedUseCases).map(([category, items]) => {
          if (!items || items.length === 0) return null;

          const catConfig = categoryConfig[category] || categoryConfig.addon;

          return (
            <div key={category}>
              {/* Category Header */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${catConfig.color}`}>
                    {catConfig.title}
                  </span>
                  {category === 'core' && (
                    <span className="text-xs text-gray-500">(Zorunlu)</span>
                  )}
                </div>
                {catConfig.description && (
                  <p className="text-sm text-gray-500">{catConfig.description}</p>
                )}
              </div>

              {/* Use Case Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.sort((a, b) => a.display_order - b.display_order).map(useCase => {
                  const isCore = useCase.category === 'core';
                  const Icon = getIcon(useCase.icon);
                  const toolCount = useCase.tools?.length || 0;

                  return (
                    <button
                      key={useCase.id}
                      onClick={() => toggleUseCase(useCase.id)}
                      disabled={isCore}
                      className={`
                        relative p-4 rounded-xl border text-left transition-all duration-200
                        ${useCase.enabled
                          ? 'bg-indigo-50 border-indigo-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                        }
                        ${isCore ? 'cursor-default opacity-80' : 'cursor-pointer'}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div className="flex-shrink-0 mt-0.5">
                          {useCase.enabled ? (
                            <CheckCircle className={`w-5 h-5 ${isCore ? 'text-slate-400' : 'text-indigo-600'}`} />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300" />
                          )}
                        </div>

                        {/* Icon */}
                        <div className={`
                          flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                          ${useCase.enabled ? 'bg-indigo-100' : 'bg-slate-100'}
                        `}>
                          <Icon className={`w-5 h-5 ${useCase.enabled ? 'text-indigo-600' : 'text-slate-400'}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-medium ${useCase.enabled ? 'text-slate-900' : 'text-slate-600'}`}>
                            {useCase.name_tr}
                          </h3>
                          <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                            {useCase.description_tr}
                          </p>
                          <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                            <Wrench className="w-3 h-3" />
                            {toolCount} araç
                          </div>
                        </div>
                      </div>

                      {/* Core badge */}
                      {isCore && (
                        <div className="absolute top-2 right-2">
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                            Zorunlu
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <span className="text-amber-700">Kaydedilmemiş değişiklikler var</span>
        </div>
      )}
    </div>
  );
};

export default UseCaseSettings;
