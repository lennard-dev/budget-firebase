import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import KpiCard from '../components/ui/KpiCard';
import DataTable from '../components/ui/DataTable';
import transactionService from '../services/transactionService';
import { formatCurrency, formatDate } from '../lib/utils';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState({
    monthExpenses: 0,
    budgetRemaining: 0,
    cashOnHand: 0,
    pendingDonations: 0
  });
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [budgetChartData, setBudgetChartData] = useState([]);
  const [categoryChartData, setCategoryChartData] = useState([]);
  const [trendChartData, setTrendChartData] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch KPI data
      const kpis = await transactionService.getDashboardKPIs();
      setKpiData({
        monthExpenses: kpis.monthExpenses,
        budgetRemaining: kpis.budgetRemaining,
        cashOnHand: kpis.cashBalance,
        pendingDonations: kpis.pendingDonations
      });

      // Fetch recent expenses
      const expenses = await transactionService.getRecentExpenses(5);
      setRecentExpenses(expenses);

      // Set up chart data
      setBudgetChartData([
        { name: 'Facility', budget: 1500, actual: 450 },
        { name: 'Administration', budget: 1200, actual: 380 }
      ]);

      setCategoryChartData([
        { name: 'Administration', value: 380, color: '#EC4899' },
        { name: 'Facility', value: 450, color: '#3B82F6' }
      ]);

      // Generate trend data for last 12 months
      const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
      const trendData = months.map((month, index) => ({
        month,
        amount: 100 + Math.random() * 500
      }));
      setTrendChartData(trendData);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      header: 'DATE',
      accessor: 'date',
      cell: (value) => formatDate(value)
    },
    {
      header: 'CATEGORY',
      accessor: 'category'
    },
    {
      header: 'SUBCATEGORY',
      accessor: 'subcategory'
    },
    {
      header: 'DESCRIPTION',
      accessor: 'description'
    },
    {
      header: 'AMOUNT',
      accessor: 'amount',
      cell: (value) => formatCurrency(value),
      align: 'right'
    }
  ];

  const handleQuickExpense = () => {
    navigate('/expenses');
  };

  const COLORS = ['#3B82F6', '#EC4899'];

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading dashboard data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      </div>
      
      <div className="space-y-6">
        {/* KPI Cards - Responsive grid with equal width/height */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <KpiCard
            label="This Month's Expenses"
            value={formatCurrency(kpiData.monthExpenses)}
            caption="Same as last month"
            onClick={() => navigate('/expenses')}
          />
          <KpiCard
            label="Budget Remaining"
            value={formatCurrency(kpiData.budgetRemaining)}
            caption=""
            onClick={() => navigate('/budget')}
          />
          <KpiCard
            label="Cash on Hand"
            value={formatCurrency(kpiData.cashOnHand)}
            caption="Last updated today"
            onClick={() => navigate('/cash-banking')}
          />
          <KpiCard
            label="Pending Donations"
            value={formatCurrency(kpiData.pendingDonations)}
            caption="0 expected"
            onClick={() => navigate('/cash-banking')}
          />
        </div>

        {/* Charts Row - Bar and Donut side by side */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Budget vs Actual */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium mb-4">Budget vs Actual</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={budgetChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="actual" fill="#10B981" />
                <Bar dataKey="budget" fill="#6B7280" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Spending by Category */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium mb-4">Spending by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spending Trend - Full width */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium mb-4">Spending Trend (Last 12 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendChartData}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="#3B82F6" 
                fillOpacity={1} 
                fill="url(#colorAmount)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Expenses Table */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Recent Expenses</h3>
            <button 
              onClick={() => navigate('/expenses')}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              View All →
            </button>
          </div>
          <DataTable
            columns={columns}
            data={recentExpenses}
            emptyMessage="No data available"
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;