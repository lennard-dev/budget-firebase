import { useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { api } from '../../services/api';
import { cn } from '../../lib/utils';

interface AccountData {
  account_name: string;
  account_code?: string;
  display_order?: number;
  spent: number;
  budgeted: number;
  remaining: number;
  subaccounts?: SubAccountData[];
}

interface SubAccountData {
  account_code: string;
  account_name: string;
  spent: number;
  budgeted: number;
  remaining: number;
}

interface BudgetData {
  totalBudget: number;
  totalSpent: number;
  accountsGrouped: Record<string, AccountData>;  // RADICAL: Changed from categoriesGrouped
}

type ViewState = 'actuals' | 'actuals-vs-budget' | 'budget';

interface YearToDateViewProps {
  year: number;
  currentMonth: number;
}

export default function YearToDateView({ year, currentMonth }: YearToDateViewProps) {
  const [viewState, setViewState] = useState<ViewState>('actuals');
  const [colorsEnabled, setColorsEnabled] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  // Generate month list
  const months = Array.from({ length: currentMonth }, (_, i) => ({
    month: i + 1,
    name: new Date(year, i).toLocaleString('en', { month: 'short' }),
    year
  }));

  // Fetch data for all months
  const monthQueries = useQueries({
    queries: months.map(m => ({
      queryKey: ['budget', m.year, m.month],
      queryFn: async () => {
        const response = await api.get(`/budgets?year=${m.year}&month=${m.month}`);
        // Backend returns { success: true, data: {...} }
        const budgetData = response.data?.success && response.data?.data 
          ? response.data.data 
          : response.data;
        return { key: `${m.year}-${m.month}`, data: budgetData as BudgetData };
      }
    }))
  });

  const isLoading = monthQueries.some(query => query.isLoading);
  const monthlyData: Record<string, BudgetData['accountsGrouped']> = {};
  const ytdTotals: Record<string, any> = {};

  // Process monthly data
  monthQueries.forEach(query => {
    if (query.data) {
      const { key, data } = query.data;
      monthlyData[key] = data.accountsGrouped || {};
      
      // Accumulate YTD totals
      Object.entries(data.accountsGrouped || {}).forEach(([accountCode, accountData]) => {
        if (!ytdTotals[accountCode]) {
          ytdTotals[accountCode] = { 
            account_name: accountData.account_name,
            display_order: accountData.display_order || 999,
            actual: 0, 
            budget: 0, 
            subaccounts: {} 
          };
        }
        ytdTotals[accountCode].actual += accountData.spent || 0;
        ytdTotals[accountCode].budget += accountData.budgeted || 0;
        
        (accountData.subaccounts || []).forEach(sub => {
          const subKey = sub.account_code;
          if (!ytdTotals[accountCode].subaccounts[subKey]) {
            ytdTotals[accountCode].subaccounts[subKey] = { 
              account_name: sub.account_name,
              actual: 0, 
              budget: 0 
            };
          }
          ytdTotals[accountCode].subaccounts[subKey].actual += sub.spent || 0;
          ytdTotals[accountCode].subaccounts[subKey].budget += sub.budgeted || 0;
        });
      });
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const toggleAccount = (accountCode: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountCode)) {
        newSet.delete(accountCode);
      } else {
        newSet.add(accountCode);
      }
      return newSet;
    });
  };

  const toggleAllCategories = () => {
    if (allExpanded) {
      setExpandedCategories(new Set());
      setAllExpanded(false);
    } else {
      const allCategoryNames = Object.keys(ytdTotals);
      setExpandedCategories(new Set(allCategoryNames));
      setAllExpanded(true);
    }
  };

  const renderMonthCell = (spent: number, budget: number) => {
    let cellClass = '';
    
    if (viewState === 'actuals') {
      const content = spent > 0 ? formatCurrency(spent) : '-';
      if (colorsEnabled && budget > 0) {
        cellClass = spent > budget ? 'bg-red-100 text-red-800' : spent < budget * 0.8 ? 'bg-green-100 text-green-800' : '';
      }
      return (
        <td className={cn("px-3 py-2 text-right text-sm border-r border-gray-100", cellClass)}>
          {content}
        </td>
      );
    } else if (viewState === 'actuals-vs-budget') {
      if (colorsEnabled && budget > 0) {
        cellClass = spent > budget ? 'bg-red-100' : spent < budget * 0.8 ? 'bg-green-100' : '';
      }
      return (
        <td className={cn("px-3 py-2 text-right text-sm border-r border-gray-100", cellClass)}>
          <div className="font-medium">{spent > 0 ? formatCurrency(spent) : '-'}</div>
          <div className="text-xs text-gray-500">{budget > 0 ? formatCurrency(budget) : '-'}</div>
        </td>
      );
    } else {
      const content = budget > 0 ? formatCurrency(budget) : '-';
      return (
        <td className={cn("px-3 py-2 text-right text-sm border-r border-gray-100", cellClass)}>
          {content}
        </td>
      );
    }
  };

  const exportData = () => {
    let csv = `Year to Date Budget Report - ${year}\n\n`;
    csv += 'Category,Subcategory,';
    
    months.forEach(m => {
      csv += `${m.name} Actual,${m.name} Budget,`;
    });
    csv += 'YTD Actual,YTD Budget,Variance %\n';
    
    Object.entries(ytdTotals).forEach(([accountCode, accountTotals]) => {
      const variance = accountTotals.budget > 0 ? 
        ((accountTotals.actual - accountTotals.budget) / accountTotals.budget * 100) : 0;
      
      csv += `"${accountTotals.account_name || accountCode}","",`;
      months.forEach(m => {
        const key = `${m.year}-${m.month}`;
        const monthData = monthlyData[key]?.[accountCode] || {};
        csv += `${monthData.spent || 0},${monthData.budgeted || 0},`;
      });
      csv += `${accountTotals.actual},${accountTotals.budget},${variance.toFixed(1)}%\n`;
      
      Object.entries(accountTotals.subaccounts).forEach(([subCode, subTotals]: [string, any]) => {
        const subVariance = subTotals.budget > 0 ? 
          ((subTotals.actual - subTotals.budget) / subTotals.budget * 100) : 0;
        
        csv += `"","${subTotals.account_name || subCode}",`;
        months.forEach(m => {
          const key = `${m.year}-${m.month}`;
          const accountData = monthlyData[key]?.[accountCode] || {};
          const subData = (accountData.subaccounts || []).find(s => s.account_code === subCode);
          csv += `${subData?.spent || 0},${subData?.budgeted || 0},`;
        });
        csv += `${subTotals.actual},${subTotals.budget},${subVariance.toFixed(1)}%\n`;
      });
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `ytd_budget_${year}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const cycleViewState = () => {
    const states: ViewState[] = ['actuals', 'actuals-vs-budget', 'budget'];
    const currentIndex = states.indexOf(viewState);
    setViewState(states[(currentIndex + 1) % 3]);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center rounded-t-xl">
        <div className="flex gap-2">
          <button
            onClick={cycleViewState}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
          >
            Toggle View: {viewState === 'actuals' ? 'Actuals' : viewState === 'actuals-vs-budget' ? 'Actuals vs Budget' : 'Budget'}
          </button>
          <button
            onClick={() => setColorsEnabled(!colorsEnabled)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
          >
            Toggle Colors
          </button>
          <button
            onClick={toggleAllCategories}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
          >
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
        <button 
          onClick={exportData}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-1"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-200">
              <th className="sticky left-0 bg-white z-20 text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px] border-r-2 border-gray-200">
                Category
              </th>
              {months.map(m => (
                <th key={`${m.year}-${m.month}`} className="px-3 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right border-r border-gray-100">
                  {m.name}
                </th>
              ))}
              <th className="px-3 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right border-r-2 border-gray-200">
                YTD Actual
              </th>
              <th className="px-3 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right border-r border-gray-100">
                YTD Budget
              </th>
              <th className="px-3 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">
                Var%
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={months.length + 4} className="text-center py-8 text-gray-500">
                  Loading Year to Date data...
                </td>
              </tr>
            ) : Object.keys(ytdTotals).length === 0 ? (
              <tr>
                <td colSpan={months.length + 4} className="text-center py-8 text-gray-500">
                  No data available for Year to Date
                </td>
              </tr>
            ) : (
              Object.entries(ytdTotals)
                .sort((a, b) => {
                  // Sort by display_order if available
                  const orderA = a[1].display_order;
                  const orderB = b[1].display_order;
                  if (orderA !== undefined && orderB !== undefined) {
                    return orderA - orderB;
                  }
                  return a[0].localeCompare(b[0]);
                })
                .map(([accountCode, accountTotals]) => {
                const variance = accountTotals.budget > 0 ? 
                  ((accountTotals.actual - accountTotals.budget) / accountTotals.budget * 100) : 0;
                const isExpanded = expandedCategories.has(accountCode);
                
                return (
                  <>
                    <tr key={accountCode} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="sticky left-0 bg-white z-10 px-4 py-2 border-r-2 border-gray-200">
                        <button
                          onClick={() => toggleAccount(accountCode)}
                          className="flex items-center gap-2 font-medium text-blue-600 hover:text-blue-800"
                        >
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {accountTotals.account_name || accountCode}
                        </button>
                      </td>
                      {months.map(m => {
                        const key = `${m.year}-${m.month}`;
                        const monthData = monthlyData[key]?.[accountCode] || {};
                        return renderMonthCell(monthData.spent || 0, monthData.budgeted || 0);
                      })}
                      <td className="px-3 py-2 text-right font-semibold border-r-2 border-gray-200">
                        {formatCurrency(accountTotals.actual)}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-gray-100">
                        {formatCurrency(accountTotals.budget)}
                      </td>
                      <td className={cn(
                        "px-3 py-2 text-center font-medium",
                        variance > 0 ? "text-red-600" : variance < -20 ? "text-green-600" : "text-gray-600"
                      )}>
                        {variance.toFixed(1)}%
                      </td>
                    </tr>
                    
                    {isExpanded && Object.entries(accountTotals.subaccounts).map(([subCode, subTotals]: [string, any]) => {
                      const subVariance = subTotals.budget > 0 ? 
                        ((subTotals.actual - subTotals.budget) / subTotals.budget * 100) : 0;
                      
                      return (
                        <tr key={`${accountCode}-${subCode}`} className="border-b border-gray-50 bg-gray-50/50">
                          <td className="sticky left-0 bg-gray-50/50 z-10 px-4 py-2 pl-12 text-sm text-gray-600 border-r-2 border-gray-200">
                            {subTotals.account_name || subCode}
                          </td>
                          {months.map(m => {
                            const key = `${m.year}-${m.month}`;
                            const accountData = monthlyData[key]?.[accountCode] || {};
                            const subData = (accountData.subaccounts || []).find(s => s.account_code === subCode);
                            return renderMonthCell(subData?.spent || 0, subData?.budgeted || 0);
                          })}
                          <td className="px-3 py-2 text-right text-sm border-r-2 border-gray-200">
                            {formatCurrency(subTotals.actual)}
                          </td>
                          <td className="px-3 py-2 text-right text-sm border-r border-gray-100">
                            {formatCurrency(subTotals.budget)}
                          </td>
                          <td className={cn(
                            "px-3 py-2 text-center text-sm",
                            subVariance > 0 ? "text-red-600" : "text-green-600"
                          )}>
                            {subVariance.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}