import React, { useState, useEffect } from 'react';
import { X, Wallet, Building, ArrowUpRight } from 'lucide-react';
import { TransactionService } from '../../services/TransactionService';

interface RecordMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingTransactionId?: string | null;
}

export default function RecordMovementModal({ 
  isOpen, 
  onClose, 
  onSave, 
  editingTransactionId 
}: RecordMovementModalProps) {
  const [account, setAccount] = useState<'cash' | 'bank'>('cash');
  const [type, setType] = useState<'income' | 'withdrawal' | 'deposit'>('income');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingTransactionId) {
      loadTransaction();
    } else {
      // Reset form for new transaction
      setAccount('cash');
      setType('income');
      setDate(new Date().toISOString().split('T')[0]);
      setAmount('');
      setDescription('');
    }
  }, [editingTransactionId, isOpen]);

  const loadTransaction = async () => {
    if (!editingTransactionId) return;
    
    try {
      const transaction = await TransactionService.getById(editingTransactionId);
      if (transaction) {
        // Determine account and type based on transaction data
        if (transaction.type === 'income') {
          setAccount((transaction.account || 'cash') as 'cash' | 'bank');
          setType('income');
        } else if (transaction.type === 'transfer') {
          if (transaction.subtype === 'withdrawal') {
            setAccount('bank');
            setType('withdrawal');
          } else if (transaction.subtype === 'deposit') {
            setAccount('cash');
            setType('deposit');
          }
        }
        
        setDate(transaction.date);
        setAmount(Math.abs(transaction.amount).toString());
        setDescription(transaction.description || '');
      }
    } catch (error) {
      console.error('Failed to load transaction:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !amount || !description) {
      alert('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    
    try {
      const amountNum = parseFloat(amount);
      let transactionType: string;
      let transactionData: any;
      
      if (type === 'income') {
        transactionType = 'income';
        transactionData = {
          date,
          amount: amountNum,
          description,
          account
        };
      } else if (type === 'withdrawal') {
        transactionType = 'transfer';
        transactionData = {
          date,
          amount: amountNum,
          description,
          subtype: 'withdrawal'
        };
      } else if (type === 'deposit') {
        transactionType = 'transfer';
        transactionData = {
          date,
          amount: amountNum,
          description,
          subtype: 'deposit'
        };
      }
      
      if (editingTransactionId) {
        await TransactionService.update(editingTransactionId, transactionType!, transactionData);
      } else {
        await TransactionService.create(transactionType!, transactionData);
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save transaction:', error);
      alert('Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const getTypeOptions = () => {
    if (account === 'cash') {
      return [
        { value: 'income', label: 'Cash Donation' },
        { value: 'withdrawal', label: 'ATM Withdrawal (from Bank)' },
        { value: 'deposit', label: 'Cash Deposit (to Bank)' }
      ];
    } else {
      return [
        { value: 'income', label: 'Bank Donation' },
        { value: 'withdrawal', label: 'Cash Withdrawal (to Cash)' },
        { value: 'deposit', label: 'Cash Deposit (from Cash)' }
      ];
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingTransactionId ? 'Edit Movement' : 'Record Movement'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Description Text */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              Record cash and bank movements including donations received, withdrawals, and deposits between accounts.
            </p>
          </div>

          {/* Account Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setAccount('cash');
                  // Reset type when switching accounts
                  setType('income');
                }}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  account === 'cash'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Wallet className="w-5 h-5" />
                <span className="font-medium">Cash</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccount('bank');
                  // Reset type when switching accounts
                  setType('income');
                }}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  account === 'bank'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Building className="w-5 h-5" />
                <span className="font-medium">Bank</span>
              </button>
            </div>
          </div>

          {/* Type and Date Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'income' | 'withdrawal' | 'deposit')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                {getTypeOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (€)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Visual indicator for transfer direction */}
          {(type === 'withdrawal' || type === 'deposit') && (
            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-white rounded-lg border-2 border-gray-300 flex items-center justify-center">
                  {type === 'withdrawal' ? (
                    <Building className="w-6 h-6 text-gray-600" />
                  ) : (
                    <Wallet className="w-6 h-6 text-gray-600" />
                  )}
                </div>
                <ArrowUpRight className="w-5 h-5 text-gray-400" />
                <div className="w-12 h-12 bg-white rounded-lg border-2 border-gray-300 flex items-center justify-center">
                  {type === 'withdrawal' ? (
                    <Wallet className="w-6 h-6 text-gray-600" />
                  ) : (
                    <Building className="w-6 h-6 text-gray-600" />
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-600 ml-2">
                {type === 'withdrawal' ? 'Bank → Cash' : 'Cash → Bank'}
              </span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : (editingTransactionId ? 'Update' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}