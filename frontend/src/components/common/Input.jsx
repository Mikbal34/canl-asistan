import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef(({
  label,
  error,
  type = 'text',
  placeholder,
  className = '',
  inputClassName = '',
  ...props
}, ref) => {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-foreground mb-2">
          {label}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        placeholder={placeholder}
        className={cn(
          'input',
          inputClassName,
          error && 'border-destructive focus:ring-destructive/30'
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
