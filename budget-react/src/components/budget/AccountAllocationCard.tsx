import { useState } from 'react';
import { ChevronDown, ChevronRight, Edit2, Trash2, Plus, X, Save } from 'lucide-react';
import { getIconByValue, suggestIconForAccount, DEFAULT_ACCOUNT_ICON } from '../../lib/account-icons';

interface ChartAccount {
  account_code: string;
  account_name: string;
  parent_code?: string;
  display_as: 'category' | 'subcategory';
  icon?: string;
  description?: string;
  is_active?: boolean;
}

interface AccountAllocationCardProps {
  account: ChartAccount;
  subAccounts: ChartAccount[];
  allocation: number;
  subAllocations: Record<string, number>;
  isExpanded: boolean;
  onToggle: () => void;
  onAllocationChange: (accountCode: string, value: number) => void;
  onEdit?: (account: ChartAccount) => void;
  onDelete?: (accountCode: string) => void;
  onAddSubaccount?: (parentCode: string, name: string, code?: string) => void;
  onEditSubaccount?: (account: ChartAccount) => void;
  onDeleteSubaccount?: (accountCode: string) => void;
}

export default function AccountAllocationCard({
  account,
  subAccounts,
  allocation,
  subAllocations,
  isExpanded,
  onToggle,
  onAllocationChange,
  onEdit,
  onDelete,
  onAddSubaccount,
  onEditSubaccount: _onEditSubaccount,
  onDeleteSubaccount: _onDeleteSubaccount
}: AccountAllocationCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(account.account_name);
  const [isAddingSubaccount, setIsAddingSubaccount] = useState(false);
  const [newSubaccountName, setNewSubaccountName] = useState('');
  const [newSubaccountCode, setNewSubaccountCode] = useState('');
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // Get the icon for this account
  const iconValue = account.icon || suggestIconForAccount(account.account_name);
  const IconComponent = getIconByValue(iconValue) || getIconByValue(DEFAULT_ACCOUNT_ICON);

  const handleSubAccountChange = (subCode: string, value: number) => {
    onAllocationChange(subCode, value);
    
    // Recalculate parent total
    const newTotal = subAccounts.reduce((sum, sub) => {
      if (sub.account_code === subCode) {
        return sum + value;
      }
      return sum + (subAllocations[sub.account_code] || 0);
    }, 0);
    
    onAllocationChange(account.account_code, newTotal);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Account Header */}
      <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
        <div 
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={onToggle}
        >
          <div className="p-2 bg-gray-100 rounded-lg">
            {IconComponent && <IconComponent className="h-5 w-5 text-gray-700" />}
          </div>
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && onEdit) {
                      onEdit({ ...account, account_name: editedName });
                      setIsEditingName(false);
                    } else if (e.key === 'Escape') {
                      setEditedName(account.account_name);
                      setIsEditingName(false);
                    }
                  }}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEdit) {
                      onEdit({ ...account, account_name: editedName });
                    }
                    setIsEditingName(false);
                  }}
                  className="text-green-600 hover:text-green-700"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditedName(account.account_name);
                    setIsEditingName(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <h4 className="font-medium text-gray-900">{account.account_name}</h4>
                <p className="text-xs text-gray-500">{account.account_code}</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-900">{formatCurrency(allocation)}</div>
            {subAccounts.length > 0 && (
              <div className="text-xs text-gray-500">{subAccounts.length} sub-accounts</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
                className="text-gray-500 hover:text-blue-600 p-1"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(account.account_code);
                }}
                className="text-gray-500 hover:text-red-600 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {subAccounts.length > 0 && (
              <div className="text-gray-400 cursor-pointer" onClick={onToggle}>
                {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Accounts and Description */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50">
          {/* Account Description - Only show when expanded */}
          {account.description && (
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm text-gray-600 italic leading-relaxed">{account.description}</p>
            </div>
          )}
          
          <div className="p-4 space-y-3">
            {/* Add Subaccount Button */}
            {onAddSubaccount && (
              <div className="flex justify-end mb-2">
                {!isAddingSubaccount ? (
                  <button
                    onClick={() => setIsAddingSubaccount(true)}
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add Sub-account
                  </button>
                ) : (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={newSubaccountName}
                      onChange={(e) => setNewSubaccountName(e.target.value)}
                      placeholder="Sub-account name"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newSubaccountCode}
                      onChange={(e) => setNewSubaccountCode(e.target.value)}
                      placeholder="Code (optional)"
                      className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <button
                      onClick={() => {
                        if (newSubaccountName.trim()) {
                          onAddSubaccount(account.account_code, newSubaccountName, newSubaccountCode);
                          setNewSubaccountName('');
                          setNewSubaccountCode('');
                          setIsAddingSubaccount(false);
                        }
                      }}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setNewSubaccountName('');
                        setNewSubaccountCode('');
                        setIsAddingSubaccount(false);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
            {subAccounts.map((subAccount) => (
              <div key={subAccount.account_code} className="flex items-center gap-4">
                <div className="flex-1 grid grid-cols-[minmax(150px,_1fr)_2fr] gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700">{subAccount.account_name}</div>
                    <div className="text-xs text-gray-500">{subAccount.account_code}</div>
                  </div>
                  <div className="flex items-center">
                    {subAccount.description && (
                      <span className="text-xs text-gray-500 italic" title={subAccount.description}>
                        {subAccount.description}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-32">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
                    <input
                      type="number"
                      value={subAllocations[subAccount.account_code] || ''}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        handleSubAccountChange(subAccount.account_code, value);
                      }}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-2 text-sm text-right border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {/* Sub-accounts total */}
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-600">Sub-accounts Total</div>
                <div className="text-sm font-semibold text-gray-900">{formatCurrency(allocation)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct allocation input if no sub-accounts */}
      {subAccounts.length === 0 && isExpanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Direct Allocation</label>
            <div className="w-32">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
                <input
                  type="number"
                  value={allocation || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    onAllocationChange(account.account_code, value);
                  }}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2 text-sm text-right border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}