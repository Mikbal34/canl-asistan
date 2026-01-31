import { useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  Upload,
  FileSpreadsheet,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Clock,
  Check,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { DynamicField } from './DynamicField';
import { Button } from './Button';

// Days of week for working hours
const DAYS = [
  { value: 1, label: 'Pazartesi' },
  { value: 2, label: 'Sali' },
  { value: 3, label: 'Carsamba' },
  { value: 4, label: 'Persembe' },
  { value: 5, label: 'Cuma' },
  { value: 6, label: 'Cumartesi' },
  { value: 0, label: 'Pazar' },
];

const DEFAULT_HOURS = {
  1: { open_time: '09:00', close_time: '18:00', is_open: true },
  2: { open_time: '09:00', close_time: '18:00', is_open: true },
  3: { open_time: '09:00', close_time: '18:00', is_open: true },
  4: { open_time: '09:00', close_time: '18:00', is_open: true },
  5: { open_time: '09:00', close_time: '18:00', is_open: true },
  6: { open_time: '10:00', close_time: '16:00', is_open: true },
  0: { open_time: '', close_time: '', is_open: false },
};

/**
 * Validates form values against field configuration
 */
export const validateStepFields = (fields, values) => {
  const errors = {};

  fields.forEach((field) => {
    const value = values[field.name];

    // Required check
    if (field.required) {
      if (value === undefined || value === null || value === '') {
        errors[field.name] = `${field.label} zorunludur`;
        return;
      }
    }

    // Skip further validation if empty and not required
    if (!value && !field.required) return;

    // Validation rules
    if (field.validation) {
      const v = field.validation;

      if (v.minLength && typeof value === 'string' && value.length < v.minLength) {
        errors[field.name] = `En az ${v.minLength} karakter olmalıdır`;
      }

      if (v.maxLength && typeof value === 'string' && value.length > v.maxLength) {
        errors[field.name] = `En fazla ${v.maxLength} karakter olabilir`;
      }

      if (v.min !== undefined && typeof value === 'number' && value < v.min) {
        errors[field.name] = `Minimum değer ${v.min} olmalıdır`;
      }

      if (v.max !== undefined && typeof value === 'number' && value > v.max) {
        errors[field.name] = `Maksimum değer ${v.max} olabilir`;
      }

      if (v.pattern && typeof value === 'string') {
        const regex = new RegExp(v.pattern);
        if (!regex.test(value)) {
          errors[field.name] = v.patternMessage || 'Geçersiz format';
        }
      }
    }

    // Email validation
    if (field.type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors[field.name] = 'Geçerli bir email adresi girin';
      }
    }

    // Phone validation (basic)
    if (field.type === 'tel' && value) {
      const phoneRegex = /^[\d\s+()-]{10,}$/;
      if (!phoneRegex.test(value)) {
        errors[field.name] = 'Geçerli bir telefon numarası girin';
      }
    }
  });

  return errors;
};

/**
 * Config-driven step renderer
 * Supports: form fields, catalog (items list), working_hours, custom components
 */
export const DynamicStep = ({
  stepConfig,
  values,
  onChange,
  onNext,
  onBack,
  onSkip,
  loading,
  error,
  isFirstStep,
  isLastStep,
  customComponents = {},
  onFileUpload,
}) => {
  const [fieldErrors, setFieldErrors] = useState({});
  const [catalogItems, setCatalogItems] = useState(values.catalogItems || []);
  const [newItem, setNewItem] = useState({});
  const [workingHours, setWorkingHours] = useState(values.workingHours || DEFAULT_HOURS);
  const fileInputRef = useRef(null);

  // Get icon component
  const IconComponent = stepConfig.icon ? LucideIcons[stepConfig.icon] : null;

  // Handle form field change
  const handleFieldChange = (fieldName, value) => {
    onChange({ ...values, [fieldName]: value });
    // Clear error when field changes
    if (fieldErrors[fieldName]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  // Validate and proceed
  const handleNext = () => {
    if (stepConfig.fields) {
      const errors = validateStepFields(stepConfig.fields, values);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
    }
    onNext();
  };

  // Handle catalog item add
  const handleAddItem = () => {
    if (!stepConfig.fields) return;

    // Validate required fields for catalog item
    const requiredFields = stepConfig.fields.filter((f) => f.required);
    const missingFields = requiredFields.filter((f) => !newItem[f.name]);

    if (missingFields.length > 0) {
      setFieldErrors({
        _catalog: `${missingFields.map((f) => f.label).join(', ')} zorunludur`,
      });
      return;
    }

    const itemWithId = { ...newItem, id: Date.now() };
    const updatedItems = [...catalogItems, itemWithId];
    setCatalogItems(updatedItems);
    onChange({ ...values, catalogItems: updatedItems });
    setNewItem({});
    setFieldErrors({});
  };

  // Handle catalog item remove
  const handleRemoveItem = (id) => {
    const updatedItems = catalogItems.filter((item) => item.id !== id);
    setCatalogItems(updatedItems);
    onChange({ ...values, catalogItems: updatedItems });
  };

  // Handle working hours change
  const handleHoursChange = (day, field, value) => {
    const updated = {
      ...workingHours,
      [day]: {
        ...workingHours[day],
        [field]: value,
      },
    };
    setWorkingHours(updated);
    onChange({ ...values, workingHours: updated });
  };

  // Handle day toggle
  const handleDayToggle = (day) => {
    const updated = {
      ...workingHours,
      [day]: {
        ...workingHours[day],
        is_open: !workingHours[day]?.is_open,
      },
    };
    setWorkingHours(updated);
    onChange({ ...values, workingHours: updated });
  };

  // Render step header
  const renderHeader = () => (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        {IconComponent && (
          <div className="p-2 rounded-lg bg-indigo-100">
            <IconComponent className="w-6 h-6 text-indigo-600" />
          </div>
        )}
        <h2 className="text-2xl font-bold text-slate-900">{stepConfig.title}</h2>
      </div>
      {stepConfig.description && (
        <p className="text-slate-500">{stepConfig.description}</p>
      )}
    </div>
  );

  // Render error message
  const renderError = () =>
    error ? (
      <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600">
        {error}
      </div>
    ) : null;

  // Render form fields
  const renderFormFields = () => {
    if (!stepConfig.fields) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stepConfig.fields.map((field) => (
            <DynamicField
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={handleFieldChange}
              error={fieldErrors[field.name]}
            />
          ))}
        </div>
      </div>
    );
  };

  // Render catalog (items list) step
  const renderCatalog = () => {
    if (stepConfig.type !== 'catalog') return null;

    return (
      <div className="space-y-6">
        {/* CSV Upload Option */}
        {stepConfig.csvSupport && (
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-6 h-6 text-slate-500" />
              <div>
                <p className="text-slate-900 font-medium">CSV ile Toplu Yükle</p>
                <p className="text-sm text-slate-500">
                  {stepConfig.fields?.map((f) => f.label).join(', ')}
                </p>
              </div>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => onFileUpload?.(e.target.files?.[0], stepConfig.catalogTable)}
                className="hidden"
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <Upload className="w-4 h-4 mr-2" />
                CSV Yükle
              </Button>
            </div>
          </div>
        )}

        {/* Manual Entry Form */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Manuel Ekle</h3>
          {fieldErrors._catalog && (
            <p className="text-red-600 text-sm mb-4">{fieldErrors._catalog}</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stepConfig.fields?.map((field) => (
              <DynamicField
                key={field.name}
                field={field}
                value={newItem[field.name]}
                onChange={(name, value) => setNewItem({ ...newItem, [name]: value })}
                error={fieldErrors[field.name]}
              />
            ))}
            <div className="flex items-end">
              <Button onClick={handleAddItem} variant="primary">
                <Plus className="w-4 h-4 mr-2" />
                Ekle
              </Button>
            </div>
          </div>
        </div>

        {/* Items List */}
        {catalogItems.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-slate-900">
              Eklenenler ({catalogItems.length})
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {catalogItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200"
                >
                  <div className="flex items-center gap-4">
                    {IconComponent && <IconComponent className="w-5 h-5 text-slate-500" />}
                    <div>
                      <p className="text-slate-900 font-medium">
                        {stepConfig.fields
                          ?.slice(0, 2)
                          .map((f) => item[f.name])
                          .filter(Boolean)
                          .join(' ')}
                      </p>
                      <p className="text-sm text-slate-500">
                        {stepConfig.fields
                          ?.slice(2, 5)
                          .map((f) => item[f.name])
                          .filter(Boolean)
                          .join(' - ')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            {IconComponent && (
              <IconComponent className="w-12 h-12 mx-auto mb-4 opacity-50" />
            )}
            <p>Henüz eklenmedi</p>
            {stepConfig.skippable && (
              <p className="text-sm mt-1">Sonra da ekleyebilirsiniz</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render working hours step
  const renderWorkingHours = () => {
    if (stepConfig.type !== 'working_hours') return null;

    return (
      <div className="space-y-4">
        <p className="text-slate-500 mb-4">
          Asistanın randevu alabilmesi için çalışma saatlerinizi belirleyin
        </p>

        {DAYS.map((day) => {
          const hours = workingHours[day.value] || DEFAULT_HOURS[day.value];

          return (
            <div
              key={day.value}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                hours?.is_open
                  ? 'bg-white border-slate-200'
                  : 'bg-slate-50 border-slate-100 opacity-60'
              }`}
            >
              {/* Day name */}
              <div className="w-28">
                <span className="text-slate-900 font-medium">{day.label}</span>
              </div>

              {/* Toggle */}
              <button
                onClick={() => handleDayToggle(day.value)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  hours?.is_open ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    hours?.is_open ? 'left-7' : 'left-1'
                  }`}
                />
              </button>

              {/* Status */}
              <span
                className={`w-16 text-sm ${
                  hours?.is_open ? 'text-emerald-600' : 'text-slate-500'
                }`}
              >
                {hours?.is_open ? 'Açık' : 'Kapalı'}
              </span>

              {/* Time inputs */}
              {hours?.is_open && (
                <>
                  <input
                    type="time"
                    value={hours.open_time || '09:00'}
                    onChange={(e) =>
                      handleHoursChange(day.value, 'open_time', e.target.value)
                    }
                    className="input w-32"
                  />
                  <span className="text-slate-500">-</span>
                  <input
                    type="time"
                    value={hours.close_time || '18:00'}
                    onChange={(e) =>
                      handleHoursChange(day.value, 'close_time', e.target.value)
                    }
                    className="input w-32"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render custom component (voice_settings, activation, etc.)
  const renderCustomComponent = () => {
    if (!stepConfig.component) return null;
    const CustomComponent = customComponents[stepConfig.component];
    if (!CustomComponent) {
      console.warn(`Custom component not found: ${stepConfig.component}`);
      return null;
    }
    return (
      <CustomComponent
        config={stepConfig}
        values={values}
        onChange={onChange}
        loading={loading}
      />
    );
  };

  // Render navigation buttons
  const renderNavigation = () => (
    <div className="flex justify-between pt-6 mt-8 border-t border-slate-200">
      <div>
        {!isFirstStep && (
          <Button variant="ghost" onClick={onBack} disabled={loading}>
            <ChevronLeft className="w-5 h-5 mr-2" />
            Geri
          </Button>
        )}
      </div>
      <div className="flex gap-3">
        {stepConfig.skippable && onSkip && (
          <Button variant="ghost" onClick={onSkip} disabled={loading}>
            {stepConfig.skipLabel || 'Atla'}
          </Button>
        )}
        <Button variant="primary" onClick={handleNext} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Kaydediliyor...
            </>
          ) : isLastStep ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              Tamamla
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

  return (
    <div className="p-8">
      {renderHeader()}
      {renderError()}

      {/* Render appropriate content based on step type */}
      {stepConfig.type === 'catalog' && renderCatalog()}
      {stepConfig.type === 'working_hours' && renderWorkingHours()}
      {stepConfig.component && renderCustomComponent()}
      {!stepConfig.type && !stepConfig.component && renderFormFields()}

      {renderNavigation()}
    </div>
  );
};

export default DynamicStep;
