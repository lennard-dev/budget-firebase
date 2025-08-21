import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CategoryData {
  budgeted: number;
  spent: number;
  variance: number;
  variancePercent: number;
  subcategories: Array<{
    name: string;
    budgeted: number;
    spent: number;
    variance: number;
  }>;
}

interface BudgetVsActualTableProps {
  categories: Record<string, CategoryData>;
  disabled?: boolean;
}

export default function BudgetVsActualTable({ categories, disabled }: BudgetVsActualTableProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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

  const needsExplanation = (variance: number, variancePercent: number) => {
    return variance > 0 && (Math.abs(variancePercent) > 10 || Math.abs(variance) > 100);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Budget vs Actual</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Category
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Budget
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actual
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Variance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Object.entries(categories).map(([categoryName, categoryData]) => {
              const isExpanded = expandedCategories.has(categoryName);
              const hasVariance = needsExplanation(categoryData.variance, categoryData.variancePercent);
              
              return (
                <>
                  <tr key={categoryName} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <button
                        onClick={() => toggleCategory(categoryName)}
                        className="flex items-center gap-2 font-medium text-gray-900 hover:text-blue-600"
                        disabled={disabled}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {categoryName}
                        {hasVariance && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-right font-medium">
                      {formatCurrency(categoryData.budgeted)}
                    </td>
                    <td className="px-6 py-3 text-right font-medium">
                      {formatCurrency(categoryData.spent)}
                    </td>
                    <td className={cn(
                      "px-6 py-3 text-right font-medium",
                      categoryData.variance > 0 ? "text-red-600" : "text-green-600"
                    )}>
                      {formatCurrency(Math.abs(categoryData.variance))}
                      {categoryData.variance > 0 ? ' over' : ' under'}
                    </td>
                  </tr>
                  
                  {isExpanded && categoryData.subcategories?.map((sub) => (
                    <tr key={`${categoryName}-${sub.name}`} className="bg-gray-50">
                      <td className="px-6 py-2 pl-12 text-sm text-gray-600">
                        {sub.name}
                      </td>
                      <td className="px-6 py-2 text-right text-sm">
                        {formatCurrency(sub.budgeted)}
                      </td>
                      <td className="px-6 py-2 text-right text-sm">
                        {formatCurrency(sub.spent)}
                      </td>
                      <td className={cn(
                        "px-6 py-2 text-right text-sm",
                        sub.variance > 0 ? "text-red-600" : "text-green-600"
                      )}>
                        {formatCurrency(Math.abs(sub.variance))}
                      </td>
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