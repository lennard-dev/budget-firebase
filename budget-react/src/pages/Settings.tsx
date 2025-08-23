import { useState } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Save, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { cn } from '../lib/utils';

type TabId = 'budgets' | 'accounts' | 'payment-methods' | 'donors';

interface ChartAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  display_as: 'category' | 'subcategory';
  parent_code?: string;
  category_name?: string;
  is_active: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  isDefault?: boolean;
  createdAt?: string;
}

interface Donor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  type?: string;
  totalDonated?: number;
  lastDonation?: string;
  createdAt?: string;
}

interface Budget {
  id: string;
  name: string;
  period: 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate: string;
  totalAmount: number;
  allocations: BudgetAllocation[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface BudgetAllocation {
  categoryCode: string;
  categoryName: string;
  amount: number;
  spent?: number;
  remaining?: number;
  percentage?: number;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>('budgets');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [editingAccount, setEditingAccount] = useState<ChartAccount | null>(null);
  const [editingDescription, setEditingDescription] = useState<{ [key: string]: string }>({});
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ 
    name: '', 
    code: '', 
    description: '',
    subaccounts: [{ name: '', description: '' }] 
  });
  const [isAddingSubaccount, setIsAddingSubaccount] = useState<{ [key: string]: boolean }>({});
  const [newSubaccount, setNewSubaccount] = useState<{ [key: string]: { name: string; description: string } }>({});
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState({ name: '', type: 'bank_transfer' });
  const [isAddingDonor, setIsAddingDonor] = useState(false);
  const [newDonor, setNewDonor] = useState({ name: '', email: '', phone: '', organization: '', type: 'individual' });
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [_editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [newBudget, setNewBudget] = useState<{
    name: string;
    period: 'monthly' | 'quarterly' | 'yearly';
    totalAmount: number;
    allocations: { categoryCode: string; amount: number }[];
  }>({
    name: '',
    period: 'monthly',
    totalAmount: 0,
    allocations: []
  });
  
  const queryClient = useQueryClient();

  // Fetch budgets
  const { data: budgetsData, isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const response = await api.get('/budgets');
      return response.data?.data || [];
    },
    enabled: activeTab === 'budgets'
  });

  // Fetch chart of accounts
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const response = await api.get('/chart-of-accounts');
      return response.data?.data || [];
    },
    enabled: activeTab === 'accounts'
  });

  // Fetch payment methods
  const { data: paymentMethodsData, isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const response = await api.get('/payment-methods');
      return response.data?.data || [];
    },
    enabled: activeTab === 'payment-methods'
  });

  // Fetch donors
  const { data: donorsData, isLoading: donorsLoading } = useQuery({
    queryKey: ['donors'],
    queryFn: async () => {
      const response = await api.get('/donors');
      return response.data?.data || [];
    },
    enabled: activeTab === 'donors'
  });

  // Group accounts by category
  const groupedAccounts = accountsData?.reduce((acc: any, account: ChartAccount) => {
    if (account.display_as === 'category') {
      acc[account.account_code] = {
        ...account,
        subaccounts: []
      };
    }
    return acc;
  }, {}) || {};

  // Add subaccounts to their parent categories
  accountsData?.forEach((account: ChartAccount) => {
    if (account.display_as === 'subcategory' && account.parent_code && groupedAccounts[account.parent_code]) {
      groupedAccounts[account.parent_code].subaccounts.push(account);
    }
  });

  // Account mutations
  const createAccountMutation = useMutation({
    mutationFn: async (accountData: any) => {
      const response = await api.post('/chart-of-accounts', accountData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      setIsAddingAccount(false);
      setNewAccount({ name: '', code: '', description: '', subaccounts: [{ name: '', description: '' }] });
    }
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ code, ...data }: any) => {
      const response = await api.put(`/chart-of-accounts/${code}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      setEditingAccount(null);
      setEditingDescription({});
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await api.delete(`/chart-of-accounts/${code}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    }
  });

  // Payment method mutations
  const createPaymentMethodMutation = useMutation({
    mutationFn: async (method: any) => {
      const response = await api.post('/payment-methods', method);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      setIsAddingPaymentMethod(false);
      setNewPaymentMethod({ name: '', type: 'bank_transfer' });
    }
  });

  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/payment-methods/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    }
  });

  // Budget mutations
  const createBudgetMutation = useMutation({
    mutationFn: async (budget: any) => {
      const response = await api.post('/budgets', budget);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setIsAddingBudget(false);
      setNewBudget({
        name: '',
        period: 'monthly',
        totalAmount: 0,
        allocations: []
      });
    }
  });

  // const updateBudgetMutation = useMutation({
  //   mutationFn: async ({ id, ...data }: any) => {
  //     const response = await api.put(`/budgets/${id}`, data);
  //     return response.data;
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ['budgets'] });
  //     setEditingBudget(null);
  //   }
  // });

  const deleteBudgetMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/budgets/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    }
  });

  const activateBudgetMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.put(`/budgets/${id}/activate`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    }
  });

  // Donor mutations
  const createDonorMutation = useMutation({
    mutationFn: async (donor: any) => {
      const response = await api.post('/donors', donor);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donors'] });
      setIsAddingDonor(false);
      setNewDonor({ name: '', email: '', phone: '', organization: '', type: 'individual' });
    }
  });

  const deleteDonorMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/donors/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donors'] });
    }
  });

  const toggleAccountExpansion = (accountCode: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountCode)) {
      newExpanded.delete(accountCode);
    } else {
      newExpanded.add(accountCode);
    }
    setExpandedAccounts(newExpanded);
  };

  const handleSaveAccount = async () => {
    if (!newAccount.name.trim()) return;

    // Prepare account data with subaccounts
    const accountData = {
      account_name: newAccount.name.trim(),
      account_code: newAccount.code.trim() || undefined, // Let backend generate if not provided
      description: newAccount.description.trim(),
      subaccounts: newAccount.subaccounts
        .filter(sub => sub.name.trim())
        .map(sub => ({
          name: sub.name.trim(),
          description: sub.description.trim()
        }))
    };

    await createAccountMutation.mutateAsync(accountData);
  };

  const handleSaveSubaccount = async (parentCode: string) => {
    const subData = newSubaccount[parentCode];
    if (!subData?.name?.trim()) return;

    const subaccountData = {
      account_name: subData.name.trim(),
      parent_code: parentCode,
      description: subData.description.trim(),
      display_as: 'subcategory'
    };

    await createAccountMutation.mutateAsync(subaccountData);
    
    setIsAddingSubaccount(prev => ({ ...prev, [parentCode]: false }));
    setNewSubaccount(prev => ({ ...prev, [parentCode]: { name: '', description: '' } }));
  };

  const handleSavePaymentMethod = async () => {
    if (!newPaymentMethod.name.trim()) return;

    await createPaymentMethodMutation.mutateAsync({
      name: newPaymentMethod.name.trim(),
      type: newPaymentMethod.type
    });
  };

  const handleSaveDonor = async () => {
    if (!newDonor.name.trim()) return;

    await createDonorMutation.mutateAsync({
      name: newDonor.name.trim(),
      email: newDonor.email.trim(),
      phone: newDonor.phone.trim(),
      organization: newDonor.organization.trim(),
      type: newDonor.type
    });
  };

  const handleUpdateAccountName = async (account: ChartAccount) => {
    if (editingAccount && editingAccount.account_name !== account.account_name) {
      await updateAccountMutation.mutateAsync({
        code: account.account_code,
        account_name: editingAccount.account_name
      });
    }
    setEditingAccount(null);
  };

  const handleUpdateDescription = async (accountCode: string, description: string) => {
    await updateAccountMutation.mutateAsync({
      code: accountCode,
      description: description
    });
  };

  const handleSaveBudget = async () => {
    if (!newBudget.name.trim() || newBudget.totalAmount <= 0) return;

    const startDate = new Date();
    let endDate = new Date();
    
    switch (newBudget.period) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    await createBudgetMutation.mutateAsync({
      ...newBudget,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
  };

  const calculateUnallocated = () => {
    const allocated = newBudget.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    return newBudget.totalAmount - allocated;
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-3">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('budgets')}
              className={cn(
                "px-4 py-2 rounded-md font-medium text-sm transition-all duration-200",
                activeTab === 'budgets'
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              Budget Settings
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={cn(
                "px-4 py-2 rounded-md font-medium text-sm transition-all duration-200",
                activeTab === 'accounts'
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              Budget Accounts
            </button>
            <button
              onClick={() => setActiveTab('payment-methods')}
              className={cn(
                "px-4 py-2 rounded-md font-medium text-sm transition-all duration-200",
                activeTab === 'payment-methods'
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              Payment Methods
            </button>
            <button
              onClick={() => setActiveTab('donors')}
              className={cn(
                "px-4 py-2 rounded-md font-medium text-sm transition-all duration-200",
                activeTab === 'donors'
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              Donors
            </button>
          </div>
        </div>
      </div>

      {/* Budgets Tab */}
      {activeTab === 'budgets' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Budget Management</h2>
              <button
                onClick={() => setIsAddingBudget(true)}
                className="bg-[#2c3e50] hover:bg-[#1a252f] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Budget
              </button>
            </div>

            {/* Add New Budget Form */}
            {isAddingBudget && (
              <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">Create New Budget</h3>
                  <button
                    onClick={() => {
                      setIsAddingBudget(false);
                      setNewBudget({
                        name: '',
                        period: 'monthly',
                        totalAmount: 0,
                        allocations: []
                      });
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Budget Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newBudget.name}
                        onChange={(e) => setNewBudget(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Q1 2025 Budget"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                      <select
                        value={newBudget.period}
                        onChange={(e) => setNewBudget(prev => ({ ...prev, period: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total Budget <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={newBudget.totalAmount}
                        onChange={(e) => setNewBudget(prev => ({ ...prev, totalAmount: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  {/* Budget Allocation */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Budget Allocation by Category</h4>
                      {newBudget.totalAmount > 0 && (
                        <span className="text-sm text-gray-600">
                          Unallocated: <span className={cn(
                            "font-medium",
                            calculateUnallocated() < 0 ? "text-red-600" : "text-gray-900"
                          )}>
                            ${calculateUnallocated().toFixed(2)}
                          </span>
                        </span>
                      )}
                    </div>
                    
                    <div className="border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                      {Object.values(groupedAccounts).map((account: any) => (
                        <div key={account.account_code} className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-sm font-medium">{account.account_name}</label>
                            <input
                              type="number"
                              value={newBudget.allocations.find(a => a.categoryCode === account.account_code)?.amount || ''}
                              onChange={(e) => {
                                const amount = parseFloat(e.target.value) || 0;
                                setNewBudget(prev => {
                                  const existing = prev.allocations.findIndex(a => a.categoryCode === account.account_code);
                                  const newAllocations = [...prev.allocations];
                                  if (existing >= 0) {
                                    if (amount > 0) {
                                      newAllocations[existing] = { categoryCode: account.account_code, amount };
                                    } else {
                                      newAllocations.splice(existing, 1);
                                    }
                                  } else if (amount > 0) {
                                    newAllocations.push({ categoryCode: account.account_code, amount });
                                  }
                                  return { ...prev, allocations: newAllocations };
                                });
                              }}
                              className="w-32 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                            />
                          </div>
                          {newBudget.totalAmount > 0 && newBudget.allocations.find(a => a.categoryCode === account.account_code) && (
                            <div className="ml-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ 
                                      width: `${Math.min(100, ((newBudget.allocations.find(a => a.categoryCode === account.account_code)?.amount || 0) / newBudget.totalAmount) * 100)}%` 
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-gray-600 w-12 text-right">
                                  {(((newBudget.allocations.find(a => a.categoryCode === account.account_code)?.amount || 0) / newBudget.totalAmount) * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={() => {
                        setIsAddingBudget(false);
                        setNewBudget({
                          name: '',
                          period: 'monthly',
                          totalAmount: 0,
                          allocations: []
                        });
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveBudget}
                      disabled={createBudgetMutation.isPending || !newBudget.name.trim() || newBudget.totalAmount <= 0}
                      className="px-4 py-2 bg-[#2c3e50] hover:bg-[#1a252f] text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {createBudgetMutation.isPending ? 'Creating...' : 'Create Budget'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Budgets List */}
            {budgetsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading budgets...</div>
            ) : budgetsData?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No budgets found. Create your first budget to start tracking expenses.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {budgetsData?.map((budget: Budget) => (
                  <div key={budget.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-lg">{budget.name}</h3>
                        <p className="text-sm text-gray-600">
                          {budget.period ? budget.period.charAt(0).toUpperCase() + budget.period.slice(1) : 'Unknown'} • 
                          {budget.startDate ? new Date(budget.startDate).toLocaleDateString() : 'N/A'} - {budget.endDate ? new Date(budget.endDate).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {budget.isActive ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Active</span>
                        ) : (
                          <button
                            onClick={() => activateBudgetMutation.mutate(budget.id)}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => setEditingBudget(budget)}
                          className="text-gray-500 hover:text-blue-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete budget "${budget.name}"?`)) {
                              deleteBudgetMutation.mutate(budget.id);
                            }
                          }}
                          className="text-gray-500 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Total Budget</span>
                        <span className="font-medium">${(budget.totalAmount || 0).toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ 
                            width: `${Math.min(100, ((budget.allocations?.reduce((sum, a) => sum + (a.spent || 0), 0) || 0) / (budget.totalAmount || 1)) * 100)}%` 
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600 mt-1">
                        <span>Spent: ${(budget.allocations?.reduce((sum, a) => sum + (a.spent || 0), 0) || 0).toFixed(2)}</span>
                        <span>Remaining: ${((budget.totalAmount || 0) - (budget.allocations?.reduce((sum, a) => sum + (a.spent || 0), 0) || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                    
                    {/* Category Allocations */}
                    <div className="border-t pt-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Category Allocations</h4>
                      <div className="space-y-2">
                        {budget.allocations?.slice(0, 3).map((allocation) => (
                          <div key={allocation.categoryCode} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{allocation.categoryName}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">${allocation.amount.toFixed(2)}</span>
                              {allocation.spent && (
                                <span className="text-xs text-gray-500">
                                  (${allocation.spent.toFixed(2)} spent)
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {(budget.allocations?.length || 0) > 3 && (
                          <button className="text-xs text-blue-600 hover:text-blue-700">
                            View all {budget.allocations?.length} allocations →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Chart of Accounts</h2>
              <button
                onClick={() => setIsAddingAccount(true)}
                className="bg-[#2c3e50] hover:bg-[#1a252f] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Budget Account
              </button>
            </div>

            {/* Add New Account Form */}
            {isAddingAccount && (
              <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">Add Budget Account</h3>
                  <button
                    onClick={() => {
                      setIsAddingAccount(false);
                      setNewAccount({ name: '', code: '', description: '', subaccounts: [{ name: '', description: '' }] });
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700">Account Information</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newAccount.name}
                        onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Operations"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Code</label>
                      <input
                        type="text"
                        value={newAccount.code}
                        onChange={(e) => setNewAccount(prev => ({ ...prev, code: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 5100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={newAccount.description}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Brief description of what this account covers"
                      rows={2}
                    />
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Subaccounts</h4>
                    
                    {newAccount.subaccounts.map((sub, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) => {
                            const updated = [...newAccount.subaccounts];
                            updated[index].name = e.target.value;
                            setNewAccount(prev => ({ ...prev, subaccounts: updated }));
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Subaccount name"
                        />
                        <input
                          type="text"
                          value={sub.description}
                          onChange={(e) => {
                            const updated = [...newAccount.subaccounts];
                            updated[index].description = e.target.value;
                            setNewAccount(prev => ({ ...prev, subaccounts: updated }));
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Description (optional)"
                        />
                        {index === newAccount.subaccounts.length - 1 ? (
                          <button
                            onClick={() => setNewAccount(prev => ({ 
                              ...prev, 
                              subaccounts: [...prev.subaccounts, { name: '', description: '' }] 
                            }))}
                            className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const updated = newAccount.subaccounts.filter((_, i) => i !== index);
                              setNewAccount(prev => ({ ...prev, subaccounts: updated }));
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    
                    <div className="mt-2">
                      <label className="text-sm text-gray-600">
                        <textarea
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Bulk Add Subaccounts (one per line)&#10;Administrative&#10;Office Supplies&#10;Utilities"
                          rows={3}
                          onBlur={(e) => {
                            const lines = e.target.value.split('\n').filter(line => line.trim());
                            if (lines.length > 0) {
                              const newSubs = lines.map(line => ({ name: line.trim(), description: '' }));
                              setNewAccount(prev => ({
                                ...prev,
                                subaccounts: [...prev.subaccounts.filter(s => s.name), ...newSubs]
                              }));
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                      <button 
                        type="button"
                        className="text-sm text-blue-600 hover:text-blue-700 mt-1"
                        onClick={(e) => {
                          const textarea = (e.currentTarget.previousElementSibling?.querySelector('textarea') as HTMLTextAreaElement);
                          if (textarea) {
                            const lines = textarea.value.split('\n').filter(line => line.trim());
                            if (lines.length > 0) {
                              const newSubs = lines.map(line => ({ name: line.trim(), description: '' }));
                              setNewAccount(prev => ({
                                ...prev,
                                subaccounts: [...prev.subaccounts.filter(s => s.name), ...newSubs]
                              }));
                              textarea.value = '';
                            }
                          }
                        }}
                      >
                        Add from List
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={() => {
                        setIsAddingAccount(false);
                        setNewAccount({ name: '', code: '', description: '', subaccounts: [{ name: '', description: '' }] });
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAccount}
                      disabled={createAccountMutation.isPending}
                      className="px-4 py-2 bg-[#2c3e50] hover:bg-[#1a252f] text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {createAccountMutation.isPending ? 'Saving...' : 'Save Account'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Accounts List */}
            {accountsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading accounts...</div>
            ) : Object.keys(groupedAccounts).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No accounts found. Add your first budget account to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.values(groupedAccounts).map((account: any) => (
                  <div key={account.account_code} className="border border-gray-200 rounded-lg">
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => toggleAccountExpansion(account.account_code)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {expandedAccounts.has(account.account_code) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        
                        <div className="flex items-center gap-3 flex-1">
                          {editingAccount?.account_code === account.account_code ? (
                            <input
                              type="text"
                              value={editingAccount?.account_name || ''}
                              onChange={(e) => setEditingAccount(prev => prev ? { ...prev, account_name: e.target.value } : null)}
                              onBlur={() => handleUpdateAccountName(account)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateAccountName(account);
                                } else if (e.key === 'Escape') {
                                  setEditingAccount(null);
                                }
                              }}
                              className="px-2 py-1 border border-blue-500 rounded focus:outline-none font-medium"
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium">{account.account_name}</span>
                          )}
                          
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {account.account_code}
                          </span>
                          
                          <span className="text-sm text-gray-500">
                            {account.subaccounts?.length || 0} subaccounts
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingAccount(account)}
                          className="text-gray-500 hover:text-blue-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete account "${account.account_name}" and all its subaccounts?`)) {
                              deleteAccountMutation.mutate(account.account_code);
                            }
                          }}
                          className="text-gray-500 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Account Details */}
                    {expandedAccounts.has(account.account_code) && (
                      <div className="px-4 pb-4 border-t border-gray-100">
                        {/* Account Description */}
                        <div className="mt-4">
                          <label className="text-sm font-medium text-gray-700">Description</label>
                          <div className="mt-1">
                            {editingDescription[account.account_code] !== undefined ? (
                              <div className="flex gap-2">
                                <textarea
                                  value={editingDescription[account.account_code]}
                                  onChange={(e) => setEditingDescription(prev => ({ 
                                    ...prev, 
                                    [account.account_code]: e.target.value 
                                  }))}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  rows={2}
                                />
                                <button
                                  onClick={() => {
                                    handleUpdateDescription(account.account_code, editingDescription[account.account_code]);
                                    setEditingDescription(prev => {
                                      const newState = { ...prev };
                                      delete newState[account.account_code];
                                      return newState;
                                    });
                                  }}
                                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingDescription(prev => {
                                    const newState = { ...prev };
                                    delete newState[account.account_code];
                                    return newState;
                                  })}
                                  className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <p 
                                className="text-sm text-gray-600 cursor-pointer hover:bg-gray-50 p-2 rounded"
                                onClick={() => setEditingDescription(prev => ({ 
                                  ...prev, 
                                  [account.account_code]: account.description || '' 
                                }))}
                              >
                                {account.description || 'Click to add description'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Subaccounts */}
                        <div className="mt-4">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-medium text-gray-700">Subaccounts</h4>
                            {!isAddingSubaccount[account.account_code] && (
                              <button
                                onClick={() => {
                                  setIsAddingSubaccount(prev => ({ ...prev, [account.account_code]: true }));
                                  setNewSubaccount(prev => ({ 
                                    ...prev, 
                                    [account.account_code]: { name: '', description: '' } 
                                  }));
                                }}
                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add Subaccount
                              </button>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            {account.subaccounts?.map((sub: ChartAccount) => (
                              <div key={sub.account_code} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{sub.account_name}</span>
                                    <span className="text-xs text-gray-500">{sub.account_code}</span>
                                  </div>
                                  {sub.description && (
                                    <p className="text-xs text-gray-600 mt-1">{sub.description}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    if (confirm(`Delete subaccount "${sub.account_name}"?`)) {
                                      deleteAccountMutation.mutate(sub.account_code);
                                    }
                                  }}
                                  className="text-gray-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            
                            {/* Add Subaccount Form */}
                            {isAddingSubaccount[account.account_code] && (
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={newSubaccount[account.account_code]?.name || ''}
                                    onChange={(e) => setNewSubaccount(prev => ({ 
                                      ...prev, 
                                      [account.account_code]: { 
                                        ...prev[account.account_code], 
                                        name: e.target.value 
                                      } 
                                    }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Subaccount name"
                                    autoFocus
                                  />
                                  <input
                                    type="text"
                                    value={newSubaccount[account.account_code]?.description || ''}
                                    onChange={(e) => setNewSubaccount(prev => ({ 
                                      ...prev, 
                                      [account.account_code]: { 
                                        ...prev[account.account_code], 
                                        description: e.target.value 
                                      } 
                                    }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Description (optional)"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSaveSubaccount(account.account_code)}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                                    >
                                      Add
                                    </button>
                                    <button
                                      onClick={() => {
                                        setIsAddingSubaccount(prev => ({ ...prev, [account.account_code]: false }));
                                        setNewSubaccount(prev => {
                                          const newState = { ...prev };
                                          delete newState[account.account_code];
                                          return newState;
                                        });
                                      }}
                                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Methods Tab */}
      {activeTab === 'payment-methods' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Payment Methods</h2>
              <button
                onClick={() => setIsAddingPaymentMethod(true)}
                className="bg-[#2c3e50] hover:bg-[#1a252f] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Payment Method
              </button>
            </div>

            {/* Add New Payment Method Form */}
            {isAddingPaymentMethod && (
              <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="font-medium mb-4">New Payment Method</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Method Name</label>
                    <input
                      type="text"
                      value={newPaymentMethod.name}
                      onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Company Card"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newPaymentMethod.type}
                      onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="card">Card</option>
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSavePaymentMethod}
                    disabled={createPaymentMethodMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {createPaymentMethodMutation.isPending ? 'Saving...' : 'Save Method'}
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingPaymentMethod(false);
                      setNewPaymentMethod({ name: '', type: 'bank_transfer' });
                    }}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Payment Methods List */}
            {paymentMethodsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading payment methods...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paymentMethodsData?.map((method: PaymentMethod) => (
                      <tr key={method.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">{method.name}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            {method.type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {method.isDefault && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                              Default
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Delete payment method "${method.name}"?`)) {
                                deletePaymentMethodMutation.mutate(method.id);
                              }
                            }}
                            className="text-gray-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Donors Tab */}
      {activeTab === 'donors' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Donors</h2>
              <button
                onClick={() => setIsAddingDonor(true)}
                className="bg-[#2c3e50] hover:bg-[#1a252f] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Donor
              </button>
            </div>

            {/* Add New Donor Form */}
            {isAddingDonor && (
              <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="font-medium mb-4">New Donor</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={newDonor.name}
                      onChange={(e) => setNewDonor(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Donor name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={newDonor.email}
                      onChange={(e) => setNewDonor(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="donor@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={newDonor.phone}
                      onChange={(e) => setNewDonor(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                    <input
                      type="text"
                      value={newDonor.organization}
                      onChange={(e) => setNewDonor(prev => ({ ...prev, organization: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newDonor.type}
                      onChange={(e) => setNewDonor(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="individual">Individual</option>
                      <option value="corporate">Corporate</option>
                      <option value="foundation">Foundation</option>
                      <option value="government">Government</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSaveDonor}
                    disabled={createDonorMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {createDonorMutation.isPending ? 'Saving...' : 'Save Donor'}
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingDonor(false);
                      setNewDonor({ name: '', email: '', phone: '', organization: '', type: 'individual' });
                    }}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Donors List */}
            {donorsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading donors...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Organization</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {donorsData?.map((donor: Donor) => (
                      <tr key={donor.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{donor.name}</td>
                        <td className="py-3 px-4 text-gray-600">{donor.email || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{donor.organization || '-'}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            {donor.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Delete donor "${donor.name}"?`)) {
                                deleteDonorMutation.mutate(donor.id);
                              }
                            }}
                            className="text-gray-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}