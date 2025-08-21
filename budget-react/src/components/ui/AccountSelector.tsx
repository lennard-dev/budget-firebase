import React, { useState, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Account {
  account_code: string;
  account_name: string;
  category_name?: string;
  subcategory_name?: string;
  parent_code?: string;
  display_as: string;
  is_active: boolean;
}

interface AccountSelectorProps {
  value: string;
  onChange: (accountCode: string, accountName: string) => void;
  accounts: Account[];
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({
  value,
  onChange,
  accounts,
  placeholder = "Select an account",
  required = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  useEffect(() => {
    // Filter only expense accounts that should be displayed
    const expenseAccounts = accounts.filter(acc => 
      acc.display_as === 'category' || acc.display_as === 'subcategory'
    );

    // Group by category
    const grouped = expenseAccounts.reduce((acc, account) => {
      if (account.display_as === 'category') {
        acc[account.account_code] = {
          category: account,
          subcategories: []
        };
      }
      return acc;
    }, {} as Record<string, { category: Account; subcategories: Account[] }>);

    // Add subcategories to their parent categories
    expenseAccounts.forEach(account => {
      if (account.display_as === 'subcategory' && account.parent_code) {
        if (grouped[account.parent_code]) {
          grouped[account.parent_code].subcategories.push(account);
        }
      }
    });

    // Flatten for display
    const flattened: Account[] = [];
    Object.values(grouped).forEach(group => {
      flattened.push(group.category);
      group.subcategories.forEach(sub => flattened.push(sub));
    });

    // Filter by search term
    if (searchTerm) {
      const filtered = flattened.filter(acc => 
        acc.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.subcategory_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredAccounts(filtered);
    } else {
      setFilteredAccounts(flattened);
    }
  }, [accounts, searchTerm]);

  useEffect(() => {
    if (value) {
      const account = accounts.find(acc => acc.account_code === value);
      setSelectedAccount(account || null);
    }
  }, [value, accounts]);

  const handleSelect = (account: Account) => {
    const displayName = account.subcategory_name || account.category_name || account.account_name;
    onChange(account.account_code, displayName);
    setSelectedAccount(account);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getDisplayText = () => {
    if (selectedAccount) {
      const name = selectedAccount.subcategory_name || 
                   selectedAccount.category_name || 
                   selectedAccount.account_name;
      return `${selectedAccount.account_code} - ${name}`;
    }
    return placeholder;
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-required={required}
      >
        <span className={selectedAccount ? 'text-gray-900' : 'text-gray-500'}>
          {getDisplayText()}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-hidden">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {filteredAccounts.length === 0 ? (
              <div className="p-3 text-gray-500 text-center">No accounts found</div>
            ) : (
              filteredAccounts.map(account => {
                const isCategory = account.display_as === 'category';
                const isSelected = account.account_code === value;
                const displayName = account.subcategory_name || 
                                   account.category_name || 
                                   account.account_name;

                return (
                  <button
                    key={account.account_code}
                    type="button"
                    onClick={() => handleSelect(account)}
                    className={`
                      w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors
                      ${isCategory ? 'font-semibold bg-gray-50' : 'pl-8'}
                      ${isSelected ? 'bg-blue-50 text-blue-700' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span>{displayName}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {account.account_code}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};