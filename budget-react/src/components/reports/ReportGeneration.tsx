import { useState, useEffect, useCallback } from 'react';
import { Save, Eye, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import ExecutiveSummary from './ExecutiveSummary';
import BudgetVsActualTable from './BudgetVsActualTable';
import VarianceExplanations from './VarianceExplanations';
import AdditionalNotes from './AdditionalNotes';
import UpcomingExpenses from './UpcomingExpenses';
import ThreeMonthComparison from './ThreeMonthComparison';
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
  const [reportDraft, setReportDraft] = useState<Partial<Report>>({});
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const [year, month] = selectedMonth.split('-').map(Number);

  // Fetch existing report for the selected month
  const { data: existingReport, isLoading: isLoadingReport } = useQuery({
    queryKey: ['report', year, month],
    queryFn: async () => {
      const response = await api.get(`/reports?year=${year}&month=${month}`);
      const reports = response.data?.data || [];
      return reports.find((r: Report) => r.month === month && r.year === year) || null;
    }
  });

  // Fetch report data for the selected month
  const { data: reportData, isLoading: isLoadingData } = useQuery({
    queryKey: ['report-data', year, month],
    queryFn: async () => {
      const response = await api.get(`/reports/generate/${year}/${month}`);
      return response.data?.data || null;
    },
    enabled: !existingReport?.dataSnapshot // Only fetch if no snapshot exists
  });

  // Use snapshot data if report is finalized, otherwise use fresh data
  const currentData = existingReport?.status === 'final' 
    ? existingReport.dataSnapshot 
    : reportData;

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

  // Initialize draft with existing report data
  useEffect(() => {
    if (existingReport) {
      setReportDraft(existingReport);
    } else {
      setReportDraft({
        month,
        year,
        executiveSummary: '',
        varianceExplanations: {},
        additionalNotes: '',
        upcomingExpenses: ''
      });
    }
  }, [existingReport, month, year]);

  // Create report mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<Report>) => {
      const response = await api.post('/reports', {
        ...data,
        month,
        year,
        dataSnapshot: currentData
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['report', year, month] });
      setLastSaved(new Date());
    }
  });

  // Update report mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Report>) => {
      const response = await api.put(`/reports/${existingReport?.id}`, {
        ...data,
        dataSnapshot: currentData
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['report', year, month] });
      setLastSaved(new Date());
    }
  });

  // Finalize report mutation
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/reports/${existingReport?.id}/finalize`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['report', year, month] });
      alert('Report finalized successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to finalize report');
    }
  });

  // Auto-save functionality
  const handleAutoSave = useCallback(() => {
    if (existingReport?.status === 'final') return;
    
    setIsSaving(true);
    const saveData = {
      ...reportDraft,
      variancesNeedingExplanation: currentData?.variancesNeedingExplanation || []
    };

    if (existingReport?.id) {
      updateMutation.mutate(saveData);
    } else if (currentData) {
      createMutation.mutate(saveData);
    }
    setIsSaving(false);
  }, [reportDraft, existingReport, currentData, createMutation, updateMutation]);

  // Set up auto-save timer
  useEffect(() => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    const timer = setTimeout(() => {
      handleAutoSave();
    }, 30000); // 30 seconds

    setAutoSaveTimer(timer);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [reportDraft]);

  const handleSaveDraft = () => {
    handleAutoSave();
  };

  const handleViewPreview = () => {
    // Save first, then open preview
    handleAutoSave();
    if (existingReport?.id) {
      window.open(`#reports/view/${existingReport.id}`, '_blank');
    }
  };

  const handleFinalize = () => {
    // Validate all required explanations
    const needsExplanations = currentData?.variancesNeedingExplanation || [];
    const explanations = reportDraft.varianceExplanations || {};
    
    const missingExplanations = needsExplanations.filter((v: any) => !explanations[v.category]);
    
    if (missingExplanations.length > 0) {
      alert(`Please provide explanations for the following categories: ${missingExplanations.map((v: any) => v.category).join(', ')}`);
      return;
    }

    if (confirm('Are you sure you want to finalize this report? Once finalized, it cannot be edited unless reopened.')) {
      finalizeMutation.mutate();
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

  const isFinalized = existingReport?.status === 'final';

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

      {/* Three Month Comparison */}
      <ThreeMonthComparison
        data={currentData.threeMonthComparison}
        categories={currentData.categories}
      />

      {/* Year to Date Chart */}
      <YearToDateChart
        data={currentData.ytdData}
      />

      {/* Financial Position */}
      <FinancialPosition
        cashBalance={currentData.cashBalance}
        bankBalance={currentData.bankBalance}
        burnRate={currentData.burnRate}
        monthsRemaining={currentData.monthsRemaining}
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