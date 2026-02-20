import { Button as ShadcnButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const variantMap = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'destructive',
  outline: 'outline',
  link: 'link',
};

const sizeMap = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
  icon: 'icon',
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => {
  return (
    <ShadcnButton
      variant={variantMap[variant] ?? variant}
      size={sizeMap[size] ?? size}
      className={cn(className)}
      {...props}
    >
      {children}
    </ShadcnButton>
  );
};
