import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus } from 'lucide-react';
import AddExpenseModal from '../components/modals/AddExpenseModal';

const Dashboard: React.FC = () => {
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  // KPI Data
  const kpiData = [
    {
      label: "This Month's Expenses",
      value: "€449.99",
      subtitle: "Same as last month",
      trend: "neutral"
    },
    {
      label: "Budget Remaining",
      value: "€9,550.01",
      subtitle: null,
      trend: null
    },
    {
      label: "Cash on Hand",
      value: "€0.00",
      subtitle: "Last updated today",
      trend: null
    },
    {
      label: "Pending Donations",
      value: "€0.00",
      subtitle: "0 expected",
      trend: null
    }
  ];

  // Budget vs Actual data
  const budgetData = [
    { category: 'Facility', budget: 1200, actual: 450 },
    { category: 'Administration', budget: 1500, actual: 500 }
  ];

  // Spending by Category data
  const categoryData = [
    { name: 'Facility', value: 450, color: '#ec4899' },
    { name: 'Administration', value: 550, color: '#3b82f6' }
  ];

  // Spending Trend data
  const trendData = [
    { month: 'Sep', amount: 200 },
    { month: 'Oct', amount: 350 },
    { month: 'Nov', amount: 400 },
    { month: 'Dec', amount: 380 },
    { month: 'Jan', amount: 450 },
    { month: 'Feb', amount: 420 },
    { month: 'Mar', amount: 480 },
    { month: 'Apr', amount: 490 },
    { month: 'May', amount: 450 },
    { month: 'Jun', amount: 470 },
    { month: 'Jul', amount: 490 },
    { month: 'Aug', amount: 500 }
  ];

  // Recent Expenses data - limited to 5 items
  const recentExpenses = [
    {
      date: '2025-08-19',
      category: 'Facility',
      subcategory: 'Rent',
      description: 'Test expense with Chart of Accounts',
      amount: '€250.00'
    },
    {
      date: '2025-08-18',
      category: 'Administration',
      subcategory: 'Test',
      description: 'Test transaction for Category ID system',
      amount: '€99.99'
    },
    {
      date: '2025-08-18',
      category: 'Administration',
      subcategory: 'Insurance',
      description: 'TEST TEST TEST',
      amount: '€100.00'
    },
    {
      date: '2025-08-17',
      category: 'Programs',
      subcategory: 'Materials',
      description: 'Program supplies',
      amount: '€75.00'
    },
    {
      date: '2025-08-16',
      category: 'Staff',
      subcategory: 'Training',
      description: 'Staff development workshop',
      amount: '€150.00'
    }
  ].slice(0, 5); // Ensure maximum 5 items

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-3 flex justify-between items-center">
          {/* Left-aligned Tab Navigation */}
          <nav className="flex gap-1">
            <button
              className="px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 bg-gray-900 text-white"
            >
              Dashboard
            </button>
          </nav>

          {/* Right-aligned Action Button */}
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="bg-[#2c3e50] hover:bg-[#1a252f] text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Quick Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, index) => (
          <div key={index} className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-normal mb-2">{kpi.label}</p>
            <p className="text-3xl font-semibold text-gray-900 mb-1">{kpi.value}</p>
            {kpi.subtitle && (
              <p className="text-xs text-gray-400">{kpi.subtitle}</p>
            )}
          </div>
        ))}
      </div>

      {/* Recent Expenses Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Recent Expenses</h2>
          <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            View All →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subcategory
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentExpenses.map((expense, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {expense.subcategory}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {expense.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                    {expense.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget vs Actual Chart */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Budget vs Actual</h2>
            <select className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option>This Month</option>
              <option>Last Month</option>
              <option>This Quarter</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={budgetData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="category" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickFormatter={(value) => `€${value}`}
              />
              <Tooltip 
                formatter={(value: any) => `€${value}`}
                contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="rect"
              />
              <Bar dataKey="budget" fill="#6b7280" name="Budget" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" fill="#10b981" name="Actual" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Spending by Category */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Spending by Category</h2>
            <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Switch View
            </button>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: any) => `€${value}`}
                contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4">
            {categoryData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spending Trend Chart */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Spending Trend (Last 12 Months)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickFormatter={(value) => `€${value}`}
            />
            <Tooltip 
              formatter={(value: any) => `€${value}`}
              contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            />
            <Line 
              type="monotone" 
              dataKey="amount" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Add Expense Modal */}
      <AddExpenseModal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)} 
      />
    </div>
  );
};

export default Dashboard;