import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';

interface Category {
  id: string;
  name: string;
  code?: string;
  subcategories: string[];
  budgetAllocation?: number;
}

interface BudgetAllocation {
  category: string;
  subcategory?: string;
  amount: number;
}

export default function BudgetSettings() {
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [budgetAllocations, setBudgetAllocations] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/categories');
      return response.data?.categories || [];
    }
  });

  // Fetch current budget allocations
  const { data: currentBudget, isLoading: budgetLoading } = useQuery({
    queryKey: ['budget-allocations'],
    queryFn: async () => {
      const response = await api.get('/budgets/allocations');
      return response.data?.allocations || {};
    }
  });

  // Initialize budget allocations when data loads
  useEffect(() => {
    if (currentBudget) {
      const allocations: Record<string, number> = {};
      
      // Convert the budget data to our flat structure
      Object.entries(currentBudget).forEach(([key, value]) => {
        if (typeof value === 'number') {
          allocations[key] = value;
        }
      });
      
      setBudgetAllocations(allocations);
    }
  }, [currentBudget]);

  // Save budget allocations
  const saveMutation = useMutation({
    mutationFn: async (allocations: Record<string, number>) => {
      // Convert flat structure to API format
      const budgetData: BudgetAllocation[] = [];
      
      Object.entries(allocations).forEach(([key, amount]) => {
        if (amount > 0) {
          if (key.includes('::')) {
            const [category, subcategory] = key.split('::');
            budgetData.push({ category, subcategory, amount });
          } else {
            budgetData.push({ category: key, amount });
          }
        }
      });

      return api.post('/budgets/allocations', { allocations: budgetData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['budget'] });
      setHasChanges(false);
      alert('Budget allocations saved successfully');
    },
    onError: (error) => {
      console.error('Error saving budget:', error);
      alert('Failed to save budget allocations');
    }
  });

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

  const handleAllocationChange = (key: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setBudgetAllocations(prev => ({
      ...prev,
      [key]: amount
    }));
    setHasChanges(true);
  };

  const calculateCategoryTotal = (category: Category) => {
    let total = budgetAllocations[category.name] || 0;
    
    category.subcategories?.forEach(subcat => {
      const key = `${category.name}::${subcat}`;
      total += budgetAllocations[key] || 0;
    });
    
    return total;
  };

  const calculateGrandTotal = () => {
    return categories.reduce((sum: number, cat: Category) => sum + calculateCategoryTotal(cat), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const handleSave = () => {
    saveMutation.mutate(budgetAllocations);
  };

  const isLoading = categoriesLoading || budgetLoading;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Budget Allocations</h3>
            <p className="text-sm text-gray-500 mt-1">
              Set monthly budget amounts for each category and subcategory
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-500">Total Budget</div>
              <div className="text-xl font-bold text-blue-600">
                {formatCurrency(calculateGrandTotal())}
              </div>
            </div>
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Budget Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Category / Subcategory
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Monthly Budget
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Category Total
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={3} className="text-center py-8 text-gray-500">
                  Loading budget settings...
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-8 text-gray-500">
                  No categories found. Add categories in the Settings page.
                </td>
              </tr>
            ) : (
              categories.map((category: Category) => {
                const isExpanded = expandedCategories.has(category.name);
                const categoryTotal = calculateCategoryTotal(category);
                const hasSubcategories = category.subcategories && category.subcategories.length > 0;
                
                return (
                  <>
                    {/* Category Row */}
                    <tr key={category.name} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          {hasSubcategories && (
                            <button
                              onClick={() => toggleCategory(category.name)}
                              className="p-0.5 hover:bg-gray-200 rounded"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500" />
                              )}
                            </button>
                          )}
                          <span className="font-medium text-gray-900">
                            {category.name}
                            {category.code && (
                              <span className="ml-2 text-xs text-gray-500">({category.code})</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex justify-end">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                            <input
                              type="number"
                              value={budgetAllocations[category.name] || ''}
                              onChange={(e) => handleAllocationChange(category.name, e.target.value)}
                              placeholder="0.00"
                              className="w-32 pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                              step="0.01"
                              min="0"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(categoryTotal)}
                        </span>
                      </td>
                    </tr>

                    {/* Subcategory Rows */}
                    {isExpanded && hasSubcategories && category.subcategories.map((subcategory: string) => {
                      const key = `${category.name}::${subcategory}`;
                      
                      return (
                        <tr key={key} className="border-b border-gray-50 bg-gray-50/50">
                          <td className="px-6 py-3 pl-14">
                            <span className="text-sm text-gray-600">{subcategory}</span>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex justify-end">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                                <input
                                  type="number"
                                  value={budgetAllocations[key] || ''}
                                  onChange={(e) => handleAllocationChange(key, e.target.value)}
                                  placeholder="0.00"
                                  className="w-32 pl-8 pr-3 py-1 border border-gray-200 rounded-md text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  step="0.01"
                                  min="0"
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            {/* Empty cell for subcategories */}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })
            )}
          </tbody>
          
          {/* Grand Total Row */}
          {categories.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td className="px-6 py-3 font-bold text-gray-900">
                  Grand Total
                </td>
                <td className="px-6 py-3"></td>
                <td className="px-6 py-3 text-right">
                  <span className="text-xl font-bold text-blue-600">
                    {formatCurrency(calculateGrandTotal())}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Instructions */}
      <div className="px-6 py-4 bg-blue-50 border-t border-blue-100">
        <div className="flex items-start gap-2">
          <div className="text-blue-600 mt-0.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-sm text-blue-800">
            <p className="font-medium">How to use Budget Settings:</p>
            <ul className="mt-1 space-y-1 list-disc list-inside text-blue-700">
              <li>Enter budget amounts for main categories or their subcategories</li>
              <li>Category totals are calculated automatically from subcategory budgets</li>
              <li>Click "Save Changes" to apply your budget allocations</li>
              <li>Budget allocations will be used for tracking in the Current Month view</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}