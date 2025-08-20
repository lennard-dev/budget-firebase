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
  Tabs,
  Tab,
  Card,
  CardContent,
  Menu,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  AccountBalance,
  TrendingUp,
  AttachMoney,
  LocalAtm,
  Add,
  SwapHoriz,
  Download,
  Edit,
  Delete,
  MoreVert,
  Visibility,
  CheckCircle,
  Pending,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import {
  useGetTransactionsQuery,
  useGetBalancesQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
} from '../store/api/apiSlice';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`cash-banking-tabpanel-${index}`}
      aria-labelledby={`cash-banking-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const CashBanking: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Date filters
  const [startDate, setStartDate] = useState<Date | null>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(endOfMonth(new Date()));

  // Transfer form state
  const [transferData, setTransferData] = useState({
    from: 'cash',
    to: 'bank',
    amount: '',
    description: '',
    date: new Date(),
  });

  // Expected income form state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [incomeData, setIncomeData] = useState({
    donor: '',
    amount: '',
    expectedDate: new Date(),
    description: '',
    status: 'pending',
  });

  // Check auth state
  const auth = useSelector((state: RootState) => state.auth);

  // Fetch data
  const { data: balances, isLoading: balancesLoading } = useGetBalancesQuery({}, {
    skip: !auth.isAuthenticated
  });

  const { 
    data: transactions, 
    isLoading: transactionsLoading,
    refetch 
  } = useGetTransactionsQuery({
    startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
    endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
    limit: 1000,
  }, {
    skip: !auth.isAuthenticated
  });

  // Mutations
  const [createTransaction] = useCreateTransactionMutation();
  const [updateTransaction] = useUpdateTransactionMutation();
  const [deleteTransaction] = useDeleteTransactionMutation();

  // Filter transactions by account
  const cashMovements = useMemo(() => {
    if (!transactions?.transactions) return [];
    return transactions.transactions.filter((t: any) => 
      t.account === 'cash' || t.payment_method === 'Cash'
    ).map((t: any, index: number) => ({
      ...t,
      running_balance: calculateRunningBalance('cash', index)
    }));
  }, [transactions]);

  const bankMovements = useMemo(() => {
    if (!transactions?.transactions) return [];
    return transactions.transactions.filter((t: any) => 
      t.account === 'bank' || t.payment_method === 'Card' || t.payment_method === 'Bank Transfer'
    ).map((t: any, index: number) => ({
      ...t,
      running_balance: calculateRunningBalance('bank', index)
    }));
  }, [transactions]);

  const expectedIncome = useMemo(() => {
    if (!transactions?.transactions) return [];
    return transactions.transactions.filter((t: any) => 
      t.type === 'expected_income' || t.metadata?.expected
    );
  }, [transactions]);

  // Calculate running balance (mock for now)
  const calculateRunningBalance = (account: string, index: number) => {
    // This would normally come from the ledger
    const baseBalance = account === 'cash' ? 5000 : 25000;
    return baseBalance - (index * 100); // Mock calculation
  };

  // Calculate statistics
  const statistics = useMemo(() => {
    const cashBalance = balances?.cash || 0;
    const bankBalance = balances?.bank || 0;
    const expectedTotal = expectedIncome.reduce((sum: number, t: any) => 
      sum + Math.abs(t.amount), 0
    );
    const receivedThisMonth = transactions?.transactions?.filter((t: any) => {
      if (t.type !== 'income') return false;
      const date = new Date(t.date);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0) || 0;

    return {
      cashBalance,
      bankBalance,
      expectedIncome: expectedTotal,
      receivedThisMonth,
    };
  }, [balances, transactions, expectedIncome]);

  const handleTransfer = async () => {
    try {
      // Create withdrawal transaction
      await createTransaction({
        type: 'transfer',
        account: transferData.from,
        amount: -Math.abs(parseFloat(transferData.amount)),
        description: `Transfer to ${transferData.to}`,
        date: format(transferData.date, 'yyyy-MM-dd'),
        metadata: { transfer_to: transferData.to }
      }).unwrap();

      // Create deposit transaction
      await createTransaction({
        type: 'transfer',
        account: transferData.to,
        amount: Math.abs(parseFloat(transferData.amount)),
        description: `Transfer from ${transferData.from}`,
        date: format(transferData.date, 'yyyy-MM-dd'),
        metadata: { transfer_from: transferData.from }
      }).unwrap();

      setTransferDialogOpen(false);
      setTransferData({
        from: 'cash',
        to: 'bank',
        amount: '',
        description: '',
        date: new Date(),
      });
      refetch();
    } catch (error) {
      console.error('Transfer failed:', error);
    }
  };

  const handleDeleteTransaction = async () => {
    if (selectedTransaction) {
      try {
        await deleteTransaction(selectedTransaction.id).unwrap();
        setDeleteDialogOpen(false);
        setSelectedTransaction(null);
        refetch();
      } catch (error) {
        console.error('Failed to delete transaction:', error);
      }
    }
  };

  const handleMarkIncomeReceived = async (income: any) => {
    try {
      await updateTransaction({
        id: income.id,
        status: 'received',
        metadata: { ...income.metadata, received_date: format(new Date(), 'yyyy-MM-dd') }
      }).unwrap();
      refetch();
    } catch (error) {
      console.error('Failed to mark income as received:', error);
    }
  };

  const getTransactionType = (transaction: any) => {
    if (transaction.type === 'expense') return 'Expense';
    if (transaction.type === 'income') return 'Income';
    if (transaction.type === 'transfer') return 'Transfer';
    if (transaction.type === 'deposit') return 'Deposit';
    if (transaction.type === 'withdrawal') return 'Withdrawal';
    return transaction.type;
  };

  const getTransactionColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'expense': return 'error';
      case 'income': return 'success';
      case 'transfer': return 'info';
      case 'deposit': return 'success';
      case 'withdrawal': return 'warning';
      default: return 'default';
    }
  };

  if (auth.isLoading || transactionsLoading || balancesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Please log in to view cash and banking information.
      </Alert>
    );
  }

  // const currentMovements = tabValue === 0 ? cashMovements : tabValue === 1 ? bankMovements : expectedIncome;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Cash & Banking</Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<SwapHoriz />}
              onClick={() => setTransferDialogOpen(true)}
            >
              Transfer
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                setIncomeDialogOpen(true);
                // TODO: Implement add transaction dialog
                console.log('Add transaction dialog', incomeDialogOpen, incomeData, setIncomeData);
              }}
            >
              Add Transaction
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
                      Cash Balance
                    </Typography>
                    <Typography variant="h5">
                      €{statistics.cashBalance.toLocaleString()}
                    </Typography>
                  </Box>
                  <LocalAtm color="primary" fontSize="large" />
                </Box>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Expected Income
                    </Typography>
                    <Typography variant="h5">
                      €{statistics.expectedIncome.toLocaleString()}
                    </Typography>
                  </Box>
                  <TrendingUp color="success" fontSize="large" />
                </Box>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Received This Month
                    </Typography>
                    <Typography variant="h5">
                      €{statistics.receivedThisMonth.toLocaleString()}
                    </Typography>
                  </Box>
                  <AttachMoney color="success" fontSize="large" />
                </Box>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Bank Balance
                    </Typography>
                    <Typography variant="h5">
                      €{statistics.bankBalance.toLocaleString()}
                    </Typography>
                  </Box>
                  <AccountBalance color="primary" fontSize="large" />
                </Box>
              </CardContent>
            </Card>
        </Box>

        {/* Date Filters */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box display="flex" gap={2} alignItems="center">
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
            <Button
              variant="outlined"
              startIcon={<Download />}
              sx={{ ml: 'auto' }}
            >
              Export
            </Button>
          </Box>
        </Paper>

        {/* Tabs */}
        <Paper>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="Cash Movements" />
            <Tab label="Bank Movements" />
            <Tab label="Expected Income" />
          </Tabs>

          {/* Cash Movements Tab */}
          <TabPanel value={tabValue} index={0}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Remaining Balance</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cashMovements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="textSecondary">
                          No cash movements found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    cashMovements
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((movement: any) => (
                        <TableRow key={movement.id}>
                          <TableCell>
                            {format(new Date(movement.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getTransactionType(movement)}
                              size="small"
                              color={getTransactionColor(movement.type)}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{movement.description}</TableCell>
                          <TableCell align="right">
                            <Typography
                              color={movement.amount < 0 ? 'error' : 'success'}
                            >
                              €{Math.abs(movement.amount).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            €{movement.running_balance?.toLocaleString() || '0'}
                          </TableCell>
                          <TableCell align="center">
                            <Box display="flex" justifyContent="center" gap={1}>
                              {movement.receipt_url && (
                                <Tooltip title="View receipt">
                                  <IconButton size="small">
                                    <Visibility />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  setSelectedTransaction(movement);
                                  setActionMenuAnchor(e.currentTarget);
                                }}
                              >
                                <MoreVert />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={cashMovements.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </TableContainer>
          </TabPanel>

          {/* Bank Movements Tab */}
          <TabPanel value={tabValue} index={1}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Remaining Balance</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bankMovements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="textSecondary">
                          No bank movements found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    bankMovements
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((movement: any) => (
                        <TableRow key={movement.id}>
                          <TableCell>
                            {format(new Date(movement.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getTransactionType(movement)}
                              size="small"
                              color={getTransactionColor(movement.type)}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{movement.description}</TableCell>
                          <TableCell align="right">
                            <Typography
                              color={movement.amount < 0 ? 'error' : 'success'}
                            >
                              €{Math.abs(movement.amount).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            €{movement.running_balance?.toLocaleString() || '0'}
                          </TableCell>
                          <TableCell align="center">
                            <Box display="flex" justifyContent="center" gap={1}>
                              {movement.receipt_url && (
                                <Tooltip title="View receipt">
                                  <IconButton size="small">
                                    <Visibility />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  setSelectedTransaction(movement);
                                  setActionMenuAnchor(e.currentTarget);
                                }}
                              >
                                <MoreVert />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={bankMovements.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </TableContainer>
          </TabPanel>

          {/* Expected Income Tab */}
          <TabPanel value={tabValue} index={2}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Expected Date</TableCell>
                    <TableCell>Donor/Source</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expectedIncome.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="textSecondary">
                          No expected income
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    expectedIncome
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((income: any) => (
                        <TableRow key={income.id}>
                          <TableCell>
                            {format(new Date(income.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>{income.metadata?.donor || 'Unknown'}</TableCell>
                          <TableCell>{income.description}</TableCell>
                          <TableCell align="right">
                            <Typography color="success">
                              €{Math.abs(income.amount).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={income.status === 'received' ? <CheckCircle /> : <Pending />}
                              label={income.status || 'Pending'}
                              size="small"
                              color={income.status === 'received' ? 'success' : 'warning'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Box display="flex" justifyContent="center" gap={1}>
                              {income.status !== 'received' && (
                                <Tooltip title="Mark as received">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => handleMarkIncomeReceived(income)}
                                  >
                                    <CheckCircle />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  setSelectedTransaction(income);
                                  setActionMenuAnchor(e.currentTarget);
                                }}
                              >
                                <MoreVert />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={expectedIncome.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </TableContainer>
          </TabPanel>
        </Paper>

        {/* Action Menu */}
        <Menu
          anchorEl={actionMenuAnchor}
          open={Boolean(actionMenuAnchor)}
          onClose={() => setActionMenuAnchor(null)}
        >
          <MenuItem onClick={() => {
            setEditingTransaction(selectedTransaction);
            setActionMenuAnchor(null);
            // TODO: Open edit dialog
            console.log('Edit transaction:', editingTransaction);
          }}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
          <MenuItem onClick={() => {
            setDeleteDialogOpen(true);
            setActionMenuAnchor(null);
          }}>
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        </Menu>

        {/* Transfer Dialog */}
        <Dialog open={transferDialogOpen} onClose={() => setTransferDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Transfer Between Accounts</DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={2}>
              <FormControl fullWidth>
                <InputLabel>From Account</InputLabel>
                <Select
                  value={transferData.from}
                  onChange={(e) => setTransferData({ ...transferData, from: e.target.value })}
                  label="From Account"
                >
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank">Bank</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>To Account</InputLabel>
                <Select
                  value={transferData.to}
                  onChange={(e) => setTransferData({ ...transferData, to: e.target.value })}
                  label="To Account"
                >
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank">Bank</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Amount"
                type="number"
                value={transferData.amount}
                onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                fullWidth
                InputProps={{
                  startAdornment: '€',
                }}
              />

              <DatePicker
                label="Date"
                value={transferData.date}
                onChange={(date) => setTransferData({ ...transferData, date: date || new Date() })}
                slotProps={{ textField: { fullWidth: true } }}
              />

              <TextField
                label="Description (Optional)"
                value={transferData.description}
                onChange={(e) => setTransferData({ ...transferData, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleTransfer} 
              variant="contained"
              disabled={!transferData.amount || transferData.from === transferData.to}
            >
              Transfer
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDeleteTransaction} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default CashBanking;