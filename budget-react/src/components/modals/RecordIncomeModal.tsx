import React, { useState } from 'react';
import { X, Wallet, Building, Calendar, DollarSign, RefreshCw } from 'lucide-react';
import { TransactionService } from '../../services/TransactionService';

interface RecordIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function RecordIncomeModal({ 
  isOpen, 
  onClose, 
  onSave 
}: RecordIncomeModalProps) {
  const [account, setAccount] = useState<'cash' | 'bank'>('bank');
  const [incomeType, setIncomeType] = useState<'actual' | 'expected'>('actual');
  const [type, setType] = useState<string>('regular');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [description, setDescription] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !amount || !source) {
      alert('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    
    try {
      const amountNum = parseFloat(amount);
      
      if (incomeType === 'actual') {
        // Create actual income transaction
        const transactionData = {
          date,
          amount: amountNum,
          description: `${source} - ${description || getTypeLabel(type)}`,
          account,
          category: 'Income',
          metadata: {
            source,
            incomeType: type,
            recurring
          }
        };
        
        await TransactionService.create('income', transactionData);
      } else {
        // TODO: Create expected income entry when backend is ready
        console.log('Expected income feature to be implemented');
        alert('Expected income feature will be available soon');
      }
      
      onSave();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Failed to save income:', error);
      alert('Failed to save income');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAccount('bank');
    setIncomeType('actual');
    setType('regular');
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setSource('');
    setDescription('');
    setRecurring(false);
  };

  const getTypeLabel = (value: string) => {
    switch (value) {
      case 'regular':
        return 'Regular Project Funding';
      case 'irregular':
        return 'Irregular Project Funding';
      case 'grant':
        return 'Grant';
      case 'donation':
        return 'Donation';
      default:
        return value;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Record Income
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
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-700">
              Record income and donations received, or track expected future income from partners and donors.
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
                onClick={() => setAccount('cash')}
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
                onClick={() => setAccount('bank')}
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

          {/* Actual/Expected Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Income Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIncomeType('actual')}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  incomeType === 'actual'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">Actual</span>
              </button>
              <button
                type="button"
                onClick={() => setIncomeType('expected')}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  incomeType === 'expected'
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Expected</span>
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
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="regular">Regular Project Funding</option>
                <option value="irregular">Irregular Project Funding</option>
                <option value="grant">Grant</option>
                <option value="donation">Donation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {incomeType === 'expected' ? 'Expected Date' : 'Date Received'}
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

          {/* Type description */}
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-600">
              {type === 'regular' && 'Monthly transfer from headquarters for project budget'}
              {type === 'irregular' && 'Transfer from headquarters outside regular monthly cycle'}
              {type === 'grant' && 'Grant from foundation or institution'}
              {type === 'donation' && 'Donation from individual, company, or NGO'}
            </p>
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source / Paid By
            </label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g., Headquarters, ABC Foundation, John Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
              required
            />
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
              Description / Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details about this income..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Recurring Checkbox */}
          {incomeType === 'expected' && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <input
                type="checkbox"
                id="recurring"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="recurring" className="flex items-center gap-2 text-sm text-gray-700">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                <span>Recurring monthly</span>
              </label>
            </div>
          )}

          {/* Info Message for Expected Income */}
          {incomeType === 'expected' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700">
                Expected income will appear in the Expected Income tab. When received, you can mark it as received and it will be recorded as an actual transaction.
              </p>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                onClose();
                resetForm();
              }}
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
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}