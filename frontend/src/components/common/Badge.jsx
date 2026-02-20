import { cn } from '@/lib/utils';

const variantClasses = {
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  info: 'badge-info',
  default: 'badge-info',
};

export const Badge = ({ children, variant = 'info', className = '' }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant] ?? variantClasses.default,
        className
      )}
    >
      {children}
    </span>
  );
};
