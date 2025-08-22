import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ThreeMonthComparisonProps {
  data: {
    current: { month: number; year: number; spending: Record<string, number> };
    previous: Array<{ month: number; year: number; spending: Record<string, number> }>;
  };
  categories: Record<string, any>;
}

export default function ThreeMonthComparison({ data, categories }: ThreeMonthComparisonProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Handle null/undefined data or categories
  if (!data || !categories) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Three Month Comparison</h3>
        <p className="text-gray-500">No comparison data available for this period.</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getMonthName = (month: number) => {
    const date = new Date(2024, month - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Prepare month headers
  const months = [
    ...data.previous.slice().reverse(),
    data.current
  ].map(m => ({
    label: getMonthName(m.month),
    year: m.year,
    month: m.month
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Detailed Expenses - Past 3 Months</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">
                Category / Subcategory
              </th>
              {months.map((m) => (
                <th key={`${m.year}-${m.month}`} className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
                  {m.label} {m.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Object.entries(categories).map(([categoryName, categoryData]) => {
              const isExpanded = expandedCategories.has(categoryName);
              
              return (
                <>
                  <tr key={categoryName} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <button
                        onClick={() => toggleCategory(categoryName)}
                        className="flex items-center gap-2 font-medium text-gray-900 hover:text-blue-600"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {categoryName}
                      </button>
                    </td>
                    {[...data.previous.slice().reverse(), data.current].map((monthData) => {
                      const amount = monthData.spending?.[categoryName] || 0;
                      const budget = categoryData?.budgeted || 0;
                      const isOver = amount > budget && budget > 0;
                      
                      return (
                        <td key={`${monthData.year}-${monthData.month}`} className="px-6 py-3 text-right">
                          <div className={cn(
                            "font-medium",
                            isOver ? "text-red-600" : "text-gray-900"
                          )}>
                            {formatCurrency(amount)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatCurrency(budget)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  
                  {isExpanded && categoryData.subcategories?.map((sub: any) => (
                    <tr key={`${categoryName}-${sub.name}`} className="bg-gray-50">
                      <td className="px-6 py-2 pl-12 text-sm text-gray-600">
                        {sub.name}
                      </td>
                      {[...data.previous.slice().reverse(), data.current].map((monthData) => {
                        // Note: We don't have subcategory breakdown in the comparison data
                        // This would need to be added to the backend
                        return (
                          <td key={`${monthData.year}-${monthData.month}`} className="px-6 py-2 text-right text-sm text-gray-500">
                            -
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}