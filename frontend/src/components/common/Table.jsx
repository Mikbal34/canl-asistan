export const Table = ({ columns, data, onRowClick, className = '' }) => {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map((column, index) => (
              <th
                key={index}
                className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                Veri bulunamadı
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-muted/30' : ''}`}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((column, colIndex) => (
                  <td key={colIndex} className="px-4 py-3 text-foreground">
                    {column.render ? column.render(row) : row[column.accessor]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
