import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Copy, Download, Plus, Save } from 'lucide-react';
import { api } from '../../services/api';
import { cn } from '../../lib/utils';
import MonthTabs from './MonthTabs';
import AccountAllocationCard from './AccountAllocationCard';

interface ChartAccount {
  account_code: string;
  account_name: string;
  parent_code?: string;
  display_as: 'category' | 'subcategory';
  icon?: string;
  description?: string;
  is_active?: boolean;
}

interface AllocationData {
  [accountCode: string]: number;
}


export default function AllocationTab() {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [allocations, setAllocations] = useState<AllocationData>({});
  const [hasChanges, setHasChanges] = useState(false);


  // Fetch chart of accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const response = await api.get('/chart-of-accounts');
      console.log('Chart of accounts response:', response.data);
      
      // The API returns { success: true, data: [...], hierarchy: {...} }
      let accountsData = [];
      if (response.data?.success && response.data?.data) {
        accountsData = response.data.data;
      } else if (Array.isArray(response.data)) {
        accountsData = response.data;
      }
      
      // Filter to get only active accounts and expense accounts for budget allocation
      return accountsData.filter((acc: ChartAccount & { account_type?: string }) => 
        acc.is_active !== false && 
        (acc.account_type === 'expense' || !acc.account_type) // Include expense accounts or those without type
      );
    }
  });

  // Fetch allocations for selected month
  const { data: monthAllocations, isLoading: allocationsLoading } = useQuery({
    queryKey: ['budget-allocations', selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split('-');
      const response = await api.get(`/budget-allocations?year=${year}&month=${month}`);
      const data = response.data?.data;
      if (data && data[selectedMonth]) {
        // Extract just the allocation amounts
        const { year, month, monthKey, updatedAt, updatedBy, ...allocations } = data[selectedMonth];
        return allocations as AllocationData;
      }
      return {};
    }
  });

  // Update local allocations when data is fetched
  useEffect(() => {
    if (monthAllocations) {
      setAllocations(monthAllocations);
      setHasChanges(false);
    }
  }, [monthAllocations]);

  // Save allocations mutation
  const saveAllocationsMutation = useMutation({
    mutationFn: async (data: { monthKey: string; allocations: AllocationData }) => {
      const response = await api.put('/budget-allocations', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-allocations', selectedMonth] });
      setHasChanges(false);
    }
  });

  // Bulk copy mutation
  const bulkCopyMutation = useMutation({
    mutationFn: async (data: { source_month: string; target_months: string[] }) => {
      const response = await api.post('/budget-allocations/bulk-copy', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-allocations'] });
    }
  });

  // Account management mutations removed - now handled in Settings page

  const handleAllocationChange = (accountCode: string, value: number) => {
    setAllocations(prev => ({
      ...prev,
      [accountCode]: value
    }));
    setHasChanges(true);

    // Update parent account total if this is a sub-account
    const account = accounts?.find((acc: ChartAccount) => acc.account_code === accountCode);
    if (account?.parent_code) {
      updateParentTotal(account.parent_code);
    }
  };

  const updateParentTotal = (parentCode: string) => {
    const subAccounts = accounts?.filter((acc: ChartAccount) => acc.parent_code === parentCode) || [];
    const total = subAccounts.reduce((sum: number, sub: ChartAccount) => {
      return sum + (allocations[sub.account_code] || 0);
    }, 0);
    
    setAllocations(prev => ({
      ...prev,
      [parentCode]: total
    }));
  };

  const toggleAccount = (accountCode: string) => {
    setExpandedAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountCode)) {
        newSet.delete(accountCode);
      } else {
        newSet.add(accountCode);
      }
      return newSet;
    });
  };

  const toggleAllAccounts = () => {
    const categoryAccounts = accounts?.filter((acc: ChartAccount) => acc.display_as === 'category') || [];
    if (expandedAccounts.size === categoryAccounts.length) {
      setExpandedAccounts(new Set());
    } else {
      setExpandedAccounts(new Set(categoryAccounts.map((acc: ChartAccount) => acc.account_code)));
    }
  };

  const handleSaveAllocations = () => {
    saveAllocationsMutation.mutate({
      monthKey: selectedMonth,
      allocations
    });
  };

  const handleCopyFromPrevious = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1); // month is 0-indexed in Date
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Fetch previous month's allocations and apply to current
    api.get(`/budget-allocations?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}`)
      .then(response => {
        const data = response.data?.data;
        if (data && data[prevMonth]) {
          const { year, month, monthKey, updatedAt, updatedBy, ...prevAllocations } = data[prevMonth];
          setAllocations(prevAllocations);
          setHasChanges(true);
        }
      });
  };

  const handleCopyToRemaining = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const targetMonths: string[] = [];
    
    // Generate remaining months in the fiscal year
    for (let m = month + 1; m <= 12; m++) {
      targetMonths.push(`${year}-${String(m).padStart(2, '0')}`);
    }
    
    if (targetMonths.length > 0) {
      // First save current allocations
      saveAllocationsMutation.mutate({
        monthKey: selectedMonth,
        allocations
      }, {
        onSuccess: () => {
          // Then copy to remaining months
          bulkCopyMutation.mutate({
            source_month: selectedMonth,
            target_months: targetMonths
          });
        }
      });
    }
  };


  const handleExport = () => {
    const monthName = new Date(selectedMonth + '-01').toLocaleString('en', { month: 'long', year: 'numeric' });
    
    let csv = `Budget Allocation - ${monthName}\n\n`;
    csv += 'Account Code,Account Name,Type,Allocated Amount\n';
    
    const categoryAccounts = accounts?.filter((acc: ChartAccount) => acc.display_as === 'category') || [];
    
    categoryAccounts.forEach((category: ChartAccount) => {
      const categoryAmount = allocations[category.account_code] || 0;
      csv += `"${category.account_code}","${category.account_name}","Category",${categoryAmount}\n`;
      
      const subAccounts = accounts?.filter((acc: ChartAccount) => acc.parent_code === category.account_code) || [];
      subAccounts.forEach((sub: ChartAccount) => {
        const subAmount = allocations[sub.account_code] || 0;
        csv += `"${sub.account_code}","${sub.account_name}","Sub-account",${subAmount}\n`;
      });
    });
    
    // Add total
    const total = Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0);
    csv += `\n"","Total","",${total}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `budget_allocation_${monthName.replace(' ', '_')}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const calculateTotal = () => {
    // Only sum category-level allocations to avoid double counting
    const categoryAccounts = accounts?.filter((acc: ChartAccount) => acc.display_as === 'category') || [];
    return categoryAccounts.reduce((sum: number, acc: ChartAccount) => {
      return sum + (allocations[acc.account_code] || 0);
    }, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const isLoading = accountsLoading || allocationsLoading;
  const categoryAccounts = accounts?.filter((acc: ChartAccount) => acc.display_as === 'category') || [];

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <MonthTabs
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />


      {/* Bulk Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={toggleAllAccounts}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
          >
            {expandedAccounts.size === categoryAccounts.length ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Collapse All
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Expand All
              </>
            )}
          </button>
          <button
            onClick={handleCopyFromPrevious}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy from Previous
          </button>
          <button
            onClick={handleCopyToRemaining}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy to Remaining
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Account Allocations */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
            Loading allocations...
          </div>
        ) : categoryAccounts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500 mb-4">No accounts found. Please set up your chart of accounts first.</p>
            <button
              onClick={async () => {
                try {
                  const response = await api.post('/chart-of-accounts/setup');
                  if (response.data?.success) {
                    queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
                  }
                } catch (error) {
                  console.error('Error setting up chart of accounts:', error);
                }
              }}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Initialize Default Chart of Accounts
            </button>
          </div>
        ) : (
          categoryAccounts.map((account: ChartAccount) => (
            <AccountAllocationCard
              key={account.account_code}
              account={account}
              subAccounts={accounts?.filter((acc: ChartAccount) => acc.parent_code === account.account_code) || []}
              allocation={allocations[account.account_code] || 0}
              subAllocations={allocations}
              isExpanded={expandedAccounts.has(account.account_code)}
              onToggle={() => toggleAccount(account.account_code)}
              onAllocationChange={handleAllocationChange}
            />
          ))
        )}
        
      </div>

      {/* Total and Save */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm font-medium text-gray-500">Total Monthly Budget</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(calculateTotal())}</div>
            <div className="text-xs text-gray-500 mt-1">
              {categoryAccounts.length} accounts • {accounts?.filter((acc: ChartAccount) => acc.display_as === 'subcategory').length || 0} sub-accounts
            </div>
          </div>
          <div className="flex gap-3">
            {hasChanges && (
              <button
                onClick={() => {
                  setAllocations(monthAllocations || {});
                  setHasChanges(false);
                }}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Reset Changes
              </button>
            )}
            <button
              onClick={handleSaveAllocations}
              disabled={!hasChanges || saveAllocationsMutation.isPending}
              className={cn(
                "px-6 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
                hasChanges
                  ? "bg-gray-900 text-white hover:bg-gray-800"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
            >
              <Save className="h-4 w-4" />
              {saveAllocationsMutation.isPending ? 'Saving...' : 'Save Budget'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}