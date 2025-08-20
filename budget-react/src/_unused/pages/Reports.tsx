import React, { useState, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Menu,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
  FormControlLabel,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  PictureAsPdf,
  TableChart,
  FilterList,
  Print,
  Assessment,
  TrendingUp,
  TrendingDown,
  AccountBalance,
  ShowChart,
  BarChart as BarChartIcon,
  FileDownload,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { useGetTransactionsQuery, useGetCategoriesQuery, useGetBudgetQuery } from '../store/api/apiSlice';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import SpendingPieChart from '../components/charts/SpendingPieChart';
import TrendLineChart from '../components/charts/TrendLineChart';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`report-tabpanel-${index}`}
      aria-labelledby={`report-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const Reports: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [reportType, setReportType] = useState('monthly');
  const [startDate, setStartDate] = useState<Date | null>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(endOfMonth(new Date()));
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [includeCharts, setIncludeCharts] = useState({
    budget: true,
    trend: true,
    category: true,
  });
  
  const reportRef = useRef<HTMLDivElement>(null);

  // Fetch data
  const { data: categories } = useGetCategoriesQuery({});
  const { data: budget } = useGetBudgetQuery({});
  const { 
    data: transactions, 
    isLoading,
    error 
  } = useGetTransactionsQuery({
    startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
    endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
    limit: 1000,
  });

  // Handle report type change
  const handleReportTypeChange = (type: string) => {
    setReportType(type);
    const now = new Date();
    
    switch(type) {
      case 'monthly':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
        const quarterEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        setStartDate(quarterStart);
        setEndDate(quarterEnd);
        break;
      case 'annual':
        setStartDate(startOfYear(now));
        setEndDate(new Date(now.getFullYear(), 11, 31));
        break;
      case 'custom':
        // Keep current dates
        break;
    }
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (!transactions?.transactions) return [];
    
    return transactions.transactions.filter((t: any) => {
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
      if (selectedType !== 'all' && t.type !== selectedType) return false;
      return true;
    });
  }, [transactions, selectedCategory, selectedType]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalIncome = filteredTransactions
      .filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
    
    const totalExpenses = filteredTransactions
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
    
    const netIncome = totalIncome - totalExpenses;
    
    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    filteredTransactions
      .filter((t: any) => t.type === 'expense')
      .forEach((t: any) => {
        const cat = t.category || 'Uncategorized';
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + Math.abs(t.amount);
      });
    
    // Top categories
    const topCategories = Object.entries(categoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    // Budget utilization
    let budgetUtilization = 0;
    let totalBudget = 0;
    if (budget?.data) {
      Object.values(budget.data).forEach((b: any) => {
        totalBudget += b.amount || 0;
      });
      budgetUtilization = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;
    }
    
    return {
      totalIncome,
      totalExpenses,
      netIncome,
      transactionCount: filteredTransactions.length,
      avgTransaction: filteredTransactions.length > 0 
        ? totalExpenses / filteredTransactions.filter((t: any) => t.type === 'expense').length 
        : 0,
      categoryBreakdown,
      topCategories,
      budgetUtilization,
      totalBudget,
    };
  }, [filteredTransactions, budget]);

  // Export handlers
  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        logging: false,
        useCORS: true,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight) * 0.95;
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 15;
      
      // Add title
      pdf.setFontSize(20);
      pdf.text('Financial Report', pdfWidth / 2, 10, { align: 'center' });
      
      // Add date range
      pdf.setFontSize(12);
      const dateRange = `${format(startDate || new Date(), 'MMM dd, yyyy')} - ${format(endDate || new Date(), 'MMM dd, yyyy')}`;
      pdf.text(dateRange, pdfWidth / 2, 20, { align: 'center' });
      
      // Add report content
      pdf.addImage(imgData, 'PNG', imgX, imgY + 10, imgWidth * ratio, imgHeight * ratio);
      
      // Save PDF
      pdf.save(`report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  const handleExportExcel = () => {
    const data = filteredTransactions.map((t: any) => ({
      Date: format(new Date(t.date), 'yyyy-MM-dd'),
      Description: t.description,
      Category: t.category,
      Subcategory: t.subcategory || '',
      Type: t.type,
      Amount: Math.abs(t.amount),
      'Payment Method': t.payment_method || 'Cash',
      Notes: t.notes || '',
    }));
    
    exportToExcel(data, `report_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportCSV = () => {
    exportToCSV(filteredTransactions, `report_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handlePrint = () => {
    window.print();
  };

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
        Failed to load report data. Please try again.
      </Alert>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">
            Reports & Analytics
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<FilterList />}
              onClick={() => setConfigDialogOpen(true)}
            >
              Configure
            </Button>
            <Button
              variant="contained"
              startIcon={<Assessment />}
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            >
              Generate Report
            </Button>
          </Box>
        </Box>

        {/* Report Configuration */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Report Type</InputLabel>
              <Select
                value={reportType}
                onChange={(e) => handleReportTypeChange(e.target.value)}
                label="Report Type"
              >
                <MenuItem value="monthly">Monthly Summary</MenuItem>
                <MenuItem value="quarterly">Quarterly Report</MenuItem>
                <MenuItem value="annual">Annual Report</MenuItem>
                <MenuItem value="custom">Custom Period</MenuItem>
              </Select>
            </FormControl>

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

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                label="Type"
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="income">Income</MenuItem>
                <MenuItem value="expense">Expenses</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Paper>

        {/* Report Content */}
        <div ref={reportRef}>
          {/* Summary Cards */}
          <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap={2} mb={3}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Total Expenses
                    </Typography>
                    <Typography variant="h5" color="error">
                      €{statistics.totalExpenses.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {statistics.transactionCount} transactions
                    </Typography>
                  </Box>
                  <TrendingDown sx={{ fontSize: 40, color: 'error.main' }} />
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Total Income
                    </Typography>
                    <Typography variant="h5" color="success.main">
                      €{statistics.totalIncome.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Net: €{statistics.netIncome.toLocaleString()}
                    </Typography>
                  </Box>
                  <TrendingUp sx={{ fontSize: 40, color: 'success.main' }} />
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Budget Utilization
                    </Typography>
                    <Typography variant="h5">
                      {statistics.budgetUtilization.toFixed(0)}%
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      of €{statistics.totalBudget.toLocaleString()}
                    </Typography>
                  </Box>
                  <ShowChart sx={{ fontSize: 40, color: 'primary.main' }} />
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Average Expense
                    </Typography>
                    <Typography variant="h5">
                      €{statistics.avgTransaction.toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      per transaction
                    </Typography>
                  </Box>
                  <AccountBalance sx={{ fontSize: 40, color: 'info.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Tabs for different views */}
          <Paper>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab label="Summary" icon={<Assessment />} iconPosition="start" />
              <Tab label="Detailed Transactions" icon={<TableChart />} iconPosition="start" />
              <Tab label="Charts & Analytics" icon={<BarChartIcon />} iconPosition="start" />
            </Tabs>

            {/* Summary Tab */}
            <TabPanel value={tabValue} index={0}>
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Top Spending Categories
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Category</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell align="right">%</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {statistics.topCategories.map(([category, amount]) => (
                          <TableRow key={category}>
                            <TableCell>{category}</TableCell>
                            <TableCell align="right">€{amount.toLocaleString()}</TableCell>
                            <TableCell align="right">
                              {((amount / statistics.totalExpenses) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                <Box>
                  <Typography variant="h6" gutterBottom>
                    Financial Summary
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>Total Income</TableCell>
                        <TableCell align="right">
                          <Typography color="success.main">
                            €{statistics.totalIncome.toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Total Expenses</TableCell>
                        <TableCell align="right">
                          <Typography color="error">
                            €{statistics.totalExpenses.toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Net Income</strong></TableCell>
                        <TableCell align="right">
                          <Typography 
                            color={statistics.netIncome >= 0 ? 'success.main' : 'error'}
                            fontWeight="bold"
                          >
                            €{statistics.netIncome.toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              </Box>
            </TabPanel>

            {/* Detailed Transactions Tab */}
            <TabPanel value={tabValue} index={1}>
              <TableContainer>
                <Table>
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
                    {filteredTransactions
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((transaction: any) => (
                        <TableRow key={transaction.id}>
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
                          <TableCell align="right">
                            <Typography 
                              color={transaction.type === 'income' ? 'success.main' : 'error'}
                            >
                              €{Math.abs(transaction.amount).toLocaleString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  component="div"
                  count={filteredTransactions.length}
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

            {/* Charts Tab */}
            <TabPanel value={tabValue} index={2}>
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3}>
                {includeCharts.category && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Category Breakdown
                    </Typography>
                    <SpendingPieChart data={
                      Object.entries(statistics.categoryBreakdown).map(([name, value]) => ({
                        name,
                        value
                      }))
                    } />
                  </Box>
                )}
                
                {includeCharts.trend && (
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Typography variant="h6" gutterBottom>
                      Spending Trend
                    </Typography>
                    <TrendLineChart data={[]} />
                  </Box>
                )}
              </Box>
            </TabPanel>
          </Paper>
        </div>

        {/* Export Menu */}
        <Menu
          anchorEl={exportMenuAnchor}
          open={Boolean(exportMenuAnchor)}
          onClose={() => setExportMenuAnchor(null)}
        >
          <MenuItem onClick={() => { handleExportPDF(); setExportMenuAnchor(null); }}>
            <PictureAsPdf sx={{ mr: 1 }} />
            Export as PDF
          </MenuItem>
          <MenuItem onClick={() => { handleExportExcel(); setExportMenuAnchor(null); }}>
            <TableChart sx={{ mr: 1 }} />
            Export as Excel
          </MenuItem>
          <MenuItem onClick={() => { handleExportCSV(); setExportMenuAnchor(null); }}>
            <FileDownload sx={{ mr: 1 }} />
            Export as CSV
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { handlePrint(); setExportMenuAnchor(null); }}>
            <Print sx={{ mr: 1 }} />
            Print Report
          </MenuItem>
        </Menu>

        {/* Configuration Dialog */}
        <Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)}>
          <DialogTitle>Report Configuration</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Include Charts
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeCharts.budget}
                    onChange={(e) => setIncludeCharts({ ...includeCharts, budget: e.target.checked })}
                  />
                }
                label="Budget vs Actual"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeCharts.trend}
                    onChange={(e) => setIncludeCharts({ ...includeCharts, trend: e.target.checked })}
                  />
                }
                label="Spending Trends"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeCharts.category}
                    onChange={(e) => setIncludeCharts({ ...includeCharts, category: e.target.checked })}
                  />
                }
                label="Category Breakdown"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfigDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Reports;