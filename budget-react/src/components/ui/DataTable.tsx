import React from 'react';
import { Eye, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Column<T = any> {
  key: string;
  label: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface Actions<T = any> {
  view?: (row: T) => void;
  edit?: (row: T) => void;
  delete?: (row: T) => void;
  more?: (row: T) => void;
}

interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  actions?: Actions<T>;
  className?: string;
  emptyMessage?: string;
}

const DataTable = <T extends Record<string, any>>({ 
  columns, 
  data, 
  onRowClick,
  actions,
  className,
  emptyMessage = "No data available"
}: DataTableProps<T>) => {
  return (
    <div className={cn("bg-white rounded-lg shadow-sm border border-gray-200", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider",
                    column.align === 'right' && "text-right",
                    column.align === 'center' && "text-center"
                  )}
                  style={{ width: column.width }}
                >
                  {column.label}
                </th>
              ))}
              {actions && (
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider w-24">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td 
                  colSpan={columns.length + (actions ? 1 : 0)} 
                  className="px-4 py-8 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={(row as any).id || rowIndex}
                  className={cn(
                    "hover:bg-gray-50 transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-4 py-3 text-sm text-gray-900",
                        column.align === 'right' && "text-right",
                        column.align === 'center' && "text-center",
                        column.className
                      )}
                    >
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {actions.view && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              actions.view!(row);
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            aria-label="View"
                          >
                            <Eye className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
                          </button>
                        )}
                        {actions.edit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              actions.edit!(row);
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            aria-label="Edit"
                          >
                            <Pencil className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
                          </button>
                        )}
                        {actions.delete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              actions.delete!(row);
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
                          </button>
                        )}
                        {actions.more && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              actions.more!(row);
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            aria-label="More actions"
                          >
                            <MoreHorizontal className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;