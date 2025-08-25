import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Save, X, GripVertical } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../services/api';
import { cn } from '../lib/utils';
import toast, { Toaster } from 'react-hot-toast';
import { getIconByValue, suggestIconForAccount, DEFAULT_ACCOUNT_ICON } from '../lib/account-icons';
import IconPicker from '../components/ui/IconPicker';

type TabId = 'accounts' | 'app-settings' | 'user-access';

interface ChartAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  display_as: 'category' | 'subcategory';
  parent_code?: string;
  category_name?: string;
  display_order?: number;
  is_active: boolean;
  description?: string;
  icon?: string;
  created_at?: string;
  updated_at?: string;
}


// Sortable Account Item Component
interface SortableAccountItemProps {
  account: any;
  children: React.ReactNode;
}

function SortableAccountItem({ account, children }: SortableAccountItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: account.account_code,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "border rounded-lg transition-all",
        isDragging ? "border-blue-400 shadow-lg z-10" : "border-gray-200"
      )}
    >
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab hover:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
          >
            <GripVertical className="w-5 h-5" />
          </div>
          
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>('accounts');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [draggedAccount, setDraggedAccount] = useState<ChartAccount | null>(null);
  const [orderedAccounts, setOrderedAccounts] = useState<ChartAccount[]>([]);
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [editingAccount, setEditingAccount] = useState<ChartAccount | null>(null);
  const [editingDescription, setEditingDescription] = useState<{ [key: string]: string }>({});
  const [editingIcon, setEditingIcon] = useState<{ [key: string]: boolean }>({});
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ 
    name: '', 
    code: '', 
    icon: '',
    description: '',
    subaccounts: [{ name: '', description: '' }] 
  });
  const [isAddingSubaccount, setIsAddingSubaccount] = useState<{ [key: string]: boolean }>({});
  const [newSubaccount, setNewSubaccount] = useState<{ [key: string]: { name: string; description: string } }>({});
  
  const queryClient = useQueryClient();

  // Fetch chart of accounts
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const response = await api.get('/chart-of-accounts');
      return response.data?.data || [];
    },
    enabled: activeTab === 'accounts'
  });

  // Initialize ordered accounts for drag and drop
  useEffect(() => {
    if (accountsData) {
      const categoryAccounts = accountsData.filter((a: ChartAccount) => a.display_as === 'category');
      
      setOrderedAccounts(prevOrdered => {
        // If we already have an order, maintain it but update the account data
        if (prevOrdered.length > 0) {
          const updatedAccounts = prevOrdered.map(orderedAcc => {
            const updatedData = categoryAccounts.find((a: ChartAccount) => a.account_code === orderedAcc.account_code);
            return updatedData || orderedAcc;
          });
          
          // Add any new accounts that weren't in the ordered list
          const newAccounts = categoryAccounts.filter(
            (acc: ChartAccount) => !prevOrdered.find(o => o.account_code === acc.account_code)
          );
          
          return [...updatedAccounts, ...newAccounts];
        } else {
          // Initial load
          return categoryAccounts;
        }
      });
    }
  }, [accountsData]);

  // Auto-suggest icon based on account name
  useEffect(() => {
    if (newAccount.name && !newAccount.icon) {
      const suggested = suggestIconForAccount(newAccount.name);
      setNewAccount(prev => ({ ...prev, icon: suggested }));
    }
  }, [newAccount.name]);

  // Group accounts by category (using ordered accounts for display)
  const groupedAccounts = orderedAccounts.reduce((acc: any, account: ChartAccount) => {
    acc[account.account_code] = {
      ...account,
      subaccounts: []
    };
    return acc;
  }, {});

  // Add subaccounts to their parent categories
  accountsData?.forEach((account: ChartAccount) => {
    if (account.display_as === 'subcategory' && account.parent_code && groupedAccounts[account.parent_code]) {
      groupedAccounts[account.parent_code].subaccounts.push(account);
    }
  });

  // DnD sensors setup
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Account mutations
  const createAccountMutation = useMutation({
    mutationFn: async (accountData: any) => {
      const response = await api.post('/chart-of-accounts', accountData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      setIsAddingAccount(false);
      setNewAccount({ name: '', code: '', icon: '', description: '', subaccounts: [{ name: '', description: '' }] });
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
      setEditingIcon({});
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

  // Save order mutation
  const saveOrderMutation = useMutation({
    mutationFn: async (accountOrders: { account_code: string; display_order: number }[]) => {
      const response = await api.put('/chart-of-accounts/reorder', { accountOrders });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      toast.success('Account order saved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save order');
    }
  });

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const account = orderedAccounts.find(a => a.account_code === active.id);
    setDraggedAccount(account || null);
  };

  // Handle drag end with auto-save
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedAccount(null);

    if (over && active.id !== over.id) {
      setOrderedAccounts((items) => {
        const oldIndex = items.findIndex(i => i.account_code === active.id);
        const newIndex = items.findIndex(i => i.account_code === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Update display_order values
        const updatedOrder = newOrder.map((account, index) => ({
          ...account,
          display_order: index + 1
        }));
        
        // Auto-save after 2 second delay
        if (saveTimer) clearTimeout(saveTimer);
        const timer = setTimeout(() => {
          // Prepare save data - include parent accounts and their sub-accounts
          const accountOrders: { account_code: string; display_order: number }[] = [];
          let orderIndex = 1;
          
          updatedOrder.forEach(parent => {
            // Add parent account
            accountOrders.push({
              account_code: parent.account_code,
              display_order: orderIndex++
            });
            
            // Add sub-accounts in their current order
            const subs = groupedAccounts[parent.account_code]?.subaccounts || [];
            subs.forEach((sub: ChartAccount) => {
              accountOrders.push({
                account_code: sub.account_code,
                display_order: orderIndex++
              });
            });
          });
          
          saveOrderMutation.mutate(accountOrders);
        }, 2000);
        setSaveTimer(timer);
        
        return updatedOrder;
      });
    }
  };

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
      icon: newAccount.icon || undefined,
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


  return (
    <>
      <Toaster position="top-right" />
      <div className="space-y-6">
        {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-3">
          <div className="flex gap-1">
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
              onClick={() => setActiveTab('app-settings')}
              className={cn(
                "px-4 py-2 rounded-md font-medium text-sm transition-all duration-200",
                activeTab === 'app-settings'
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              App Settings
            </button>
            <button
              onClick={() => setActiveTab('user-access')}
              className={cn(
                "px-4 py-2 rounded-md font-medium text-sm transition-all duration-200",
                activeTab === 'user-access'
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              User & Access
            </button>
          </div>
        </div>
      </div>

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
                      setNewAccount({ name: '', code: '', icon: '', description: '', subaccounts: [{ name: '', description: '' }] });
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                    <IconPicker
                      value={newAccount.icon}
                      onChange={(iconValue) => setNewAccount(prev => ({ ...prev, icon: iconValue }))}
                    />
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
                        setNewAccount({ name: '', code: '', icon: '', description: '', subaccounts: [{ name: '', description: '' }] });
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedAccounts.map(a => a.account_code)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {orderedAccounts.map((account) => {
                      const fullAccount = groupedAccounts[account.account_code];
                      return (
                        <div key={account.account_code}>
                          <SortableAccountItem 
                            account={fullAccount}
                          >
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
                            {(() => {
                              const iconValue = fullAccount.icon || suggestIconForAccount(fullAccount.account_name);
                              const IconComponent = getIconByValue(iconValue) || getIconByValue(DEFAULT_ACCOUNT_ICON);
                              return IconComponent && (
                                <div className="p-2 bg-gray-100 rounded-lg">
                                  <IconComponent className="h-5 w-5 text-gray-700" />
                                </div>
                              );
                            })()}
                            
                            {editingAccount?.account_code === fullAccount.account_code ? (
                              <input
                                type="text"
                                value={editingAccount?.account_name || ''}
                                onChange={(e) => setEditingAccount(prev => prev ? { ...prev, account_name: e.target.value } : null)}
                                onBlur={() => handleUpdateAccountName(fullAccount)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateAccountName(fullAccount);
                                  } else if (e.key === 'Escape') {
                                    setEditingAccount(null);
                                  }
                                }}
                                className="px-2 py-1 border border-blue-500 rounded focus:outline-none font-medium"
                                autoFocus
                              />
                            ) : (
                              <span className="font-medium">{fullAccount.account_name}</span>
                            )}
                            
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {fullAccount.account_code}
                            </span>
                            
                            <span className="text-sm text-gray-500">
                              {fullAccount.subaccounts?.length || 0} subaccounts
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingAccount(fullAccount)}
                              className="text-gray-500 hover:text-blue-600"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete account "${fullAccount.account_name}" and all its subaccounts?`)) {
                                  deleteAccountMutation.mutate(fullAccount.account_code);
                                }
                              }}
                              className="text-gray-500 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          </SortableAccountItem>
                          
                          {/* Expanded Account Details */}
                          {expandedAccounts.has(fullAccount.account_code) && (
                          <div className="px-4 pb-4 border-t border-gray-100">
                        {/* Account Icon */}
                        <div className="mt-4">
                          <label className="text-sm font-medium text-gray-700">Icon</label>
                          <div className="mt-1">
                            {editingIcon[fullAccount.account_code] ? (
                              <div className="space-y-3 max-w-xs">
                                <IconPicker
                                  compact={true}
                                  value={fullAccount.icon || suggestIconForAccount(fullAccount.account_name)}
                                  onChange={async (iconValue) => {
                                    await updateAccountMutation.mutateAsync({
                                      code: fullAccount.account_code,
                                      icon: iconValue
                                    });
                                    setEditingIcon(prev => ({ ...prev, [fullAccount.account_code]: false }));
                                    toast.success('Icon updated successfully');
                                  }}
                                />
                                <button
                                  onClick={() => setEditingIcon(prev => ({ ...prev, [fullAccount.account_code]: false }))}
                                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const iconValue = fullAccount.icon || suggestIconForAccount(fullAccount.account_name);
                                    const IconComponent = getIconByValue(iconValue) || getIconByValue(DEFAULT_ACCOUNT_ICON);
                                    return IconComponent && (
                                      <div className="p-2 bg-gray-100 rounded-lg">
                                        <IconComponent className="h-5 w-5 text-gray-700" />
                                      </div>
                                    );
                                  })()}
                                </div>
                                <button
                                  onClick={() => setEditingIcon(prev => ({ ...prev, [fullAccount.account_code]: true }))}
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                  Change Icon
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Account Description */}
                        <div className="mt-4">
                          <label className="text-sm font-medium text-gray-700">Description</label>
                          <div className="mt-1">
                            {editingDescription[fullAccount.account_code] !== undefined ? (
                              <div className="flex gap-2">
                                <textarea
                                  value={editingDescription[fullAccount.account_code]}
                                  onChange={(e) => setEditingDescription(prev => ({ 
                                    ...prev, 
                                    [fullAccount.account_code]: e.target.value 
                                  }))}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  rows={2}
                                />
                                <button
                                  onClick={() => {
                                    handleUpdateDescription(fullAccount.account_code, editingDescription[fullAccount.account_code]);
                                    setEditingDescription(prev => {
                                      const newState = { ...prev };
                                      delete newState[fullAccount.account_code];
                                      return newState;
                                    });
                                  }}
                                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingDescription(prev => {
                                    const newState = { ...prev };
                                    delete newState[fullAccount.account_code];
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
                                  [fullAccount.account_code]: fullAccount.description || '' 
                                }))}
                              >
                                {fullAccount.description || 'Click to add description'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Subaccounts */}
                        <div className="mt-4">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-medium text-gray-700">Subaccounts</h4>
                            {!isAddingSubaccount[fullAccount.account_code] && (
                              <button
                                onClick={() => {
                                  setIsAddingSubaccount(prev => ({ ...prev, [fullAccount.account_code]: true }));
                                  setNewSubaccount(prev => ({ 
                                    ...prev, 
                                    [fullAccount.account_code]: { name: '', description: '' } 
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
                            {fullAccount.subaccounts?.map((sub: ChartAccount) => (
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
                            {isAddingSubaccount[fullAccount.account_code] && (
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={newSubaccount[fullAccount.account_code]?.name || ''}
                                    onChange={(e) => setNewSubaccount(prev => ({ 
                                      ...prev, 
                                      [fullAccount.account_code]: { 
                                        ...prev[fullAccount.account_code], 
                                        name: e.target.value 
                                      } 
                                    }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Subaccount name"
                                    autoFocus
                                  />
                                  <input
                                    type="text"
                                    value={newSubaccount[fullAccount.account_code]?.description || ''}
                                    onChange={(e) => setNewSubaccount(prev => ({ 
                                      ...prev, 
                                      [fullAccount.account_code]: { 
                                        ...prev[fullAccount.account_code], 
                                        description: e.target.value 
                                      } 
                                    }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Description (optional)"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSaveSubaccount(fullAccount.account_code)}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                                    >
                                      Add
                                    </button>
                                    <button
                                      onClick={() => {
                                        setIsAddingSubaccount(prev => ({ ...prev, [fullAccount.account_code]: false }));
                                        setNewSubaccount(prev => {
                                          const newState = { ...prev };
                                          delete newState[fullAccount.account_code];
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
                      );
                    })}
                  </div>
                </SortableContext>
                
                {/* Drag Overlay */}
                <DragOverlay>
                  {draggedAccount ? (
                    <div className="bg-white rounded-lg border-2 border-blue-400 shadow-xl p-4 opacity-90">
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-5 h-5 text-gray-400" />
                        <div className="flex-1">
                          <span className="font-medium">{draggedAccount.account_name}</span>
                          <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {draggedAccount.account_code}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        </div>
      )}

      {/* App Settings Tab */}
      {activeTab === 'app-settings' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-6">App Settings</h2>
            
            <div className="space-y-6">
              {/* Currency Settings */}
              <div>
                <h3 className="text-lg font-medium mb-3">Currency & Locale</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Fiscal Year Settings */}
              <div>
                <h3 className="text-lg font-medium mb-3">Fiscal Year</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year Start</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="01">January</option>
                      <option value="04">April</option>
                      <option value="07">July</option>
                      <option value="10">October</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Notification Settings */}
              <div>
                <h3 className="text-lg font-medium mb-3">Notifications</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="ml-2 text-sm text-gray-700">Email notifications for budget alerts</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="ml-2 text-sm text-gray-700">Monthly budget reports</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="ml-2 text-sm text-gray-700">Transaction approval reminders</span>
                  </label>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors">
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User & Access Tab */}
      {activeTab === 'user-access' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-6">User & Access Management</h2>
            
            <div className="space-y-6">
              {/* Current User Info */}
              <div>
                <h3 className="text-lg font-medium mb-3">Your Account</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Email:</span>
                      <span className="text-sm font-medium">user@example.com</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Role:</span>
                      <span className="text-sm font-medium">Administrator</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Last Login:</span>
                      <span className="text-sm font-medium">Today at 10:30 AM</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Team Members */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-medium">Team Members</h3>
                  <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Invite User
                  </button>
                </div>
                
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-3 text-sm">
                          <div>
                            <div className="font-medium text-gray-900">John Doe</div>
                            <div className="text-gray-500">john@example.com</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">Viewer</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">2 hours ago</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <button className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                          <button className="text-red-600 hover:text-red-800">Remove</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Access Logs */}
              <div>
                <h3 className="text-lg font-medium mb-3">Recent Activity</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Budget updated</p>
                        <p className="text-xs text-gray-500">By John Doe • 2 hours ago</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">New expense added</p>
                        <p className="text-xs text-gray-500">By You • 3 hours ago</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Account settings changed</p>
                        <p className="text-xs text-gray-500">By You • Yesterday</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}