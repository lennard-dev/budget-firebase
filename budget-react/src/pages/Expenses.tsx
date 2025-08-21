import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Calendar, 
  Search, 
  Download, 
  X, 
  Eye, 
  Settings2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { TransactionService } from '../services/TransactionService';
import AddExpenseModal from '../components/modals/AddExpenseModal';
import EditExpenseModal from '../components/modals/EditExpenseModal';
import DeleteConfirmationModal from '../components/modals/DeleteConfirmationModal';
import ReceiptViewerModal from '../components/modals/ReceiptViewerModal';

type SortField = 'date' | 'transaction' | 'category' | 'description' | 'amount' | 'payment';
type SortDirection = 'asc' | 'desc';

interface Expense {
  id: string;
  date: string;
  transactionNumber: string;
  category: string;  // Will be mapped to account
  subcategory: string;  // Will be mapped to sub-account
  description: string;
  amount: number;
  paymentMethod: string;
  receipt?: string;
}

const Expenses: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  
  // Filter states
  const [quickSelect, setQuickSelect] = useState('past30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedSubAccount, setSelectedSubAccount] = useState('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');
  
  // Sorting states
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Initialize dates for past 30 days
  useEffect(() => {
    const today = new Date();
    const past30 = new Date(today);
    past30.setDate(past30.getDate() - 30);
    setStartDate(past30.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  // Fetch expenses from API
  const { data: expensesData, isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', startDate, endDate, selectedAccount],
    queryFn: async () => {
      const filters: any = {
        type: 'expense',
        limit: 1000
      };
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (selectedAccount !== 'all') filters.category = selectedAccount;
      
      const transactions = await TransactionService.getList(filters);
      // Transform to match Expense interface
      return transactions.map((txn: any) => ({
        id: txn.id || txn.transaction_id,
        date: txn.date,
        transactionNumber: txn.transaction_id || `TXN-${txn.id}`,
        category: txn.category || 'Uncategorized',
        subcategory: txn.subcategory || '',
        description: txn.description || '',
        amount: Math.abs(txn.amount),
        paymentMethod: txn.paymentMethod || txn.payment_method || 'Cash',
        receipt: txn.receipt_url
      }));
    },
    enabled: true
  });

  // Fetch categories from API
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const cats = await TransactionService.getCategories();
      return cats.map((cat: any) => ({
        id: cat.id || cat.name?.toLowerCase(),
        name: cat.name,
        subcategories: cat.subcategories || []
      }));
    }
  });

  const expenses = expensesData || [];
  const categories = categoriesData || [];

  // Handle quick select change
  const handleQuickSelectChange = (value: string) => {
    setQuickSelect(value);
    // Here you would calculate and set the start and end dates based on the selection
    const today = new Date();
    let start = new Date();
    
    switch(value) {
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1);
        break;
      case 'past30':
        start = new Date(today.setDate(today.getDate() - 30));
        break;
      case 'past90':
        start = new Date(today.setDate(today.getDate() - 90));
        break;
      case 'past12Months':
        start = new Date(today.setMonth(today.getMonth() - 12));
        break;
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
  };

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort expenses
  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses];
    
    // Apply filters
    if (searchTerm) {
      filtered = filtered.filter(exp => 
        exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.transactionNumber.includes(searchTerm)
      );
    }
    
    if (selectedAccount !== 'all') {
      filtered = filtered.filter(exp => exp.category.toLowerCase() === selectedAccount);
    }
    
    if (selectedSubAccount !== 'all') {
      filtered = filtered.filter(exp => exp.subcategory.toLowerCase() === selectedSubAccount);
    }
    
    if (selectedPaymentMethod !== 'all') {
      filtered = filtered.filter(exp => exp.paymentMethod.toLowerCase() === selectedPaymentMethod);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch(sortField) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'transaction':
          comparison = a.transactionNumber.localeCompare(b.transactionNumber);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'description':
          comparison = a.description.localeCompare(b.description);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'payment':
          comparison = a.paymentMethod.localeCompare(b.paymentMethod);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [expenses, searchTerm, selectedAccount, selectedSubAccount, selectedPaymentMethod, sortField, sortDirection]);

  const totalAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsEditModalOpen(true);
    setOpenActionMenu(null);
  };

  const handleDelete = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsDeleteModalOpen(true);
    setOpenActionMenu(null);
  };

  const handleViewReceipt = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsReceiptModalOpen(true);
  };

  const handleClearFilters = () => {
    setQuickSelect('past30');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    setSelectedAccount('all');
    setSelectedSubAccount('all');
    setSelectedPaymentMethod('all');
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-3 h-3 ml-1 text-primary-600" />
      : <ChevronDown className="w-3 h-3 ml-1 text-primary-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Page Title with Add Expense Button */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Expenses</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#2c3e50] hover:bg-[#1a252f] text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Add Expense
        </button>
      </div>

      {/* Filter Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        {/* Top Row of Filters */}
        <div className="grid grid-cols-12 gap-4 mb-4">
          {/* Quick Select */}
          <div className="col-span-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Quick Select</label>
            <select
              value={quickSelect}
              onChange={(e) => handleQuickSelectChange(e.target.value)}
              className="w-full h-[38px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="past30">Past 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="thisYear">This Year</option>
              <option value="past90">Past 90 Days</option>
              <option value="past12Months">Past 12 Months</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-[38px] pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-[38px] pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Search */}
          <div className="col-span-5">
            <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search description or transaction #..."
                className="w-full h-[38px] pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Bottom Row of Filters */}
        <div className="grid grid-cols-12 gap-4">
          {/* Account */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full h-[38px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Sub-Account */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Sub-Account</label>
            <select
              value={selectedSubAccount}
              onChange={(e) => setSelectedSubAccount(e.target.value)}
              className="w-full h-[38px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All</option>
              {selectedAccount !== 'all' && 
                categories.find(c => c.id === selectedAccount)?.subcategories.map((sub: string) => (
                  <option key={sub} value={sub.toLowerCase()}>{sub}</option>
                ))
              }
            </select>
          </div>

          {/* Payment Method */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full h-[38px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank transfer">Bank Transfer</option>
            </select>
          </div>

          {/* Export Button */}
          <div className="col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">&nbsp;</label>
            <button className="w-full h-[38px] px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          {/* Clear Button */}
          <div className="col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">&nbsp;</label>
            <button 
              onClick={handleClearFilters}
              className="w-full h-[38px] px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
              title="Clear Filters"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          </div>

          {/* Results Summary */}
          <div className="col-span-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">Results</label>
            <div className="w-full h-[38px] px-3 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm flex items-center justify-center border border-gray-200">
              <span className="font-medium">{filteredExpenses.length}</span>&nbsp;expenses • 
              <span className="font-medium">&nbsp;€{totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left">
                  <button 
                    onClick={() => handleSort('date')}
                    className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center hover:text-gray-700"
                  >
                    Date
                    <SortIcon field="date" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button 
                    onClick={() => handleSort('transaction')}
                    className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center hover:text-gray-700"
                  >
                    Transaction #
                    <SortIcon field="transaction" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button 
                    onClick={() => handleSort('category')}
                    className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center hover:text-gray-700"
                  >
                    Account
                    <SortIcon field="category" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button 
                    onClick={() => handleSort('description')}
                    className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center hover:text-gray-700"
                  >
                    Description
                    <SortIcon field="description" />
                  </button>
                </th>
                <th className="px-6 py-3 text-right">
                  <button 
                    onClick={() => handleSort('amount')}
                    className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center justify-end hover:text-gray-700"
                  >
                    Amount
                    <SortIcon field="amount" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button 
                    onClick={() => handleSort('payment')}
                    className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center hover:text-gray-700"
                  >
                    Payment
                    <SortIcon field="payment" />
                  </button>
                </th>
                <th className="px-6 py-3 text-center">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingExpenses ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Loading expenses...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No expenses found for the selected filters
                  </td>
                </tr>
              ) : filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.transactionNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{expense.subcategory}</div>
                      <div className="text-xs text-gray-500 italic">{expense.category}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {expense.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                    €{expense.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {expense.paymentMethod}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-7 flex justify-center">
                        {expense.receipt && (
                          <button
                            onClick={() => handleViewReceipt(expense)}
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                            title="View Receipt"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setOpenActionMenu(openActionMenu === expense.id ? null : expense.id)}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        >
                          <Settings2 className="w-4 h-4" />
                        </button>
                        {openActionMenu === expense.id && (
                          <div className="absolute right-full mr-1 top-1/2 -translate-y-1/2 w-32 bg-white rounded-lg shadow-lg border border-gray-200 z-10 overflow-hidden">
                            <button
                              onClick={() => handleEdit(expense)}
                              className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(expense)}
                              className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AddExpenseModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
      
      {selectedExpense && (
        <>
          <EditExpenseModal 
            isOpen={isEditModalOpen} 
            onClose={() => setIsEditModalOpen(false)}
            expense={selectedExpense}
          />
          
          <DeleteConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={() => {
              // Handle delete
              console.log('Deleting expense:', selectedExpense.id);
              setIsDeleteModalOpen(false);
            }}
            title="Delete Expense"
            message={`Are you sure you want to delete this expense for €${selectedExpense.amount.toFixed(2)}?`}
          />
          
          <ReceiptViewerModal
            isOpen={isReceiptModalOpen}
            onClose={() => setIsReceiptModalOpen(false)}
            receiptUrl={selectedExpense.receipt || ''}
          />
        </>
      )}
    </div>
  );
};

export default Expenses;