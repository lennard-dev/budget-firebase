import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AlertTriangle, ArrowRight, Trash2, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (action: 'delete' | 'transfer', targetAccountCode?: string) => Promise<void>;
  account: {
    account_code: string;
    account_name: string;
    transaction_count?: number;
  } | null;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  account,
}) => {
  const [action, setAction] = useState<'delete' | 'transfer'>('transfer');
  const [targetAccountCode, setTargetAccountCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [transactionCount, setTransactionCount] = useState(0);

  // Fetch transaction count for this account
  useEffect(() => {
    if (account?.account_code && isOpen) {
      checkTransactionCount();
    }
  }, [account?.account_code, isOpen]);

  const checkTransactionCount = async () => {
    if (!account) return;
    
    try {
      const response = await api.get(`/chart-of-accounts/${account.account_code}/transaction-count`);
      setTransactionCount(response.data?.count || 0);
    } catch (err) {
      console.error('Error checking transaction count:', err);
      setTransactionCount(0);
    }
  };

  // Fetch other accounts for transfer option
  const { data: accountsData } = useQuery({
    queryKey: ['chart-of-accounts-for-transfer'],
    queryFn: async () => {
      const response = await api.get('/chart-of-accounts');
      return response.data?.data || [];
    },
    enabled: isOpen && action === 'transfer'
  });

  // Filter out the current account and system accounts
  const availableAccounts = accountsData?.filter((acc: any) => 
    acc.account_code !== account?.account_code && 
    acc.display_as === 'category' &&
    acc.account_type === 'expense'
  ) || [];

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      if (action === 'transfer' && !targetAccountCode) {
        setError('Please select an account to transfer transactions to');
        setIsLoading(false);
        return;
      }

      await onConfirm(action, action === 'transfer' ? targetAccountCode : undefined);
      
      // Reset state
      setAction('transfer');
      setTargetAccountCode('');
      setError('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
    } finally {
      setIsLoading(false);
    }
  };

  if (!account) return null;

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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="div"
                  className="flex items-center justify-between p-6 pb-4 border-b border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{account.account_name}</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Title>

                <div className="p-6">
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  {transactionCount > 0 && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>Warning:</strong> This account has {transactionCount} transaction{transactionCount !== 1 ? 's' : ''}.
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      What would you like to do with the existing transactions?
                    </p>

                    {/* Action Selection */}
                    <div className="space-y-3">
                      {/* Transfer Option */}
                      <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          name="action"
                          value="transfer"
                          checked={action === 'transfer'}
                          onChange={() => setAction('transfer')}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <ArrowRight className="w-4 h-4 text-blue-600" />
                            <span className="font-medium text-gray-900">Transfer to another account</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Move all transactions to a different expense account
                          </p>
                        </div>
                      </label>

                      {/* Delete Option */}
                      <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          name="action"
                          value="delete"
                          checked={action === 'delete'}
                          onChange={() => setAction('delete')}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Trash2 className="w-4 h-4 text-red-600" />
                            <span className="font-medium text-gray-900">
                              Delete account and all transactions
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {transactionCount > 0 
                              ? `Permanently delete this account and all ${transactionCount} transaction${transactionCount !== 1 ? 's' : ''}`
                              : 'Permanently remove the account and all associated data'
                            }
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Transfer Account Selection */}
                    {action === 'transfer' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select destination account
                        </label>
                        <select
                          value={targetAccountCode}
                          onChange={(e) => setTargetAccountCode(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Choose an account...</option>
                          {availableAccounts.map((acc: any) => (
                            <option key={acc.account_code} value={acc.account_code}>
                              {acc.account_name} ({acc.account_code})
                            </option>
                          ))}
                        </select>
                        {targetAccountCode && (
                          <p className="mt-2 text-sm text-gray-600">
                            All {transactionCount} transaction{transactionCount !== 1 ? 's' : ''} will be transferred to this account.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Confirmation Message */}
                    {action === 'delete' && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">
                          <strong>This action cannot be undone.</strong> 
                          {transactionCount > 0 
                            ? ` The account and all ${transactionCount} transaction${transactionCount !== 1 ? 's' : ''} will be permanently deleted.`
                            : ' The account will be permanently deleted.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading || (action === 'transfer' && !targetAccountCode)}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      action === 'delete' 
                        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                        : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                    }`}
                  >
                    {isLoading ? 'Processing...' : action === 'delete' ? 'Delete Account & Transactions' : 'Transfer & Delete'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default DeleteAccountModal;