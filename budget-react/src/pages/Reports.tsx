import { useState, useEffect } from 'react';
import { FileText, BarChart3, Calendar, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { cn } from '../lib/utils';
import ReportOverview from '../components/reports/ReportOverview';
import ReportGeneration from '../components/reports/ReportGeneration';
import ReportView from '../components/reports/ReportView';

type TabId = 'overview' | 'generation' | 'adhoc' | 'view';

interface Report {
  id: string;
  month: number;
  year: number;
  status: 'draft' | 'final';
  createdAt: string;
  createdBy: string;
  finalizedAt?: string;
  totalVariance?: number;
  variancesNeedingExplanation?: any[];
  dataSnapshot?: {
    totalVariance?: number;
    variancesNeedingExplanation?: any[];
  };
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [shouldDefaultToDraft, setShouldDefaultToDraft] = useState(false);
  
  // Get current month and year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  // Fetch reports list for metrics
  const { data: reportsData } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const response = await api.get('/reports');
      return response.data?.data || [];
    }
  });
  
  // Calculate metrics
  const reports = reportsData || [];
  const currentMonthReport = reports.find((r: Report) => 
    r.month === currentMonth && r.year === currentYear
  );
  const lastFinalReport = reports.find((r: Report) => r.status === 'final');
  const totalReports = reports.length;
  const draftReports = reports.filter((r: Report) => r.status === 'draft').length;
  const finalReports = reports.filter((r: Report) => r.status === 'final').length;
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
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

  // Handle hash-based navigation for report viewing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      
      // Check if it's a report view URL
      if (hash.includes('#reports/view/')) {
        setActiveTab('view');
      } else if (hash.includes('#reports/generation/')) {
        setActiveTab('generation');
      } else if (hash === '#reports') {
        // Don't change tab if we're just navigating to reports page
        // Keep whatever tab was active
      }
    };

    handleHashChange(); // Check on mount
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // When switching to generation tab, default to most recent draft
  useEffect(() => {
    if (activeTab === 'generation' && shouldDefaultToDraft && reports.length > 0) {
      // Find the most recent draft report
      const draftReports = reports
        .filter((r: Report) => r.status === 'draft')
        .sort((a: Report, b: Report) => {
          // Sort by year and month descending
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        });

      if (draftReports.length > 0) {
        const mostRecentDraft = draftReports[0];
        // Set the URL to load this draft
        window.location.hash = `#reports/generation/${mostRecentDraft.year}/${mostRecentDraft.month}`;
      } else {
        // No drafts exist, just clear the hash to load current month
        window.location.hash = '#reports/generation';
      }
      setShouldDefaultToDraft(false);
    }
  }, [activeTab, shouldDefaultToDraft, reports]);

  return (
    <div className="space-y-6">
      {/* Tab Navigation - Hide when viewing a specific report */}
      {activeTab !== 'view' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-3">
            <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "px-4 py-2 rounded-md font-medium text-sm transition-all duration-200",
              activeTab === 'overview'
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            All Reports
          </button>
          <button
            onClick={() => {
              setShouldDefaultToDraft(true);
              setActiveTab('generation');
            }}
            className={cn(
              "px-4 py-2 rounded-md font-medium text-sm transition-all duration-200",
              activeTab === 'generation'
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            Create Report
          </button>
          <button
            onClick={() => setActiveTab('adhoc')}
            className={cn(
              "px-4 py-2 rounded-md font-medium text-sm transition-all duration-200",
              activeTab === 'adhoc'
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            More Insights
          </button>
          </div>
        </div>
      </div>
      )}

      {/* Metric Cards - Only show on overview tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-full">
            <div className="flex items-center justify-between h-full">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-500">Current Month Status</div>
                <div className="mt-1 text-lg font-semibold">
                  {currentMonthReport ? (
                    <span className={cn(
                      "flex items-center gap-2",
                      currentMonthReport.status === 'final' ? "text-green-600" : "text-amber-600"
                    )}>
                      {getMonthName(currentMonth, currentYear)}: {currentMonthReport.status === 'final' ? 'Final' : 'Draft'}
                    </span>
                  ) : (
                    <span className="text-gray-400">
                      {getMonthName(currentMonth, currentYear)}: Not Started
                    </span>
                  )}
                </div>
              </div>
              <FileText className="h-8 w-8 text-gray-400 flex-shrink-0" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-full">
            <div className="flex items-center justify-between h-full">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-500">Total Reports</div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-900">{totalReports}</span>
                  <div className="text-xs text-gray-500">
                    {draftReports} draft<br/>{finalReports} final
                  </div>
                </div>
              </div>
              <BarChart3 className="h-8 w-8 text-gray-400 flex-shrink-0" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-full">
            <div className="flex items-center justify-between h-full">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-500">Reports This Year</div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-900">
                    {reports.filter((r: Report) => r.year === currentYear).length}
                  </span>
                  <div className="text-xs text-gray-500">
                    {Math.round((reports.filter((r: Report) => r.year === currentYear && r.status === 'final').length / 12) * 100)}%<br/>complete
                  </div>
                </div>
              </div>
              <Calendar className="h-8 w-8 text-gray-400 flex-shrink-0" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-full">
            <div className="flex items-center justify-between h-full">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-500">Last Report Sent</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {lastFinalReport ? formatDate(lastFinalReport.finalizedAt || lastFinalReport.createdAt) : 'Never'}
                </div>
              </div>
              <Clock className="h-8 w-8 text-gray-400 flex-shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' ? (
        <ReportOverview onSelectDraftReport={(month: number, year: number) => {
          setActiveTab('generation');
          // Pass the selected month/year to ReportGeneration somehow
          window.location.hash = `#reports/generation/${year}/${month}`;
        }} />
      ) : activeTab === 'generation' ? (
        <ReportGeneration />
      ) : activeTab === 'view' ? (
        <ReportView />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <BarChart3 className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">More Insights</h2>
            <p className="text-gray-600">Coming Soon</p>
            <p className="text-sm text-gray-500 mt-2">
              Create custom reports with specific date ranges and filters
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}