import { useState, useEffect } from 'react';
import {
  Package,
  Check,
  Star,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  Wrench,
  Zap,
  Crown,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';

// Tier configuration
const tierConfig = {
  basic: {
    label: 'Basic',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Package,
  },
  standard: {
    label: 'Standard',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Zap,
  },
  premium: {
    label: 'Premium',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Crown,
  },
};

/**
 * TemplateSelector - Select and assign assistant template to tenant
 * Used in TenantDetail admin page
 */
export const TemplateSelector = ({
  tenantId,
  industry,
  currentTemplateId,
  onTemplateAssigned,
  templates = [],
  loading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState(currentTemplateId || null);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState(null);

  // Update selected when current changes
  useEffect(() => {
    setSelectedTemplateId(currentTemplateId);
  }, [currentTemplateId]);

  // Filter templates by industry
  const filteredTemplates = templates.filter(t => t.industry === industry);

  // Get icon component
  const getIcon = (iconName) => {
    return LucideIcons[iconName] || LucideIcons.Package;
  };

  // Handle template selection
  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
    setError(null);
  };

  // Handle assign button click
  const handleAssign = async () => {
    if (!selectedTemplateId) {
      setError('Lütfen bir şablon seçin');
      return;
    }

    if (selectedTemplateId === currentTemplateId) {
      setError('Bu şablon zaten atanmış');
      return;
    }

    setAssigning(true);
    setError(null);

    try {
      await onTemplateAssigned(selectedTemplateId);
    } catch (err) {
      console.error('Error assigning template:', err);
      setError(err.message || 'Şablon atama hatası');
    } finally {
      setAssigning(false);
    }
  };

  // Check if selection changed
  const hasChanges = selectedTemplateId !== currentTemplateId;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Package className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">Asistan Şablonu</h3>
            <p className="text-sm text-slate-500">
              {currentTemplateId ? 'Şablon atanmış' : 'Şablon seçilmedi'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="warning" className="text-xs">
              Değişiklik var
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="py-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-slate-500">Şablonlar yükleniyor...</p>
            </div>
          )}

          {/* No templates */}
          {!loading && filteredTemplates.length === 0 && (
            <div className="py-8 text-center">
              <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">Bu sektör için şablon bulunamadı</p>
            </div>
          )}

          {/* Template cards */}
          {!loading && filteredTemplates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => {
                const isSelected = selectedTemplateId === template.id;
                const isCurrent = currentTemplateId === template.id;
                const tier = tierConfig[template.tier] || tierConfig.standard;
                const Icon = getIcon(template.icon);
                const TierIcon = tier.icon;

                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template.id)}
                    disabled={assigning}
                    className={`
                      relative p-4 rounded-xl border-2 text-left transition-all
                      ${isSelected
                        ? 'border-indigo-500 bg-indigo-50 shadow-md'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                      }
                      ${assigning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {/* Featured badge */}
                    {template.is_featured && (
                      <div className="absolute -top-2 -right-2">
                        <div className="bg-amber-400 text-amber-900 text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          Önerilen
                        </div>
                      </div>
                    )}

                    {/* Current badge */}
                    {isCurrent && (
                      <div className="absolute -top-2 -left-2">
                        <div className="bg-emerald-500 text-white text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Mevcut
                        </div>
                      </div>
                    )}

                    {/* Selection indicator */}
                    <div className={`
                      absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center
                      ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 bg-white'}
                    `}>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>

                    {/* Icon and tier */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`
                        w-12 h-12 rounded-xl flex items-center justify-center
                        ${isSelected ? 'bg-indigo-100' : 'bg-slate-100'}
                      `}>
                        <Icon className={`w-6 h-6 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`} />
                      </div>
                      <div className={`px-2 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 ${tier.color}`}>
                        <TierIcon className="w-3 h-3" />
                        {tier.label}
                      </div>
                    </div>

                    {/* Title and description */}
                    <h4 className={`font-semibold mb-1 ${isSelected ? 'text-indigo-900' : 'text-slate-900'}`}>
                      {template.name_tr}
                    </h4>
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                      {template.description_tr}
                    </p>

                    {/* Use cases count */}
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Wrench className="w-3 h-3" />
                      {template.included_use_cases?.length || 0} özellik
                    </div>

                    {/* Included use cases preview */}
                    {template.included_use_cases && template.included_use_cases.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="flex flex-wrap gap-1">
                          {template.included_use_cases.slice(0, 4).map((ucId, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded"
                            >
                              {ucId}
                            </span>
                          ))}
                          {template.included_use_cases.length > 4 && (
                            <span className="text-xs text-slate-400">
                              +{template.included_use_cases.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          {!loading && filteredTemplates.length > 0 && (
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                {selectedTemplateId && (
                  <>
                    Seçili: <span className="font-medium text-slate-700">
                      {filteredTemplates.find(t => t.id === selectedTemplateId)?.name_tr}
                    </span>
                  </>
                )}
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAssign}
                disabled={!hasChanges || assigning}
              >
                {assigning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Atanıyor...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Şablonu Ata & Sync
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;
