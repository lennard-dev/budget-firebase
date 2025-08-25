import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Calendar, DollarSign, FileText, Upload, CreditCard } from 'lucide-react';
import { AccountSelector } from '../ui/AccountSelector';
import { updateTransaction, getChartOfAccounts } from '../../services/api';

interface Account {
  account_code: string;
  account_name: string;
  category_name?: string;
  subcategory_name?: string;
  parent_code?: string;
  display_as: string;
  is_active: boolean;
}

interface EditExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: {
    id: string;
    date: string;
    category: string;
    subcategory: string;
    description: string;
    amount: number;
    paymentMethod: string;
    receipt?: string;
  };
  onSuccess?: () => void;
}

const EditExpenseModal: React.FC<EditExpenseModalProps> = ({ 
  isOpen, 
  onClose, 
  expense,
  onSuccess 
}) => {
  const [formData, setFormData] = useState({
    date: expense.date,
    account_code: '',
    account_name: '',
    description: expense.description,
    amount: expense.amount.toString(),
    paymentMethod: expense.paymentMethod.toLowerCase().replace(' ', '_'),
    receipt: null as File | null,
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    // Reset form when expense changes
    setFormData({
      date: expense.date,
      account_code: '',
      account_name: expense.subcategory || expense.category || '',
      description: expense.description,
      amount: expense.amount.toString(),
      paymentMethod: expense.paymentMethod.toLowerCase().replace(' ', '_'),
      receipt: null,
    });
  }, [expense]);

  const fetchAccounts = async () => {
    try {
      const data = await getChartOfAccounts();
      setAccounts(data.accounts || []);
      
      // Try to match existing category/subcategory to account code
      if (expense.subcategory || expense.category) {
        const matchingAccount = (data.accounts || []).find((acc: Account) => 
          acc.subcategory_name === expense.subcategory ||
          acc.category_name === expense.category ||
          acc.account_name === expense.subcategory ||
          acc.account_name === expense.category
        );
        
        if (matchingAccount) {
          setFormData(prev => ({
            ...prev,
            account_code: matchingAccount.account_code,
            account_name: matchingAccount.subcategory_name || matchingAccount.category_name || matchingAccount.account_name
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
      // Try enabling mock auth if not already enabled
      if (!localStorage.getItem('useMockAuth')) {
        localStorage.setItem('useMockAuth', 'true');
        // Retry with mock auth
        try {
          const data = await getChartOfAccounts();
          setAccounts(data.accounts || []);
          
          // Try to match existing category/subcategory to account code
          if (expense.subcategory || expense.category) {
            const matchingAccount = (data.accounts || []).find((acc: Account) => 
              acc.subcategory_name === expense.subcategory ||
              acc.category_name === expense.category ||
              acc.account_name === expense.subcategory ||
              acc.account_name === expense.category
            );
            
            if (matchingAccount) {
              setFormData(prev => ({
                ...prev,
                account_code: matchingAccount.account_code,
                account_name: matchingAccount.subcategory_name || matchingAccount.category_name || matchingAccount.account_name
              }));
            }
          }
        } catch (retryErr) {
          console.error('Error fetching accounts with mock auth:', retryErr);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Prepare update data
      const updateData: any = {
        date: formData.date,
        type: 'expense',
        account: formData.paymentMethod === 'cash' ? 'cash' : 'bank',
        account_code: formData.account_code,
        account_name: formData.account_name,
        description: formData.description,
        amount: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        // Legacy fields for compatibility
        category: formData.account_name.split(' - ')[0] || '',
        subcategory: formData.account_name.includes(' - ') ? formData.account_name.split(' - ')[1] : ''
      };

      // Upload receipt if provided
      let receiptId = null;
      if (formData.receipt) {
        // Handle receipt upload (implementation depends on your storage solution)
        // receiptId = await uploadReceipt(formData.receipt);
      }

      if (receiptId) {
        updateData.metadata = { receiptId };
      }

      // Update the transaction
      await updateTransaction(expense.id, updateData);

      // Notify parent and close
      if (onSuccess) {
        onSuccess();
      } else {
        // Fallback refresh
        window.location.reload();
      }
      onClose();
    } catch (err: any) {
      console.error('Error updating expense:', err);
      setError(err.message || 'Failed to update expense');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, receipt: e.target.files[0] });
    }
  };

  const handleAccountChange = (accountCode: string, accountName: string) => {
    setFormData({ 
      ...formData, 
      account_code: accountCode,
      account_name: accountName 
    });
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[85vh]">
                <Dialog.Title
                  as="div"
                  className="flex items-center justify-between p-6 pb-4 border-b border-gray-100"
                >
                  <h3 className="text-lg font-semibold text-gray-900">Edit Expense</h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Title>

                {error && (
                  <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
                    {/* Date Field */}
                    <div>
                      <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                        Date
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="date"
                          id="date"
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>

                    {/* Account Selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expense Account
                      </label>
                      <AccountSelector
                        value={formData.account_code}
                        onChange={handleAccountChange}
                        accounts={accounts}
                        placeholder="Select expense account"
                        required={true}
                      />
                    </div>

                    {/* Description Field */}
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                          rows={3}
                          placeholder="Enter expense description"
                          required
                        />
                      </div>
                    </div>

                    {/* Amount Field */}
                    <div>
                      <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                        Amount
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          id="amount"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="0.00"
                          step="0.01"
                          required
                        />
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Method
                      </label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                          id="paymentMethod"
                          value={formData.paymentMethod}
                          onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
                          required
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="bank_transfer">Bank Transfer</option>
                        </select>
                      </div>
                    </div>

                    {/* Receipt Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Receipt (Optional)
                      </label>
                      <div className="flex items-center justify-center w-full">
                        <label
                          htmlFor="receipt"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-2 text-gray-400" />
                            <p className="mb-2 text-sm text-gray-500">
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-gray-500">PNG, JPG or PDF (MAX. 5MB)</p>
                            {(formData.receipt || expense.receipt) && (
                              <p className="mt-2 text-sm text-primary-600">
                                {formData.receipt ? formData.receipt.name : expense.receipt}
                              </p>
                            )}
                          </div>
                          <input
                            id="receipt"
                            type="file"
                            className="hidden"
                            accept="image/*,application/pdf"
                            onChange={handleFileChange}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading || !formData.account_code}
                    >
                      {loading ? 'Updating...' : 'Update Expense'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default EditExpenseModal;