import { Skeleton as ShadcnSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Base skeleton block (keeps backward-compat API)
export const Skeleton = ({ width = '100%', height = '1rem', className = '', rounded = 'rounded' }) => (
  <ShadcnSkeleton
    className={cn(rounded, className)}
    style={{ width, height }}
  />
);

// Text line skeleton
export const SkeletonText = ({ width = '100%', className = '' }) => (
  <ShadcnSkeleton className={cn('h-4', className)} style={{ width }} />
);

// Circle skeleton (avatar/icon)
export const SkeletonCircle = ({ size = '2.5rem', className = '' }) => (
  <ShadcnSkeleton
    className={cn('rounded-full flex-shrink-0', className)}
    style={{ width: size, height: size }}
  />
);

// Dashboard stat card skeleton
export const SkeletonStatCard = () => (
  <div className="rounded-xl border border-border bg-card p-6">
    <div className="flex items-start justify-between">
      <div className="space-y-3 flex-1">
        <ShadcnSkeleton className="h-4 w-24" />
        <ShadcnSkeleton className="h-8 w-16" />
        <ShadcnSkeleton className="h-3 w-12" />
      </div>
      <ShadcnSkeleton className="rounded-lg w-12 h-12" />
    </div>
  </div>
);

// Table rows skeleton
export const SkeletonTableRows = ({ rows = 5, columns = 4, showHeader = true }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      {showHeader && (
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="py-3 px-4">
                <ShadcnSkeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <tr key={rowIdx}>
            {Array.from({ length: columns }).map((_, colIdx) => (
              <td key={colIdx} className="py-3 px-4">
                <ShadcnSkeleton className="h-4" style={{ width: `${60 + ((rowIdx * colIdx) % 30)}%` }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
