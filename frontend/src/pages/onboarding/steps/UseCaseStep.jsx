import { useState, useEffect } from 'react';
import {
  CheckCircle,
  Circle,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Info,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useCaseAPI } from '../../../services/api';

/**
 * Use Case Selection Step for Onboarding
 * Allows tenant to select which use cases (features) they want to enable
 */
export const UseCaseStep = ({
  data,
  industry,
  config,
  onUpdate,
  onNext,
  onBack,
}) => {
  const [useCases, setUseCases] = useState([]);
  const [selectedUseCases, setSelectedUseCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Category display config
  const categoryConfig = {
    core: {
      title: 'Temel Özellikler',
      description: 'Tüm işletmeler için gerekli temel özellikler',
      color: 'bg-blue-100 text-blue-700 border-blue-200',
      required: true,
    },
    automotive: {
      title: 'Otomotiv Özellikleri',
      description: 'Araç satış ve servis bayileri için özel özellikler',
      color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      required: false,
    },
    beauty: {
      title: 'Güzellik Salonu Özellikleri',
      description: 'Kuaför ve güzellik salonları için özel özellikler',
      color: 'bg-pink-100 text-pink-700 border-pink-200',
      required: false,
    },
    addon: {
      title: 'Ek Özellikler',
      description: 'İsteğe bağlı ekstra özellikler',
      color: 'bg-purple-100 text-purple-700 border-purple-200',
      required: false,
    },
  };

  // Fetch use cases on mount
  useEffect(() => {
    const fetchUseCases = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get all use cases for this industry
        const { data: allUseCases } = await useCaseAPI.getAll({ industry });
        setUseCases(allUseCases || []);

        // Get default use cases and pre-select them
        const { data: defaults } = await useCaseAPI.getDefaults(industry);
        const defaultIds = (defaults || []).map(uc => uc.id);

        // If we have previously selected use cases in wizard data, use those
        if (data.selectedUseCases && data.selectedUseCases.length > 0) {
          setSelectedUseCases(data.selectedUseCases);
        } else {
          setSelectedUseCases(defaultIds);
        }
      } catch (err) {
        console.error('Error fetching use cases:', err);
        setError('Özellikler yüklenirken bir hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    fetchUseCases();
  }, [industry, data.selectedUseCases]);

  // Toggle use case selection
  const toggleUseCase = (useCaseId, isCore) => {
    if (isCore) return; // Core use cases cannot be deselected

    setSelectedUseCases(prev => {
      if (prev.includes(useCaseId)) {
        return prev.filter(id => id !== useCaseId);
      } else {
        return [...prev, useCaseId];
      }
    });
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

  // Handle next step
  const handleNext = async () => {
    setSaving(true);
    setError(null);

    try {
      // Update wizard data with selected use cases
      onUpdate({ selectedUseCases });
      onNext();
    } catch (err) {
      console.error('Error saving use cases:', err);
      setError('Kaydedilirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
        <p className="text-slate-500">Özellikler yükleniyor...</p>
      </div>
    );
  }

  // Get the icon component
  const getIcon = (iconName) => {
    return LucideIcons[iconName] || LucideIcons.Box;
  };

  // Count selected tools
  const selectedToolCount = useCases
    .filter(uc => selectedUseCases.includes(uc.id))
    .reduce((acc, uc) => acc + (uc.tools?.length || 0), 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Asistan Özelliklerini Seçin
        </h2>
        <p className="text-slate-500">
          Asistanınızın hangi özelliklere sahip olacağını belirleyin.
          İstediğiniz zaman değiştirebilirsiniz.
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-blue-700 font-medium mb-1">Nasıl Çalışır?</p>
          <p className="text-blue-600">
            Her özellik, asistanınızın kullanabileceği belirli yetenekleri (tool'ları) içerir.
            Seçtiğiniz özellikler asistanınızın müşterilere nasıl yardımcı olabileceğini belirler.
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Use Case Categories */}
      <div className="space-y-8">
        {/* Core first, then industry-specific, then addons */}
        {['core', industry, 'addon'].map(category => {
          const items = groupedUseCases[category];
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
                  {catConfig.required && (
                    <span className="text-xs text-gray-500">(Zorunlu)</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{catConfig.description}</p>
              </div>

              {/* Use Case Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.sort((a, b) => a.display_order - b.display_order).map(useCase => {
                  const isSelected = selectedUseCases.includes(useCase.id);
                  const isCore = useCase.category === 'core';
                  const Icon = getIcon(useCase.icon);
                  const toolCount = useCase.tools?.length || 0;

                  return (
                    <button
                      key={useCase.id}
                      onClick={() => toggleUseCase(useCase.id, isCore)}
                      disabled={isCore}
                      className={`
                        relative p-4 rounded-xl border text-left transition-all duration-200
                        ${isSelected
                          ? 'bg-indigo-50 border-indigo-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                        }
                        ${isCore ? 'cursor-default' : 'cursor-pointer'}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div className="flex-shrink-0 mt-0.5">
                          {isSelected ? (
                            <CheckCircle className={`w-5 h-5 ${isCore ? 'text-slate-400' : 'text-indigo-600'}`} />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300" />
                          )}
                        </div>

                        {/* Icon */}
                        <div className={`
                          flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                          ${isSelected ? 'bg-indigo-100' : 'bg-slate-100'}
                        `}>
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                            {useCase.name_tr}
                          </h3>
                          <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                            {useCase.description_tr}
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            {toolCount} araç (tool) içerir
                          </p>
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

      {/* Summary */}
      <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Seçilen özellikler: <span className="text-slate-900 font-medium">{selectedUseCases.length}</span>
          </span>
          <span className="text-slate-500">
            Toplam araç sayısı: <span className="text-indigo-600 font-medium">{selectedToolCount}</span>
          </span>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Geri
        </button>

        <button
          onClick={handleNext}
          disabled={saving || selectedUseCases.length === 0}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
            ${saving || selectedUseCases.length === 0
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }
          `}
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Kaydediliyor...
            </>
          ) : (
            <>
              Devam Et
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default UseCaseStep;
