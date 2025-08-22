import { MoreVertical, Eye, Edit, RotateCcw, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Menu } from '@headlessui/react';
import { api } from '../../services/api';
import { cn } from '../../lib/utils';

interface Report {
  id: string;
  month: number;
  year: number;
  status: 'draft' | 'final';
  createdAt: string;
  createdBy: string;
  finalizedAt?: string;
  updatedAt: string;
}

interface ReportOverviewProps {
  onSelectDraftReport?: (month: number, year: number) => void;
}

export default function ReportOverview({ onSelectDraftReport }: ReportOverviewProps) {
  const queryClient = useQueryClient();

  // Fetch reports list
  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const response = await api.get('/reports');
      return response.data?.data || [];
    }
  });

  // Reopen report mutation
  const reopenMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await api.post(`/reports/${reportId}/reopen`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    }
  });

  // Delete report mutation
  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await api.delete(`/reports/${reportId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    }
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric'
    });
  };

  const getMonthName = (month: number, year: number) => {
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleAction = (action: string, report: Report) => {
    switch (action) {
      case 'view':
        // Navigate to report viewer
        window.location.hash = `#reports/view/${report.id}`;
        break;
      case 'edit':
        // Navigate to report generation with this report
        window.location.hash = `#reports/edit/${report.id}`;
        break;
      case 'export':
        // TODO: Implement PDF export
        console.log('Export PDF for report:', report.id);
        break;
      case 'reopen':
        if (confirm('Are you sure you want to reopen this finalized report?')) {
          reopenMutation.mutate(report.id);
        }
        break;
      case 'delete':
        if (confirm(`Are you sure you want to delete this ${report.status} report?`)) {
          deleteMutation.mutate(report.id);
        }
        break;
    }
  };

  const ActionMenu = ({ report }: { report: Report }) => (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button
        onClick={(e) => e.stopPropagation()}
        className="p-1 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
      >
        <MoreVertical className="h-4 w-4 text-gray-500" />
      </Menu.Button>
      
      <Menu.Items 
        anchor="bottom end"
        className="z-50 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
        <div className="py-1">
          {report.status === 'draft' ? (
            // Draft report options
            <>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction('edit', report);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm flex items-center gap-2',
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    )}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction('delete', report);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm flex items-center gap-2',
                      active ? 'bg-red-50 text-red-900' : 'text-red-600'
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
              </Menu.Item>
            </>
          ) : (
            // Finalized report options
            <>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction('view', report);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm flex items-center gap-2',
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    )}
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction('reopen', report);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm flex items-center gap-2',
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    )}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reopen
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction('delete', report);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm flex items-center gap-2',
                      active ? 'bg-red-50 text-red-900' : 'text-red-600'
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
              </Menu.Item>
            </>
          )}
        </div>
      </Menu.Items>
    </Menu>
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">Loading reports...</div>
      </div>
    );
  }

  if (reports?.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">
          No reports generated yet. Go to Report Generation to create your first report.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 relative">
      {/* Mobile View - Cards */}
      <div className="block md:hidden">
        <div className="p-4 space-y-4">
          {reports?.map((report: Report) => (
            <div
              key={report.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => {
                if (report.status === 'draft' && onSelectDraftReport) {
                  onSelectDraftReport(report.month, report.year);
                } else {
                  handleAction('view', report);
                }
              }}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {getMonthName(report.month, report.year)}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDateShort(report.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
                    report.status === 'final' 
                      ? "bg-green-100 text-green-800" 
                      : "bg-amber-100 text-amber-800"
                  )}>
                    {report.status === 'final' ? 'Final' : 'Draft'}
                  </span>
                  <ActionMenu report={report} />
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Created by: {report.createdBy}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop View - Table */}
      <div className="hidden md:block overflow-x-auto overflow-y-visible">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Month
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Generated Date
              </th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                Created By
              </th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {reports?.map((report: Report) => (
              <tr 
                key={report.id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  if (report.status === 'draft' && onSelectDraftReport) {
                    onSelectDraftReport(report.month, report.year);
                  } else {
                    handleAction('view', report);
                  }
                }}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {getMonthName(report.month, report.year)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-600">
                    <span className="hidden xl:inline">{formatDate(report.createdAt)}</span>
                    <span className="xl:hidden">{formatDateShort(report.createdAt)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={cn(
                    "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
                    report.status === 'final' 
                      ? "bg-green-100 text-green-800" 
                      : "bg-amber-100 text-amber-800"
                  )}>
                    {report.status === 'final' ? 'Final' : 'Draft'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                  <div className="text-sm text-gray-600">
                    {report.createdBy}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <ActionMenu report={report} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}