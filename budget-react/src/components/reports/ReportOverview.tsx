import { useState } from 'react';
import { MoreVertical, Eye, Edit, FileDown, RotateCcw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  const getMonthName = (month: number, year: number) => {
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleAction = (action: string, report: Report) => {
    setOpenMenuId(null);
    
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
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="overflow-x-auto">
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
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Created By
              </th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-500">
                  Loading reports...
                </td>
              </tr>
            ) : reports?.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-500">
                  No reports generated yet. Go to Report Generation to create your first report.
                </td>
              </tr>
            ) : (
              reports?.map((report: Report) => (
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
                      {formatDate(report.createdAt)}
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {report.createdBy}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="relative inline-block text-left">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === report.id ? null : report.id);
                        }}
                        className="p-1 rounded-md hover:bg-gray-100"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </button>
                      
                      {openMenuId === report.id && (
                        <div className="absolute right-0 z-10 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                          <div className="py-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAction('view', report);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </button>
                            
                            {report.status === 'draft' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction('edit', report);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Edit className="h-4 w-4" />
                                Edit
                              </button>
                            )}
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAction('export', report);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <FileDown className="h-4 w-4" />
                              Export PDF
                            </button>
                            
                            {report.status === 'final' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction('reopen', report);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <RotateCcw className="h-4 w-4" />
                                Reopen
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}