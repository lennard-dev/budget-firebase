import { useState, useEffect, useRef, useMemo } from 'react';
import { Save, Eye, Check, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import ExecutiveSummary from './ExecutiveSummary';
import BudgetVsActualTable from './BudgetVsActualTable';
import VarianceExplanations from './VarianceExplanations';
import AdditionalNotes from './AdditionalNotes';
import UpcomingExpenses from './UpcomingExpenses';
import YearToDateChart from './YearToDateChart';
import FinancialPosition from './FinancialPosition';

interface ReportData {
  month: number;
  year: number;
  totalBudget: number;
  totalSpent: number;
  totalVariance: number;
  categories: Record<string, any>;
  variancesNeedingExplanation: any[];
  cashBalance: number;
  bankBalance: number;
  burnRate: number;
  monthsRemaining: number;
  threeMonthComparison: any;
  ytdData: any[];
}

interface NeededAction {
  id: string;
  text: string;
  assignee: string;
  priority: 'info' | 'warning';
}

interface Report {
  id?: string;
  month: number;
  year: number;
  status: 'draft' | 'final';
  executiveSummary?: string;
  neededActions?: NeededAction[];
  varianceExplanations?: Record<string, string>;
  additionalNotes?: string;
  upcomingExpenses?: string;
  ytdComment?: string;
  financialPositionComment?: string;
  dataSnapshot?: ReportData;
}

export default function ReportGeneration() {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // Check if there's a month/year in the hash
    const hash = window.location.hash;
    const match = hash.match(/#reports\/generation\/(\d{4})\/(\d{1,2})/);
    if (match) {
      const [, year, month] = match;
      return `${year}-${String(parseInt(month)).padStart(2, '0')}`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [reportDraft, setReportDraft] = useState<Partial<Report>>({});
  const reportDraftRef = useRef<Partial<Report>>({});
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [forceRefresh, setForceRefresh] = useState(0);

  const [year, month] = selectedMonth.split('-').map(Number);
  
  // Keep ref in sync with state
  useEffect(() => {
    reportDraftRef.current = reportDraft;
  }, [reportDraft]);

  // Fetch existing report for the selected month
  const { data: existingReport, isLoading: isLoadingReport } = useQuery<Report | null>({
    queryKey: ['report', year, month],
    queryFn: async () => {
      const response = await api.get(`/reports?year=${year}&month=${month}`);
      const reports = response.data?.data || [];
      return reports.find((r: Report) => r.month === month && r.year === year) || null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false // Don't refetch on window focus to avoid losing edits
  });

  // Fetch report data for the selected month
  const { data: reportData, isLoading: isLoadingData, refetch: refetchReportData } = useQuery<ReportData | null>({
    queryKey: ['report-data', year, month, forceRefresh],
    queryFn: async () => {
      const response = await api.get(`/reports/generate/${year}/${month}`);
      return response.data?.data || null;
    },
    enabled: !existingReport?.dataSnapshot || forceRefresh > 0, // Fetch if no snapshot or force refresh
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10 // 10 minutes (formerly cacheTime)
  });

  // Memoize current data to prevent unnecessary re-renders
  const currentData = useMemo(() => {
    return forceRefresh > 0 && reportData ? reportData : (currentReport?.dataSnapshot || existingReport?.dataSnapshot || reportData);
  }, [forceRefresh, reportData, currentReport?.dataSnapshot, existingReport?.dataSnapshot]);

  // Listen for hash changes to update selected month
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/#reports\/generation\/(\d{4})\/(\d{1,2})/);
      if (match) {
        const [, year, month] = match;
        setSelectedMonth(`${year}-${String(parseInt(month)).padStart(2, '0')}`);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Initialize draft with existing report data - SIMPLIFIED
  useEffect(() => {
    if (existingReport) {
      setCurrentReport(existingReport);
      
      // ALWAYS set reportDraft from existingReport when it loads
      // This ensures data is loaded on refresh
      setReportDraft({
        month,
        year,
        executiveSummary: existingReport.executiveSummary || '',
        varianceExplanations: existingReport.varianceExplanations || {},
        additionalNotes: existingReport.additionalNotes || '',
        upcomingExpenses: existingReport.upcomingExpenses || '',
        neededActions: existingReport.neededActions || [],
        ytdComment: existingReport.ytdComment || '',
        financialPositionComment: existingReport.financialPositionComment || ''
      });
    } else if (!isLoadingReport) {
      // Only reset if we're done loading and no report exists
      setCurrentReport(null);
      setReportDraft({
        month,
        year,
        executiveSummary: '',
        varianceExplanations: {},
        additionalNotes: '',
        upcomingExpenses: '',
        neededActions: [],
        ytdComment: '',
        financialPositionComment: ''
      });
    }
    // Note: We only depend on existingReport and isLoadingReport, not month/year
    // This prevents re-initialization when the user is editing
  }, [existingReport, isLoadingReport, month, year]);

  // Create report mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<Report>) => {
      const response = await api.post('/reports', {
        ...data,
        month,
        year,
        dataSnapshot: currentData || undefined || undefined
      });
      return response.data;
    },
    onSuccess: (response) => {
      // Update current report with the created report (includes ID)
      setCurrentReport(response.data);
      queryClient.setQueryData(['report', year, month], response.data);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setLastSaved(new Date());
    },
    onError: (error: any) => {
      console.error('Failed to create report:', error);
    }
  });

  // Update report mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Report>) => {
      const reportId = currentReport?.id || existingReport?.id;
      const response = await api.put(`/reports/${reportId}`, {
        ...data,
        dataSnapshot: currentData || undefined || undefined
      });
      return response.data;
    },
    onSuccess: (response) => {
      // Update current report with the latest data
      setCurrentReport(response.data);
      queryClient.setQueryData(['report', year, month], response.data);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setLastSaved(new Date());
    },
    onError: (error: any) => {
      console.error('Failed to update report:', error);
    }
  });

  // Finalize report mutation
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const reportId = currentReport?.id || existingReport?.id;
      if (!reportId) {
        throw new Error('No report ID available. Please save the report first.');
      }
      const response = await api.post(`/reports/${reportId}/finalize`);
      return response.data;
    },
    onSuccess: (response) => {
      setCurrentReport(response.data);
      queryClient.setQueryData(['report', year, month], response.data);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      alert('Report finalized successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to finalize report');
    }
  });

  // Debounced auto-save - only save after 3 seconds of inactivity
  useEffect(() => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    // Don't set up auto-save if report is finalized
    if (currentReport?.status === 'final' || existingReport?.status === 'final') {
      return;
    }

    const timer = setTimeout(() => {
      // Don't auto-save if report is finalized
      const reportId = currentReport?.id || existingReport?.id;
      if (currentReport?.status === 'final' || existingReport?.status === 'final') return;
      
      // Only save if we have actual changes
      if (!reportId && !currentData) return;
      
      setIsSaving(true);
      // Use the ref to get the latest draft state
      const saveData = {
        ...reportDraftRef.current,
        variancesNeedingExplanation: currentData?.variancesNeedingExplanation || [],
        dataSnapshot: currentData || undefined || undefined
      };

      if (reportId) {
        updateMutation.mutate(saveData);
      } else if (currentData) {
        createMutation.mutate(saveData);
      }
      
      // Clear saving indicator after a short delay
      setTimeout(() => setIsSaving(false), 1000);
    }, 3000); // 3 seconds debounce

    setAutoSaveTimer(timer);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
    // Only re-run when reportDraft changes to reset the timer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDraft]);

  const handleSaveDraft = () => {
    console.log('handleSaveDraft called');
    const reportId = currentReport?.id || existingReport?.id;
    
    // Don't save if report is finalized
    if (currentReport?.status === 'final' || existingReport?.status === 'final') {
      console.log('Report is finalized, not saving');
      return;
    }
    
    setIsSaving(true);
    const saveData = {
      ...reportDraft, // Use current state for manual save
      variancesNeedingExplanation: currentData?.variancesNeedingExplanation || [],
      dataSnapshot: currentData || undefined
    };

    // Debug logging
    console.log('Saving report draft:', {
      reportId,
      month: saveData.month,
      year: saveData.year,
      executiveSummary: saveData.executiveSummary,
      neededActions: saveData.neededActions,
      varianceExplanations: saveData.varianceExplanations,
      additionalNotes: saveData.additionalNotes,
      upcomingExpenses: saveData.upcomingExpenses,
      ytdComment: saveData.ytdComment,
      financialPositionComment: saveData.financialPositionComment,
      hasDataSnapshot: !!saveData.dataSnapshot
    });

    if (reportId) {
      console.log('Updating existing report with ID:', reportId);
      updateMutation.mutate(saveData);
    } else if (currentData) {
      console.log('Creating new report');
      createMutation.mutate(saveData);
    } else {
      console.log('No data to save');
    }
    setIsSaving(false);
  };

  const handleUpdateData = async () => {
    // Refresh the report data from the backend
    setIsSaving(true);
    try {
      // Force a fresh data fetch
      setForceRefresh(prev => prev + 1);
      
      // Invalidate and refetch the data
      await queryClient.invalidateQueries({ queryKey: ['report-data', year, month] });
      const result = await refetchReportData();
      
      // Wait a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Save the updated data snapshot with the fresh data
      const reportId = currentReport?.id || existingReport?.id;
      const freshData = result.data;
      
      if (reportId && freshData) {
        const saveData = {
          ...reportDraft,
          variancesNeedingExplanation: freshData.variancesNeedingExplanation || [],
          dataSnapshot: freshData // Use the freshly fetched data
        };
        await updateMutation.mutateAsync(saveData);
        
        // Invalidate reports list to refresh the UI
        await queryClient.invalidateQueries({ queryKey: ['reports'] });
      }
      
      alert('Report data has been updated successfully!');
    } catch (error) {
      console.error('Failed to update data:', error);
      alert('Failed to update report data. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewPreview = () => {
    // Save first, then open preview
    handleSaveDraft();
    const reportId = currentReport?.id || existingReport?.id;
    if (reportId) {
      setTimeout(() => {
        window.open(`#reports/view/${reportId}`, '_blank');
      }, 500);
    } else {
      alert('Please save the report first before viewing preview');
    }
  };

  const handleFinalize = async () => {
    // Validate all required explanations
    const needsExplanations = currentData?.variancesNeedingExplanation || [];
    const explanations = reportDraft.varianceExplanations || {};
    
    const missingExplanations = needsExplanations.filter((v: any) => !explanations[v.category]);
    
    if (missingExplanations.length > 0) {
      alert(`Please provide explanations for the following categories: ${missingExplanations.map((v: any) => v.category).join(', ')}`);
      return;
    }

    if (confirm('Are you sure you want to finalize this report? Once finalized, it cannot be edited unless reopened.')) {
      // Save draft first before finalizing
      const reportId = currentReport?.id || existingReport?.id;
      setIsSaving(true);
      
      const saveData = {
        ...reportDraft,
        variancesNeedingExplanation: currentData?.variancesNeedingExplanation || [],
        dataSnapshot: currentData || undefined || undefined
      };

      try {
        if (reportId) {
          await updateMutation.mutateAsync(saveData);
        } else if (currentData) {
          await createMutation.mutateAsync(saveData);
        }
        
        // Wait a moment for the save to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Now finalize
        finalizeMutation.mutate();
      } catch (error) {
        console.error('Failed to save before finalizing:', error);
        alert('Failed to save report before finalizing. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  };


  const updateDraft = (field: string, value: any) => {
    setReportDraft(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  const isLoading = isLoadingReport || isLoadingData;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading report data...</div>
      </div>
    );
  }

  if (!currentData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600 mb-4">
            There is no financial data available for the selected month. Please ensure expenses and budgets have been entered.
          </p>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {getMonthOptions().map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  const isFinalized = currentReport?.status === 'final' || existingReport?.status === 'final';

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={isFinalized}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              {getMonthOptions().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {lastSaved && (
              <span className="text-sm text-gray-500">
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {isSaving && (
              <span className="text-sm text-blue-600">Saving...</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!isFinalized && (
              <>
                <button
                  onClick={handleUpdateData}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Update Data
                </button>
                <button
                  onClick={handleSaveDraft}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Draft
                </button>
                <button
                  onClick={handleViewPreview}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View Preview
                </button>
              </>
            )}
          </div>
        </div>
        {isFinalized && (
          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              This report has been finalized and is read-only. To make changes, you must reopen it from the Report Overview.
            </p>
          </div>
        )}
      </div>

      {/* Executive Summary with Needed Actions */}
      <ExecutiveSummary
        data={currentData}
        summary={reportDraft.executiveSummary || ''}
        onChange={(value) => updateDraft('executiveSummary', value)}
        actions={reportDraft.neededActions || []}
        onActionsChange={(actions) => updateDraft('neededActions', actions)}
        disabled={isFinalized}
      />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BudgetVsActualTable
            categories={currentData.categories}
            disabled={isFinalized}
          />
        </div>
        <div className="lg:col-span-1">
          <VarianceExplanations
            variances={currentData.variancesNeedingExplanation}
            explanations={reportDraft.varianceExplanations || {}}
            onChange={(value) => updateDraft('varianceExplanations', value)}
            disabled={isFinalized}
          />
        </div>
      </div>

      {/* Additional Notes */}
      <AdditionalNotes
        notes={reportDraft.additionalNotes || ''}
        onChange={(value) => updateDraft('additionalNotes', value)}
        disabled={isFinalized}
      />

      {/* Upcoming Expenses */}
      <UpcomingExpenses
        expenses={reportDraft.upcomingExpenses || ''}
        onChange={(value) => updateDraft('upcomingExpenses', value)}
        disabled={isFinalized}
      />

      {/* Year to Date Chart */}
      <YearToDateChart
        data={currentData.ytdData}
        comment={reportDraft.ytdComment}
        onCommentChange={(value) => updateDraft('ytdComment', value)}
        disabled={isFinalized}
      />

      {/* Financial Position */}
      <FinancialPosition
        cashBalance={currentData.cashBalance}
        bankBalance={currentData.bankBalance}
        burnRate={currentData.burnRate}
        monthsRemaining={currentData.monthsRemaining}
        comment={reportDraft.financialPositionComment}
        onCommentChange={(value) => updateDraft('financialPositionComment', value)}
        disabled={isFinalized}
      />

      {/* Finalize Report Button - Moved to bottom */}
      {!isFinalized && (
        <div className="flex justify-end pt-6">
          <button
            onClick={handleFinalize}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium shadow-sm"
          >
            <Check className="h-5 w-5" />
            Finalize Report
          </button>
        </div>
      )}
    </div>
  );
}