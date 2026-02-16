/**
 * Skeleton loading primitives + composite components
 */

// Base skeleton block
export const Skeleton = ({ width = '100%', height = '1rem', className = '', rounded = 'rounded' }) => (
  <div
    className={`animate-pulse bg-slate-200 ${rounded} ${className}`}
    style={{ width, height }}
  />
);

// Text line skeleton
export const SkeletonText = ({ width = '100%', className = '' }) => (
  <div
    className={`animate-pulse bg-slate-200 rounded h-4 ${className}`}
    style={{ width }}
  />
);

// Circle skeleton (avatar/icon)
export const SkeletonCircle = ({ size = '2.5rem', className = '' }) => (
  <div
    className={`animate-pulse bg-slate-200 rounded-full flex-shrink-0 ${className}`}
    style={{ width: size, height: size }}
  />
);

// Dashboard stat card skeleton
export const SkeletonStatCard = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-6">
    <div className="flex items-start justify-between">
      <div className="space-y-3 flex-1">
        <div className="animate-pulse bg-slate-200 rounded h-4 w-24" />
        <div className="animate-pulse bg-slate-200 rounded h-8 w-16" />
        <div className="animate-pulse bg-slate-200 rounded h-3 w-12" />
      </div>
      <div className="animate-pulse bg-slate-200 rounded-lg w-12 h-12" />
    </div>
  </div>
);

// Table rows skeleton
export const SkeletonTableRows = ({ rows = 5, columns = 4, showHeader = true }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      {showHeader && (
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="py-3 px-4">
                <div className="animate-pulse bg-slate-200 rounded h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody className="divide-y divide-slate-200">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <tr key={rowIdx}>
            {Array.from({ length: columns }).map((_, colIdx) => (
              <td key={colIdx} className="py-3 px-4">
                <div
                  className="animate-pulse bg-slate-200 rounded h-4"
                  style={{ width: `${60 + Math.random() * 30}%` }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
