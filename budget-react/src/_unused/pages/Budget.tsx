import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  TrendingUp,
  TrendingDown,
  Warning,
  CheckCircle,
  ExpandMore,
  Assessment,
  AttachMoney,
  PieChart,
  Download,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import {
  useGetBudgetQuery,
  useUpdateBudgetMutation,
  useGetTransactionsQuery,
  useGetCategoriesQuery,
} from '../store/api/apiSlice';
import { PieChart as RechartsChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';

interface BudgetItem {
  id: string;
  category: string;
  subcategory?: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  notes?: string;
}

interface BudgetModalProps {
  open: boolean;
  onClose: () => void;
  item?: BudgetItem | null;
  onSave: (item: Partial<BudgetItem>) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#8DD1E1'];

const BudgetModal: React.FC<BudgetModalProps> = ({ open, onClose, item, onSave }) => {
  const [formData, setFormData] = useState<Partial<BudgetItem>>({
    category: item?.category || '',
    subcategory: item?.subcategory || '',
    amount: item?.amount || 0,
    period: item?.period || 'monthly',
    notes: item?.notes || '',
  });

  const { data: categories } = useGetCategoriesQuery({});

  const handleSubmit = () => {
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item ? 'Edit Budget Item' : 'Add Budget Item'}</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={2}>
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              label="Category"
            >
              {categories?.data?.map((cat: any) => (
                <MenuItem key={cat.id} value={cat.name}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Subcategory (Optional)"
            value={formData.subcategory}
            onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
            fullWidth
          />

          <TextField
            label="Budget Amount"
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
            fullWidth
            InputProps={{
              startAdornment: '€',
            }}
          />

          <FormControl fullWidth>
            <InputLabel>Period</InputLabel>
            <Select
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value as 'monthly' | 'quarterly' | 'yearly' })}
              label="Period"
            >
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="quarterly">Quarterly</MenuItem>
              <MenuItem value="yearly">Yearly</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Notes (Optional)"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            fullWidth
            multiline
            rows={2}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={!formData.category || !formData.amount}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const Budget: React.FC = () => {
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'comparison'>('overview');
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Date range for comparison
  const [startDate, setStartDate] = useState<Date | null>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(endOfMonth(new Date()));

  // Check auth state
  const auth = useSelector((state: RootState) => state.auth);

  // Fetch data
  const { data: budget, isLoading: budgetLoading, refetch: refetchBudget } = useGetBudgetQuery(
    { period },
    { skip: !auth.isAuthenticated }
  );

  const { data: transactions, isLoading: transactionsLoading } = useGetTransactionsQuery(
    {
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
      type: 'expense',
      limit: 1000,
    },
    { skip: !auth.isAuthenticated }
  );

  const { data: categories } = useGetCategoriesQuery({}, { skip: !auth.isAuthenticated });

  const [updateBudget] = useUpdateBudgetMutation();

  // Calculate budget vs actual
  const budgetComparison = useMemo(() => {
    if (!budget?.items || !transactions?.transactions) return [];

    const categoryTotals: Record<string, { budget: number; actual: number; items: any[] }> = {};

    // Initialize with budget data
    budget.items.forEach((item: BudgetItem) => {
      if (!categoryTotals[item.category]) {
        categoryTotals[item.category] = { budget: 0, actual: 0, items: [] };
      }
      categoryTotals[item.category].budget += item.amount;
      categoryTotals[item.category].items.push(item);
    });

    // Add actual expenses
    transactions.transactions.forEach((transaction: any) => {
      const category = transaction.category || 'Uncategorized';
      if (!categoryTotals[category]) {
        categoryTotals[category] = { budget: 0, actual: 0, items: [] };
      }
      categoryTotals[category].actual += Math.abs(transaction.amount);
    });

    return Object.entries(categoryTotals).map(([category, data]) => ({
      category,
      budget: data.budget,
      actual: data.actual,
      variance: data.budget - data.actual,
      percentUsed: data.budget > 0 ? (data.actual / data.budget) * 100 : 0,
      items: data.items,
    }));
  }, [budget, transactions]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalBudget = budgetComparison.reduce((sum, item) => sum + item.budget, 0);
    const totalActual = budgetComparison.reduce((sum, item) => sum + item.actual, 0);
    const totalVariance = totalBudget - totalActual;
    const percentUsed = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

    const overBudgetCategories = budgetComparison.filter(item => item.variance < 0).length;
    const underBudgetCategories = budgetComparison.filter(item => item.variance > 0 && item.actual > 0).length;

    return {
      totalBudget,
      totalActual,
      totalVariance,
      percentUsed,
      overBudgetCategories,
      underBudgetCategories,
    };
  }, [budgetComparison]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return budgetComparison
      .filter(item => item.actual > 0)
      .map(item => ({
        name: item.category,
        value: item.actual,
      }));
  }, [budgetComparison]);

  const handleSaveBudgetItem = async (item: Partial<BudgetItem>) => {
    try {
      const updatedItems = editingItem
        ? budget.items.map((i: BudgetItem) => 
            i.id === editingItem.id ? { ...i, ...item } : i
          )
        : [...(budget?.items || []), { ...item, id: Date.now().toString() }];

      await updateBudget({
        period,
        items: updatedItems,
      }).unwrap();

      refetchBudget();
      setBudgetModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to update budget:', error);
    }
  };

  const handleDeleteBudgetItem = async (id: string) => {
    try {
      const updatedItems = budget.items.filter((i: BudgetItem) => i.id !== id);
      await updateBudget({
        period,
        items: updatedItems,
      }).unwrap();
      refetchBudget();
    } catch (error) {
      console.error('Failed to delete budget item:', error);
    }
  };

  const getStatusColor = (percentUsed: number) => {
    if (percentUsed >= 100) return 'error';
    if (percentUsed >= 80) return 'warning';
    if (percentUsed >= 50) return 'info';
    return 'success';
  };

  const getStatusIcon = (percentUsed: number) => {
    if (percentUsed >= 100) return <Warning color="error" />;
    if (percentUsed >= 80) return <TrendingUp color="warning" />;
    return <CheckCircle color="success" />;
  };

  if (auth.isLoading || budgetLoading || transactionsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Please log in to view budget information.
      </Alert>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Budget Management</Typography>
          <Box display="flex" gap={2}>
            <ToggleButtonGroup
              value={period}
              exclusive
              onChange={(_, value) => value && setPeriod(value)}
              size="small"
            >
              <ToggleButton value="monthly">Monthly</ToggleButton>
              <ToggleButton value="quarterly">Quarterly</ToggleButton>
              <ToggleButton value="yearly">Yearly</ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                setEditingItem(null);
                setBudgetModalOpen(true);
              }}
            >
              Add Budget Item
            </Button>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 3,
            mb: 3,
          }}
        >
          <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Total Budget
                    </Typography>
                    <Typography variant="h5">
                      €{summary.totalBudget.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {period} budget
                    </Typography>
                  </Box>
                  <AttachMoney color="primary" fontSize="large" />
                </Box>
              </CardContent>
            </Card>

          <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Actual Spending
                    </Typography>
                    <Typography variant="h5">
                      €{summary.totalActual.toLocaleString()}
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={Math.min(summary.percentUsed, 100)}
                      color={getStatusColor(summary.percentUsed)}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  <Assessment color="info" fontSize="large" />
                </Box>
              </CardContent>
            </Card>

          <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Remaining
                    </Typography>
                    <Typography 
                      variant="h5"
                      color={summary.totalVariance >= 0 ? 'success.main' : 'error.main'}
                    >
                      €{Math.abs(summary.totalVariance).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {summary.totalVariance >= 0 ? 'Under budget' : 'Over budget'}
                    </Typography>
                  </Box>
                  {summary.totalVariance >= 0 ? 
                    <TrendingDown color="success" fontSize="large" /> :
                    <TrendingUp color="error" fontSize="large" />
                  }
                </Box>
              </CardContent>
            </Card>

          <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Categories Status
                    </Typography>
                    <Box display="flex" gap={1} mt={1}>
                      <Chip 
                        label={`${summary.overBudgetCategories} over`}
                        size="small"
                        color="error"
                        variant="outlined"
                      />
                      <Chip 
                        label={`${summary.underBudgetCategories} under`}
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                  <PieChart color="primary" fontSize="large" />
                </Box>
              </CardContent>
            </Card>
        </Box>

        {/* View Mode Tabs */}
        <Paper sx={{ mb: 2 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, value) => value && setViewMode(value)}
              sx={{ p: 1 }}
            >
              <ToggleButton value="overview">Overview</ToggleButton>
              <ToggleButton value="detailed">Detailed</ToggleButton>
              <ToggleButton value="comparison">Comparison</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Overview View */}
          {viewMode === 'overview' && (
            <Box p={3}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Budget by Category
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Category</TableCell>
                          <TableCell align="right">Budget</TableCell>
                          <TableCell align="right">Actual</TableCell>
                          <TableCell align="right">Variance</TableCell>
                          <TableCell>Progress</TableCell>
                          <TableCell align="center">Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {budgetComparison.map((item) => (
                          <TableRow key={item.category}>
                            <TableCell>{item.category}</TableCell>
                            <TableCell align="right">
                              €{item.budget.toLocaleString()}
                            </TableCell>
                            <TableCell align="right">
                              €{item.actual.toLocaleString()}
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                color={item.variance >= 0 ? 'success.main' : 'error.main'}
                              >
                                €{Math.abs(item.variance).toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(item.percentUsed, 100)}
                                  color={getStatusColor(item.percentUsed)}
                                  sx={{ flex: 1, minWidth: 100 }}
                                />
                                <Typography variant="caption">
                                  {Math.round(item.percentUsed)}%
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              {getStatusIcon(item.percentUsed)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                <Box>
                  <Typography variant="h6" gutterBottom>
                    Spending Distribution
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </RechartsChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            </Box>
          )}

          {/* Detailed View */}
          {viewMode === 'detailed' && (
            <Box p={3}>
              {categories?.data?.map((category: any) => {
                const categoryData = budgetComparison.find(item => item.category === category.name);
                const categoryItems = budget?.items?.filter((item: BudgetItem) => item.category === category.name) || [];
                
                if (categoryItems.length === 0) return null;

                return (
                  <Accordion key={category.id}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                        <Typography>{category.name}</Typography>
                        <Box display="flex" gap={2} mr={2}>
                          <Chip
                            label={`€${categoryData?.budget.toLocaleString() || 0}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          <Chip
                            label={`${Math.round(categoryData?.percentUsed || 0)}%`}
                            size="small"
                            color={getStatusColor(categoryData?.percentUsed || 0)}
                          />
                        </Box>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Subcategory</TableCell>
                              <TableCell align="right">Budget</TableCell>
                              <TableCell>Period</TableCell>
                              <TableCell>Notes</TableCell>
                              <TableCell align="center">Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {categoryItems.map((item: BudgetItem) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.subcategory || '-'}</TableCell>
                                <TableCell align="right">€{item.amount.toLocaleString()}</TableCell>
                                <TableCell>{item.period}</TableCell>
                                <TableCell>{item.notes || '-'}</TableCell>
                                <TableCell align="center">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setEditingItem(item);
                                      setBudgetModalOpen(true);
                                    }}
                                  >
                                    <Edit />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteBudgetItem(item.id)}
                                  >
                                    <Delete />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Box>
          )}

          {/* Comparison View */}
          {viewMode === 'comparison' && (
            <Box p={3}>
              <Box display="flex" gap={2} mb={3}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={setStartDate}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Category Filter</InputLabel>
                  <Select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    label="Category Filter"
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    {categories?.data?.map((cat: any) => (
                      <MenuItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  sx={{ ml: 'auto' }}
                >
                  Export Report
                </Button>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
                {budgetComparison
                  .filter(item => selectedCategory === 'all' || item.category === selectedCategory)
                  .map((item) => (
                    <Card key={item.category}>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {item.category}
                          </Typography>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2" color="textSecondary">
                              Budget
                            </Typography>
                            <Typography variant="body2">
                              €{item.budget.toLocaleString()}
                            </Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2" color="textSecondary">
                              Actual
                            </Typography>
                            <Typography variant="body2">
                              €{item.actual.toLocaleString()}
                            </Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between" mb={2}>
                            <Typography variant="body2" color="textSecondary">
                              Variance
                            </Typography>
                            <Typography 
                              variant="body2"
                              color={item.variance >= 0 ? 'success.main' : 'error.main'}
                            >
                              €{Math.abs(item.variance).toLocaleString()}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(item.percentUsed, 100)}
                            color={getStatusColor(item.percentUsed)}
                          />
                          <Box display="flex" justifyContent="space-between" mt={1}>
                            <Typography variant="caption" color="textSecondary">
                              {Math.round(item.percentUsed)}% used
                            </Typography>
                            {getStatusIcon(item.percentUsed)}
                          </Box>
                        </CardContent>
                      </Card>
                  ))}
              </Box>
            </Box>
          )}
        </Paper>

        {/* Budget Modal */}
        <BudgetModal
          open={budgetModalOpen}
          onClose={() => {
            setBudgetModalOpen(false);
            setEditingItem(null);
          }}
          item={editingItem}
          onSave={handleSaveBudgetItem}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default Budget;