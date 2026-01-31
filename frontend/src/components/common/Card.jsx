/**
 * Card component with glass morphism effect
 * @param {Object} props
 * @param {React.ReactNode} props.children - Card content
 * @param {string} props.className - Additional classes
 * @param {Function} props.onClick - Click handler (optional)
 */
export const Card = ({ children, className = '', onClick }) => {
  return (
    <div
      className={`card ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

/**
 * Card header component
 */
export const CardHeader = ({ children, className = '' }) => {
  return <div className={`mb-4 ${className}`}>{children}</div>;
};

/**
 * Card title component
 */
export const CardTitle = ({ children, className = '' }) => {
  return <h3 className={`text-xl font-semibold text-slate-900 ${className}`}>{children}</h3>;
};

/**
 * Card content component
 */
export const CardContent = ({ children, className = '' }) => {
  return <div className={className}>{children}</div>;
};
