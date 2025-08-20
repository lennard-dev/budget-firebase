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
  TablePagination,
  TextField,
  InputAdornment,
  Chip,
  Checkbox,
  Menu,
  MenuItem,
  Tooltip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add,
  Search,
  FilterList,
  Delete,
  Edit,
  Receipt,
  MoreVert,
  Block,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { 
  useGetTransactionsQuery, 
  useDeleteTransactionMutation,
  useGetCategoriesQuery 
} from '../store/api/apiSlice';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { exportToCSV } from '../utils/exportUtils';
import ExpenseModal from '../components/modals/ExpenseModal';
import VoidTransactionModal from '../components/modals/VoidTransactionModal';
import ReceiptViewer from '../components/modals/ReceiptViewer';
import BulkActions from '../components/common/BulkActions';

const Expenses: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [expenseToVoid, setExpenseToVoid] = useState<any>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionMenuExpense, setActionMenuExpense] = useState<any>(null);

  // Filter states
  const [startDate, setStartDate] = useState<Date | null>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(endOfMonth(new Date()));
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [minAmount, setMinAmount] = useState<number | ''>('');
  const [maxAmount, setMaxAmount] = useState<number | ''>('');

  // Check auth state
  const auth = useSelector((state: RootState) => state.auth);
  
  // Fetch data - skip if not authenticated
  const { data: categories } = useGetCategoriesQuery({}, {
    skip: !auth.isAuthenticated
  });
  const { 
    data: transactions, 
    isLoading, 
    error, 
    refetch 
  } = useGetTransactionsQuery({
    startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
    endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
    type: 'expense',
    limit: 1000,
  }, {
    skip: !auth.isAuthenticated
  });

  const [deleteTransaction] = useDeleteTransactionMutation();

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    if (!transactions?.transactions) return [];
    
    return transactions.transactions.filter((expense: any) => {
      // Text search
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!expense.description?.toLowerCase().includes(search) &&
            !expense.category?.toLowerCase().includes(search) &&
            !expense.subcategory?.toLowerCase().includes(search)) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && expense.category !== selectedCategory) {
        return false;
      }

      // Payment method filter
      if (selectedPaymentMethod !== 'all' && expense.payment_method !== selectedPaymentMethod) {
        return false;
      }

      // Amount range filter
      const amount = Math.abs(expense.amount);
      if (minAmount !== '' && amount < minAmount) return false;
      if (maxAmount !== '' && amount > maxAmount) return false;

      return true;
    });
  }, [transactions, searchTerm, selectedCategory, selectedPaymentMethod, minAmount, maxAmount]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = filteredExpenses.reduce((sum: number, exp: any) => sum + Math.abs(exp.amount), 0);
    const avg = filteredExpenses.length > 0 ? total / filteredExpenses.length : 0;
    const categoryTotals: Record<string, number> = {};
    
    filteredExpenses.forEach((exp: any) => {
      const cat = exp.category || 'Uncategorized';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(exp.amount);
    });

    const topCategory = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)[0];

    return {
      total,
      average: avg,
      count: filteredExpenses.length,
      topCategory: topCategory ? topCategory[0] : 'N/A',
      topCategoryAmount: topCategory ? topCategory[1] : 0,
    };
  }, [filteredExpenses]);

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = filteredExpenses
        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
        .map((exp: any) => exp.id);
      setSelectedExpenses(newSelected);
    } else {
      setSelectedExpenses([]);
    }
  };

  const handleSelectExpense = (id: string) => {
    const selectedIndex = selectedExpenses.indexOf(id);
    let newSelected: string[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedExpenses, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedExpenses.slice(1));
    } else if (selectedIndex === selectedExpenses.length - 1) {
      newSelected = newSelected.concat(selectedExpenses.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedExpenses.slice(0, selectedIndex),
        selectedExpenses.slice(selectedIndex + 1)
      );
    }

    setSelectedExpenses(newSelected);
  };

  const handleDeleteExpense = async () => {
    if (expenseToDelete) {
      try {
        await deleteTransaction(expenseToDelete).unwrap();
        setDeleteDialogOpen(false);
        setExpenseToDelete(null);
        refetch();
      } catch (error) {
        console.error('Failed to delete expense:', error);
      }
    }
  };

  const handleVoidExpense = async (reason: string, notes: string) => {
    if (expenseToVoid) {
      try {
        // TODO: Implement void API endpoint
        // For now, we'll update the transaction with voided status
        console.log('Voiding expense:', expenseToVoid.id, reason, notes);
        setVoidModalOpen(false);
        setExpenseToVoid(null);
        refetch();
      } catch (error) {
        console.error('Failed to void expense:', error);
      }
    }
  };

  const handleActionMenuOpen = (event: React.MouseEvent<HTMLElement>, expense: any) => {
    setActionMenuAnchor(event.currentTarget);
    setActionMenuExpense(expense);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
    setActionMenuExpense(null);
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        selectedExpenses.map(id => deleteTransaction(id).unwrap())
      );
      setSelectedExpenses([]);
      refetch();
    } catch (error) {
      console.error('Failed to delete expenses:', error);
    }
  };

  const handleExportSelected = () => {
    const selected = filteredExpenses.filter((exp: any) => 
      selectedExpenses.includes(exp.id)
    );
    exportToCSV(selected, 'selected_expenses');
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedPaymentMethod('all');
    setMinAmount('');
    setMaxAmount('');
    setStartDate(startOfMonth(new Date()));
    setEndDate(endOfMonth(new Date()));
  };

  const isSelected = (id: string) => selectedExpenses.indexOf(id) !== -1;

  // Show loading only while auth is loading
  if (auth.isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // Show auth error if not authenticated
  if (!auth.isAuthenticated) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Please log in to view expenses.
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load expenses. Please try again later.
      </Alert>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Expense Management</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setEditingExpense(null);
              setExpenseModalOpen(true);
            }}
          >
            Add Expense
          </Button>
        </Box>

        {/* Statistics Cards */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 2,
            mb: 3,
          }}
        >
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="textSecondary">
              Total Expenses
            </Typography>
            <Typography variant="h5">€{statistics.total.toLocaleString()}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="textSecondary">
              Average Expense
            </Typography>
            <Typography variant="h5">€{statistics.average.toFixed(2)}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="textSecondary">
              Transaction Count
            </Typography>
            <Typography variant="h5">{statistics.count}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="textSecondary">
              Top Category
            </Typography>
            <Typography variant="h6">{statistics.topCategory}</Typography>
            <Typography variant="caption" color="textSecondary">
              €{statistics.topCategoryAmount.toLocaleString()}
            </Typography>
          </Paper>
        </Box>

        {/* Search and Filters */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <TextField
              placeholder="Search expenses..."
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flex: 1, minWidth: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
            
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

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Category"
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
              startIcon={<FilterList />}
              onClick={(e) => setFilterAnchorEl(e.currentTarget)}
            >
              More Filters
            </Button>

            <Button
              variant="text"
              onClick={handleResetFilters}
            >
              Reset
            </Button>
          </Box>
        </Paper>

        {/* Bulk Actions */}
        {selectedExpenses.length > 0 && (
          <BulkActions
            selectedCount={selectedExpenses.length}
            onDelete={handleBulkDelete}
            onExport={handleExportSelected}
            onClearSelection={() => setSelectedExpenses([])}
          />
        )}

        {/* Expenses Table */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={
                        selectedExpenses.length > 0 &&
                        selectedExpenses.length < filteredExpenses.length
                      }
                      checked={
                        filteredExpenses.length > 0 &&
                        selectedExpenses.length === filteredExpenses.length
                      }
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Payment Method</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Receipt</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="textSecondary">
                        No expenses found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((expense: any) => {
                      const isItemSelected = isSelected(expense.id);
                      
                      return (
                        <TableRow
                          key={expense.id}
                          hover
                          selected={isItemSelected}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={isItemSelected}
                              onChange={() => handleSelectExpense(expense.id)}
                            />
                          </TableCell>
                          <TableCell>
                            {format(new Date(expense.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">{expense.description}</Typography>
                              {expense.subcategory && (
                                <Typography variant="caption" color="textSecondary">
                                  {expense.subcategory}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={expense.category || 'Uncategorized'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={expense.payment_method || 'Cash'}
                              size="small"
                              color={
                                expense.payment_method === 'Cash' ? 'default' :
                                expense.payment_method === 'Card' ? 'primary' : 'secondary'
                              }
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="error">
                              €{Math.abs(expense.amount).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {expense.receipt_url ? (
                              <Tooltip title="View receipt">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setViewingReceipt(expense.receipt_url);
                                    setReceiptViewerOpen(true);
                                  }}
                                >
                                  <Receipt />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Typography variant="caption" color="textSecondary">
                                No receipt
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Box display="flex" justifyContent="center" gap={1}>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingExpense(expense);
                                    setExpenseModalOpen(true);
                                  }}
                                >
                                  <Edit />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="More actions">
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleActionMenuOpen(e, expense)}
                                >
                                  <MoreVert />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredExpenses.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </TableContainer>
        </Paper>

        {/* More Filters Menu */}
        <Menu
          anchorEl={filterAnchorEl}
          open={Boolean(filterAnchorEl)}
          onClose={() => setFilterAnchorEl(null)}
        >
          <Box sx={{ p: 2, minWidth: 250 }}>
            <Typography variant="subtitle2" gutterBottom>
              Amount Range
            </Typography>
            <Box display="flex" gap={1} mb={2}>
              <TextField
                label="Min"
                type="number"
                size="small"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value ? Number(e.target.value) : '')}
              />
              <TextField
                label="Max"
                type="number"
                size="small"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value ? Number(e.target.value) : '')}
              />
            </Box>
            
            <FormControl fullWidth size="small">
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                label="Payment Method"
              >
                <MenuItem value="all">All Methods</MenuItem>
                <MenuItem value="Cash">Cash</MenuItem>
                <MenuItem value="Card">Card</MenuItem>
                <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Menu>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this expense? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDeleteExpense} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Expense Modal */}
        <ExpenseModal
          open={expenseModalOpen}
          onClose={() => {
            setExpenseModalOpen(false);
            setEditingExpense(null);
          }}
          expense={editingExpense}
          onSave={() => {
            refetch();
            setExpenseModalOpen(false);
            setEditingExpense(null);
          }}
        />

        {/* Receipt Viewer */}
        <ReceiptViewer
          open={receiptViewerOpen}
          onClose={() => {
            setReceiptViewerOpen(false);
            setViewingReceipt(null);
          }}
          receiptUrl={viewingReceipt}
        />

        {/* Action Menu */}
        <Menu
          anchorEl={actionMenuAnchor}
          open={Boolean(actionMenuAnchor)}
          onClose={handleActionMenuClose}
        >
          <MenuItem onClick={() => {
            setEditingExpense(actionMenuExpense);
            setExpenseModalOpen(true);
            handleActionMenuClose();
          }}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
          <MenuItem onClick={() => {
            setExpenseToVoid(actionMenuExpense);
            setVoidModalOpen(true);
            handleActionMenuClose();
          }}>
            <Block fontSize="small" sx={{ mr: 1 }} />
            Void
          </MenuItem>
          <MenuItem onClick={() => {
            setExpenseToDelete(actionMenuExpense?.id);
            setDeleteDialogOpen(true);
            handleActionMenuClose();
          }}>
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        </Menu>

        {/* Void Transaction Modal */}
        <VoidTransactionModal
          open={voidModalOpen}
          onClose={() => {
            setVoidModalOpen(false);
            setExpenseToVoid(null);
          }}
          transaction={expenseToVoid}
          onVoid={handleVoidExpense}
          onDelete={() => {
            setExpenseToDelete(expenseToVoid?.id);
            setDeleteDialogOpen(true);
            setVoidModalOpen(false);
            setExpenseToVoid(null);
          }}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default Expenses;