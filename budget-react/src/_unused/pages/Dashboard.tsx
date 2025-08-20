import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  AccountBalance,
  TrendingUp,
  AttachMoney,
  Receipt,
  Refresh,
  Visibility,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { useGetBalancesQuery, useGetTransactionsQuery } from '../store/api/apiSlice';
import SummaryCard from '../components/common/SummaryCard';
import SpendingPieChart from '../components/charts/SpendingPieChart';
import TrendLineChart from '../components/charts/TrendLineChart';
import BudgetChart from '../components/charts/BudgetChart';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Fetch data
  const { 
    data: balances, 
    isLoading: balancesLoading, 
    error: balancesError,
    refetch: refetchBalances 
  } = useGetBalancesQuery({});
  
  const { 
    data: transactions, 
    isLoading: transactionsLoading,
    refetch: refetchTransactions
  } = useGetTransactionsQuery({ 
    limit: 100,
    startDate: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });

  // Calculate spending by category for pie chart
  const spendingByCategory = useMemo(() => {
    if (!transactions?.transactions) return [];
    
    const categoryTotals: Record<string, number> = {};
    transactions.transactions
      .filter((t: any) => t.type === 'expense')
      .forEach((t: any) => {
        const category = t.category || 'Uncategorized';
        categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(t.amount);
      });
    
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 categories
  }, [transactions]);

  // Calculate monthly trend data
  const monthlyTrend = useMemo(() => {
    if (!transactions?.transactions) return [];
    
    const monthlyData: Record<string, { income: number; expenses: number }> = {};
    
    transactions.transactions.forEach((t: any) => {
      const month = format(new Date(t.date), 'yyyy-MM');
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expenses: 0 };
      }
      
      if (t.type === 'income') {
        monthlyData[month].income += t.amount;
      } else if (t.type === 'expense') {
        monthlyData[month].expenses += Math.abs(t.amount);
      }
    });
    
    return Object.entries(monthlyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  // Calculate budget vs actual (mock data for now)
  const budgetData = [
    { category: 'Operations', budget: 5000, actual: 4200 },
    { category: 'Programs', budget: 8000, actual: 7500 },
    { category: 'Administration', budget: 3000, actual: 3200 },
    { category: 'Facility', budget: 2000, actual: 1800 },
  ];

  // Calculate month-over-month change
  const monthlyChange = useMemo(() => {
    if (!transactions?.transactions) return 0;
    
    const currentMonth = format(new Date(), 'yyyy-MM');
    const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM');
    
    const currentTotal = transactions.transactions
      .filter((t: any) => format(new Date(t.date), 'yyyy-MM') === currentMonth && t.type === 'expense')
      .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
    
    const lastTotal = transactions.transactions
      .filter((t: any) => format(new Date(t.date), 'yyyy-MM') === lastMonth && t.type === 'expense')
      .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
    
    if (lastTotal === 0) return 0;
    return ((currentTotal - lastTotal) / lastTotal) * 100;
  }, [transactions]);

  if (balancesLoading || transactionsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (balancesError) {
    return (
      <Alert 
        severity="error" 
        sx={{ mt: 2 }}
        action={
          <Button color="inherit" size="small" onClick={() => {
            refetchBalances();
            refetchTransactions();
          }}>
            Retry
          </Button>
        }
      >
        Failed to load dashboard data. Please try again.
      </Alert>
    );
  }

  const summaryCards = [
    {
      title: 'Cash Balance',
      value: balances?.cash || 0,
      icon: <AttachMoney />,
      color: '#4caf50',
      subtitle: 'Available in cash',
    },
    {
      title: 'Bank Balance',
      value: balances?.bank || 0,
      icon: <AccountBalance />,
      color: '#2196f3',
      subtitle: 'Available in bank',
    },
    {
      title: 'Total Balance',
      value: (balances?.cash || 0) + (balances?.bank || 0),
      icon: <TrendingUp />,
      color: '#667eea',
      subtitle: 'Combined total',
    },
    {
      title: 'This Month',
      value: balances?.monthlyTotal || 0,
      icon: <Receipt />,
      color: monthlyChange >= 0 ? '#f44336' : '#4caf50',
      trend: {
        value: monthlyChange,
        label: 'vs last month'
      },
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Dashboard</Typography>
        <Button
          startIcon={<Refresh />}
          onClick={() => {
            refetchBalances();
            refetchTransactions();
          }}
        >
          Refresh
        </Button>
      </Box>
      
      {/* Summary Cards */}
      <Box 
        sx={{ 
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 3,
          mb: 3
        }}
      >
        {summaryCards.map((card, index) => (
          <SummaryCard key={index} {...card} />
        ))}
      </Box>

      {/* Charts Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3, mb: 3 }}>
        <SpendingPieChart 
          data={spendingByCategory}
          title="Spending by Category"
          height={350}
        />
        <BudgetChart 
          data={budgetData}
          title="Budget vs Actual"
          height={350}
        />
      </Box>

      {/* Trend Chart */}
      <Box sx={{ mb: 3 }}>
        <TrendLineChart
          data={monthlyTrend}
          title="Income vs Expenses Trend (6 Months)"
          height={350}
          type="area"
        />
      </Box>

      {/* Recent Transactions Table */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Recent Transactions</Typography>
          <Button
            size="small"
            endIcon={<Visibility />}
            onClick={() => navigate('/expenses')}
          >
            View All
          </Button>
        </Box>
        
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions?.transactions?.slice(0, 10).map((transaction: any) => (
                <TableRow key={transaction.id} hover>
                  <TableCell>
                    {format(new Date(transaction.date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell>
                    <Chip 
                      label={transaction.category || 'Uncategorized'} 
                      size="small" 
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={transaction.type}
                      size="small"
                      color={transaction.type === 'income' ? 'success' : 'error'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell 
                    align="right"
                    sx={{
                      color: transaction.type === 'income' ? 'success.main' : 'error.main',
                      fontWeight: 500,
                    }}
                  >
                    €{Math.abs(transaction.amount).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {(!transactions?.transactions || transactions.transactions.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="textSecondary">
                      No transactions found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default Dashboard;