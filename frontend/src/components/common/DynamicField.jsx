import { useState } from 'react';
import { Eye, EyeOff, ChevronDown, X } from 'lucide-react';

/**
 * Config-driven form field renderer
 * Supports: text, email, tel, password, textarea, number, select, multiselect, currency, checkbox, time
 */
export const DynamicField = ({ field, value, onChange, error }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  const handleChange = (newValue) => {
    onChange(field.name, newValue);
  };

  // Base input classes
  const inputClasses = `
    w-full px-4 py-3 rounded-lg
    bg-white border border-slate-200
    text-slate-900 placeholder-slate-400
    focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500
    transition-all
    ${error ? 'border-red-500 focus:ring-red-500/30' : ''}
    ${field.disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `;

  // Label component
  const Label = () => (
    <label className="block text-sm font-medium text-slate-700 mb-2">
      {field.label}
      {field.required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );

  // Error message component
  const ErrorMessage = () =>
    error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null;

  // Hint/description component
  const Hint = () =>
    field.hint ? <p className="mt-1 text-xs text-gray-500">{field.hint}</p> : null;

  // Render based on field type
  switch (field.type) {
    case 'text':
    case 'email':
    case 'tel':
      return (
        <div style={field.width ? { width: field.width } : {}}>
          <Label />
          <input
            type={field.type}
            name={field.name}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={field.disabled}
            className={inputClasses}
            minLength={field.validation?.minLength}
            maxLength={field.validation?.maxLength}
            pattern={field.validation?.pattern}
          />
          <ErrorMessage />
          <Hint />
        </div>
      );

    case 'password':
      return (
        <div style={field.width ? { width: field.width } : {}}>
          <Label />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name={field.name}
              value={value || ''}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={field.placeholder}
              disabled={field.disabled}
              className={`${inputClasses} pr-12`}
              minLength={field.validation?.minLength}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <ErrorMessage />
          <Hint />
        </div>
      );

    case 'textarea':
      return (
        <div style={field.width ? { width: field.width } : {}}>
          <Label />
          <textarea
            name={field.name}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={field.disabled}
            rows={field.rows || 3}
            className={`${inputClasses} resize-none`}
            minLength={field.validation?.minLength}
            maxLength={field.validation?.maxLength}
          />
          <ErrorMessage />
          <Hint />
        </div>
      );

    case 'number':
      return (
        <div style={field.width ? { width: field.width } : {}}>
          <Label />
          <input
            type="number"
            name={field.name}
            value={value ?? ''}
            onChange={(e) => handleChange(e.target.value ? Number(e.target.value) : '')}
            placeholder={field.placeholder}
            disabled={field.disabled}
            className={inputClasses}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.step || 1}
          />
          <ErrorMessage />
          <Hint />
        </div>
      );

    case 'currency':
      return (
        <div style={field.width ? { width: field.width } : {}}>
          <Label />
          <div className="relative">
            <input
              type="text"
              name={field.name}
              value={value ? Number(value).toLocaleString('tr-TR') : ''}
              onChange={(e) => {
                const numericValue = e.target.value.replace(/\D/g, '');
                handleChange(numericValue ? Number(numericValue) : '');
              }}
              placeholder={field.placeholder}
              disabled={field.disabled}
              className={`${inputClasses} pr-12`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
              {field.currency || 'TRY'}
            </span>
          </div>
          <ErrorMessage />
          <Hint />
        </div>
      );

    case 'select':
      return (
        <div style={field.width ? { width: field.width } : {}}>
          <Label />
          <div className="relative">
            <select
              name={field.name}
              value={value || field.default || ''}
              onChange={(e) => handleChange(e.target.value)}
              disabled={field.disabled}
              className={`${inputClasses} appearance-none cursor-pointer`}
            >
              {!field.default && !value && (
                <option value="" disabled>
                  {field.placeholder || 'Seçiniz...'}
                </option>
              )}
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
          </div>
          {field.allowCustom && (
            <input
              type="text"
              placeholder="Veya özel değer girin..."
              className={`${inputClasses} mt-2`}
              onBlur={(e) => {
                if (e.target.value) handleChange(e.target.value);
              }}
            />
          )}
          <ErrorMessage />
          <Hint />
        </div>
      );

    case 'multiselect':
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div style={field.width ? { width: field.width } : {}}>
          <Label />
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label
                key={option.value}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                  ${selectedValues.includes(option.value)
                    ? 'bg-indigo-50 border-indigo-500'
                    : 'bg-white border-slate-200 hover:border-slate-300'}
                `}
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleChange([...selectedValues, option.value]);
                    } else {
                      handleChange(selectedValues.filter((v) => v !== option.value));
                    }
                  }}
                  className="sr-only"
                />
                <div
                  className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                    ${selectedValues.includes(option.value)
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'border-slate-300'}
                  `}
                >
                  {selectedValues.includes(option.value) && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-slate-700">{option.label}</span>
              </label>
            ))}
          </div>
          <ErrorMessage />
          <Hint />
        </div>
      );

    case 'checkbox':
      return (
        <div style={field.width ? { width: field.width } : {}}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value ?? field.default ?? false}
              onChange={(e) => handleChange(e.target.checked)}
              disabled={field.disabled}
              className="sr-only"
            />
            <div
              className={`
                w-6 h-6 rounded border-2 flex items-center justify-center transition-all
                ${value ?? field.default
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'border-slate-300 bg-white'}
                ${field.disabled ? 'opacity-50' : ''}
              `}
            >
              {(value ?? field.default) && (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <span className="text-slate-700">{field.label}</span>
          </label>
          <ErrorMessage />
          <Hint />
        </div>
      );

    case 'time':
      return (
        <div style={field.width ? { width: field.width } : {}}>
          <Label />
          <input
            type="time"
            name={field.name}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={field.disabled}
            className={inputClasses}
          />
          <ErrorMessage />
          <Hint />
        </div>
      );

    default:
      console.warn(`Unknown field type: ${field.type}`);
      return (
        <div style={field.width ? { width: field.width } : {}}>
          <Label />
          <input
            type="text"
            name={field.name}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClasses}
          />
          <ErrorMessage />
        </div>
      );
  }
};

export default DynamicField;
