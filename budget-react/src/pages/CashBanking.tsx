import { useState, useEffect } from 'react';
import { 
  ArrowUpDown, 
  Plus,
  Wallet,
  Building,
  Clock,
  Eye,
  Settings,
  Download,
  Check
} from 'lucide-react';
import { TransactionService } from '../services/TransactionService';
import RecordMovementModal from '../components/modals/RecordMovementModal';
import RecordIncomeModal from '../components/modals/RecordIncomeModal';

interface LedgerEntry {
  id?: string;
  transaction_id: string;
  account: string;
  date: string;
  timestamp: number;
  type: string;
  subtype?: string;
  paymentMethod?: string;
  description: string;
  change_amount: number;
  balance_before: number;
  balance_after: number;
  display_balance?: number;
  category?: string;
}

interface ExpectedIncome {
  id: string;
  expectedDate: string;
  source: string;
  description: string;
  amount: number;
  status: 'pending' | 'received';
  recurring: boolean;
  notes?: string;
}

export default function CashBanking() {
  const [activeTab, setActiveTab] = useState<'cash' | 'bank' | 'expected'>('cash');
  const [cashMovements, setCashMovements] = useState<LedgerEntry[]>([]);
  const [bankMovements, setBankMovements] = useState<LedgerEntry[]>([]);
  const [expectedIncomes, setExpectedIncomes] = useState<ExpectedIncome[]>([]);
  const [balances, setBalances] = useState({ cash: 0, bank: 0 });
  const [_loading, setLoading] = useState(true);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  
  // Filter states
  const [cashFilters, setCashFilters] = useState({
    quickSelect: '30',
    startDate: '',
    endDate: '',
    type: '',
    search: ''
  });
  
  const [bankFilters, setBankFilters] = useState({
    quickSelect: '30',
    startDate: '',
    endDate: '',
    type: '',
    search: ''
  });

  // Summary calculations
  const [summary, setSummary] = useState({
    expectedTotal: 0,
    receivedThisMonth: 0,
    receivedCount: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'cash') {
      loadCashMovements();
    } else if (activeTab === 'bank') {
      loadBankMovements();
    } else if (activeTab === 'expected') {
      loadExpectedIncome();
    }
  }, [activeTab, cashFilters, bankFilters]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load balances
      const balanceData = await TransactionService.getBalances();
      setBalances(balanceData);

      // Calculate this month's received
      const thisMonth = new Date();
      const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const monthTransactions = await TransactionService.getList({
        type: 'income',
        startDate: monthStart,
        endDate: monthEnd
      });
      
      const receivedTotal = monthTransactions.reduce((sum: number, txn: any) => sum + Math.abs(txn.amount), 0);
      setSummary(prev => ({
        ...prev,
        receivedThisMonth: receivedTotal,
        receivedCount: monthTransactions.length
      }));

      // Load initial movements
      await loadCashMovements();
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCashMovements = async () => {
    try {
      const params: any = { limit: 1000 };
      
      // Apply date filters
      if (cashFilters.quickSelect && cashFilters.quickSelect !== 'all') {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(cashFilters.quickSelect));
        params.startDate = startDate.toISOString().split('T')[0];
        params.endDate = endDate.toISOString().split('T')[0];
      } else if (cashFilters.startDate || cashFilters.endDate) {
        if (cashFilters.startDate) params.startDate = cashFilters.startDate;
        if (cashFilters.endDate) params.endDate = cashFilters.endDate;
      }

      const ledgerEntries = await TransactionService.getLedger('cash', params);
      
      // Apply additional filters
      let filtered = ledgerEntries;
      
      if (cashFilters.type) {
        filtered = filtered.filter((entry) => {
          if (cashFilters.type === 'cash-expense') return entry.type === 'expense';
          if (cashFilters.type === 'donation') return entry.type === 'income';
          if (cashFilters.type === 'withdrawal') return entry.subtype === 'withdrawal';
          if (cashFilters.type === 'deposit') return entry.subtype === 'deposit';
          return true;
        });
      }
      
      if (cashFilters.search) {
        const searchLower = cashFilters.search.toLowerCase();
        filtered = filtered.filter((entry) => 
          entry.description?.toLowerCase().includes(searchLower)
        );
      }
      
      setCashMovements(filtered);
    } catch (error) {
      console.error('Failed to load cash movements:', error);
    }
  };

  const loadBankMovements = async () => {
    try {
      const params: any = { limit: 1000 };
      
      // Apply date filters
      if (bankFilters.quickSelect && bankFilters.quickSelect !== 'all') {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(bankFilters.quickSelect));
        params.startDate = startDate.toISOString().split('T')[0];
        params.endDate = endDate.toISOString().split('T')[0];
      } else if (bankFilters.startDate || bankFilters.endDate) {
        if (bankFilters.startDate) params.startDate = bankFilters.startDate;
        if (bankFilters.endDate) params.endDate = bankFilters.endDate;
      }

      const ledgerEntries = await TransactionService.getLedger('bank', params);
      
      // Filter out cash expenses from bank movements
      let filtered = ledgerEntries.filter((entry) => {
        if (entry.type === 'expense') {
          return entry.paymentMethod !== 'Cash' && entry.paymentMethod !== null;
        }
        return true;
      });
      
      // Apply additional filters
      if (bankFilters.type) {
        filtered = filtered.filter((entry) => {
          if (bankFilters.type === 'transfer') return entry.type === 'transfer';
          if (bankFilters.type === 'payment') return entry.type === 'expense';
          if (bankFilters.type === 'income') return entry.type === 'income';
          return true;
        });
      }
      
      if (bankFilters.search) {
        const searchLower = bankFilters.search.toLowerCase();
        filtered = filtered.filter((entry) => 
          entry.description?.toLowerCase().includes(searchLower)
        );
      }
      
      setBankMovements(filtered);
    } catch (error) {
      console.error('Failed to load bank movements:', error);
    }
  };

  const loadExpectedIncome = async () => {
    // TODO: Implement when backend API is ready
    setExpectedIncomes([]);
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      try {
        await TransactionService.delete(transactionId);
        await loadData();
      } catch (error) {
        console.error('Failed to delete transaction:', error);
        alert('Failed to delete transaction');
      }
    }
  };

  const handleEditTransaction = (transactionId: string) => {
    setEditingTransaction(transactionId);
    setMovementModalOpen(true);
  };

  const getTypeLabel = (type: string, subtype?: string, paymentMethod?: string) => {
    if (type === 'expense') {
      if (paymentMethod === 'Cash') return 'Cash Expense';
      if (paymentMethod === 'Card') return 'Card Expense';
      if (paymentMethod === 'Bank Transfer') return 'Bank Transfer';
      return 'Expense';
    }
    if (type === 'income') return 'Donation';
    if (type === 'transfer') {
      if (subtype === 'withdrawal') return 'Withdrawal';
      if (subtype === 'deposit') return 'Deposit';
      return 'Transfer';
    }
    return type || 'Unknown';
  };

  const getTypeClass = (type: string) => {
    if (type === 'expense') return 'bg-red-100 text-red-700';
    if (type === 'income') return 'bg-green-100 text-green-700';
    if (type === 'transfer') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-700';
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: 'EUR'
    }).format(Math.abs(amount));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const updateQuickSelect = (value: string, type: 'cash' | 'bank') => {
    const endDate = new Date();
    let startDate = new Date();
    
    if (value && value !== 'all') {
      startDate.setDate(endDate.getDate() - parseInt(value));
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      
      if (type === 'cash') {
        setCashFilters(prev => ({
          ...prev,
          quickSelect: value,
          startDate: startStr,
          endDate: endStr
        }));
      } else {
        setBankFilters(prev => ({
          ...prev,
          quickSelect: value,
          startDate: startStr,
          endDate: endStr
        }));
      }
    } else {
      if (type === 'cash') {
        setCashFilters(prev => ({
          ...prev,
          quickSelect: value,
          startDate: '',
          endDate: ''
        }));
      } else {
        setBankFilters(prev => ({
          ...prev,
          quickSelect: value,
          startDate: '',
          endDate: ''
        }));
      }
    }
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export functionality to be implemented');
  };

  const MovementsTable = ({ movements, type }: { movements: LedgerEntry[], type: 'cash' | 'bank' }) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction #</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining Balance</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {movements.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                No {type} movements found
              </td>
            </tr>
          ) : (
            movements.map((entry) => (
              <tr key={entry.id || entry.transaction_id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(entry.date)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {entry.transaction_id.slice(-8).toUpperCase()}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getTypeClass(entry.type)}`}>
                    {getTypeLabel(entry.type, entry.subtype, entry.paymentMethod)}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {entry.description || '-'}
                </td>
                <td className={`px-4 py-4 whitespace-nowrap text-sm text-right font-medium ${
                  entry.change_amount < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatAmount(entry.change_amount)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                  {formatAmount(entry.display_balance || entry.balance_after)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-1">
                    {entry.type === 'expense' && (
                      <button
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        title="View receipt"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <div className="relative">
                      <button
                        onClick={() => setOpenActionMenu(openActionMenu === entry.transaction_id ? null : entry.transaction_id)}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        title="More actions"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      {openActionMenu === entry.transaction_id && (
                        <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <button
                            onClick={() => {
                              handleEditTransaction(entry.transaction_id);
                              setOpenActionMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              handleDeleteTransaction(entry.transaction_id);
                              setOpenActionMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cash & Banking</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setMovementModalOpen(true)}
            className="bg-[#2c3e50] hover:bg-[#1a252f] text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <ArrowUpDown className="w-4 h-4" strokeWidth={2} />
            Record Movement
          </button>
          <button
            onClick={() => setIncomeModalOpen(true)}
            className="bg-[#2c3e50] hover:bg-[#1a252f] text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Record Income
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Current Cash Balance</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{formatAmount(balances.cash)}</div>
          <div className="mt-1 text-xs text-gray-500">Updated just now</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Expected Income</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">{formatAmount(summary.expectedTotal)}</div>
          <div className="mt-1 text-xs text-gray-500">{expectedIncomes.filter(e => e.status === 'pending').length} pending</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Received This Month</div>
          <div className="mt-1 text-2xl font-bold text-green-600">{formatAmount(summary.receivedThisMonth)}</div>
          <div className="mt-1 text-xs text-gray-500">{summary.receivedCount} donations</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Bank Balance</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{formatAmount(balances.bank)}</div>
          <div className="mt-1 text-xs text-gray-500">Updated just now</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-50 rounded-lg p-1 mb-6">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('cash')}
            className={`flex-1 px-4 py-2.5 rounded-md font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'cash'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Cash Movements
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`flex-1 px-4 py-2.5 rounded-md font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'bank'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Building className="w-4 h-4" />
            Bank Movements
          </button>
          <button
            onClick={() => setActiveTab('expected')}
            className={`flex-1 px-4 py-2.5 rounded-md font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'expected'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Expected Income
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'cash' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Quick Select</label>
                    <select
                      value={cashFilters.quickSelect}
                      onChange={(e) => updateQuickSelect(e.target.value, 'cash')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Custom Range</option>
                      <option value="7">Past 7 Days</option>
                      <option value="30">Past 30 Days</option>
                      <option value="90">Past 90 Days</option>
                      <option value="365">Past 12 Months</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={cashFilters.startDate}
                      onChange={(e) => setCashFilters(prev => ({ ...prev, startDate: e.target.value, quickSelect: '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={cashFilters.endDate}
                      onChange={(e) => setCashFilters(prev => ({ ...prev, endDate: e.target.value, quickSelect: '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={cashFilters.type}
                      onChange={(e) => setCashFilters(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">All Types</option>
                      <option value="cash-expense">Cash Expense</option>
                      <option value="deposit">Deposit</option>
                      <option value="withdrawal">Withdrawal</option>
                      <option value="donation">Donation</option>
                    </select>
                  </div>
                  <div className="flex-[2] min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                    <input
                      type="text"
                      value={cashFilters.search}
                      onChange={(e) => setCashFilters(prev => ({ ...prev, search: e.target.value }))}
                      placeholder="Search description..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>
          </div>

          {/* Main Content Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Action Bar */}
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center rounded-t-xl">
              <div></div>
              <button
                onClick={handleExport}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-1"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            </div>

            {/* Table */}
            <div className="p-0">
              <MovementsTable movements={cashMovements} type="cash" />
            </div>
          </div>
        </div>
      )}

      {/* Bank Movements Tab */}
      {activeTab === 'bank' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Quick Select</label>
                    <select
                      value={bankFilters.quickSelect}
                      onChange={(e) => updateQuickSelect(e.target.value, 'bank')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Custom Range</option>
                      <option value="7">Past 7 Days</option>
                      <option value="30">Past 30 Days</option>
                      <option value="90">Past 90 Days</option>
                      <option value="365">Past 12 Months</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={bankFilters.startDate}
                      onChange={(e) => setBankFilters(prev => ({ ...prev, startDate: e.target.value, quickSelect: '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={bankFilters.endDate}
                      onChange={(e) => setBankFilters(prev => ({ ...prev, endDate: e.target.value, quickSelect: '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={bankFilters.type}
                      onChange={(e) => setBankFilters(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">All Types</option>
                      <option value="transfer">Transfer</option>
                      <option value="payment">Payment</option>
                      <option value="income">Income</option>
                    </select>
                  </div>
                  <div className="flex-[2] min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                    <input
                      type="text"
                      value={bankFilters.search}
                      onChange={(e) => setBankFilters(prev => ({ ...prev, search: e.target.value }))}
                      placeholder="Search description..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>
          </div>

          {/* Main Content Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Action Bar */}
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center rounded-t-xl">
              <div></div>
              <button
                onClick={handleExport}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-1"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            </div>

            {/* Table */}
            <div className="p-0">
              <MovementsTable movements={bankMovements} type="bank" />
            </div>
          </div>
        </div>
      )}

      {/* Expected Income Tab */}
      {activeTab === 'expected' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Action Bar */}
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center rounded-t-xl">
            <div></div>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-1"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>

          {/* Table */}
          <div className="p-0">
            <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid By</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expectedIncomes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No expected income entries yet
                        </td>
                      </tr>
                    ) : (
                      expectedIncomes.map((income) => (
                        <tr key={income.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {income.source}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(income.expectedDate)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                            {formatAmount(income.amount)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              income.status === 'received' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {income.status === 'received' ? 'Received' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {income.notes || '-'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                className={`p-1.5 rounded ${
                                  income.status === 'received'
                                    ? 'text-green-600 bg-green-100'
                                    : 'text-gray-400 hover:text-green-600 hover:bg-green-100'
                                }`}
                                title={income.status === 'received' ? 'Marked as received' : 'Mark as received'}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <div className="relative">
                                <button
                                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                  title="More actions"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {movementModalOpen && (
        <RecordMovementModal
          isOpen={movementModalOpen}
          onClose={() => {
            setMovementModalOpen(false);
            setEditingTransaction(null);
          }}
          onSave={loadData}
          editingTransactionId={editingTransaction}
        />
      )}

      {incomeModalOpen && (
        <RecordIncomeModal
          isOpen={incomeModalOpen}
          onClose={() => setIncomeModalOpen(false)}
          onSave={loadData}
        />
      )}
    </div>
  );
}