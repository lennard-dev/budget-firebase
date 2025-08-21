import { useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { api } from '../../services/api';
import { cn } from '../../lib/utils';

interface CategoryData {
  spent: number;
  total: number;
  subcategories?: SubcategoryData[];
}

interface SubcategoryData {
  subcategory: string;
  spent: number;
  budgeted: number;
}

interface BudgetData {
  totalBudget: number;
  totalSpent: number;
  categoriesGrouped: Record<string, CategoryData>;
}

type ViewState = 'actuals' | 'actuals-vs-budget' | 'budget';

interface CurrentYearViewProps {
  year: number;
}

export default function CurrentYearView({ year }: CurrentYearViewProps) {
  const [viewState, setViewState] = useState<ViewState>('budget'); // Default to budget view for full year
  const [colorsEnabled, setColorsEnabled] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  // Generate all 12 months
  const months = Array.from({ length: 12 }, (_, i) => ({
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
  const monthlyData: Record<string, BudgetData['categoriesGrouped']> = {};
  const yearTotals: Record<string, any> = {};

  // Process monthly data
  monthQueries.forEach(query => {
    if (query.data) {
      const { key, data } = query.data;
      monthlyData[key] = data.categoriesGrouped || {};
      
      // Accumulate year totals
      Object.entries(data.categoriesGrouped || {}).forEach(([cat, catData]) => {
        if (!yearTotals[cat]) {
          yearTotals[cat] = { actual: 0, budget: 0, subcategories: {} };
        }
        yearTotals[cat].actual += catData.spent || 0;
        yearTotals[cat].budget += catData.total || 0;
        
        (catData.subcategories || []).forEach(sub => {
          const subKey = sub.subcategory;
          if (!yearTotals[cat].subcategories[subKey]) {
            yearTotals[cat].subcategories[subKey] = { actual: 0, budget: 0 };
          }
          yearTotals[cat].subcategories[subKey].actual += sub.spent || 0;
          yearTotals[cat].subcategories[subKey].budget += sub.budgeted || 0;
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

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const toggleAllCategories = () => {
    if (allExpanded) {
      setExpandedCategories(new Set());
      setAllExpanded(false);
    } else {
      const allCategoryNames = Object.keys(yearTotals);
      setExpandedCategories(new Set(allCategoryNames));
      setAllExpanded(true);
    }
  };

  const renderMonthCell = (spent: number, budget: number, isFutureMonth: boolean) => {
    let cellClass = '';
    
    // Gray out future months
    if (isFutureMonth && viewState === 'actuals') {
      cellClass = 'bg-gray-50 text-gray-400';
      return (
        <td className={cn("px-3 py-2 text-right text-sm border-r border-gray-100", cellClass)}>
          -
        </td>
      );
    } else if (viewState === 'actuals') {
      const content = spent > 0 ? formatCurrency(spent) : '-';
      if (colorsEnabled && budget > 0 && !isFutureMonth) {
        cellClass = spent > budget ? 'bg-red-100 text-red-800' : spent < budget * 0.8 ? 'bg-green-100 text-green-800' : '';
      }
      return (
        <td className={cn("px-3 py-2 text-right text-sm border-r border-gray-100", cellClass)}>
          {content}
        </td>
      );
    } else if (viewState === 'actuals-vs-budget') {
      if (colorsEnabled && budget > 0 && !isFutureMonth) {
        cellClass = spent > budget ? 'bg-red-100' : spent < budget * 0.8 ? 'bg-green-100' : '';
      }
      return (
        <td className={cn("px-3 py-2 text-right text-sm border-r border-gray-100", cellClass)}>
          <div className={cn("font-medium", isFutureMonth && "text-gray-400")}>
            {!isFutureMonth && spent > 0 ? formatCurrency(spent) : '-'}
          </div>
          <div className="text-xs text-gray-500">{budget > 0 ? formatCurrency(budget) : '-'}</div>
        </td>
      );
    } else {
      // Budget view - show budgets for all months
      const content = budget > 0 ? formatCurrency(budget) : '-';
      return (
        <td className={cn("px-3 py-2 text-right text-sm border-r border-gray-100", cellClass)}>
          {content}
        </td>
      );
    }
  };

  const exportData = () => {
    let csv = `Current Year Budget Report - ${year}\n\n`;
    csv += 'Category,Subcategory,';
    
    months.forEach(m => {
      csv += `${m.name} Actual,${m.name} Budget,`;
    });
    csv += 'Year Total,Year Budget,Variance %\n';
    
    Object.entries(yearTotals).sort((a, b) => a[0].localeCompare(b[0])).forEach(([catName, catTotals]) => {
      const variance = catTotals.budget > 0 ? 
        ((catTotals.actual - catTotals.budget) / catTotals.budget * 100) : 0;
      
      csv += `"${catName}","",`;
      months.forEach(m => {
        const key = `${m.year}-${m.month}`;
        const monthData = monthlyData[key]?.[catName] || {};
        csv += `${monthData.spent || 0},${monthData.total || 0},`;
      });
      csv += `${catTotals.actual},${catTotals.budget},${variance.toFixed(1)}%\n`;
      
      Object.entries(catTotals.subcategories).forEach(([subName, subTotals]: [string, any]) => {
        const subVariance = subTotals.budget > 0 ? 
          ((subTotals.actual - subTotals.budget) / subTotals.budget * 100) : 0;
        
        csv += `"","${subName}",`;
        months.forEach(m => {
          const key = `${m.year}-${m.month}`;
          const catData = monthlyData[key]?.[catName] || {};
          const subData = (catData.subcategories || []).find(s => s.subcategory === subName);
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
    a.setAttribute('download', `current_year_budget_${year}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const cycleViewState = () => {
    const states: ViewState[] = ['actuals', 'actuals-vs-budget', 'budget'];
    const currentIndex = states.indexOf(viewState);
    setViewState(states[(currentIndex + 1) % 3]);
  };

  const currentMonth = new Date().getMonth() + 1;

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
                <th 
                  key={`${m.year}-${m.month}`} 
                  className={cn(
                    "px-3 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right border-r border-gray-100",
                    m.month > currentMonth && "text-gray-400"
                  )}
                >
                  {m.name}
                </th>
              ))}
              <th className="px-3 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right border-r-2 border-gray-200">
                Year Total
              </th>
              <th className="px-3 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right border-r border-gray-100">
                Year Budget
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
                  Loading Current Year data...
                </td>
              </tr>
            ) : Object.keys(yearTotals).length === 0 ? (
              <tr>
                <td colSpan={months.length + 4} className="text-center py-8 text-gray-500">
                  No data available for Current Year
                </td>
              </tr>
            ) : (
              Object.entries(yearTotals).sort((a, b) => a[0].localeCompare(b[0])).map(([catName, catTotals]) => {
                const variance = catTotals.budget > 0 ? 
                  ((catTotals.actual - catTotals.budget) / catTotals.budget * 100) : 0;
                const isExpanded = expandedCategories.has(catName);
                
                return (
                  <>
                    <tr key={catName} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="sticky left-0 bg-white z-10 px-4 py-2 border-r-2 border-gray-200">
                        <button
                          onClick={() => toggleCategory(catName)}
                          className="flex items-center gap-2 font-medium text-blue-600 hover:text-blue-800"
                        >
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {catName}
                        </button>
                      </td>
                      {months.map(m => {
                        const key = `${m.year}-${m.month}`;
                        const monthData = monthlyData[key]?.[catName] || {};
                        const isFutureMonth = m.month > currentMonth;
                        return renderMonthCell(monthData.spent || 0, monthData.total || 0, isFutureMonth);
                      })}
                      <td className="px-3 py-2 text-right font-semibold border-r-2 border-gray-200">
                        {formatCurrency(catTotals.actual)}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-gray-100">
                        {formatCurrency(catTotals.budget)}
                      </td>
                      <td className={cn(
                        "px-3 py-2 text-center font-medium",
                        variance > 0 ? "text-red-600" : variance < -20 ? "text-green-600" : "text-gray-600"
                      )}>
                        {variance.toFixed(1)}%
                      </td>
                    </tr>
                    
                    {isExpanded && Object.entries(catTotals.subcategories).map(([subName, subTotals]: [string, any]) => {
                      const subVariance = subTotals.budget > 0 ? 
                        ((subTotals.actual - subTotals.budget) / subTotals.budget * 100) : 0;
                      
                      return (
                        <tr key={`${catName}-${subName}`} className="border-b border-gray-50 bg-gray-50/50">
                          <td className="sticky left-0 bg-gray-50/50 z-10 px-4 py-2 pl-12 text-sm text-gray-600 border-r-2 border-gray-200">
                            {subName}
                          </td>
                          {months.map(m => {
                            const key = `${m.year}-${m.month}`;
                            const catData = monthlyData[key]?.[catName] || {};
                            const subData = (catData.subcategories || []).find(s => s.subcategory === subName);
                            const isFutureMonth = m.month > currentMonth;
                            return renderMonthCell(subData?.spent || 0, subData?.budgeted || 0, isFutureMonth);
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