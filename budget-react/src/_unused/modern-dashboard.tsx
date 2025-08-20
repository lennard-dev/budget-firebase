import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { TransactionsTable } from './tables/transactions-table'
import { useTransactions } from '../hooks/use-transactions'
import { useAppStore } from '../store/app-store'
import { 
  Euro, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Plus,
  Filter
} from 'lucide-react'
import { formatCurrency } from '../lib/utils'

const ModernDashboard: React.FC = () => {
  const { user } = useAppStore()
  const { data: transactions = [], isLoading } = useTransactions({ limit: 100 })

  // Calculate summary statistics
  const stats = React.useMemo(() => {
    const thisMonth = transactions.filter(t => {
      const transactionDate = new Date(t.date)
      const now = new Date()
      return transactionDate.getMonth() === now.getMonth() && 
             transactionDate.getFullYear() === now.getFullYear()
    })

    const totalExpenses = thisMonth
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    const totalIncome = thisMonth
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)

    const netIncome = totalIncome - totalExpenses
    const transactionCount = thisMonth.length

    return { totalExpenses, totalIncome, netIncome, transactionCount }
  }, [transactions])

  const summaryCards = [
    {
      title: "This Month's Expenses",
      value: formatCurrency(stats.totalExpenses),
      subtitle: "Same as last month",
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Budget Remaining",
      value: formatCurrency(9550.01),
      subtitle: "11 days left in period",
      icon: Euro,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Cash on Hand",
      value: formatCurrency(2050.0),
      subtitle: "Last updated today",
      icon: Wallet,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Pending Donations",
      value: formatCurrency(0),
      subtitle: "0 expected",
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ]

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">
              Dashboard
            </h1>
            <p className="text-text-secondary">
              Welcome back, {user?.name}
            </p>
          </div>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Quick Expense
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card, index) => (
            <Card key={index} className="border-0 shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-text-muted uppercase tracking-wide">
                      {card.title}
                    </p>
                    <p className="text-2xl font-bold text-text-primary">
                      {card.value}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {card.subtitle}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${card.bgColor}`}>
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Budget vs Actual Chart */}
          <Card className="border-0 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold">
                Budget vs Actual
              </CardTitle>
              <select className="text-sm border rounded px-2 py-1">
                <option>This Month</option>
                <option>Last Month</option>
                <option>This Quarter</option>
              </select>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-400 rounded"></div>
                    <span>Budget</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-success-green rounded"></div>
                    <span>Actual</span>
                  </div>
                </div>
                {/* Placeholder for chart */}
                <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
                  <span className="text-gray-500">Budget vs Actual Chart</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Spending by Category Chart */}
          <Card className="border-0 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold">
                Spending by Category
              </CardTitle>
              <Button variant="ghost" size="sm">
                Switch View
              </Button>
            </CardHeader>
            <CardContent>
              {/* Placeholder for pie chart */}
              <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
                <span className="text-gray-500">Category Breakdown Chart</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Spending Trend */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Spending Trend (Last 12 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Placeholder for line chart */}
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
              <span className="text-gray-500">12-Month Spending Trend</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Expenses */}
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Recent Expenses
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                View All →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <TransactionsTable 
              data={transactions.slice(0, 5)} 
              isLoading={isLoading}
              onEdit={(transaction) => console.log('Edit:', transaction)}
              onDelete={(transaction) => console.log('Delete:', transaction)}
              onViewReceipt={(transaction) => console.log('View receipt:', transaction)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ModernDashboard