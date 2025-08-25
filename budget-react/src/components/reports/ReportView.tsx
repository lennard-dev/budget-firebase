import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import ExecutiveSummary from './ExecutiveSummary';
import BudgetVsActualTable from './BudgetVsActualTable';
import VarianceExplanations from './VarianceExplanations';
import AdditionalNotes from './AdditionalNotes';
import UpcomingExpenses from './UpcomingExpenses';
import YearToDateChart from './YearToDateChart';
import FinancialPosition from './FinancialPosition';

interface Report {
  id: string;
  month: number;
  year: number;
  status: 'draft' | 'final';
  createdAt: string;
  createdBy: string;
  finalizedAt?: string;
  executiveSummary?: string;
  neededActions?: any[];
  varianceExplanations?: Record<string, string>;
  additionalNotes?: string;
  upcomingExpenses?: string;
  ytdComment?: string;
  financialPositionComment?: string;
  dataSnapshot?: any;
}

export default function ReportView() {
  const [reportId, setReportId] = useState<string | null>(null);

  // Get report ID from hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/#reports\/view\/([a-zA-Z0-9]+)/);
      if (match) {
        setReportId(match[1]);
      }
    };

    handleHashChange(); // Check on mount
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Fetch report data
  const { data: report, isLoading } = useQuery<Report | null>({
    queryKey: ['report-view', reportId],
    queryFn: async () => {
      if (!reportId) return null;
      const response = await api.get(`/reports/${reportId}`);
      return response.data?.data || null;
    },
    enabled: !!reportId
  });

  const handleBack = () => {
    window.location.hash = '#reports';
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // TODO: Implement PDF export
    alert('PDF export coming soon!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading report...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Report Not Found</h3>
          <p className="text-gray-600 mb-4">The requested report could not be found.</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Back to Reports
          </button>
        </div>
      </div>
    );
  }

  const monthName = new Date(report.year, report.month - 1).toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  const data = report.dataSnapshot;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{monthName} Report</h2>
              <p className="text-sm text-gray-600 mt-1">
                Status: <span className={report.status === 'final' ? 'text-green-600' : 'text-amber-600'}>
                  {report.status === 'final' ? 'Finalized' : 'Draft'}
                </span>
                {report.finalizedAt && (
                  <> • Finalized on {new Date(report.finalizedAt).toLocaleDateString()}</>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {data && (
        <>
          <ExecutiveSummary 
            data={{
              totalBudget: data.totalBudget,
              totalSpent: data.totalSpent,
              totalVariance: data.totalVariance
            }}
            summary={report.executiveSummary || ''}
            actions={report.neededActions || []}
            onChange={() => {}} // No-op for read-only view
            disabled={true}
          />

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <BudgetVsActualTable
              categories={data.categories}
              disabled={true}
            />
          </div>

          {data.variancesNeedingExplanation && data.variancesNeedingExplanation.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <VarianceExplanations
                variances={data.variancesNeedingExplanation}
                explanations={report.varianceExplanations || {}}
                onChange={() => {}} // No-op for read-only view
                disabled={true}
              />
            </div>
          )}

          <AdditionalNotes
            notes={report.additionalNotes || ''}
            onChange={() => {}} // No-op for read-only view
            disabled={true}
          />

          <UpcomingExpenses
            expenses={report.upcomingExpenses || ''}
            onChange={() => {}} // No-op for read-only view
            disabled={true}
          />

          <YearToDateChart
            data={data.ytdData}
            comment={report.ytdComment}
            disabled={true}
          />

          <FinancialPosition
            cashBalance={data.cashBalance}
            bankBalance={data.bankBalance}
            burnRate={data.burnRate}
            monthsRemaining={data.monthsRemaining}
            comment={report.financialPositionComment}
            disabled={true}
          />
        </>
      )}
    </div>
  );
}