import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { cn } from '../lib/utils';
import YearToDateView from '../components/budget/YearToDateView';
import CurrentYearView from '../components/budget/CurrentYearView';
import BudgetSettings from '../components/budget/BudgetSettings';

interface BudgetData {
  totalBudget: number;
  totalSpent: number;
  categoriesGrouped: Record<string, AccountData>;  // Using accounts instead of categories
}

interface AccountData {
  spent: number;
  total: number;
  subcategories?: SubAccountData[];  // Sub-accounts instead of subcategories
}

interface SubAccountData {
  subcategory: string;  // Will be renamed to sub-account in backend
  spent: number;
  budgeted: number;
}

type TabId = 'current-month' | 'year-to-date' | 'current-year' | 'budget-settings';

export default function Budget() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [activeTab, setActiveTab] = useState<TabId>('current-month');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const [year, month] = selectedMonth.split('-');
  
  // Fetch budget data for current month
  const { data: budgetData, isLoading } = useQuery({
    queryKey: ['budget', year, month],
    queryFn: async () => {
      const response = await api.get(`/budgets?year=${year}&month=${month}`);
      // Backend returns { success: true, data: {...} }
      if (response.data?.success && response.data?.data) {
        return response.data.data as BudgetData;
      }
      return response.data as BudgetData;
    }
  });

  const totalBudget = budgetData?.totalBudget || 0;
  const totalSpent = budgetData?.totalSpent || 0;
  const remaining = totalBudget - totalSpent;
  const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getBudgetStatus = (spent: number, budgeted: number) => {
    if (!budgeted || budgeted === 0) return 'neutral';
    const percentage = (spent / budgeted) * 100;
    
    if (percentage > 100) return 'over';
    if (percentage > 80) return 'warning';
    if (percentage < 50) return 'under';
    return 'on-track';
  };

  const getBudgetStatusText = (spent: number, budgeted: number) => {
    const status = getBudgetStatus(spent, budgeted);
    switch (status) {
      case 'over': return 'Over Budget';
      case 'warning': return 'Near Limit';
      case 'under': return 'Under-utilized';
      case 'on-track': return 'On Track';
      default: return 'No Budget';
    }
  };

  const getProgressColor = (spent: number, budgeted: number) => {
    const status = getBudgetStatus(spent, budgeted);
    switch (status) {
      case 'over': return 'bg-red-600';
      case 'warning': return 'bg-amber-500';
      case 'under': return 'bg-blue-600';
      case 'on-track': return 'bg-emerald-600';
      default: return 'bg-gray-500';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'over': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-amber-100 text-amber-800';
      case 'under': return 'bg-blue-100 text-blue-800';
      case 'on-track': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleAccount = (accountName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountName)) {
        newSet.delete(accountName);
      } else {
        newSet.add(accountName);
      }
      return newSet;
    });
  };

  const toggleAllCategories = () => {
    if (allExpanded) {
      setExpandedCategories(new Set());
      setAllExpanded(false);
    } else {
      const allAccountNames = Object.keys(budgetData?.categoriesGrouped || {});
      setExpandedCategories(new Set(allAccountNames));
      setAllExpanded(true);
    }
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    const date = new Date(year + '-' + month + '-01');
    if (direction === 'prev') {
      date.setMonth(date.getMonth() - 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const getMonthOptions = () => {
    const options = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${d.toLocaleString('en', { month: 'long' })} ${d.getFullYear()}`;
      options.push({ value, label });
    }
    return options;
  };

  const exportCurrentMonth = () => {
    if (!budgetData) {
      alert('No data to export');
      return;
    }

    const monthName = new Date(year + '-' + month + '-01').toLocaleString('en', { month: 'long', year: 'numeric' });
    
    let csv = `Budget Report - ${monthName}\n\n`;
    csv += 'Account,Sub-Account,Budget,Spent,Remaining,% Used\n';
    
    Object.entries(budgetData.categoriesGrouped || {}).forEach(([catName, catData]) => {
      const spent = catData.spent || 0;
      const budgeted = catData.total || 0;
      const catRemaining = budgeted - spent;
      const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
      
      csv += `"${catName}","",${budgeted},${spent},${catRemaining},${percentage.toFixed(1)}%\n`;
      
      (catData.subcategories || []).forEach(sub => {
        const subSpent = sub.spent || 0;
        const subBudgeted = sub.budgeted || 0;
        const subRemaining = subBudgeted - subSpent;
        const subPercentage = subBudgeted > 0 ? (subSpent / subBudgeted) * 100 : 0;
        
        csv += `"","${sub.subcategory}",${subBudgeted},${subSpent},${subRemaining},${subPercentage.toFixed(1)}%\n`;
      });
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `budget_${monthName.replace(' ', '_')}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-3 flex justify-between items-center">
          {/* Left-aligned Tab Navigation */}
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab('current-month')}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                activeTab === 'current-month'
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              Current Month
            </button>
            <button
              onClick={() => setActiveTab('year-to-date')}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                activeTab === 'year-to-date'
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              Year to Date
            </button>
            <button
              onClick={() => setActiveTab('current-year')}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                activeTab === 'current-year'
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              Current Year
            </button>
            <button
              onClick={() => setActiveTab('budget-settings')}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                activeTab === 'budget-settings'
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              Budget Settings
            </button>
          </nav>

          {/* Right-aligned Month Selector (only visible for current-month tab) */}
          {activeTab === 'current-month' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeMonth('prev')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {getMonthOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => changeMonth('next')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {activeTab !== 'budget-settings' && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Total Budget</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">{formatCurrency(totalBudget)}</div>
          <div className="mt-1 text-xs text-gray-500">Same as last month</div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Total Spent</div>
          <div className="mt-1 text-2xl font-bold text-red-600">{formatCurrency(totalSpent)}</div>
          <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={cn("h-full transition-all duration-300", getProgressColor(totalSpent, totalBudget))}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Remaining</div>
          <div className={cn("mt-1 text-2xl font-bold", remaining < 0 ? "text-red-600" : "text-emerald-600")}>
            {formatCurrency(remaining)}
          </div>
          <div className="mt-1 text-xs text-gray-500">15 days left in period</div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">% Used</div>
          <div className={cn("mt-1 text-2xl font-bold", percentUsed > 100 ? "text-red-600" : percentUsed > 80 ? "text-amber-600" : "text-blue-600")}>
            {formatPercent(percentUsed)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {percentUsed > 80 ? 'High usage rate' : 'Normal usage'}
          </div>
        </div>
      </div>
      )}

      {/* Tab Content */}
      <div>
        {activeTab === 'current-month' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Action Bar */}
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center rounded-t-xl">
            <button
              onClick={toggleAllCategories}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
            <button
              onClick={exportCurrentMonth}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-1"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Account</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Budget</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Spent</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Remaining</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">% Used</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Progress</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">Loading budget data...</td>
                  </tr>
                ) : !budgetData || Object.keys(budgetData.categoriesGrouped || {}).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">No budget data for this period</td>
                  </tr>
                ) : (
                  Object.entries(budgetData.categoriesGrouped || {})
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([categoryName, categoryData]) => {
                      const spent = categoryData.spent || 0;
                      const budgeted = categoryData.total || 0;
                      const catRemaining = budgeted - spent;
                      const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
                      const status = getBudgetStatus(spent, budgeted);
                      const statusText = getBudgetStatusText(spent, budgeted);
                      const isExpanded = expandedCategories.has(categoryName);
                      
                      return (
                        <>
                          <tr key={categoryName} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <button
                                onClick={() => toggleAccount(categoryName)}
                                className="flex items-center gap-2 font-medium text-blue-600 hover:text-blue-800"
                              >
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                {categoryName}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right">{formatCurrency(budgeted)}</td>
                            <td className={cn("px-4 py-3 text-right", spent > budgeted && "text-red-600")}>
                              {formatCurrency(spent)}
                            </td>
                            <td className={cn("px-4 py-3 text-right", catRemaining < 0 ? "text-red-600" : "text-emerald-600")}>
                              {formatCurrency(catRemaining)}
                            </td>
                            <td className="px-4 py-3 text-center">{formatPercent(percentage)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={cn("h-full transition-all duration-300", getProgressColor(spent, budgeted))}
                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-gray-600 min-w-[35px] text-center">
                                  {formatPercent(percentage)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={cn("inline-flex px-2 py-1 text-xs font-semibold rounded-full", getStatusClass(status))}>
                                {statusText}
                              </span>
                            </td>
                          </tr>
                          
                          {/* Sub-Accounts */}
                          {isExpanded && (categoryData.subcategories || []).map(subcategory => {
                            const subSpent = subcategory.spent || 0;
                            const subBudgeted = subcategory.budgeted || 0;
                            const subRemaining = subBudgeted - subSpent;
                            const subPercentage = subBudgeted > 0 ? (subSpent / subBudgeted) * 100 : 0;
                            const subStatus = getBudgetStatus(subSpent, subBudgeted);
                            const subStatusText = getBudgetStatusText(subSpent, subBudgeted);
                            
                            return (
                              <tr key={`${categoryName}-${subcategory.subcategory}`} className="border-b border-gray-50 bg-gray-50/50">
                                <td className="px-4 py-3 pl-12 text-sm text-gray-600">{subcategory.subcategory}</td>
                                <td className="px-4 py-3 text-right text-sm">{formatCurrency(subBudgeted)}</td>
                                <td className={cn("px-4 py-3 text-right text-sm", subSpent > subBudgeted && "text-red-600")}>
                                  {formatCurrency(subSpent)}
                                </td>
                                <td className={cn("px-4 py-3 text-right text-sm", subRemaining < 0 ? "text-red-600" : "text-emerald-600")}>
                                  {formatCurrency(subRemaining)}
                                </td>
                                <td className="px-4 py-3 text-center text-sm">{formatPercent(subPercentage)}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className={cn("h-full transition-all duration-300", getProgressColor(subSpent, subBudgeted))}
                                        style={{ width: `${Math.min(subPercentage, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium text-gray-600 min-w-[35px] text-center">
                                      {formatPercent(subPercentage)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={cn("inline-flex px-2 py-1 text-xs font-semibold rounded-full", getStatusClass(subStatus))}>
                                    {subStatusText}
                                  </span>
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
      )}

        {activeTab === 'year-to-date' && (
          <YearToDateView 
            year={parseInt(year)} 
            currentMonth={new Date().getMonth() + 1} 
          />
        )}

        {activeTab === 'current-year' && (
          <CurrentYearView year={parseInt(year)} />
        )}

        {activeTab === 'budget-settings' && (
          <BudgetSettings />
        )}
      </div>
    </div>
  );
}