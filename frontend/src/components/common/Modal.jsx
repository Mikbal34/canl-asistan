import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(sizeClasses[size], 'max-h-[90vh] overflow-y-auto')}>
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        <div>{children}</div>
      </DialogContent>
    </Dialog>
  );
};

export const ModalFooter = ({ children, className = '' }) => {
  return (
    <div className={cn('flex items-center justify-end gap-3 pt-6 border-t border-border mt-6', className)}>
      {children}
    </div>
  );
};
